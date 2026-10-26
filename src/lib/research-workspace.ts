import { isRecord } from "./exploration";
import type { Project } from "./projects";
import { selectedConcepts } from "./workbench";
import {
  hash,
  isDirectionCard,
  isSections,
  type DirectionCard,
  type ReadingSection,
} from "./workflow";

export type ResearchStage = "context" | "discussion" | "directions" | "design";
export type ResearchMethod = "quantitative" | "qualitative";
export type ResearchContext = {
  id: string;
  createdAt: string;
  fingerprint: string;
  sourceIds: string[];
  sections: ReadingSection[];
};
export type ResearchMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sourceIds: string[];
  quickQuestions: string[];
  fingerprint?: string;
};
export type DirectionCandidate = DirectionCard & {
  id: string;
  createdAt: string;
  fingerprint: string;
  status: "candidate" | "rejected";
  concepts: string[];
};
export type CandidateBatch = {
  id: string;
  createdAt: string;
  fingerprint: string;
  cards: DirectionCandidate[];
};
export type ConfirmedDirection = {
  id: string;
  createdAt: string;
  fingerprint: string;
  candidateId: string | null;
  card: DirectionCard;
  concepts: string[];
};
export type ResearchVariable = {
  id: string;
  name: string;
  role: "X" | "Y" | "M" | "W" | "control";
  explanation: string;
  rationale: string;
  evidenceIds: string[];
  uncertainty: string;
  confirmed: boolean;
};
export type ResearchHypothesis = {
  id: string;
  from: string;
  to: string;
  moderatorId?: string;
  text: string;
  rationale: string;
  evidenceIds: string[];
  confirmed: boolean;
};
export type DesignBase = {
  id: string;
  createdAt: string;
  updatedAt: string;
  fingerprint: string;
  directionId: string;
  sourceIds: string[];
  confirmed: boolean;
  question: string;
  value: string;
  evidenceGap: string;
};
export type QuantitativeDesign = DesignBase & {
  variables: ResearchVariable[];
  hypotheses: ResearchHypothesis[];
  method: string;
  target: string;
  sampling: string;
  operationalization: string;
  analysis: string;
  limitations: string;
};
export type ResearchTheme = { id: string; title: string; explanation: string };
export type InterviewQuestion = { id: string; themeId: string; text: string };
export type QualitativeDesign = DesignBase & {
  target: string;
  setting: string;
  themes: ResearchTheme[];
  questions: InterviewQuestion[];
  method: string;
  sampling: string;
  analysis: string;
  ethics: string;
  limitations: string;
  outlineNeedsReview: boolean;
};
/** Additive, versioned state. Legacy review/design and PDF ownership stay untouched. */
export type ResearchWorkspace = {
  version: 1;
  stage: ResearchStage;
  discussionCandidateId?: string | null;
  contexts: ResearchContext[];
  messages: ResearchMessage[];
  discussionDraft: string;
  preferences: string;
  rejectedAngles: string[];
  candidateBatches: CandidateBatch[];
  directions: ConfirmedDirection[];
  activeDirectionId: string | null;
  directionDraft?: { candidateId: string | null; card: DirectionCard } | null;
  method: ResearchMethod | null;
  methodAdvice: string;
  quantitative: QuantitativeDesign | null;
  qualitative: QualitativeDesign | null;
  quantitativeHistory: QuantitativeDesign[];
  qualitativeHistory: QualitativeDesign[];
};
export const emptyResearchWorkspace = (): ResearchWorkspace => ({
  version: 1,
  stage: "context",
  contexts: [],
  messages: [],
  discussionDraft: "",
  preferences: "",
  rejectedAngles: [],
  candidateBatches: [],
  directions: [],
  activeDirectionId: null,
  method: null,
  methodAdvice: "",
  quantitative: null,
  qualitative: null,
  quantitativeHistory: [],
  qualitativeHistory: [],
});

const text = (v: unknown, max = 4000): v is string =>
  typeof v === "string" && v.length <= max;
const id = (v: unknown): v is string => text(v, 250) && !!v.trim();
const date = (v: unknown): v is string =>
  text(v, 100) && Number.isFinite(Date.parse(v));
const list = (v: unknown, max = 300, itemMax = 250): v is string[] =>
  Array.isArray(v) && v.length <= max && v.every((x) => text(x, itemMax));
const ids = (v: unknown): v is string[] =>
  list(v) && v.every(id) && new Set(v).size === v.length;
const unique = <T extends { id: string }>(values: T[]) =>
  new Set(values.map((v) => v.id)).size === values.length;
const dated = (v: Record<string, unknown>) =>
  id(v.id) && date(v.createdAt) && text(v.fingerprint, 12000);
export function isResearchContext(v: unknown): v is ResearchContext {
  return isRecord(v) && dated(v) && ids(v.sourceIds) && isSections(v.sections);
}
export function isResearchMessage(v: unknown): v is ResearchMessage {
  return (
    isRecord(v) &&
    id(v.id) &&
    date(v.createdAt) &&
    ["user", "assistant"].includes(String(v.role)) &&
    (v.fingerprint === undefined || text(v.fingerprint, 12000)) &&
    text(v.content, 6000) &&
    ids(v.sourceIds) &&
    list(v.quickQuestions, 5, 300)
  );
}
export function isDirectionCandidate(v: unknown): v is DirectionCandidate {
  return (
    isRecord(v) &&
    dated(v) &&
    ["candidate", "rejected"].includes(String(v.status)) &&
    list(v.concepts, 24, 80) &&
    isDirectionCard(v)
  );
}
export function isCandidateBatch(v: unknown): v is CandidateBatch {
  return (
    isRecord(v) &&
    dated(v) &&
    Array.isArray(v.cards) &&
    v.cards.length <= 3 &&
    v.cards.every(isDirectionCandidate) &&
    unique(v.cards)
  );
}
export function isConfirmedDirection(v: unknown): v is ConfirmedDirection {
  return (
    isRecord(v) &&
    dated(v) &&
    (v.candidateId === null || id(v.candidateId)) &&
    isDirectionCard(v.card) &&
    list(v.concepts, 24, 80)
  );
}
export function isResearchVariable(v: unknown): v is ResearchVariable {
  return (
    isRecord(v) &&
    id(v.id) &&
    text(v.name, 120) &&
    !!v.name.trim() &&
    ["X", "Y", "M", "W", "control"].includes(String(v.role)) &&
    text(v.explanation, 1600) &&
    text(v.rationale, 1600) &&
    ids(v.evidenceIds) &&
    text(v.uncertainty, 1600) &&
    typeof v.confirmed === "boolean"
  );
}
export function isResearchHypothesis(v: unknown): v is ResearchHypothesis {
  return (
    isRecord(v) &&
    id(v.id) &&
    id(v.from) &&
    id(v.to) &&
    v.from !== v.to &&
    (v.moderatorId === undefined || id(v.moderatorId)) &&
    text(v.text, 1600) &&
    text(v.rationale, 1600) &&
    ids(v.evidenceIds) &&
    typeof v.confirmed === "boolean"
  );
}
function isDesignBase(v: Record<string, unknown>) {
  return (
    dated(v) &&
    date(v.updatedAt) &&
    id(v.directionId) &&
    ids(v.sourceIds) &&
    typeof v.confirmed === "boolean" &&
    text(v.question) &&
    text(v.value) &&
    text(v.evidenceGap)
  );
}
export function isQuantitativeDesign(v: unknown): v is QuantitativeDesign {
  if (
    !isRecord(v) ||
    !isDesignBase(v) ||
    ![
      "method",
      "target",
      "sampling",
      "operationalization",
      "analysis",
      "limitations",
    ].every((k) => text(v[k])) ||
    !Array.isArray(v.variables) ||
    v.variables.length > 12 ||
    !v.variables.every(isResearchVariable) ||
    !unique(v.variables) ||
    !Array.isArray(v.hypotheses) ||
    v.hypotheses.length > 12 ||
    !v.hypotheses.every(isResearchHypothesis) ||
    !unique(v.hypotheses)
  )
    return false;
  const variableIds = new Set(v.variables.map((x) => x.id));
  return v.hypotheses.every(
    (h) =>
      variableIds.has(h.from) &&
      variableIds.has(h.to) &&
      (h.moderatorId === undefined ||
        (variableIds.has(h.moderatorId) &&
          h.moderatorId !== h.from &&
          h.moderatorId !== h.to)),
  );
}
export function isQualitativeDesign(v: unknown): v is QualitativeDesign {
  if (
    !isRecord(v) ||
    !isDesignBase(v) ||
    ![
      "target",
      "setting",
      "method",
      "sampling",
      "analysis",
      "ethics",
      "limitations",
    ].every((k) => text(v[k])) ||
    typeof v.outlineNeedsReview !== "boolean" ||
    !Array.isArray(v.themes) ||
    v.themes.length > 12 ||
    !v.themes.every(
      (t) =>
        isRecord(t) &&
        id(t.id) &&
        text(t.title, 160) &&
        text(t.explanation, 1600),
    ) ||
    !Array.isArray(v.questions) ||
    v.questions.length > 20 ||
    !v.questions.every(
      (q) => isRecord(q) && id(q.id) && id(q.themeId) && text(q.text, 1600),
    )
  )
    return false;
  const themes = v.themes as ResearchTheme[];
  const questions = v.questions as InterviewQuestion[];
  return (
    unique(themes) &&
    unique(questions) &&
    questions.every((q) => themes.some((t) => t.id === q.themeId))
  );
}
export function isResearchWorkspace(v: unknown): v is ResearchWorkspace {
  if (
    !isRecord(v) ||
    (v.discussionCandidateId !== undefined &&
      v.discussionCandidateId !== null &&
      !id(v.discussionCandidateId)) ||
    v.version !== 1 ||
    !["context", "discussion", "directions", "design"].includes(
      String(v.stage),
    ) ||
    !text(v.discussionDraft, 6000) ||
    !text(v.preferences, 6000) ||
    !list(v.rejectedAngles, 100, 2000) ||
    !(
      v.method === null ||
      ["quantitative", "qualitative"].includes(String(v.method))
    ) ||
    !text(v.methodAdvice, 6000)
  )
    return false;
  if (
    !Array.isArray(v.contexts) ||
    v.contexts.length > 100 ||
    !v.contexts.every(isResearchContext) ||
    !unique(v.contexts) ||
    !Array.isArray(v.messages) ||
    v.messages.length > 200 ||
    !v.messages.every(isResearchMessage) ||
    !unique(v.messages) ||
    !Array.isArray(v.candidateBatches) ||
    v.candidateBatches.length > 100 ||
    !v.candidateBatches.every(isCandidateBatch) ||
    !unique(v.candidateBatches) ||
    !Array.isArray(v.directions) ||
    v.directions.length > 100 ||
    !v.directions.every(isConfirmedDirection) ||
    !unique(v.directions) ||
    !(
      v.activeDirectionId === null ||
      v.directions.some((d) => d.id === v.activeDirectionId)
    ) ||
    !(
      v.directionDraft === undefined ||
      v.directionDraft === null ||
      (isRecord(v.directionDraft) &&
        (v.directionDraft.candidateId === null ||
          id(v.directionDraft.candidateId)) &&
        isDirectionCard(v.directionDraft.card))
    ) ||
    !(v.quantitative === null || isQuantitativeDesign(v.quantitative)) ||
    !(v.qualitative === null || isQualitativeDesign(v.qualitative)) ||
    !Array.isArray(v.quantitativeHistory) ||
    v.quantitativeHistory.length > 100 ||
    !v.quantitativeHistory.every(isQuantitativeDesign) ||
    !Array.isArray(v.qualitativeHistory) ||
    v.qualitativeHistory.length > 100 ||
    !v.qualitativeHistory.every(isQualitativeDesign)
  )
    return false;
  const directionIds = new Set(v.directions.map((d) => d.id));
  return [
    v.quantitative,
    v.qualitative,
    ...v.quantitativeHistory,
    ...v.qualitativeHistory,
  ].every(
    (d) =>
      d === null || (isRecord(d) && directionIds.has(String(d.directionId))),
  );
}

export const currentResearchDirection = (r: ResearchWorkspace) =>
  r.directions.find((d) => d.id === r.activeDirectionId) ?? null;

/** A read adapter only: no writes, deletions, or invented migration of the old canvas. */
export function researchState(p: Project): ResearchWorkspace {
  if (p.workflow?.research) return p.workflow.research;
  const r = emptyResearchWorkspace();
  const old = p.workflow?.direction;
  if (old?.card) {
    const confirmed: ConfirmedDirection = {
      id: "legacy-direction",
      createdAt: p.updatedAt,
      fingerprint: old.fingerprint,
      candidateId: null,
      card: old.card,
      concepts: selectedConcepts(p),
    };
    r.directions = [confirmed];
    r.activeDirectionId = confirmed.id;
  }
  const oldAnalyses = (p.workflow?.analyses ?? []).filter(
    (a) => a.kind === "directions" && a.synthesis?.length,
  );
  r.contexts = oldAnalyses.map((a) => ({
    id: `legacy-${a.id}`,
    createdAt: a.createdAt,
    fingerprint: a.fingerprint,
    sourceIds: a.sourceIds,
    sections: a.synthesis!,
  }));
  r.candidateBatches = oldAnalyses
    .filter((a) => a.cards?.length)
    .map((a) => ({
      id: `legacy-${a.id}`,
      createdAt: a.createdAt,
      fingerprint: a.fingerprint,
      cards: a.cards!.map((c, i) => ({
        ...c,
        id: `legacy-${a.id}-${i}`,
        createdAt: a.createdAt,
        fingerprint: a.fingerprint,
        status: "candidate",
        concepts: selectedConcepts(p),
      })),
    }));
  return r;
}

/** Only source dependencies; messages, direction choices and design edits cannot invalidate themselves. */
export function researchFingerprint(p: Project) {
  const selected = p.workflow?.selection;
  const sourceIds = new Set(
    (p.library?.items ?? [])
      .filter((i) => selected == null || selected.includes(i.id))
      .map((i) => i.id),
  );
  const latestReadings = new Map<string, unknown>();
  for (const a of p.workflow?.analyses ?? [])
    if (a.kind === "reading") {
      for (const sourceId of a.sourceIds)
        if (sourceIds.has(sourceId))
          latestReadings.set(sourceId, [
            a.id,
            a.fingerprint,
            a.createdAt,
            a.sections,
          ]);
    }
  return hash([
    p.observation,
    p.exploration?.seed?.workingQuestion ?? "",
    selectedConcepts(p),
    p.workflow?.selection ?? null,
    (p.library?.items ?? []).map((i) => [i.id, i.paper, i.attachment]),
    [...latestReadings],
  ]);
}

export function renameVariable(
  design: QuantitativeDesign,
  variableId: string,
  name: string,
): QuantitativeDesign {
  const before = design.variables.find((v) => v.id === variableId)?.name;
  if (!before || !name.trim() || before === name) return design;
  return {
    ...design,
    confirmed: false,
    variables: design.variables.map((v) =>
      v.id === variableId ? { ...v, name, confirmed: false } : v,
    ),
    hypotheses: design.hypotheses.map((h) =>
      [h.from, h.to, h.moderatorId].includes(variableId)
        ? { ...h, text: h.text.split(before).join(name), confirmed: false }
        : h,
    ),
  };
}
export function removeVariable(
  design: QuantitativeDesign,
  variableId: string,
): QuantitativeDesign {
  return {
    ...design,
    confirmed: false,
    variables: design.variables.filter((v) => v.id !== variableId),
    hypotheses: design.hypotheses.filter(
      (h) => ![h.from, h.to, h.moderatorId].includes(variableId),
    ),
  };
}
export function removeHypothesis(
  design: QuantitativeDesign,
  hypothesisId: string,
): QuantitativeDesign {
  return {
    ...design,
    confirmed: false,
    hypotheses: design.hypotheses.filter((h) => h.id !== hypothesisId),
  };
}
export function updateQualitativeTheme(
  design: QualitativeDesign,
  themeId: string,
  patch: Partial<Pick<ResearchTheme, "title" | "explanation">>,
): QualitativeDesign {
  return {
    ...design,
    confirmed: false,
    outlineNeedsReview: true,
    themes: design.themes.map((t) =>
      t.id === themeId ? { ...t, ...patch } : t,
    ),
  };
}
export function removeQualitativeTheme(
  design: QualitativeDesign,
  themeId: string,
): QualitativeDesign {
  return {
    ...design,
    confirmed: false,
    outlineNeedsReview: true,
    themes: design.themes.filter((t) => t.id !== themeId),
    questions: design.questions.filter((q) => q.themeId !== themeId),
  };
}

export function researchDesignPlainText(
  design: QuantitativeDesign | QualitativeDesign,
  titles: string[] = [],
) {
  const general = `我的研究设计\n\n状态：${design.confirmed ? "用户已确认的初步方案" : "AI 建议 / 用户编辑草稿，尚待确认"}\n\n我研究什么：${design.question}\n\n为什么值得研究：${design.value}\n\n文献依据：${titles.join("；") || "待补充核查"}\n\n证据缺口：${design.evidenceGap}\n`;
  if ("variables" in design)
    return (
      general +
      `\n研究路径：定量研究\n\n核心变量\n${design.variables.map((v) => `${v.name}（${v.role === "control" ? "控制变量" : v.role}，${v.confirmed ? "用户已确认" : "候选"}）：${v.explanation}\n选择理由：${v.rationale}\n待核查：${v.uncertainty}`).join("\n\n")}\n\n拟检验假设\n${design.hypotheses.map((h, i) => `H${i + 1}（${h.confirmed ? "用户已确认，仍待检验" : "候选，待检验"}）：${h.text}\n逻辑依据：${h.rationale}`).join("\n\n")}\n\n初步方法：${design.method}\n研究对象：${design.target}\n样本获取：${design.sampling}\n操作化思路：${design.operationalization}\n分析建议：${design.analysis}\n方法限制：${design.limitations}\n\n所有关系为拟检验关系，用户确认不等于文献已验证或因果成立。`
    );
  return (
    general +
    `\n研究路径：质性研究\n\n对象与情境：${design.target}；${design.setting}\n\n探索主题\n${design.themes.map((t) => `${t.title}：${t.explanation}`).join("\n")}\n\n初步访谈 / 观察提纲${design.outlineNeedsReview ? "（主题已修改，需核对提纲）" : ""}\n${design.questions.map((q, i) => `${i + 1}. ${q.text}`).join("\n")}\n\n初步方法：${design.method}\n招募与样本考虑：${design.sampling}\n分析路径：${design.analysis}\n伦理与隐私：${design.ethics}\n可行性与限制：${design.limitations}\n\n这是可修改的初步研究建议，访谈尚未执行，未生成研究发现。`
  );
}
