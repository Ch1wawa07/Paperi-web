import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { importedPaper } from "../src/lib/bibliography";
import { emptyExploration } from "../src/lib/exploration";
import { emptyLibrary } from "../src/lib/literature";
import { emptyWorkflow, type ReadingSection } from "../src/lib/workflow";
import { emptyNavigation } from "../src/lib/research-navigation";
import {
  emptyResearchWorkspace,
  researchFingerprint,
  type ResearchWorkspace,
  type QuantitativeDesign,
  type QualitativeDesign,
} from "../src/lib/research-workspace";
import type { Project, ProjectSnapshot } from "../src/lib/projects";
import type {
  JourneyInput,
  JourneyResult,
} from "../src/lib/research-journey-client";

// These fixtures verify product behavior. They are deliberately synthetic and
// never claim that a real model analyzed the user's three Chinese papers.
const key = "paperi.projects.v1";
const at = "2026-10-26T08:00:00.000Z";
const observation = "为什么有些广告越劝我买，我反而越不想买？";
const preference = "我主要想研究大学生，偏问卷，不想做复杂实验";

function project(id = "journey-a", library = true): Project {
  return {
    id,
    name:
      id === "journey-a"
        ? "反向广告研究 · 明确模拟验收"
        : "另一研究项目 · 明确模拟验收",
    discipline: "广告学",
    status: "starting",
    observation,
    createdAt: at,
    updatedAt: at,
    exploration: {
      ...emptyExploration(),
      messages: [
        { id: "hero", role: "user", content: observation, createdAt: at },
      ],
      navigation: {
        ...emptyNavigation(),
        concepts: ["心理逆反", "品牌态度", "说服认知", "复杂实验"].map(
          (term, i) => ({
            id: `concept-${i}`,
            term,
            explanation: "测试中的候选解释，待真实文献核查",
            everyday: "非已核实学术定义",
            uncertainty: "明确模拟",
            status: i < 3 ? "selected" : "excluded",
            origin: "user",
          }),
        ),
      },
    },
    workflow: emptyWorkflow(),
    ...(library
      ? {
          library: {
            ...emptyLibrary(),
            items: [1, 2, 3].map((i) => ({
              id: `paper-${i}`,
              paper: importedPaper({
                key: `import:fixture-${i}`,
                title: `模拟材料${i}：反向广告与心理逆反（非真实论文）`,
                authors: ["模拟作者"],
                year: 2024,
                venue: "模拟来源，不是学术出版记录",
                abstract:
                  "这是自动化测试材料，不能当作真实研究结论或实际论文。",
              }),
              categoryIds: [],
              note: "用户测试笔记，应持续保留",
              savedAt: at,
              updatedAt: at,
            })),
          },
        }
      : {}),
  };
}

async function seed(page: Page, projects = [project(), project("journey-b")]) {
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
    { key, projects },
  );
  await page.goto("/research");
}
async function snapshot(page: Page): Promise<ProjectSnapshot> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);
}
async function state(page: Page): Promise<ResearchWorkspace> {
  const s = await snapshot(page);
  return s.projects.find((p) => p.id === s.activeId)!.workflow!.research!;
}
function sections(ids: string[]): ReadingSection[] {
  return [
    "总体研究什么",
    "理论/主题与方法分组",
    "已有发现、分歧与限制",
    "可继续探索的切入口",
  ].map((title, i) => ({
    title,
    body:
      i === 3
        ? "模拟研究提议：可进一步比较大学生对广告的解释，仍待真实文献核对。"
        : "明确模拟：跨篇整理材料的范围，不能当作实际论文发现。",
    evidenceIds: ids,
    quote: "这是自动化测试材料，不能当作真实研究结论或实际论文。",
    page: null,
    uncertainty: "明确模拟；仅验证数据流，不证明真实 AI 学术质量。",
    evidenceStatus: i === 3 ? "proposal" : "verified",
  }));
}
function designBase(input: JourneyInput) {
  const direction = input.context.confirmed!;
  return {
    id: `${input.task}-fixture`,
    createdAt: at,
    updatedAt: at,
    fingerprint: direction.fingerprint,
    directionId: direction.id,
    sourceIds: input.context.evidence.map((e) => e.id),
    confirmed: false,
    question: direction.card.question,
    value: "模拟建议：可探讨大学生对广告的评价",
    evidenceGap: "模拟材料不能支持实际量表、显著结果或因果判断，需补真实证据。",
  };
}
function quantitative(input: JourneyInput): QuantitativeDesign {
  const draft: QuantitativeDesign = structuredClone(
    input.context.quantitative ?? {
      ...designBase(input),
      variables: [],
      hypotheses: [],
      method: "",
      target: "",
      sampling: "",
      operationalization: "",
      analysis: "",
      limitations: "",
    },
  );
  if (input.designStep === "variables")
    draft.variables = [
      {
        id: "x",
        name: "反向广告感知",
        role: "X",
        explanation: "拟测量的广告理解",
        rationale: "模拟变量建议",
        evidenceIds: draft.sourceIds,
        uncertainty: "量表待核实",
        confirmed: false,
      },
      {
        id: "m",
        name: "心理逆反",
        role: "M",
        explanation: "拟讨论的心理反应",
        rationale: "模拟变量建议",
        evidenceIds: draft.sourceIds,
        uncertainty: "关系待检验",
        confirmed: false,
      },
      {
        id: "y",
        name: "品牌态度",
        role: "Y",
        explanation: "拟测量的品牌评价",
        rationale: "模拟变量建议",
        evidenceIds: draft.sourceIds,
        uncertainty: "量表待核实",
        confirmed: false,
      },
    ];
  if (input.designStep === "hypotheses")
    draft.hypotheses = [
      {
        id: "h1",
        from: "x",
        to: "y",
        text: "反向广告感知与品牌态度有关（模拟候选，待检验）。",
        rationale: "模拟逻辑，不是已证实结果",
        evidenceIds: draft.sourceIds,
        confirmed: false,
      },
      {
        id: "h2",
        from: "x",
        to: "m",
        text: "反向广告感知与心理逆反有关（模拟候选，待检验）。",
        rationale: "模拟逻辑，需证据",
        evidenceIds: draft.sourceIds,
        confirmed: false,
      },
    ];
  if (input.designStep === "method")
    Object.assign(draft, {
      method: "模拟建议：横截面问卷",
      target: "可接触的大学生",
      sampling: "便利招募，说明样本局限",
      operationalization: "先核查已公开量表及使用权限，不伪造正式量表",
      analysis: "探索相关或回归，不能仅凭问卷声称因果",
      limitations: "测试建议；尚未收集数据，不保证因果或显著性",
    });
  return { ...draft, updatedAt: new Date().toISOString() };
}
function qualitative(input: JourneyInput): QualitativeDesign {
  const draft: QualitativeDesign = structuredClone(
    input.context.qualitative ?? {
      ...designBase(input),
      target: "大学生",
      setting: "观看广告的日常情境",
      themes: [],
      questions: [],
      method: "",
      sampling: "",
      analysis: "",
      ethics: "",
      limitations: "",
      outlineNeedsReview: false,
    },
  );
  if (input.designStep === "themes")
    draft.themes = [
      { id: "t1", title: "观看与理解广告的经历", explanation: "模拟探索主题" },
      { id: "t2", title: "自由选择的感受", explanation: "模拟探索主题" },
      { id: "t3", title: "品牌评价的形成", explanation: "模拟探索主题" },
    ];
  if (input.designStep === "questions")
    draft.questions = [
      "你能回忆一次令你印象深刻的广告经历吗？",
      "当时你怎样理解广告的表达？",
      "你怎样描述当时的感受？",
      "哪些情境会改变你的理解？",
      "你后来怎样看待这个品牌？",
      "还有哪些经历与你刚才说的不同？",
    ].map((text, i) => ({
      id: `q${i}`,
      themeId: draft.themes[i % draft.themes.length].id,
      text,
    }));
  if (input.designStep === "method")
    Object.assign(draft, {
      method: "模拟建议：半结构访谈",
      sampling: "招募可接触大学生，说明自愿退出与样本边界",
      analysis: "经同意记录材料，匿名整理、初步编码、对比主题与反例",
      ethics: "取得知情同意，匿名处理并限制原始录音访问",
      limitations: "模拟初步提纲，访谈尚未执行，不能生成研究发现。",
    });
  return { ...draft, updatedAt: new Date().toISOString() };
}
function response(input: JourneyInput): JourneyResult {
  const ids = input.context.evidence.map((e) => e.id);
  if (input.task === "context") {
    const first = input.context.evidence[0];
    const page = first.pages[0];
    return {
      sections: sections(ids).map((section) => ({
        ...section,
        quote: (page?.text ?? first.abstract ?? "").slice(0, 60),
        page: page?.page ?? null,
      })),
    };
  }
  if (input.task === "discussion")
    return {
      reply:
        "明确模拟回应：你已选择心理逆反、品牌态度。结合三篇材料，大学生问卷是一个待进一步核实的可行路径。",
      quickQuestions: [
        "在大学生范围内怎样缩小问题？",
        "还缺哪些证据？",
        "问卷的局限是什么？",
        "有哪些不同解释？",
      ],
    };
  if (input.task === "directions")
    return {
      cards: [1, 2].map((i) => ({
        title: `模拟候选方向${i}：大学生与反向广告`,
        question:
          i === 1
            ? "大学生对反向广告的感知与品牌态度有什么关系？"
            : "大学生如何理解反向广告中的真诚表达？",
        value: "模拟研究提议，尚待真实论文核查",
        method: i === 1 ? "拟问卷，实施难度需确认" : "拟访谈，实施难度需确认",
        limitations: "量表、理论及证据均待核查",
        evidenceIds: ids,
        concepts: ["心理逆反", "品牌态度"],
      })),
    };
  if (input.task === "method")
    return {
      advice:
        "模拟比较：问卷适合讨论关联；访谈适合理解经历。你偏好问卷，仍由你决定。",
    };
  return {
    design:
      input.task === "quantitative" ? quantitative(input) : qualitative(input),
  };
}
async function mockJourney(page: Page) {
  const calls: JourneyInput[] = [];
  await page.route("**/api/research-journey", async (route) => {
    const input = route.request().postDataJSON() as JourneyInput;
    calls.push(input);
    await route.fulfill({ json: response(input) });
  });
  return calls;
}

test("研究闭环（AI 明确模拟、PDF 使用真实解析器）：三篇材料→讨论偏好→确认方向→可编辑两种设计", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const calls = await mockJourney(page);
  await seed(page, [project("journey-a", false), project("journey-b", false)]);
  await page.goto("/literature?mode=import");
  const buffer = readFileSync("tests/fixtures/workflow/readable.pdf");
  await page.getByLabel("选择题录或 PDF 文件").setInputFiles(
    [1, 2, 3].map((i) => ({
      name: `synthetic-journey-${i}.pdf`,
      mimeType: "application/pdf",
      buffer,
    })),
  );
  await expect(page.getByText("导入预览：3 篇可编辑，0 条失败")).toBeVisible({
    timeout: 20000,
  });
  for (let i = 0; i < 3; i++) {
    await page
      .getByLabel("论文标题", { exact: true })
      .nth(i)
      .fill(`模拟 PDF 材料${i + 1}（非真实论文）`);
    await page.getByLabel(`第 ${i + 1} 条导入方式`).selectOption("keep");
  }
  await page.getByRole("button", { name: "导入这 3 篇", exact: true }).click();
  await expect(page.locator(".paper-card")).toHaveCount(3);
  await page.route("**/api/workflow", async (route) => {
    const input = route.request().postDataJSON();
    const evidence = input.evidence[0];
    await route.fulfill({
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
          body: "明确模拟精析，仅验证真实 PDF 节选与七个维度的数据流。",
          evidenceIds: [evidence.id],
          quote: evidence.pages[0].text.slice(0, 60),
          page: evidence.pages[0].page,
          uncertainty: "合成 PDF，非真实学术验收",
          evidenceStatus: "verified",
        })),
      },
    });
  });
  await page
    .getByRole("button", { name: "文献精析", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "一键精析", exact: true }).click();
  await expect(page.locator(".study-section")).toHaveCount(7);
  await page.getByRole("link", { name: /带着.*文献去梳理研究脉络/ }).click();
  await expect(page).toHaveURL(/\/research/);
  await expect(page.locator(".rj-evidence-status li")).toHaveCount(3);
  expect(calls).toHaveLength(0);
  await page.getByRole("button", { name: "梳理这些文献", exact: true }).click();
  await expect(page.locator(".rj-section-grid .study-section")).toHaveCount(4);
  expect(calls[0].task).toBe("context");
  expect(calls[0].context.evidence.every((e) => e.pages.length > 0)).toBe(true);
  expect(calls[0].context.evidence.some((e) => e.reading.length === 7)).toBe(
    true,
  );
  await expect(page.locator(".direction-choice")).toHaveCount(0);
  // Reopening an identical synthesis must reuse it, not consume another call.
  await page.getByRole("button", { name: "梳理这些文献", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "无需再次调用 AI" }),
  ).toBeVisible();
  expect(calls).toHaveLength(1);
  await page
    .getByRole("button", { name: "进入 AI 研究对话", exact: true })
    .click();
  await expect(page.getByRole("log", { name: "项目研究对话" })).toContainText(
    "心理逆反",
  );
  await page.getByLabel("继续讨论研究方向", { exact: true }).fill(preference);
  await page.getByRole("button", { name: "发送研究想法", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("明确模拟回应");
  const discussion = calls.find((c) => c.task === "discussion")!;
  expect(discussion.context.observation).toBe(observation);
  expect(discussion.context.concepts).toEqual([
    "心理逆反",
    "品牌态度",
    "说服认知",
  ]);
  expect(discussion.context.conceptChoices).toContainEqual(
    expect.objectContaining({ term: "复杂实验", status: "excluded" }),
  );
  expect(discussion.context.evidence.every((e) => e.pages.length === 0)).toBe(
    true,
  );
  expect(discussion.context.synthesis).toHaveLength(4);
  await page.getByRole("button", { name: "更新我的偏好", exact: true }).click();
  await expect
    .poll(async () => (await state(page)).preferences)
    .toContain(preference);
  await page
    .getByRole("button", { name: "根据我们的讨论推荐方向", exact: true })
    .click();
  await expect(page.locator(".direction-choice")).toHaveCount(2);
  expect(
    calls.find((c) => c.task === "directions")!.context.preferences,
  ).toContain(preference);
  await page
    .getByRole("button", { name: "选择这个方向", exact: true })
    .first()
    .click();
  await page
    .getByLabel("具体研究问题", { exact: true })
    .fill("大学生如何评价反向广告，且这种评价与品牌态度有什么关系？");
  await page
    .getByRole("button", { name: "确认并保存研究方向", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "开始研究设计", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".rj-confirmed")).toContainText(
    "大学生如何评价反向广告",
  );
  expect((await state(page)).candidateBatches[0].cards).toHaveLength(2);
  await page.getByRole("button", { name: "开始研究设计", exact: true }).click();
  await page.getByRole("button", { name: /^定量研究/ }).click();
  await page
    .getByRole("button", { name: "AI 帮我明确研究问题", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "我的研究问题", exact: true }),
  ).toHaveValue(/大学生/);
  await page
    .locator(".rd-step-nav")
    .getByRole("button", { name: /核心变量/ })
    .click();
  await page
    .getByRole("button", { name: "AI 帮我梳理这一环节", exact: true })
    .click();
  await expect(page.locator(".rd-variable")).toHaveCount(3);
  await page
    .locator(".rd-step-nav")
    .getByRole("button", { name: /假设与模型/ })
    .click();
  await page
    .getByRole("button", { name: "AI 帮我梳理这一环节", exact: true })
    .click();
  await expect(page.locator(".rd-hypothesis")).toHaveCount(2);
  await expect(page.locator(".rd-model [data-hypothesis-id='h2']")).toHaveCount(
    1,
  );
  await page.locator(".rd-model [data-variable-id='x']").focus();
  await page.locator(".rd-model [data-variable-id='x']").press("Enter");
  await expect(
    page.getByRole("textbox", { name: "模型中的变量名称", exact: true }),
  ).toHaveValue("反向广告感知");
  await page
    .locator(".rd-step-nav")
    .getByRole("button", { name: /核心变量/ })
    .click();
  await page
    .locator(".rd-variable[data-variable-id='x']")
    .getByRole("textbox", { name: "变量名称", exact: true })
    .fill("反向广告理解");
  await page.getByRole("button", { name: "保存当前设计", exact: true }).click();
  await page
    .locator(".rd-step-nav")
    .getByRole("button", { name: /假设与模型/ })
    .click();
  await expect(page.locator(".rd-model")).toContainText("反向广告理解");
  await expect(
    page.getByRole("textbox", { name: "H1 假设表述", exact: true }),
  ).toHaveValue(/反向广告理解/);
  await page
    .locator(".rd-hypothesis[data-hypothesis-id='h2']")
    .getByRole("button", { name: "删除假设", exact: true })
    .click();
  await expect(page.locator(".rd-model [data-hypothesis-id='h2']")).toHaveCount(
    0,
  );
  await expect(page.locator(".rd-model [data-hypothesis-id='h1']")).toHaveCount(
    1,
  );
  await page
    .locator(".rd-step-nav")
    .getByRole("button", { name: /实施建议/ })
    .click();
  await page
    .getByRole("button", { name: "AI 帮我梳理这一环节", exact: true })
    .click();
  await page.getByRole("button", { name: "保存当前设计", exact: true }).click();
  await expect
    .poll(async () => (await state(page)).quantitative?.method)
    .toContain("横截面问卷");
  const quantSaved = (await state(page)).quantitative!;
  expect(quantSaved.hypotheses).toHaveLength(1);
  expect(quantSaved.hypotheses[0].text).toContain("反向广告理解");
  await page.getByRole("button", { name: /^质性研究/ }).click();
  await page
    .getByRole("button", { name: "保留草稿并切换", exact: true })
    .click();
  await page
    .getByRole("button", { name: "AI 帮我明确研究问题", exact: true })
    .click();
  await page
    .locator(".rd-step-nav")
    .getByRole("button", { name: /对象与主题/ })
    .click();
  await page
    .getByRole("button", { name: "AI 帮我梳理这一环节", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "主题名称", exact: true }),
  ).toHaveCount(3);
  await page
    .locator(".rd-step-nav")
    .getByRole("button", { name: /访谈提纲/ })
    .click();
  await page
    .getByRole("button", { name: "AI 帮我梳理这一环节", exact: true })
    .click();
  await expect
    .poll(async () => (await state(page)).qualitative?.questions.length)
    .toBe(6);
  await page
    .locator(".rd-step-nav")
    .getByRole("button", { name: /对象与主题/ })
    .click();
  await page
    .getByRole("textbox", { name: "主题名称", exact: true })
    .first()
    .fill("观看广告的具体情境");
  await page.getByRole("button", { name: "保存当前设计", exact: true }).click();
  await expect
    .poll(async () => (await state(page)).qualitative?.outlineNeedsReview)
    .toBe(true);
  await page
    .locator(".rd-step-nav")
    .getByRole("button", { name: /实施建议/ })
    .click();
  await page
    .getByRole("button", { name: "AI 帮我梳理这一环节", exact: true })
    .click();
  await page.getByRole("button", { name: "保存当前设计", exact: true }).click();
  await page.reload();
  const saved = await state(page);
  expect(saved.quantitative).toEqual(quantSaved);
  expect(saved.qualitative?.themes[0].title).toBe("观看广告的具体情境");
  expect(saved.qualitative?.questions).toHaveLength(6);
  expect(saved.messages.map((m) => m.content)).toContain(preference);
  expect(saved.quantitativeHistory.length).toBeGreaterThan(0);
  expect(saved.qualitativeHistory.length).toBeGreaterThan(0);
  await expect(page.locator(".rd-model")).toHaveCount(0);
  await page.getByRole("button", { name: "复制普通文字", exact: true }).click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain("研究路径：质性研究");
  expect(text).toContain("观看广告的具体情境");
  expect(text).not.toContain('"themeId"');
  expect(text).not.toContain("H1（");
  await page.evaluate(() => {
    (window as unknown as { printCalls: number }).printCalls = 0;
    window.print = () => {
      (window as unknown as { printCalls: number }).printCalls++;
    };
  });
  await page.getByRole("button", { name: "打印研究设计", exact: true }).click();
  expect(
    await page.evaluate(
      () => (window as unknown as { printCalls: number }).printCalls,
    ),
  ).toBe(1);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".rd-print")).toBeVisible();
  await page.emulateMedia({ media: "screen" });
});

function completedProject(): Project {
  const p = project();
  const fingerprint = researchFingerprint(p);
  const ids = p.library!.items.map((i) => i.id);
  const research = emptyResearchWorkspace();
  research.contexts = [
    {
      id: "context-saved",
      createdAt: at,
      fingerprint,
      sourceIds: ids,
      sections: sections(ids),
    },
  ];
  research.messages = [
    {
      id: "discussion-user",
      role: "user",
      content: preference,
      createdAt: at,
      sourceIds: ids,
      quickQuestions: [],
    },
    {
      id: "discussion-ai",
      role: "assistant",
      content: "明确模拟：已保存的研究建议，不是已验证事实。".repeat(8),
      createdAt: at,
      sourceIds: ids,
      quickQuestions: ["还缺哪些证据？", "怎样缩小对象？", "问卷有什么局限？"],
    },
  ];
  research.preferences = preference;
  const card = {
    title: "用户确认的研究方向",
    question: "大学生对反向广告的理解与品牌态度有什么关系？",
    value: "用户写下的研究价值",
    method: "拟问卷，尚待核查",
    limitations: "补充实际证据",
    evidenceIds: ids,
  };
  research.directions = [
    {
      id: "direction-confirmed",
      createdAt: at,
      fingerprint,
      candidateId: null,
      card,
      concepts: ["心理逆反", "品牌态度"],
    },
  ];
  research.activeDirectionId = "direction-confirmed";
  research.method = "quantitative";
  const input: JourneyInput = {
    task: "quantitative",
    designStep: "variables",
    context: {
      observation,
      fingerprint,
      intent: "",
      concepts: [],
      conceptChoices: [],
      labMessages: [],
      evidence: p.library!.items.map((i) => ({
        id: i.id,
        title: i.paper.title,
        authors: i.paper.authors,
        year: i.paper.year,
        venue: i.paper.venue,
        abstract: i.paper.abstract,
        level: "摘要",
        pages: [],
        reading: [],
        readingStatus: "none",
        attachmentStatus: "none",
      })),
      synthesis: sections(ids),
      synthesisStatus: "current",
      warnings: [],
      messages: [],
      preferences: preference,
      rejectedAngles: [],
      candidates: [],
      confirmed: research.directions[0],
      method: "quantitative",
      quantitative: null,
      qualitative: null,
    },
  };
  research.quantitative = quantitative(input);
  input.context.quantitative = research.quantitative;
  input.designStep = "hypotheses";
  research.quantitative = quantitative(input);
  research.qualitative = qualitative({
    ...input,
    task: "qualitative",
    designStep: "themes",
  });
  p.workflow!.research = research;
  p.workflow!.review = [
    {
      id: "legacy-review",
      title: "旧综述留存",
      body: "旧项目正文不能丢失",
      evidenceIds: ids,
      uncertainty: "历史记录",
      x: 0,
      y: 0,
    },
  ];
  return p;
}

test("失败与数据连续性（明确模拟）：无密钥/401/429/超时/坏格式不覆盖成果，文献删除和项目切换保留两种设计", async ({
  page,
}) => {
  const p = completedProject();
  await seed(page, [p, project("journey-b")]);
  page.on("dialog", (d) => d.accept());
  const before = await state(page);
  let calls = 0;
  const errors = [
    { status: 503, error: "模拟：尚未配置 AI_API_KEY 或 DEEPSEEK_API_KEY" },
    { status: 401, error: "模拟：AI 服务拒绝凭证，请核对密钥权限" },
    { status: 429, error: "模拟：请求频繁，原有内容保留" },
    { status: 504, error: "模拟：连接超过等待时间，请手动重试" },
    { status: 200, error: "坏格式测试，不能写入方向" },
  ];
  await page.route("**/api/research-journey", (route) => {
    const error = errors[calls++];
    return route.fulfill({
      status: error.status,
      json: { error: error.error },
    });
  });
  for (let i = 0; i < errors.length; i++) {
    await page.getByRole("button", { name: "重新梳理", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({
        hasText: i === errors.length - 1 ? "格式不完整" : errors[i].error,
      }),
    ).toBeVisible();
    expect(calls).toBe(i + 1);
    const after = await state(page);
    expect(after.contexts).toEqual(before.contexts);
    expect(after.directions).toEqual(before.directions);
    expect(after.quantitative).toEqual(before.quantitative);
    expect(after.qualitative).toEqual(before.qualitative);
  }
  await page.goto("/literature?mode=library");
  await page
    .getByRole("button", { name: "删除文献", exact: true })
    .first()
    .click();
  await expect(page.locator(".paper-card")).toHaveCount(2);
  await page.goto("/research");
  await expect(
    page.getByText(
      "资料来源已变，已有分析、方向或设计待复核。历史成果全部保留；由你决定是否更新。",
      { exact: true },
    ),
  ).toBeVisible();
  const afterDelete = await state(page);
  expect(afterDelete.directions).toEqual(before.directions);
  expect(afterDelete.quantitative).toEqual(before.quantitative);
  expect(afterDelete.qualitative).toEqual(before.qualitative);
  await page
    .locator(".rj-stages")
    .getByRole("button", { name: /继续研究什么/ })
    .click();
  await page
    .getByLabel("继续讨论研究方向", { exact: true })
    .fill("尚未发送的研究想法也要保留");
  await page
    .locator(".rj-stages")
    .getByRole("button", { name: /我的研究方向/ })
    .click();
  await page.reload();
  await page
    .locator(".rj-stages")
    .getByRole("button", { name: /继续研究什么/ })
    .click();
  await expect(
    page.getByLabel("继续讨论研究方向", { exact: true }),
  ).toHaveValue("尚未发送的研究想法也要保留");
  await page.getByLabel("当前项目", { exact: true }).selectOption("journey-b");
  await expect(page.getByRole("log")).toHaveCount(0);
  await page
    .locator(".rj-stages")
    .getByRole("button", { name: /继续研究什么/ })
    .click();
  await expect(page.getByRole("log")).not.toContainText("已保存的研究建议");
  await expect(
    page.getByLabel("继续讨论研究方向", { exact: true }),
  ).toHaveValue("");
  await page.getByLabel("当前项目", { exact: true }).selectOption("journey-a");
  await expect(page.getByRole("log")).toContainText("已保存的研究建议");
  expect((await snapshot(page)).projects[0].workflow!.review[0].body).toBe(
    "旧项目正文不能丢失",
  );
  expect(calls).toBe(errors.length);
});

test("真实本地无密钥服务返回明确错误，保留已保存方案（无付费模型请求）", async ({
  page,
}) => {
  await seed(page, [completedProject()]);
  page.on("dialog", (dialog) => dialog.accept());
  const before = await state(page);
  const pending = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/research-journey") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "重新梳理", exact: true }).click();
  expect((await pending).status()).toBe(503);
  await expect(
    page.getByRole("alert").filter({ hasText: "AI 服务尚未配置" }),
  ).toBeVisible();
  const after = await state(page);
  expect(after.contexts).toEqual(before.contexts);
  expect(after.directions).toEqual(before.directions);
  expect(after.quantitative).toEqual(before.quantitative);
  expect(after.qualitative).toEqual(before.qualitative);
});

test("慢请求期间调整文献选择：结果保留发起时来源并标记待复核（明确模拟）", async ({
  page,
}) => {
  await seed(page, [completedProject()]);
  page.on("dialog", (dialog) => dialog.accept());
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let receive!: (input: JourneyInput) => void;
  const received = new Promise<JourneyInput>((resolve) => {
    receive = resolve;
  });
  await page.route("**/api/research-journey", async (route) => {
    const input = route.request().postDataJSON() as JourneyInput;
    receive(input);
    await gate;
    await route.fulfill({ json: response(input) });
  });
  try {
    await page.getByRole("button", { name: "重新梳理", exact: true }).click();
    const input = await received;
    const originalIds = input.context.evidence.map((e) => e.id);
    await page.locator(".shared-evidence summary").click();
    await page
      .locator(".shared-evidence input[type='checkbox']")
      .first()
      .uncheck();
    await expect
      .poll(
        async () =>
          (await snapshot(page)).projects[0].workflow!.selection?.length,
      )
      .toBe(2);
    release();
    await expect.poll(async () => (await state(page)).contexts.length).toBe(2);
    const result = (await state(page)).contexts.at(-1)!;
    expect(result.sourceIds).toEqual(originalIds);
    expect(result.fingerprint).toBe(input.context.fingerprint);
    expect((await snapshot(page)).projects[0].workflow!.selection).toHaveLength(
      2,
    );
    expect(result.fingerprint).not.toBe(
      researchFingerprint((await snapshot(page)).projects[0]),
    );
    await expect(
      page.getByText(
        "资料来源已变，已有分析、方向或设计待复核。历史成果全部保留；由你决定是否更新。",
        { exact: true },
      ),
    ).toBeVisible();
  } finally {
    release();
  }
});

test("未失焦的讨论和方向编辑刷新仍可恢复，且不覆盖已确认方向（明确模拟）", async ({
  page,
}) => {
  const p = completedProject();
  p.workflow!.research!.stage = "discussion";
  await seed(page, [p]);
  await page
    .getByLabel("继续讨论研究方向", { exact: true })
    .fill("尚未发送，也没有离开输入框的想法");
  await page.reload();
  await expect(
    page.getByLabel("继续讨论研究方向", { exact: true }),
  ).toHaveValue("尚未发送，也没有离开输入框的想法");
  await page
    .locator(".rj-stages")
    .getByRole("button", { name: /我的研究方向/ })
    .click();
  await page
    .getByRole("button", { name: "编辑已确认方向", exact: true })
    .click();
  await page
    .getByLabel("具体研究问题", { exact: true })
    .fill("正在编辑的新研究问题，尚未最终确认");
  await page.reload();
  await expect(page.getByLabel("具体研究问题", { exact: true })).toHaveValue(
    "正在编辑的新研究问题，尚未最终确认",
  );
  const research = await state(page);
  expect(
    research.directions.find((d) => d.id === research.activeDirectionId)!.card
      .question,
  ).toBe(p.workflow!.research!.directions[0].card.question);
});

test("AI 等待期间保护设计编辑，返回后恢复操作且保留其他步骤（明确模拟）", async ({
  page,
}) => {
  const p = completedProject();
  await seed(page, [p]);
  let release = () => {};
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/research-journey", async (route) => {
    const input = route.request().postDataJSON() as JourneyInput;
    await waiting;
    await route.fulfill({
      json: {
        design: { ...quantitative(input), updatedAt: new Date().toISOString() },
      },
    });
  });
  await page.getByRole("button", { name: "我的研究设计", exact: true }).click();
  const before = await state(page);
  try {
    await page
      .getByRole("button", { name: "重新建议这一环节", exact: true })
      .click();
    await expect(page.locator(".rd-editor")).toHaveJSProperty("inert", true);
    await page.keyboard.press("Tab");
    expect(
      await page
        .locator(".rd-editor")
        .evaluate((e) => e.contains(document.activeElement)),
    ).toBe(false);
    await expect(
      page.getByRole("button", { name: "取消本次请求", exact: true }),
    ).toBeEnabled();
    expect((await state(page)).quantitative).toEqual(before.quantitative);
  } finally {
    release();
  }
  await expect(page.locator(".rd-editor")).toHaveJSProperty("inert", false);
  await expect
    .poll(async () => (await state(page)).quantitativeHistory.length)
    .toBe(before.quantitativeHistory.length + 1);
  expect((await state(page)).quantitative!.variables).toEqual(
    before.quantitative!.variables,
  );
});

test("空标题方向草稿和其他有效输入分别恢复，旧项目链接仍保留项目隔离（明确模拟）", async ({
  page,
}) => {
  const p = completedProject();
  p.workflow!.research!.stage = "directions";
  await seed(page, [p, project("journey-b")]);
  await page
    .getByRole("button", { name: "编辑已确认方向", exact: true })
    .click();
  const original = await state(page);
  await page.getByLabel("方向名称", { exact: true }).fill("");
  await page.reload();
  await expect(page.getByLabel("方向名称", { exact: true })).toHaveValue("");
  expect((await state(page)).directions).toEqual(original.directions);
  await page.evaluate(
    ({ id, base }) => {
      localStorage.setItem(
        `paperi.research.inputs.${id}`,
        JSON.stringify({
          preferences: { base: base.preferences, value: "用户已写下的新偏好" },
          directionDraft: {
            base: base.directionDraft,
            value: { card: { title: 42 } },
          },
        }),
      );
    },
    { id: p.id, base: await state(page) },
  );
  await page.reload();
  await page.getByRole("button", { name: "继续研究什么", exact: true }).click();
  await page.getByText("我的研究偏好与不考虑的角度", { exact: true }).click();
  await expect(page.getByLabel("研究偏好", { exact: true })).toHaveValue(
    "用户已写下的新偏好",
  );
  await page.goto("/literature?mode=context&project=journey-b&history=1");
  await expect(page).toHaveURL(/\/research\?history=1&project=journey-b$/);
  await expect(
    page.getByText("链接属于另一个项目，请先在顶部切换项目。", { exact: true }),
  ).toBeVisible();
});

for (const width of [1440, 390])
  test(`研究工作区视觉复验 ${width}px：紧凑字体、Hero 同源聊天、输入不遮挡、站内可读模型（明确模拟）`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await seed(page, [completedProject()]);
    await expect(page.locator(".rj-section-grid .study-section")).toHaveCount(
      4,
    );
    const body = page.locator(".rj-section-grid .study-section p").first();
    expect(
      await body.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
    ).toBe(15);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/screenshots/research-journey/context-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page
      .locator(".rj-stages")
      .getByRole("button", { name: /继续研究什么/ })
      .click();
    await expect(page.getByRole("log")).toContainText("已保存的研究建议");
    const log = await page.getByRole("log").boundingBox();
    const composer = await page.locator(".rj-chat .lab-composer").boundingBox();
    expect(log!.height).toBeGreaterThan(composer!.height * 2);
    expect(log!.y + log!.height).toBeLessThanOrEqual(composer!.y + 2);
    const chatPaint = await page
      .locator(".rj-chat")
      .evaluate((e) => getComputedStyle(e).backgroundImage);
    expect(chatPaint).toContain("radial-gradient");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/screenshots/research-journey/discussion-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page
      .locator(".rj-stages")
      .getByRole("button", { name: /我的研究设计/ })
      .click();
    await page
      .locator(".rd-step-nav")
      .getByRole("button", { name: /假设与模型/ })
      .click();
    await expect(page.locator(".rd-model")).toBeVisible();
    await expect(page.locator(".rd-model")).toContainText("反向广告感知");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/screenshots/research-journey/design-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
  });
