import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { emptyWorkflow } from "../src/lib/workflow";
const key = "paperi.projects.v1";
async function begin(page: Page) {
  await page.route("**/api/lab", (r) => {
    if (r.request().method() === "GET")
      return r.fulfill({
        json: { configured: true, message: "模拟模型连接，不是真实 AI" },
      });
    const b = r.request().postDataJSON();
    return r.fulfill({
      json: {
        reply: "这是测试夹具中的解释，非真实学术建议。",
        directions: [],
        guide: {
          stage: b.stage,
          understanding: "仅交互测试",
          concepts: Array.from({ length: 10 }, (_, i) => ({
            term: `测试视角${i + 1}`,
            explanation: "用大白话解释测试视角",
            everyday: "相近概念边界待核对",
            uncertainty: "候选待查",
            group: i < 5 ? "心理" : "传播",
            relevance: "与测试观察有关",
          })),
          keywords: { zh: ["测试视角"], en: ["fixture perspective"] },
          threads: [],
        },
      },
    });
  });
  await page.route("**/api/research", (r) =>
    r.fulfill({
      json: {
        zh: ["测试视角"],
        en: ["fixture perspective"],
        synonyms: ["测试扩展"],
        expressions: ["测试视角 消费", "fixture perspective consumer"],
      },
    }),
  );
  await page.goto("/");
  await page
    .getByLabel("写下你的日常观察")
    .fill("为什么有些品牌联名反而让消费者反感？");
  await page.getByRole("button", { name: "开始探索", exact: true }).click();
  await expect(page.locator(".chat-assistant")).toHaveCount(1);
  await page.getByRole("link", { name: "进入概念锚定" }).click();
  await expect(page).toHaveURL("/concepts");
  await expect(page.locator(".concept-card")).toHaveCount(10);
}
test("核心路径（AI明确模拟）：原话、十概念、双语检索词、混合导入、七维精析到独立研究脉络", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await begin(page);
  await page
    .getByRole("button", { name: "选择概念", exact: true })
    .nth(0)
    .click();
  await page
    .getByRole("button", { name: "选择概念", exact: true })
    .nth(0)
    .click();
  await expect(
    page.getByRole("link", { name: "前往深圳大学图书馆" }),
  ).toHaveCount(1);
  await page.getByText("高级检索词（可选）", { exact: true }).click();
  await expect(page.getByLabel("已有检索词")).toContainText(
    "fixture perspective",
  );
  const library = page
    .getByRole("link", { name: "前往深圳大学图书馆" })
    .first();
  await expect(library).toHaveAttribute("href", "https://www.lib.szu.edu.cn/");
  await expect(library).toHaveAttribute("target", "_blank");
  await page.getByRole("link", { name: "进入文献工作台" }).click();
  await page
    .getByLabel("选择题录或 PDF 文件")
    .setInputFiles([
      "tests/fixtures/workflow/publisher-records.ris",
      "tests/fixtures/workflow/readable.pdf",
    ]);
  await expect(page.getByText("导入预览：4 篇可编辑，0 条失败")).toBeVisible();
  await page.getByRole("button", { name: "导入这 4 篇" }).click();
  await expect(page.locator(".paper-card")).toHaveCount(4);
  let receivedPDF = false;
  await page.route("**/api/workflow", (r) => {
    const b = r.request().postDataJSON(),
      id = b.evidence[0].id;
    receivedPDF ||= b.evidence.some(
      (e: { pages: unknown[] }) => e.pages.length > 0,
    );
    const section = (title: string) => ({
      title,
      body: "本地模拟分析，非真实论文结论。",
      evidenceIds: [id],
      quote: b.evidence[0].pages[0]?.text || b.evidence[0].paper.abstract || "",
      page: b.evidence[0].pages[0]?.page ?? null,
      uncertainty: "明确模拟，仅验证数据流",
    });
    return r.fulfill({
      json: {
        sections: [
          "30 秒读懂",
          "研究问题与动机",
          "理论与核心概念",
          "研究方法与过程",
          "关键发现与结论",
          "局限与研究启发",
          "对当前项目的价值",
        ].map(section),
      },
    });
  });
  await page
    .getByRole("button", { name: "文献精析", exact: true })
    .first()
    .click();
  await page.getByLabel("选择精析文献").selectOption({ index: 3 });
  await page.getByRole("button", { name: "一键精析", exact: true }).click();
  await expect(page.locator(".study-section")).toHaveCount(7);
  expect(receivedPDF).toBe(true);
  let journeyCalls = 0;
  await page.route("**/api/research-journey", (route) => {
    journeyCalls++;
    return route.fulfill({
      status: 500,
      json: { error: "本测试仅验收衔接，不应自动发起研究请求" },
    });
  });
  await page.getByRole("link", { name: "进入研究脉络，手动选择资料" }).click();
  await expect(page).toHaveURL("/research");
  await expect(page.locator(".rj-evidence-status li")).toHaveCount(4);
  await expect(page.locator(".rj-context")).toContainText("已有精析");
  await expect(
    page.getByRole("button", { name: "梳理这些文献", exact: true }),
  ).toBeEnabled();
  expect(journeyCalls).toBe(0);
  const id = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).activeId,
    key,
  );
  await page.goto("/lab");
  await expect(page.locator(".chat-user").first()).toContainText(
    "为什么有些品牌联名反而让消费者反感？",
  );
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).activeId,
      key,
    ),
  ).toBe(id);
});
test("多个PDF可选并保存；旧页面重定向，旧研究数据/PDF副本删除保护仍在", async ({
  page,
}) => {
  await begin(page);
  await page.goto("/literature");
  const buffer = readFileSync("tests/fixtures/workflow/readable.pdf");
  await page.getByLabel("选择题录或 PDF 文件").setInputFiles(
    [1, 2, 3].map((i) => ({
      name: `synthetic-${i}.pdf`,
      mimeType: "application/pdf",
      buffer,
    })),
  );
  await expect(page.getByText("导入预览：3 篇可编辑，0 条失败")).toBeVisible();
  for (let i = 1; i <= 3; i++)
    await page.getByLabel(`第 ${i} 条导入方式`).selectOption("keep");
  await page.getByRole("button", { name: "导入这 3 篇" }).click();
  await expect(page.locator(".paper-card")).toHaveCount(3);
  await page.evaluate(
    ({ key, f }) => {
      const s = JSON.parse(localStorage.getItem(key)!);
      s.projects[0].workflow = {
        ...f,
        review: [
          {
            id: "old",
            title: "原有综述",
            body: "用户旧成果应保留",
            evidenceIds: [],
            uncertainty: "待查",
            x: 0,
            y: 0,
          },
        ],
      };
      localStorage.setItem(key, JSON.stringify(s));
    },
    { key, f: emptyWorkflow() },
  );
  for (const path of ["map", "review", "canvas", "proposal"]) {
    await page.goto("/" + path);
    await expect(page).toHaveURL(/\/research(?:\?|$)/);
  }
  await expect(page.locator(".legacy-history")).toContainText(
    "用户旧成果应保留",
  );
  await expect(
    page.getByRole("navigation", { name: "主要导航" }).getByRole("link"),
  ).toHaveCount(5);
  await expect(
    page.getByRole("button", { name: "文献星图", exact: true }),
  ).toHaveCount(0);
});
test("分析已返回但存储失败可单独重试保存，不重复模型请求（明确模拟）", async ({
  page,
}) => {
  await begin(page);
  await page.goto("/literature");
  await page
    .getByLabel("选择题录或 PDF 文件")
    .setInputFiles("tests/fixtures/workflow/publisher-records.ris");
  await page.getByRole("button", { name: "导入这 3 篇" }).click();
  await page
    .getByRole("button", { name: "文献精析", exact: true })
    .first()
    .click();
  let calls = 0;
  await page.route("**/api/workflow", async (r) => {
    calls++;
    const b = r.request().postDataJSON();
    await page.evaluate(() => {
      const save = Storage.prototype.setItem;
      (window as unknown as { restoreSave: () => void }).restoreSave = () => {
        Storage.prototype.setItem = save;
      };
      Storage.prototype.setItem = () => {
        throw new DOMException("quota", "QuotaExceededError");
      };
    });
    return r.fulfill({
      json: {
        sections: [
          "30 秒读懂",
          "研究问题与动机",
          "理论与核心概念",
          "研究方法与过程",
          "关键发现与结论",
          "局限与研究启发",
          "对当前项目的价值",
        ].map((title) => ({
          title,
          body: "明确模拟分析，仅验证结果保存",
          quote: "",
          page: null,
          evidenceIds: [b.evidence[0].id],
          uncertainty: "测试夹具",
        })),
      },
    });
  });
  await page.getByRole("button", { name: "一键精析", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "保存当前分析（不重新调用 AI）" }),
  ).toBeVisible();
  await expect(page.locator(".study-section")).toHaveCount(7);
  await page.evaluate(() =>
    (window as unknown as { restoreSave: () => void }).restoreSave(),
  );
  await page
    .getByRole("button", { name: "保存当前分析（不重新调用 AI）" })
    .click();
  await expect(
    page.getByRole("button", { name: "保存当前分析（不重新调用 AI）" }),
  ).toHaveCount(0);
  expect(calls).toBe(1);
  await page.reload();
  await page
    .getByRole("button", { name: "文献精析", exact: true })
    .first()
    .click();
  await expect(page.locator(".study-section")).toHaveCount(7);
});
