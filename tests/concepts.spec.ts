import { expect, test, type Page } from "@playwright/test";
import { emptyExploration } from "../src/lib/exploration";
import { emptyNavigation } from "../src/lib/research-navigation";
import { emptyWorkflow } from "../src/lib/workflow";
import { emptyLibrary } from "../src/lib/literature";
import { importedPaper } from "../src/lib/bibliography";
import { emptyResearchWorkspace } from "../src/lib/research-workspace";

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
  await expect(
    page
      .locator(".library-entry")
      .getByRole("link", { name: "前往深圳大学图书馆" }),
  ).toHaveAttribute("href", "https://www.lib.szu.edu.cn/");
  await expect(
    page.getByText("可直接使用已选概念检索", { exact: false }),
  ).toBeVisible();
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

test("五个概念可直接去图书馆、复制检索词；无 AI 仍继续，旧关键词和项目草稿不丢失", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await setup(page);
  await page.goto("/");
  const workflow = emptyWorkflow(),
    research = emptyResearchWorkspace();
  workflow.keywords = {
    zh: "旧中文检索词",
    en: "preserved English query",
    synonyms: "旧同义词",
    expressions: "旧组合一\n旧组合二",
    fingerprint: "legacy-profile",
  };
  const card = {
    title: "明确标记的旧方向夹具",
    question: "旧项目的问题仍保留吗",
    value: "仅验证数据连续性",
    method: "问卷候选",
    limitations: "模拟数据不是学术结论",
    evidenceIds: ["p1"],
  };
  research.directions = [
    {
      id: "direction-old",
      createdAt: at,
      fingerprint: "legacy-profile",
      candidateId: null,
      card,
      concepts: ["概念一"],
    },
  ];
  research.activeDirectionId = "direction-old";
  const base = {
    id: "q-old",
    createdAt: at,
    updatedAt: at,
    fingerprint: "legacy-profile",
    directionId: "direction-old",
    sourceIds: ["p1"],
    confirmed: false,
    question: "旧草稿问题",
    value: "待核查",
    evidenceGap: "仅测试",
    method: "既有方法",
    target: "既有对象",
    sampling: "既有招募",
    analysis: "既有分析",
    limitations: "既有限制",
  };
  research.quantitative = {
    ...base,
    variables: [],
    hypotheses: [],
    operationalization: "已有操作化草稿",
  };
  research.qualitative = {
    ...base,
    id: "qual-old",
    setting: "已有情境",
    themes: [],
    questions: [],
    ethics: "已有伦理草稿",
    outlineNeedsReview: false,
  };
  workflow.research = research;
  const terms = ["概念一", "概念二", "概念三", "概念四", "概念五"];
  const library = {
    ...emptyLibrary(),
    items: [1, 2, 3].map((i) => ({
      id: `p${i}`,
      paper: importedPaper({ title: `明确模拟材料${i}` }),
      categoryIds: [],
      note: "旧笔记",
      savedAt: at,
      updatedAt: at,
    })),
  };
  await page.evaluate(
    ({ key, workflow, terms, library }) => {
      const saved = JSON.parse(localStorage.getItem(key)!);
      const project = saved.projects[0];
      project.workflow = workflow;
      project.library = library;
      project.exploration.navigation.concepts = terms.map((term, i) => ({
        id: `old-concept-${i}`,
        term,
        explanation: "用户已有解释",
        everyday: "",
        uncertainty: "待文献核查",
        origin: "user",
        status: "selected",
      }));
      localStorage.setItem(key, JSON.stringify(saved));
    },
    { key, workflow, terms, library },
  );
  let posts = 0;
  await page.route("**/api/**", (route) => {
    if (route.request().method() === "POST") posts++;
    return route.fulfill({
      json: {
        configured: false,
        message: "明确模拟：没有 AI 密钥，可直接去图书馆",
      },
    });
  });
  await context.route("https://www.lib.szu.edu.cn/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<title>图书馆跳转夹具，非真实数据库页面</title>",
    }),
  );
  await page.goto("/concepts");
  const selected = page.locator(".selected-concepts-bar");
  await expect(selected.locator(".selected-concept")).toHaveCount(5);
  const link = selected.getByRole("link", { name: "前往深圳大学图书馆" });
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("href", "https://www.lib.szu.edu.cn/");
  await expect(page.locator(".keyword-preview")).toHaveCount(0);
  await expect(page.getByText("待生成", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "保存检索准备", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "进入文献工作台" })).toHaveCount(
    1,
  );
  const advanced = page.locator(".concept-search-advanced");
  await expect(advanced).not.toHaveAttribute("open");
  await selected
    .getByRole("button", { name: "复制检索词", exact: true })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    terms.join(" "),
  );
  const [popup] = await Promise.all([page.waitForEvent("popup"), link.click()]);
  await expect(popup).toHaveURL("https://www.lib.szu.edu.cn/");
  await popup.close();
  expect(posts).toBe(0);
  await advanced.locator("summary").click();
  await expect(page.getByLabel("已有检索词")).toContainText(
    "preserved English query",
  );
  await page.reload();
  await page
    .getByLabel("当前项目", { exact: true })
    .selectOption("concept-two");
  await expect(
    page.locator(".selected-concepts-bar .selected-concept"),
  ).toHaveCount(0);
  await page
    .getByLabel("当前项目", { exact: true })
    .selectOption("concept-one");
  await expect(
    page.locator(".selected-concepts-bar .selected-concept"),
  ).toHaveCount(5);
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).projects[0],
    key,
  );
  expect(saved.workflow).toEqual(workflow);
  expect(saved.library).toEqual(library);
  expect(
    saved.exploration.navigation.concepts.map((c: { term: string }) => c.term),
  ).toEqual(terms);
  expect(posts).toBe(0);
});
