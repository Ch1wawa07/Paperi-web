import { test, expect } from "@playwright/test";
import { emptyWorkflow, isWorkflow } from "../src/lib/workflow";
import { emptyLibrary } from "../src/lib/literature";
import { importedPaper } from "../src/lib/bibliography";
import { parseSnapshot, type Project } from "../src/lib/projects";
import { emptyWorkbench } from "../src/lib/workbench";
import {
  emptyResearchWorkspace, isResearchWorkspace, isQuantitativeDesign, isQualitativeDesign,
  researchState, researchFingerprint, renameVariable, removeVariable, removeHypothesis,
  updateQualitativeTheme, removeQualitativeTheme, researchDesignPlainText,
  type QuantitativeDesign, type QualitativeDesign,
} from "../src/lib/research-workspace";

const at = "2026-10-26T00:00:00Z";
const direction = { title: "明确标记的测试方向", question: "测试关系是否成立", value: "仅验证状态流转", method: "问卷候选", limitations: "不是学术结论", evidenceIds: ["paper-a"] };
const project: Project = {
  id: "project-a", name: "模拟数据隔离项目", discipline: "广告学", status: "starting", observation: "测试原始问题",
  createdAt: at, updatedAt: at,
  library: { ...emptyLibrary(), items: [{ id: "paper-a", paper: importedPaper({ title: "明确标记的模拟论文" }), categoryIds: [], note: "用户笔记", savedAt: at, updatedAt: at }] },
};
const base = { id: "design-a", createdAt: at, updatedAt: at, fingerprint: "source", directionId: "direction-a", sourceIds: ["paper-a"], confirmed: false,
  question: "用户编辑的问题", value: "为何研究", evidenceGap: "仅有测试题录" };
const quant = (): QuantitativeDesign => ({ ...base,
  variables: [
    { id: "x", name: "测试说服认知", role: "X", explanation: "测试解释", rationale: "候选", evidenceIds: ["paper-a"], uncertainty: "待核实", confirmed: true },
    { id: "y", name: "测试品牌态度", role: "Y", explanation: "测试解释", rationale: "候选", evidenceIds: ["paper-a"], uncertainty: "待核实", confirmed: true },
    { id: "w", name: "测试调节因素", role: "W", explanation: "测试解释", rationale: "候选", evidenceIds: [], uncertainty: "待核实", confirmed: false },
  ],
  hypotheses: [
    { id: "h1", from: "x", to: "y", text: "测试说服认知与测试品牌态度可能相关", rationale: "待检验", evidenceIds: ["paper-a"], confirmed: true },
    { id: "h2", from: "x", to: "y", moderatorId: "w", text: "测试调节因素可能改变该关系", rationale: "待检验", evidenceIds: [], confirmed: false },
  ],
  method: "横截面问卷", target: "大学生", sampling: "便利样本的局限", operationalization: "需核查量表", analysis: "相关分析候选", limitations: "不能据此断言因果",
});
const qual = (): QualitativeDesign => ({ ...base, id: "qual-a", target: "可接触学生", setting: "日常广告接触", themes: [
  { id: "t1", title: "解释体验", explanation: "开放探索" }, { id: "t2", title: "情境", explanation: "理解背景" },
], questions: [{ id: "q1", themeId: "t1", text: "请谈谈你的经历" }, { id: "q2", themeId: "t2", text: "当时是什么情境" }],
  method: "访谈候选", sampling: "自愿参与", analysis: "主题分析候选", ethics: "取得知情同意，去标识", limitations: "不能代表所有群体", outlineNeedsReview: false,
});

test("新增研究状态向后兼容；旧项目、精析、PDF标识、旧设计原样保留，读取适配不写入", () => {
  const f = emptyWorkflow();
  f.direction = { card: direction, text: "已确认的旧方向", evidenceIds: ["paper-a"], fingerprint: "old" };
  f.review = [{ id: "old-review", title: "旧综述", body: "用户原稿", evidenceIds: ["paper-a"], uncertainty: "待核对", x: 1, y: 2 }];
  f.analyses = [{ id: "old-reading", kind: "reading", fingerprint: "old", sourceIds: ["paper-a"], createdAt: at,
    sections: [{ title: "旧精析", body: "旧记录", evidenceIds: ["paper-a"], quote: "", page: null, uncertainty: "待核对" }] }];
  const old = { ...project, workflow: f,
    library: { ...project.library!, items: project.library!.items.map(i => ({ ...i, attachment: { id: "pdf-owned-by-original-project", name: "测试文献.pdf", pages: 3, characters: 1300, updatedAt: at } })) },
    workbench: { ...emptyWorkbench(), design: { path: "quantitative" as const, nodes: [{ id: "old-node", kind: "variable", title: "旧变量", body: "旧设计原稿", x: 1, y: 2, status: "confirmed" as const, evidenceIds: ["paper-a"], uncertainty: "旧版内容" }], edges: [] } },
  };
  const raw = JSON.stringify({ version: 1, revision: 7, activeId: old.id, projects: [old] });
  const restored = parseSnapshot(raw);
  expect(JSON.stringify(restored)).toBe(raw);
  const adapted = researchState(restored.projects[0]);
  expect(adapted.directions[0].card.question).toBe(direction.question);
  expect(restored.projects[0].workflow?.research).toBeUndefined();
  expect(restored.projects[0].workflow?.review[0].body).toBe("用户原稿");
  expect(restored.projects[0].workflow?.analyses[0].sections[0].body).toBe("旧记录");
  expect(restored.projects[0].library?.items[0].attachment?.id).toBe("pdf-owned-by-original-project");
  expect(restored.projects[0].workbench?.design.nodes[0].body).toBe("旧设计原稿");
  expect(isWorkflow(f)).toBe(true);
  expect(isResearchWorkspace(adapted)).toBe(true);
  expect(isWorkflow({ ...f, research: adapted })).toBe(true);
});

test("定量变量改名、删除与假设模型关系同步，拒绝孤儿和无效关系", () => {
  const design = quant();
  expect(isQuantitativeDesign(design)).toBe(true);
  const renamed = renameVariable(design, "x", "用户自定名称");
  expect(renamed.variables[0].name).toBe("用户自定名称");
  expect(renamed.hypotheses[0].text).toBe("用户自定名称与测试品牌态度可能相关");
  expect(renamed.hypotheses[0].confirmed).toBe(false);
  expect(renamed.hypotheses[0].from).toBe("x");
  expect(removeHypothesis(renamed, "h2").hypotheses.map(h => h.id)).toEqual(["h1"]);
  expect(removeVariable(renamed, "w").hypotheses.map(h => h.id)).toEqual(["h1"]);
  const deleted = removeVariable(renamed, "x");
  expect(deleted.hypotheses).toEqual([]);
  expect(isQuantitativeDesign(deleted)).toBe(true);
  expect(isQuantitativeDesign({ ...design, hypotheses: [{ ...design.hypotheses[0], to: "missing" }] })).toBe(false);
  expect(isQuantitativeDesign({ ...design, hypotheses: [{ ...design.hypotheses[0], to: "x" }] })).toBe(false);
  expect(isQuantitativeDesign({ ...design, hypotheses: [{ ...design.hypotheses[0], moderatorId: "x" }] })).toBe(false);
  expect(design.variables[0].name).toBe("测试说服认知");
});

test("质性主题独立编辑，关联提纲标待核对，删除无悬空引用且不出现量化结构", () => {
  const original = qual();
  const edited = updateQualitativeTheme(original, "t1", { title: "新的开放主题" });
  expect(edited.outlineNeedsReview).toBe(true);
  expect(edited.questions).toEqual(original.questions);
  const deleted = removeQualitativeTheme(edited, "t1");
  expect(deleted.questions.map(q => q.id)).toEqual(["q2"]);
  expect(isQualitativeDesign(deleted)).toBe(true);
  expect(isQualitativeDesign({ ...original, questions: [{ id: "q3", themeId: "missing", text: "无效" }] })).toBe(false);
  const report = researchDesignPlainText(original, ["模拟论文"]);
  expect(report).toContain("初步访谈 / 观察提纲");
  expect(report).not.toMatch(/自变量|因变量|H1|```|\"themeId\"/);
  expect(researchDesignPlainText(quant())).toContain("拟检验假设");
});

test("两个设计路径和历史可恢复；确认方向唯一；无效数据不覆盖整个项目", () => {
  const r = emptyResearchWorkspace();
  r.directions = [{ id: "direction-a", createdAt: at, fingerprint: "source", candidateId: null, card: direction, concepts: [] }];
  r.activeDirectionId = "direction-a";
  r.quantitative = quant(); r.qualitative = qual(); r.method = "qualitative";
  r.quantitativeHistory = [{ ...quant(), id: "older-quant", question: "上次的用户原稿" }];
  r.directionDraft = { candidateId: null, card: { ...direction, question: "尚未确认的用户编辑" } };
  r.messages = [{ id: "m1", createdAt: at, role: "user", content: "偏问卷，不做复杂实验", sourceIds: [], quickQuestions: [] }];
  expect(isResearchWorkspace(r)).toBe(true);
  const p = { ...project, workflow: { ...emptyWorkflow(), research: r } };
  const restored = parseSnapshot(JSON.stringify({ version: 1, revision: 1, projects: [p], activeId: p.id })).projects[0];
  expect(restored.workflow?.research).toEqual(r);
  expect(isResearchWorkspace({ ...r, activeDirectionId: "missing" })).toBe(false);
  expect(isResearchWorkspace({ ...r, quantitative: { ...r.quantitative, directionId: "missing" } })).toBe(false);
  expect(() => parseSnapshot(JSON.stringify({ version: 1, revision: 1, projects: [{ ...p, workflow: { ...p.workflow, research: { ...r, activeDirectionId: "missing" } } }], activeId: p.id }))).toThrow("为保护原有内容");
});

test("资料变更使依赖过期，但研究对话与设计修改不自我失效、不清除确认内容", () => {
  const p = { ...project, workflow: emptyWorkflow() };
  const first = researchFingerprint(p);
  const r = emptyResearchWorkspace();
  r.preferences = "大学生，问卷";
  r.directions = [{ id: "direction-a", createdAt: at, fingerprint: first, candidateId: null, card: direction, concepts: [] }];
  r.activeDirectionId = "direction-a"; r.quantitative = { ...quant(), fingerprint: first };
  const edited = { ...p, workflow: { ...p.workflow, research: r } };
  expect(researchFingerprint(edited)).toBe(first);
  const deleted = { ...edited, library: { ...emptyLibrary(), items: [] } };
  expect(researchFingerprint(deleted)).not.toBe(first);
  expect(researchState(deleted).quantitative?.question).toBe("用户编辑的问题");
  expect(researchState(deleted).activeDirectionId).toBe("direction-a");
  const updatedReading = { ...edited, workflow: { ...edited.workflow, analyses: [{ id: "a", kind: "reading" as const, fingerprint: "r", sourceIds: ["paper-a"], createdAt: at, sections: [] }] } };
  expect(researchFingerprint(updatedReading)).not.toBe(first);
  expect(researchFingerprint({ ...edited, observation: "换一个项目问题" })).not.toBe(first);
});
