import { test, expect } from "@playwright/test";
import { setup } from "./fixtures/pdf-project";
import { readingDimensions } from "../src/lib/reading-quality";
import { mkdirSync } from "node:fs";
test("合成五篇流程：校对、单节重试保留其余、结论支持状态与原PDF链接、只带3篇进脉络且刷新保留", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setup(page);
  await page.getByRole("button", { name: "批量校对书目", exact: true }).click();
  for (let i = 0; i < 5; i++) {
    await page
      .getByLabel(`p${i}-title`, { exact: true })
      .fill(`合成验收文献题名${i}`);
    await page.getByLabel(`p${i}-authors`, { exact: true }).fill("测试作者");
    await page.getByLabel(`p${i}-year`, { exact: true }).fill("2024");
    await page.getByLabel(`p${i}-venue`, { exact: true }).fill("合成测试来源");
  }
  await page.getByRole("button", { name: "确认并保存本项目全部书目" }).click();
  const requests: {
    readingTargets?: string[];
    evidence: { id: string; pages: { page: number; text: string }[] }[];
  }[] = [];
  let retryNeeded = true;
  await page.route("**/api/workflow", async (route) => {
    const input = route.request().postDataJSON();
    requests.push(input);
    const id = input.evidence[0].id;
    const e = input.evidence[0].pages;
    const quote = e[0].text;
    const sections = (input.readingTargets ?? readingDimensions)
      .filter(
        (title: string) =>
          !(retryNeeded && id === "p1" && title === "理论与核心概念"),
      )
      .map((title: string) => ({
        title,
        body:
          title === "关键发现与结论"
            ? "这份合成材料中的关系未获支持，不代表真实论文。"
            : "合成测试核心说明，非真实论文结论。",
        evidenceIds: [id],
        quote,
        page: e[0].page,
        uncertainty: "本地合成验收，非真实DeepSeek",
        evidenceStatus: "verified",
        ...(title === "关键发现与结论"
          ? {
              findings: [
                {
                  question: "合成关系得到支持吗？",
                  conclusion: "测试关系未支持，不能证明完全没有效应。",
                  support: "not-supported",
                  quote: e[2].text,
                  page: 3,
                },
              ],
            }
          : {}),
      }));
    if (retryNeeded && id === "p1") {
      sections.splice(2, 0, {
        title: "理论与核心概念",
        body: "暂无可靠依据，待核实。",
        evidenceIds: [id],
        quote: "",
        page: null,
        uncertainty: "缺节",
        evidenceStatus: "insufficient",
        issue: {
          code: "MISSING_SECTION",
          message: "AI未返回此板块，其他有效板块已保留。",
        },
      });
      retryNeeded = false;
    }
    await route.fulfill({ json: { sections, notices: [] } });
  });
  await page
    .getByRole("button", { name: "文献精析", exact: true })
    .first()
    .click();
  for (let i = 0; i < 3; i++) {
    await page
      .getByLabel("选择精析文献", { exact: true })
      .selectOption(`p${i}`);
    await page.getByRole("button", { name: "一键精析", exact: true }).click();
    await expect(page.locator(".study-section")).toHaveCount(7);
    if (i === 1) {
      await page
        .getByRole("button", {
          name: "只重试本节：理论与核心概念",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("button", {
          name: "只重试本节：理论与核心概念",
          exact: true,
        }),
      ).toHaveCount(0);
    }
    await expect(
      page.locator(".study-section").filter({
        has: page.getByRole("heading", {
          name: "关键发现与结论",
          exact: true,
        }),
      }),
    ).toContainText("未支持 / 无显著性");
  }
  expect(requests).toHaveLength(4);
  expect(requests[2].readingTargets).toEqual(["理论与核心概念"]);
  const findings = page.locator(".reading-findings");
  await findings.getByText("核对原文 · PDF 第 3 页", { exact: true }).click();
  await expect(
    findings.getByRole("link", { name: "打开原 PDF 第 3 页 ↗" }),
  ).toHaveAttribute("href", /^blob:.*#page=3$/);
  mkdirSync("docs/screenshots/pdf-repair", { recursive: true });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: "docs/screenshots/pdf-repair/reading-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/pdf-repair/reading-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  const before = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("paperi.projects.v1")!).projects[0]
        .workflow.analyses,
  );
  expect(before).toHaveLength(5);
  expect(before[2].sections[0]).toEqual(before[3].sections[0]);
  await page.reload();
  await page
    .getByRole("button", { name: "文献精析", exact: true })
    .first()
    .click();
  await expect(page.getByText(/当前 3 篇已校对书目/)).toBeVisible();
  const body = page.waitForRequest(
    (r) => r.url().includes("/api/research-journey") && r.method() === "POST",
  );
  await page.route("**/api/research-journey", (route) =>
    route.fulfill({
      json: {
        sections: [
          "总体研究什么",
          "理论、主题与方法分组",
          "已有发现、分歧与限制",
          "可继续探索的切入口",
        ].map((title, i) => ({
          title,
          body:
            i === 3
              ? "拟研究的切口，尚待验证。"
              : "仅对照合成测试材料，不是真实论文比较。",
          evidenceIds: ["p0", "p1", "p2"],
          quote: "",
          page: null,
          uncertainty: "合成测试",
          evidenceStatus: i === 3 ? "proposal" : "insufficient",
        })),
      },
    }),
  );
  await page
    .getByRole("button", { name: "带着通过检查的文献去梳理研究脉络" })
    .click();
  await expect(page).toHaveURL(/\/research/);
  await page.getByRole("button", { name: "梳理这些文献", exact: true }).click();
  const input = (await body).postDataJSON();
  expect(input.context.evidence.map((e: { id: string }) => e.id)).toEqual([
    "p0",
    "p1",
    "p2",
  ]);
  expect(
    input.context.evidence[0].reading.find(
      (s: { title: string }) => s.title === "关键发现与结论",
    ).findings[0].support,
  ).toBe("not-supported");
  await page.reload();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("paperi.projects.v1")!).projects[0],
  );
  expect(saved.library.items).toHaveLength(5);
  expect(saved.workflow.selection).toEqual(["p0", "p1", "p2"]);
});
