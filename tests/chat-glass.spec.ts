import { test, expect, type Page } from "@playwright/test";
import { emptyWorkflow } from "../src/lib/workflow";
import { emptyResearchWorkspace } from "../src/lib/research-workspace";
import type { Project } from "../src/lib/projects";

// Saved synthetic conversation only: no request to an AI service is needed for these checks.
async function seedChat(page: Page, withHistory = true) {
  const createdAt = "2026-10-27T00:00:00Z";
  const research = emptyResearchWorkspace();
  research.stage = "discussion";
  research.messages = withHistory
    ? Array.from({ length: 8 }, (_, i) => ({
        id: `chat-layout-${i}`,
        role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
        content:
          i % 2 === 0
            ? "我想围绕大学生讨论可行的问卷研究（明确模拟输入）。"
            : "明确模拟的已保存回复，只用于检验长对话阅读，不代表真实学术分析。可以先缩小研究对象，再核对论文材料中的概念与方法边界。".repeat(
                4,
              ),
        createdAt,
        sourceIds: [],
        quickQuestions: [],
      }))
    : [];
  const project: Project = {
    id: "chat-layout",
    name: "研究对话玻璃质感 · 模拟验收",
    discipline: "广告学",
    status: "starting",
    observation: "反向广告与消费者反应（模拟布局项目）",
    createdAt,
    updatedAt: createdAt,
    workflow: { ...emptyWorkflow(), research },
  };
  await page.goto("/");
  await page.evaluate(
    (project) =>
      localStorage.setItem(
        "paperi.projects.v1",
        JSON.stringify({
          version: 1,
          revision: 0,
          projects: [project],
          activeId: project.id,
        }),
      ),
    project,
  );
  await page.goto("/research");
  await expect(page.getByRole("log", { name: "项目研究对话" })).toBeVisible();
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`研究对话玻璃与比例 ${viewport.width}×${viewport.height}：长回复可滚动，输入不遮挡（无模型请求）`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    let requests = 0;
    await page.route("**/api/research-journey", (route) => {
      requests++;
      return route.fulfill({
        status: 503,
        json: { error: "布局测试不调用模型" },
      });
    });
    await seedChat(page);
    const chat = page.locator(".rj-chat"),
      log = page.getByRole("log", { name: "项目研究对话" }),
      composer = page.locator(".rj-chat .lab-composer");
    const material = await chat.evaluate((e) => {
      const s = getComputedStyle(e);
      return {
        paint: s.backgroundImage,
        color: s.backgroundColor,
        blur: s.backdropFilter,
      };
    });
    expect(material.paint).toContain("radial-gradient");
    expect(material.paint).toContain("rgba(");
    expect(material.color).toBe("rgba(0, 0, 0, 0)");
    expect(material.blur).toContain("blur(");
    const boxes = await Promise.all([
      chat.boundingBox(),
      log.boundingBox(),
      composer.boundingBox(),
    ]);
    expect(boxes.every(Boolean)).toBe(true);
    const [c, l, input] = boxes;
    expect(c!.height).toBeLessThanOrEqual(viewport.height + 20);
    expect(l!.height).toBeGreaterThan(input!.height * 2);
    expect(l!.y + l!.height).toBeLessThanOrEqual(input!.y + 1);
    expect(await log.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(
      true,
    );
    await log.evaluate((e) => {
      e.scrollTop = e.scrollHeight;
    });
    const last = await log.locator(".message").last().boundingBox();
    expect(last!.y + last!.height).toBeLessThanOrEqual(l!.y + l!.height + 1);
    await page
      .getByLabel("继续讨论研究方向", { exact: true })
      .fill("这是布局验收输入，不发送。 ");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(requests).toBe(0);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: `docs/screenshots/acceptance-fixes/chat-${viewport.width}.png`,
      fullPage: true,
      animations: "disabled",
    });
  });
}

test("尚未开始讨论时不强撑大块空白，直接输入仍可用（无模型请求）", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedChat(page, false);
  const chat = await page.locator(".rj-chat").boundingBox();
  expect(chat!.height).toBeLessThan(620);
  const input = page.getByLabel("继续讨论研究方向", { exact: true });
  await input.fill("先记录想法，不发送模型。");
  await expect(input).toHaveValue("先记录想法，不发送模型。");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: "docs/screenshots/acceptance-fixes/chat-start-1440.png",
    fullPage: true,
    animations: "disabled",
  });
});
