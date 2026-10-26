import { expect, test, type Page } from "@playwright/test";
import { emptyExploration } from "../src/lib/exploration";
import { emptyNavigation } from "../src/lib/research-navigation";

const key = "paperi.projects.v1",
  at = "2026-10-26T04:00:00Z";
async function setup(page: Page) {
  await page.addInitScript(
    ({ key, at, exploration }) => {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          revision: 0,
          activeId: "concept-one",
          projects: [
            {
              id: "concept-one",
              name: "概念夹具项目",
              discipline: "传播学",
              observation: "夹具观察：我反感被广告劝说",
              createdAt: at,
              updatedAt: at,
              status: "starting",
              exploration,
            },
            {
              id: "concept-two",
              name: "另一个独立项目",
              discipline: "传播学",
              observation: "另一个观察",
              createdAt: at,
              updatedAt: at,
              status: "starting",
            },
          ],
        }),
      );
    },
    {
      key,
      at,
      exploration: {
        ...emptyExploration(),
        navigation: {
          ...emptyNavigation(),
          concepts: [
            {
              id: "c",
              term: "夹具逆反",
              explanation: "测试候选，不是事实",
              everyday: "",
              uncertainty: "待查",
              origin: "user",
              status: "selected",
            },
          ],
        },
      },
    },
  );
  await page.route("**/api/lab", (r) =>
    r.fulfill({
      json: { configured: false, message: "测试：未配置 AI；可手动编辑" },
    }),
  );
}

test("独立概念导航复用同一选择源，修改、排除、刷新和项目切换保持隔离", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/concepts");
  const nav = page.getByRole("navigation", { name: "主要导航" });
  await expect(nav.getByRole("link", { name: /概念锚定/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(nav.getByRole("link", { name: /研究脉络/ })).toHaveAttribute(
    "href",
    "/research",
  );
  await expect(page.locator(".selected-concepts-bar")).toContainText(
    "夹具逆反",
  );
  await page.getByRole("button", { name: "修改", exact: true }).click();
  await page.getByLabel("概念名称", { exact: true }).fill("用户修改的逆反");
  await page.getByRole("button", { name: "保存概念", exact: true }).click();
  await page.getByRole("button", { name: "排除", exact: true }).click();
  await expect(page.locator(".concept-card")).toContainText("已排除");
  await page.reload();
  await expect(page.locator(".concept-card")).toContainText("用户修改的逆反");
  await expect(page.locator(".concept-card")).toContainText("已排除");
  await page.getByRole("button", { name: "选择概念", exact: true }).click();
  await page.getByRole("link", { name: "根据已选概念准备检索" }).click();
  await expect(
    page
      .locator(".library-entry")
      .getByRole("link", { name: "前往深圳大学图书馆" }),
  ).toHaveAttribute("href", "https://www.lib.szu.edu.cn/");
  await expect(page.getByLabel("中文核心关键词")).toHaveValue("用户修改的逆反");
  await page
    .getByLabel("当前项目", { exact: true })
    .selectOption("concept-two");
  await expect(page.locator(".concept-card")).toHaveCount(0);
  await page
    .getByLabel("当前项目", { exact: true })
    .selectOption("concept-one");
  await expect(page.locator(".concept-card")).toContainText("用户修改的逆反");
});

test("概念 AI 调用失败保留旧选择，不自动请求或重复计费", async ({ page }) => {
  await setup(page);
  let calls = 0;
  await page.route("**/api/lab", (r) => {
    if (r.request().method() === "GET")
      return r.fulfill({ json: { configured: true, message: "测试提供商" } });
    calls++;
    return r.fulfill({
      status: 429,
      json: { error: "测试请求过于频繁，请稍后主动重试" },
    });
  });
  await page.goto("/concepts");
  await page.getByRole("button", { name: "补充不同角度的概念" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "请求过于频繁" }),
  ).toBeVisible();
  await expect(page.locator(".selected-concepts-bar")).toContainText(
    "夹具逆反",
  );
  expect(calls).toBe(1);
  await page.reload();
  await expect(page.locator(".selected-concepts-bar")).toContainText(
    "夹具逆反",
  );
  expect(calls).toBe(1);
});

test("点击准备检索才按当前概念补全双语词；仅浏览、刷新或改选不自动发起模型请求", async ({
  page,
}) => {
  await setup(page);
  let calls = 0;
  await page.route("**/api/lab", (r) =>
    r.fulfill({
      json: { configured: true, message: "模拟配置检查，不是真实模型" },
    }),
  );
  await page.route("**/api/research", (route) => {
    calls++;
    const request = route.request().postDataJSON();
    expect(request.context.concepts).toEqual(["夹具逆反"]);
    return route.fulfill({
      json: {
        zh: ["夹具逆反"],
        en: ["fixture reactance"],
        expressions: ["夹具逆反 品牌态度"],
      },
    });
  });
  await page.goto("/concepts");
  await expect(page.locator(".concept-card")).toHaveCount(1);
  expect(calls).toBe(0);
  await page.getByRole("link", { name: "根据已选概念准备检索" }).click();
  await expect(page.getByLabel("英文核心关键词")).toHaveValue(
    "fixture reactance",
  );
  expect(calls).toBe(1);
  await page.reload();
  await expect(page.getByLabel("英文核心关键词")).toHaveValue(
    "fixture reactance",
  );
  expect(calls).toBe(1);
  await page.getByRole("button", { name: "排除", exact: true }).click();
  await expect(page.locator(".concept-card")).toContainText("已排除");
  expect(calls).toBe(1);
});
