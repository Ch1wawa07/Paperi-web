import { test, expect, type Page } from "@playwright/test";
import { importedPaper } from "../src/lib/bibliography";
import { emptyExploration } from "../src/lib/exploration";
import { emptyLibrary } from "../src/lib/literature";
import { emptyNavigation } from "../src/lib/research-navigation";
import { emptyWorkflow } from "../src/lib/workflow";
import {
  emptyResearchWorkspace,
  researchFingerprint,
  type QuantitativeDesign,
  type QualitativeDesign,
  type ResearchHypothesis,
} from "../src/lib/research-workspace";
import type { Project, ProjectSnapshot } from "../src/lib/projects";

// These explicit model paths test drawing and editing, not actual academic findings.
// No model result is injected into real user projects and no paid service is called.
const at = "2026-10-27T02:00:00.000Z",
  storageKey = "paperi.projects.v1";
function fixture(id = "feedback-model"): Project {
  const p: Project = {
    id,
    name:
      id === "feedback-model"
        ? "明确模拟：双中介与调节绘图验收"
        : "另一个隔离项目",
    discipline: "广告学",
    status: "starting",
    observation: "绘图验收材料：变量与假设均为明确测试数据，非真实研究成果。",
    createdAt: at,
    updatedAt: at,
    exploration: {
      ...emptyExploration(),
      navigation: {
        ...emptyNavigation(),
        concepts: [
          "心理逆反",
          "品牌态度",
          "说服认知",
          "广告感知",
          "品牌熟悉度",
        ].map((term, i) => ({
          id: `c-${i}`,
          term,
          explanation: "明确模拟的候选概念",
          everyday: "学术定义仍待核查",
          uncertainty: "仅测试状态保存",
          status: "selected",
          origin: "user",
        })),
      },
    },
    library: {
      ...emptyLibrary(),
      items: [1, 2, 3].map((i) => ({
        id: `p-${i}`,
        paper: importedPaper({
          title: `明确模拟材料 ${i}，不是实际论文`,
          authors: ["测试作者"],
          year: 2025,
          abstract: "此段内容仅用于状态和可视化自动化验收，不是实际论文摘要。",
        }),
        categoryIds: [],
        note: `原笔记${i}`,
        savedAt: at,
        updatedAt: at,
      })),
    },
    workflow: emptyWorkflow(),
  };
  const f = p.workflow!,
    r = emptyResearchWorkspace();
  f.keywords = {
    zh: "旧版保存的中文检索词",
    en: "preserved English query",
    synonyms: "旧版同义词",
    expressions: "原有检索组合",
    fingerprint: "old-saved-profile",
  };
  const fingerprint = researchFingerprint(p),
    sourceIds = ["p-1", "p-2", "p-3"];
  const card = {
    title: "用户已确认的模拟方向",
    question: "明确模拟的广告反应研究问题",
    value: "测试方向保存",
    method: "问卷候选",
    limitations: "不得当作已验证的理论或研究结论",
    evidenceIds: sourceIds,
  };
  r.directions = [
    {
      id: "direction-1",
      createdAt: at,
      fingerprint,
      candidateId: null,
      card,
      concepts: ["心理逆反", "品牌态度"],
    },
  ];
  r.activeDirectionId = "direction-1";
  r.stage = "design";
  r.method = "quantitative";
  const base = {
    id: "quant-1",
    createdAt: at,
    updatedAt: at,
    fingerprint,
    directionId: "direction-1",
    sourceIds,
    confirmed: false,
    question: card.question,
    value: card.value,
    evidenceGap: card.limitations,
  };
  const hypotheses: ResearchHypothesis[] = [
    {
      id: "h1",
      kind: "direct",
      from: "x",
      to: "m1",
      text: "测试 H1：反向广告暴露类型与感知独特有关，待检验。",
      rationale: "明确绘图测试路径，不是论文结论",
      evidenceIds: sourceIds,
      confirmed: true,
    },
    {
      id: "h2",
      kind: "direct",
      from: "m1",
      to: "y",
      text: "测试 H2：感知独特与状态逆反有关，待检验。",
      rationale: "明确绘图测试路径",
      evidenceIds: sourceIds,
      confirmed: true,
    },
    {
      id: "h3",
      kind: "direct",
      from: "x",
      to: "m2",
      text: "测试 H3：反向广告暴露类型与感知操纵意图有关，待检验。",
      rationale: "明确绘图测试路径",
      evidenceIds: sourceIds,
      confirmed: false,
    },
    {
      id: "h4",
      kind: "direct",
      from: "m2",
      to: "y",
      text: "测试 H4：感知操纵意图与状态逆反有关，待检验。",
      rationale: "明确绘图测试路径",
      evidenceIds: sourceIds,
      confirmed: true,
    },
    {
      id: "h5",
      kind: "moderation",
      moderatesId: "h2",
      moderatorId: "w",
      from: "m1",
      to: "y",
      text: "测试 H5：品牌熟悉度可能调节 H2 所描述关系，待检验。",
      rationale: "调节指向 H2 关系，不是 W→Y 直接效应",
      evidenceIds: sourceIds,
      confirmed: false,
    },
  ];
  const quantitative: QuantitativeDesign = {
    ...base,
    variables: [
      { id: "x", name: "反向广告暴露类型", role: "X" },
      { id: "m1", name: "感知独特", role: "M" },
      { id: "m2", name: "感知操纵意图", role: "M" },
      { id: "y", name: "状态逆反", role: "Y" },
      { id: "w", name: "品牌熟悉度", role: "W" },
    ].map((v) => ({
      ...v,
      role: v.role as QuantitativeDesign["variables"][number]["role"],
      explanation: "明确测试变量，不是已验证构念",
      rationale: "用于绘图验收",
      evidenceIds: sourceIds,
      uncertainty: "应另行核查学术依据",
      confirmed: true,
    })),
    hypotheses,
    method: "问卷候选",
    target: "测试对象",
    sampling: "样本待确认",
    operationalization: "测量待核查",
    analysis: "分析条件待核查",
    limitations: "不能据此宣称因果",
  };
  const qualitative: QualitativeDesign = {
    ...base,
    id: "qual-1",
    target: "旧质性对象",
    setting: "原有情境",
    themes: [
      { id: "t1", title: "原有访谈主题", explanation: "不应被定量编辑覆盖" },
    ],
    questions: [{ id: "q1", themeId: "t1", text: "请谈谈你的体验" }],
    method: "访谈候选",
    sampling: "原招募计划",
    analysis: "原编码计划",
    ethics: "知情同意",
    limitations: "原限制",
    outlineNeedsReview: false,
  };
  r.quantitative = quantitative;
  r.qualitative = qualitative;
  f.research = r;
  return p;
}
async function seed(page: Page, p = fixture()) {
  await page.goto("/");
  await page.evaluate(
    ({ key, projects }) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          revision: 0,
          activeId: projects[0].id,
          projects,
        }),
      ),
    { key: storageKey, projects: [p, fixture("feedback-other")] },
  );
  await page.goto("/research");
  await expect(page.locator(".rd-workspace")).toBeVisible();
  await page
    .locator(".rd-step-nav")
    .getByRole("button", { name: /假设与模型/ })
    .click();
  await expect(page.locator(".rd-model")).toBeVisible();
}
async function stored(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!) as ProjectSnapshot,
    storageKey,
  );
}
const edge = (page: Page, id: string) =>
  page.locator(`.rd-model [data-hypothesis-id='${id}']`);

async function checkExplicitPaths(page: Page) {
  for (const [id, from, to] of [
    ["h1", "x", "m1"],
    ["h2", "m1", "y"],
    ["h3", "x", "m2"],
    ["h4", "m2", "y"],
  ]) {
    await expect(edge(page, id)).toHaveAttribute("data-from", from);
    await expect(edge(page, id)).toHaveAttribute("data-to", to);
    await expect(edge(page, id).locator(".rd-model-link")).toHaveCount(1);
    await expect(edge(page, id).locator(".rd-model-link")).toHaveAttribute(
      "marker-end",
      /url\(/,
    );
  }
  await expect(edge(page, "h5")).toHaveAttribute("data-moderates-id", "h2");
  await expect(edge(page, "h5").locator(".rd-model-link")).toHaveCount(1);
  await expect(
    page.locator(".rd-model [data-from='w'][data-to='y']"),
  ).toHaveCount(0);
  await expect(page.locator(".rd-model [data-hypothesis-id]")).toHaveCount(5);
  await expect(edge(page, "h3")).toHaveClass(/candidate/);
  await expect(edge(page, "h1")).toHaveClass(/confirmed/);
  const geometry = await page.locator(".rd-model").evaluate((svg) => {
    const root = svg as unknown as SVGSVGElement;
    const view = root.viewBox.baseVal;
    const paths = [...root.querySelectorAll<SVGPathElement>(".rd-model-link")];
    const within = paths.every((path) => {
      const style = getComputedStyle(path),
        length = path.getTotalLength();
      return (
        style.stroke !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0 &&
        length > 15 &&
        Array.from({ length: 41 }, (_, i) =>
          path.getPointAtLength((length * i) / 40),
        ).every(
          (p) =>
            p.x >= -1 &&
            p.y >= -1 &&
            p.x <= view.width + 1 &&
            p.y <= view.height + 1,
        )
      );
    });
    const mod = root.querySelector<SVGPathElement>(
      "[data-hypothesis-id='h5'] .rd-model-link",
    )!;
    const target = root.querySelector<SVGPathElement>(
      "[data-hypothesis-id='h2'] .rd-model-link",
    )!;
    const end = mod.getPointAtLength(mod.getTotalLength());
    const distance = Math.min(
      ...Array.from({ length: 101 }, (_, i) => {
        const p = target.getPointAtLength((target.getTotalLength() * i) / 100);
        return Math.hypot(end.x - p.x, end.y - p.y);
      }),
    );
    return {
      within,
      modDistanceToTarget: distance,
      modDash: getComputedStyle(mod).strokeDasharray,
    };
  });
  expect(geometry.within).toBe(true);
  expect(geometry.modDistanceToTarget).toBeLessThan(5);
  expect(geometry.modDash).not.toBe("none");
}

test("显式双中介与指定关系调节可溯源；编辑、删除、保存刷新不产生残线（模拟绘图数据）", async ({
  page,
}) => {
  const p = fixture();
  let paidCalls = 0;
  await page.route("**/api/research-journey", (route) => {
    paidCalls++;
    return route.fulfill({ status: 503, json: { error: "此测试不调用模型" } });
  });
  await seed(page, p);
  await checkExplicitPaths(page);
  await page.locator(".rd-model [data-variable-id='x']").focus();
  await page.locator(".rd-model [data-variable-id='x']").press("Enter");
  await page
    .getByLabel("模型中的变量名称", { exact: true })
    .fill("广告呈现方式（用户改名）");
  await expect(page.locator(".rd-model")).toContainText(
    "广告呈现方式（用户改名）",
  );
  await expect(page.getByLabel("H1 假设表述", { exact: true })).toHaveValue(
    /广告呈现方式/,
  );
  await page
    .getByLabel("模型中的变量角色", { exact: true })
    .selectOption("control");
  await expect(page.locator(".rd-model [data-variable-id='x']")).toContainText(
    "控制",
  );
  await expect(edge(page, "h1")).toHaveAttribute("data-from", "x");
  await page
    .locator(".rd-hypothesis[data-hypothesis-id='h3']")
    .getByLabel("关系终点", { exact: true })
    .selectOption("y");
  await expect(edge(page, "h3")).toHaveAttribute("data-to", "y");
  const confirmation = page
    .locator(".rd-hypothesis[data-hypothesis-id='h3']")
    .getByRole("checkbox", {
      name: "我确认将此关系列为待检验假设",
      exact: true,
    });
  await confirmation.check();
  await expect(edge(page, "h3")).toHaveClass(/confirmed/);
  await confirmation.uncheck();
  await expect(edge(page, "h3")).toHaveClass(/candidate/);
  const moderationEditor = page.locator(
    ".rd-hypothesis[data-hypothesis-id='h5']",
  );
  await moderationEditor
    .getByLabel("被调节的关系", { exact: true })
    .selectOption("h4");
  await expect(edge(page, "h5")).toHaveAttribute("data-moderates-id", "h4");
  await expect(
    moderationEditor.getByLabel("H5 假设表述", { exact: true }),
  ).toHaveValue(/H4/);
  await moderationEditor
    .getByLabel("被调节的关系", { exact: true })
    .selectOption("h2");
  await moderationEditor
    .getByLabel("调节变量", { exact: true })
    .selectOption("x");
  await expect(edge(page, "h5")).toHaveAttribute("data-moderator-id", "x");
  await expect(
    moderationEditor.getByLabel("H5 假设表述", { exact: true }),
  ).toHaveValue(/广告呈现方式/);
  await moderationEditor
    .getByLabel("调节变量", { exact: true })
    .selectOption("w");
  await expect(
    moderationEditor.getByLabel("H5 假设表述", { exact: true }),
  ).toHaveValue(/品牌熟悉度.*H2/);
  await page
    .locator(".rd-hypothesis[data-hypothesis-id='h2']")
    .getByRole("button", { name: "删除假设", exact: true })
    .click();
  await expect(edge(page, "h2")).toHaveCount(0);
  await expect(edge(page, "h5")).toHaveCount(0);
  await expect(page.locator(".rd-model [data-hypothesis-id]")).toHaveCount(3);
  await page.getByRole("button", { name: "保存当前设计", exact: true }).click();
  await page.reload();
  await page
    .locator(".rd-step-nav")
    .getByRole("button", { name: /假设与模型/ })
    .click();
  await expect(edge(page, "h3")).toHaveAttribute("data-to", "y");
  await expect(edge(page, "h5")).toHaveCount(0);
  await expect(page.locator(".rd-model")).toContainText(
    "广告呈现方式（用户改名）",
  );
  const saved = (await stored(page)).projects.find((x) => x.id === p.id)!;
  expect(saved.workflow!.research!.qualitative).toEqual(
    p.workflow!.research!.qualitative,
  );
  expect(saved.workflow!.keywords).toEqual(p.workflow!.keywords);
  expect(saved.exploration).toEqual(p.exploration);
  expect(saved.library).toEqual(p.library);
  expect(saved.workflow!.research!.directions).toEqual(
    p.workflow!.research!.directions,
  );
  await page
    .getByLabel("当前项目", { exact: true })
    .selectOption("feedback-other");
  expect(
    (await stored(page)).projects.find((x) => x.id === "feedback-other")!
      .workflow!.research!.quantitative!.variables[0].name,
  ).toBe("反向广告暴露类型");
  await page.getByLabel("当前项目", { exact: true }).selectOption(p.id);
  expect(
    (await stored(page)).projects.find((x) => x.id === p.id)!.workflow!
      .research!.quantitative!.variables[0].name,
  ).toBe("广告呈现方式（用户改名）");
  expect(paidCalls).toBe(0);
});

test("结构化 AI 路径响应经真实保存逻辑进入模型，不凭变量角色补线（明确模拟 API）", async ({
  page,
}) => {
  const p = fixture(),
    provided = structuredClone(p.workflow!.research!.quantitative!.hypotheses);
  p.workflow!.research!.quantitative!.hypotheses = [];
  let calls = 0;
  await page.route("**/api/research-journey", (route) => {
    calls++;
    const input = route.request().postDataJSON();
    expect(input.task).toBe("quantitative");
    expect(input.designStep).toBe("hypotheses");
    expect(
      input.context.quantitative.variables.map((v: { id: string }) => v.id),
    ).toEqual(["x", "m1", "m2", "y", "w"]);
    return route.fulfill({
      json: {
        design: {
          ...input.context.quantitative,
          hypotheses: provided,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  });
  await seed(page, p);
  await expect(page.locator(".rd-model-link")).toHaveCount(0);
  await page
    .getByRole("button", { name: "梳理变量间的假设关系", exact: true })
    .click();
  await expect(page.locator(".rd-model [data-hypothesis-id]")).toHaveCount(5);
  await checkExplicitPaths(page);
  const saved = (await stored(page)).projects.find((x) => x.id === p.id)!;
  expect(saved.workflow!.research!.quantitative!.hypotheses).toEqual(provided);
  expect(calls).toBe(1);
  await page.reload();
  await page
    .locator(".rd-step-nav")
    .getByRole("button", { name: /假设与模型/ })
    .click();
  await checkExplicitPaths(page);
  expect(calls).toBe(1);
});

test("只有变量时明确说明尚无假设，不从X/M/Y/W角色猜测连线（模拟绘图数据）", async ({
  page,
}) => {
  const p = fixture();
  p.workflow!.research!.quantitative!.hypotheses = [];
  await seed(page, p);
  await expect(
    page.getByText("当前只有变量，尚未确认变量间的假设关系，因此不显示连线", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.locator(".rd-model-link")).toHaveCount(0);
  await expect(page.locator(".rd-model [data-variable-id]")).toHaveCount(5);
  await page
    .getByRole("button", { name: "添加待检验假设", exact: true })
    .click();
  await expect(page.locator(".rd-model-link")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "添加这条假设", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("新增关系起点", { exact: true }).selectOption("x");
  await page.getByLabel("新增关系终点", { exact: true }).selectOption("y");
  await expect(page.locator(".rd-model-link")).toHaveCount(0);
  await page.getByRole("button", { name: "添加这条假设", exact: true }).click();
  await expect(page.locator(".rd-model [data-hypothesis-id]")).toHaveCount(1);
  const direct = page.locator(".rd-model [data-hypothesis-id]");
  await expect(direct).toHaveClass(/candidate/);
  const directId = await direct.getAttribute("data-hypothesis-id");
  await expect(direct).toHaveAttribute("data-from", "x");
  await expect(direct).toHaveAttribute("data-to", "y");
  await page.getByRole("button", { name: "添加调节假设", exact: true }).click();
  await expect(
    page.getByLabel("新增调节的目标关系", { exact: true }),
  ).toHaveValue("");
  await expect(page.getByLabel("新增调节变量", { exact: true })).toHaveValue(
    "",
  );
  await page
    .getByLabel("新增调节的目标关系", { exact: true })
    .selectOption(directId!);
  await page.getByLabel("新增调节变量", { exact: true }).selectOption("w");
  await expect(page.locator(".rd-model [data-hypothesis-id]")).toHaveCount(1);
  await page.getByRole("button", { name: "添加这条假设", exact: true }).click();
  await expect(page.locator(".rd-model [data-hypothesis-id]")).toHaveCount(2);
  const moderation = page.locator(".rd-model [data-kind='moderation']");
  await expect(moderation).toHaveAttribute("data-moderates-id", directId!);
  await expect(moderation).toHaveAttribute("data-moderator-id", "w");
  await expect(
    page.locator(".rd-model [data-from='w'][data-to='y']"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "保存当前设计", exact: true }).click();
  await page.reload();
  await page
    .locator(".rd-step-nav")
    .getByRole("button", { name: /假设与模型/ })
    .click();
  await expect(
    page.locator(".rd-model [data-kind='moderation']"),
  ).toHaveAttribute("data-moderates-id", directId!);
});

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`显式五变量模型可读且不越界 ${viewport.width}×${viewport.height}（模拟绘图数据）`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await seed(page);
    await checkExplicitPaths(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const model = page.locator(".rd-model");
    await model.scrollIntoViewIfNeeded();
    const box = await model.boundingBox();
    expect(box!.height).toBeLessThanOrEqual(viewport.width < 700 ? 430 : 380);
    const region = page.locator(".rd-compact-model");
    if (viewport.width >= 700) {
      expect(
        await region
          .locator(".rd-model-scroll")
          .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      ).toBe(true);
      const visible = await model.boundingBox();
      expect(visible!.y).toBeGreaterThanOrEqual(0);
      expect(visible!.y + visible!.height).toBeLessThanOrEqual(viewport.height);
    } else {
      await expect(region).toContainText(/横向|左右/);
      await region.locator(".rd-model-scroll").evaluate((e) => {
        e.scrollLeft = e.scrollWidth;
      });
      expect(
        await region
          .locator(".rd-model-scroll")
          .evaluate((e) => e.scrollLeft > 0),
      ).toBe(true);
      await region.locator(".rd-model-scroll").evaluate((e) => {
        e.scrollLeft = 0;
      });
    }
    await region.screenshot({
      path: `docs/screenshots/feedback-model/model-${viewport.width}.png`,
      animations: "disabled",
    });
  });
}
