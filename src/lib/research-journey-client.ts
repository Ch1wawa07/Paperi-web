import { isRecord } from "./exploration";
import { getPDF } from "./local-files";
import type { Project } from "./projects";
import {
  currentResearchDirection,
  researchFingerprint,
  isQualitativeDesign,
  isQuantitativeDesign,
  type ResearchWorkspace,
  type QuantitativeDesign,
  type QualitativeDesign,
} from "./research-workspace";
import {
  isDirectionCard,
  isSections,
  pdfExcerpts,
  sourceFingerprint,
  workflowEvidence,
  type DirectionCard,
  type ReadingSection,
} from "./workflow";
import { selectedConcepts } from "./workbench";

export type JourneyTask =
  | "context"
  | "discussion"
  | "directions"
  | "method"
  | "quantitative"
  | "qualitative";
export type JourneyOptions = {
  message?: string;
  candidateId?: string;
  instruction?: string;
  designStep?: string;
};
export type JourneyEvidence = {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  abstract: string | null;
  level: "PDF节选" | "摘要" | "仅题录";
  pages: { page: number; text: string }[];
  reading: ReadingSection[];
  readingStatus: "none" | "current" | "stale";
  attachmentStatus: "none" | "available" | "missing" | "not-loaded";
};
export type JourneyContext = {
  observation: string;
  intent: string;
  concepts: string[];
  fingerprint: string;
  conceptChoices: { term: string; status: string; explanation: string }[];
  labMessages: { role: "user" | "assistant"; content: string }[];
  evidence: JourneyEvidence[];
  synthesis: ReadingSection[];
  synthesisStatus: "none" | "current" | "stale";
  warnings: string[];
  messages: { role: "user" | "assistant"; content: string }[];
  preferences: string;
  rejectedAngles: string[];
  candidates: { id: string; status: string; card: DirectionCard }[];
  confirmed: ResearchWorkspace["directions"][number] | null;
  method: ResearchWorkspace["method"];
  quantitative: QuantitativeDesign | null;
  qualitative: QualitativeDesign | null;
};
export type JourneyInput = JourneyOptions & {
  task: JourneyTask;
  context: JourneyContext;
};
export type JourneyResult = {
  sections?: ReadingSection[];
  notices?: string[];
  reply?: string;
  quickQuestions?: string[];
  cards?: (DirectionCard & { concepts?: string[] })[];
  advice?: string;
  design?: QuantitativeDesign | QualitativeDesign;
};

const clipSections = (sections: ReadingSection[], max = 7) =>
  sections.slice(0, max).map((s) => ({
    ...s,
    body: s.body.slice(0, 700),
    quote: s.quote.slice(0, 500),
    uncertainty: s.uncertainty.slice(0, 700),
  }));
/** Sends a bounded project digest. Full PDF text is never resent during a conversation. */
export async function buildResearchJourneyInput(
  p: Project,
  research: ResearchWorkspace,
  task: JourneyTask,
  options: JourneyOptions = {},
  signal?: AbortSignal,
): Promise<JourneyInput> {
  const items = workflowEvidence(p);
  if (!items.length)
    throw new Error("请先导入并选择至少一篇文献，再继续研究。");
  if (items.length > 30)
    throw new Error("每次最多使用 30 篇文献，请调整本次选择后分组梳理。");
  const evidence: JourneyEvidence[] = [];
  const warnings: string[] = [];
  let remaining = 36000;
  for (const item of items) {
    signal?.throwIfAborted();
    let pages: JourneyEvidence["pages"] = [];
    let attachmentStatus: JourneyEvidence["attachmentStatus"] = item.attachment
      ? "not-loaded"
      : "none";
    // Only the synthesis task reads stored PDF excerpts. Later tasks use its bounded saved evidence digest.
    if (task === "context" && item.attachment) {
      const file = await getPDF(p.id, item.attachment.id);
      signal?.throwIfAborted();
      if (!file) {
        attachmentStatus = "missing";
        warnings.push(
          `《${item.paper.title.slice(0, 100)}》的PDF在当前浏览器不存在，本次仅使用可用摘要或题录；可重新附加原PDF。`,
        );
      }
      if (file) {
        attachmentStatus = "available";
        const budget = Math.min(
          12000,
          Math.floor(remaining / (items.length - evidence.length)),
        );
        pages = pdfExcerpts(file.pages, budget);
        remaining -= pages.reduce((n, page) => n + page.text.length, 0);
      }
    }
    const reading = (p.workflow?.analyses ?? [])
      .filter((a) => a.kind === "reading" && a.sourceIds.includes(item.id))
      .at(-1);
    evidence.push({
      id: item.id,
      title: item.paper.title.slice(0, 800),
      authors: item.paper.authors.slice(0, 6),
      year: item.paper.year,
      venue: item.paper.venue,
      abstract:
        item.paper.abstract?.slice(0, items.length > 10 ? 800 : 2400) ?? null,
      level: pages.length ? "PDF节选" : item.paper.abstract ? "摘要" : "仅题录",
      pages,
      attachmentStatus,
      readingStatus: !reading
        ? "none"
        : reading.fingerprint === sourceFingerprint(p)
          ? "current"
          : "stale",
      reading: reading
        ? clipSections(reading.sections, items.length > 10 ? 3 : 7).map((s) =>
            items.length > 10
              ? {
                  ...s,
                  body: s.body.slice(0, 180),
                  quote: s.quote.slice(0, 180),
                  uncertainty: s.uncertainty.slice(0, 120),
                }
              : s,
          )
        : [],
    });
  }
  const sourceIds = new Set(items.map((item) => item.id));
  const confirmed = currentResearchDirection(research);
  if (confirmed?.card.evidenceIds.some((id) => !sourceIds.has(id)))
    warnings.push(
      "已确认方向的部分文献不在本次资料中；方向和已有设计已保留，请核对旧依据。",
    );
  const currentDesign =
    task === "quantitative"
      ? research.quantitative
      : task === "qualitative"
        ? research.qualitative
        : null;
  if (currentDesign && currentDesign.fingerprint !== researchFingerprint(p))
    warnings.push(
      "当前设计基于此前资料，本次只更新所选步骤；其余内容仍需复核，不会自动删除。",
    );
  const context: JourneyContext = {
    observation: p.observation.slice(0, 2000),
    fingerprint: researchFingerprint(p),
    intent: (
      p.exploration?.seed?.workingQuestion ??
      p.exploration?.navigation?.guide?.understanding ??
      ""
    ).slice(0, 1500),
    concepts: selectedConcepts(p),
    conceptChoices: (p.exploration?.navigation?.concepts ?? []).map((c) => ({
      term: c.term,
      status: c.status,
      explanation: c.explanation.slice(0, 300),
    })),
    labMessages: (p.exploration?.messages ?? [])
      .slice(-4)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 700) })),
    evidence,
    warnings,
    synthesisStatus: !research.contexts.length
      ? "none"
      : research.contexts.at(-1)?.fingerprint === researchFingerprint(p)
        ? "current"
        : "stale",
    synthesis: clipSections(research.contexts.at(-1)?.sections ?? [], 5),
    messages: research.messages
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 1200) })),
    preferences: research.preferences.slice(0, 3000),
    rejectedAngles: research.rejectedAngles
      .slice(-12)
      .map((s) => s.slice(0, 500)),
    candidates: research.candidateBatches
      .slice(-2)
      .flatMap((b) => b.cards)
      .map((c) => ({
        id: c.id,
        status: c.status,
        card: {
          title: c.title,
          question: c.question,
          value: c.value,
          method: c.method,
          limitations: c.limitations,
          evidenceIds: c.evidenceIds,
        },
      })),
    confirmed,
    method: research.method,
    quantitative: task === "quantitative" ? research.quantitative : null,
    qualitative: task === "qualitative" ? research.qualitative : null,
  };
  if (JSON.stringify(context).length > 240000)
    throw new Error(
      "本次上下文过多，请减少所选文献后分组研究。尚未调用AI，原有资料和草稿保留。",
    );
  return { task, context, ...options };
}

export function isJourneyResult(
  task: JourneyTask,
  value: unknown,
): value is JourneyResult {
  if (!isRecord(value)) return false;
  const text = (s: unknown, max = 6000) =>
    typeof s === "string" && !!s.trim() && s.length <= max;
  if (task === "context")
    return isSections(value.sections) && value.sections.length === 4;
  if (task === "discussion")
    return (
      text(value.reply) &&
      Array.isArray(value.quickQuestions) &&
      value.quickQuestions.length >= 3 &&
      value.quickQuestions.length <= 5 &&
      value.quickQuestions.every((q) => text(q, 300))
    );
  if (task === "directions")
    return (
      Array.isArray(value.cards) &&
      value.cards.length <= 3 &&
      value.cards.every(isDirectionCard)
    );
  if (task === "method") return text(value.advice);
  return task === "quantitative"
    ? isQuantitativeDesign(value.design)
    : isQualitativeDesign(value.design);
}
export async function requestResearchJourney(
  p: Project,
  research: ResearchWorkspace,
  task: JourneyTask,
  signal: AbortSignal,
  options: JourneyOptions = {},
): Promise<JourneyResult> {
  const input = await buildResearchJourneyInput(
    p,
    research,
    task,
    options,
    signal,
  );
  const response = await fetch("/api/research-journey", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.any([signal, AbortSignal.timeout(65000)]),
  });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      isRecord(value) && typeof value.error === "string"
        ? value.error
        : "研究助手暂时未完成，请手动重试。原有内容保留。",
    );
  if (!isJourneyResult(task, value))
    throw new Error(
      "研究助手返回格式不完整，未保存。原有内容保留，可以手动重试。",
    );
  return { ...value, notices: input.context.warnings };
}
