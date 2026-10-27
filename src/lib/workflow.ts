import { isRecord } from "./exploration";
import { safeWebURL } from "./literature";
import type { Project } from "./projects";
import { selectedConcepts } from "./workbench";
import {
  isResearchWorkspace,
  type ResearchWorkspace,
} from "./research-workspace";
export type ReadingFact = {
  evidenceId?: string;
  text: string;
  quote: string;
  page: number | null;
};
export type ReadingFinding = {
  question: string;
  conclusion: string;
  support: "supported" | "not-supported" | "not-tested" | "unclear";
  quote: string;
  page: number | null;
};
export type ReadingSection = {
  facts?: ReadingFact[];
  findings?: ReadingFinding[];
  suggestion?: string;
  issue?: { code: string; message: string };
  title: string;
  body: string;
  evidenceIds: string[];
  quote: string;
  page: number | null;
  uncertainty: string;
  evidenceStatus?: "verified" | "insufficient" | "proposal";
};
export type DirectionCard = {
  title: string;
  question: string;
  value: string;
  method: string;
  limitations: string;
  evidenceIds: string[];
};
export function isDirectionCard(v: unknown): v is DirectionCard {
  return (
    isRecord(v) &&
    ["title", "question", "value", "method", "limitations"].every(
      (k) => typeof v[k] === "string" && (v[k] as string).length <= 1200,
    ) &&
    typeof v.title === "string" &&
    !!v.title.trim() &&
    Array.isArray(v.evidenceIds) &&
    v.evidenceIds.every((id) => typeof id === "string")
  );
}
export const directionPlainText = (c: DirectionCard, titles: string[]) =>
  `${c.title}\n\n研究问题：${c.question}\n\n为什么值得研究：${c.value}\n\n文献依据：${titles.join("；") || "待补充"}\n\n初步可以怎样研究：${c.method}\n\n待确认事项：${c.limitations}`;
export type Analysis = {
  coverage?: PDFCoverage[];
  notices?: string[];
  inputSnapshot?: string;
  synthesis?: ReadingSection[];
  cards?: DirectionCard[];
  id: string;
  kind: "directions" | "reading" | "review";
  fingerprint: string;
  sourceIds: string[];
  createdAt: string;
  sections: ReadingSection[];
};
export type ReviewNode = {
  id: string;
  title: string;
  body: string;
  evidenceIds: string[];
  uncertainty: string;
  x: number;
  y: number;
};
export type Workflow = {
  research?: ResearchWorkspace;
  graphView?: { mode: string; expanded: boolean };
  version: 1;
  revision: number;
  libraryURL: string;
  keywords: {
    zh: string;
    synonyms: string;
    en: string;
    expressions: string;
    fingerprint: string;
  };
  selection: string[] | null;
  direction: {
    card?: DirectionCard;
    text: string;
    evidenceIds: string[];
    fingerprint: string;
  } | null;
  analyses: Analysis[];
  review: ReviewNode[];
  reviewFingerprint: string;
  positions: Record<string, { x: number; y: number }>;
  confirmedFingerprint: string | null;
};
export const emptyWorkflow = (): Workflow => ({
  version: 1,
  revision: 0,
  libraryURL: "https://www.lib.szu.edu.cn/",
  keywords: { zh: "", synonyms: "", en: "", expressions: "", fingerprint: "" },
  selection: null,
  direction: null,
  analyses: [],
  review: [],
  reviewFingerprint: "",
  positions: {},
  confirmedFingerprint: null,
});
const str = (v: unknown, n = 6000): v is string =>
  typeof v === "string" && v.length <= n;
const ids = (v: unknown): v is string[] =>
  Array.isArray(v) &&
  v.length <= 300 &&
  v.every((x) => str(x, 250)) &&
  new Set(v).size === v.length;
export function isSections(v: unknown): v is ReadingSection[] {
  return (
    Array.isArray(v) &&
    v.length <= 12 &&
    v.every(
      (s) =>
        isRecord(s) &&
        (s.issue === undefined ||
          (isRecord(s.issue) &&
            str(s.issue.code, 80) &&
            str(s.issue.message, 600))) &&
        (s.suggestion === undefined || str(s.suggestion, 1200)) &&
        (s.facts === undefined ||
          (Array.isArray(s.facts) &&
            s.facts.length <= 5 &&
            s.facts.every(
              (f) =>
                isRecord(f) &&
                (f.evidenceId === undefined || str(f.evidenceId, 100)) &&
                str(f.text, 500) &&
                str(f.quote, 1200) &&
                (f.page === null ||
                  (Number.isSafeInteger(f.page) && Number(f.page) > 0)),
            ))) &&
        (s.findings === undefined ||
          (Array.isArray(s.findings) &&
            s.findings.length <= 4 &&
            s.findings.every(
              (f) =>
                isRecord(f) &&
                str(f.question, 250) &&
                str(f.conclusion, 500) &&
                str(f.quote, 1200) &&
                [
                  "supported",
                  "not-supported",
                  "not-tested",
                  "unclear",
                ].includes(String(f.support)) &&
                (f.page === null ||
                  (Number.isSafeInteger(f.page) && Number(f.page) > 0)),
            ))) &&
        str(s.title, 160) &&
        !!s.title.trim() &&
        str(s.body, 4000) &&
        ids(s.evidenceIds) &&
        str(s.quote, 1200) &&
        (s.page === null || (Number.isInteger(s.page) && Number(s.page) > 0)) &&
        str(s.uncertainty, 1500) &&
        (s.evidenceStatus === undefined ||
          ["verified", "insufficient", "proposal"].includes(
            String(s.evidenceStatus),
          )),
    )
  );
}
/** Old diagnostics stay in stored history, but never become the active research topic. */
export function cleanDirection(text: string) {
  return text
    .replace(/无法从本次提供的原文核对这一分析，请补充资料或重试。/g, "")
    .trim();
}
export function isFailedSection(s: ReadingSection) {
  return (
    s.evidenceStatus === "insufficient" ||
    s.body.includes("无法从本次提供的原文核对这一分析")
  );
}

export type PDFCoverage = {
  paperId: string;
  totalPages: number;
  characters: number;
  budget: number;
  pages: { page: number; characters: number; full: boolean }[];
  omittedPages: number[];
  notes: string[];
};
export function isPDFCoverage(v: unknown): v is PDFCoverage[] {
  return (
    Array.isArray(v) &&
    v.length <= 30 &&
    v.every(
      (c) =>
        isRecord(c) &&
        str(c.paperId, 100) &&
        Number.isSafeInteger(c.totalPages) &&
        Number(c.totalPages) >= 0 &&
        Number(c.totalPages) <= 150 &&
        Number.isSafeInteger(c.characters) &&
        Number(c.characters) >= 0 &&
        Number.isSafeInteger(c.budget) &&
        Number(c.budget) >= 0 &&
        Array.isArray(c.pages) &&
        c.pages.length <= 150 &&
        c.pages.every(
          (p) =>
            isRecord(p) &&
            Number.isSafeInteger(p.page) &&
            Number(p.page) > 0 &&
            Number.isSafeInteger(p.characters) &&
            Number(p.characters) >= 0 &&
            typeof p.full === "boolean",
        ) &&
        Array.isArray(c.omittedPages) &&
        c.omittedPages.length <= 150 &&
        c.omittedPages.every((n) => Number.isSafeInteger(n) && Number(n) > 0) &&
        Array.isArray(c.notes) &&
        c.notes.length <= 10 &&
        c.notes.every((n) => str(n, 600)),
    )
  );
}
/** Bounded excerpts are windows around actual section headings, not just page prefixes. */
export function selectPDFExcerpts(
  pages: string[],
  budget: number,
  paperId = "",
) {
  budget = Math.max(0, Math.floor(budget));
  const heading =
    /摘\s*要|研究假设|研究方法|研究设计|样本|研究结果|数据分析|讨\s*论|结\s*论|abstract|hypotheses|method|results|discussion|conclusion/gi;
  const matches = pages.map((text) =>
    [...text.matchAll(heading)].map((m) => m.index!),
  );
  const all = pages.reduce((n, p) => n + p.length, 0);
  let excerpts: { page: number; text: string }[] = [];
  if (all <= budget && pages.every((p) => p.length <= 24000))
    excerpts = pages.map((text, i) => ({ page: i + 1, text }));
  else {
    const headings = matches.flatMap((m, i) => (m.length ? [i] : []));
    // First, abstract/sections, last page, then a bounded spread. An explicit budget limits all work.
    const priority = [
      ...new Set([
        0,
        ...headings,
        pages.length - 1,
        ...Array.from({ length: 8 }, (_, i) =>
          Math.round((i * (pages.length - 1)) / 7),
        ),
      ]),
    ].filter((i) => i >= 0);
    const indices = priority.slice(0, Math.max(1, Math.floor(budget / 800)));
    const perPage = Math.min(
      24000,
      Math.floor(budget / Math.max(1, indices.length)),
    );
    excerpts = indices
      .map((i) => {
        const text = pages[i] ?? "";
        if (text.length <= perPage) return { page: i + 1, text };
        const hits = matches[i];
        if (!hits.length) return { page: i + 1, text: text.slice(0, perPage) };
        const width = Math.floor(perPage / Math.min(hits.length, 3));
        const windows = hits.slice(0, 3).map((pos) => ({
          start: Math.max(0, Math.min(text.length - width, pos - 100)),
          end: 0,
        }));
        windows.forEach(
          (w) => (w.end = Math.min(text.length, w.start + width)),
        );
        windows.sort((a, b) => a.start - b.start);
        const merged: typeof windows = [];
        for (const w of windows) {
          const last = merged.at(-1);
          if (last && w.start <= last.end) last.end = Math.max(last.end, w.end);
          else merged.push({ ...w });
        }
        return {
          page: i + 1,
          text: merged
            .map((w) => text.slice(w.start, w.end))
            .join("\n[节选间省略]\n")
            .slice(0, perPage),
        };
      })
      .filter((p) => p.text.length)
      .sort((a, b) => a.page - b.page);
  }
  const selected = new Set(excerpts.map((p) => p.page));
  const coverage: PDFCoverage = {
    paperId,
    totalPages: pages.length,
    characters: excerpts.reduce((n, p) => n + p.text.length, 0),
    budget,
    pages: excerpts.map((p) => ({
      page: p.page,
      characters: p.text.length,
      full: p.text === pages[p.page - 1],
    })),
    omittedPages: pages.flatMap((_, i) => (selected.has(i + 1) ? [] : [i + 1])),
    notes:
      all > budget
        ? [
            "受节选预算限制，优先摘要、假设、方法、结果、讨论与结论；部分页面仅提供标题附近的窗口，其余文字未发送。",
          ]
        : [],
  };
  return { pages: excerpts, coverage };
}
export const pdfExcerpts = (pages: string[], budget: number) =>
  selectPDFExcerpts(pages, budget).pages;
export function isWorkflow(v: unknown): v is Workflow {
  if (
    !isRecord(v) ||
    (v.research !== undefined && !isResearchWorkspace(v.research)) ||
    v.version !== 1 ||
    (v.graphView !== undefined &&
      (!isRecord(v.graphView) ||
        !["all", "references", "citing"].includes(String(v.graphView.mode)) ||
        typeof v.graphView.expanded !== "boolean")) ||
    !Number.isSafeInteger(v.revision) ||
    Number(v.revision) < 0 ||
    safeWebURL(v.libraryURL) !== v.libraryURL ||
    !isRecord(v.keywords) ||
    !["zh", "en", "synonyms", "expressions", "fingerprint"].every((k) =>
      str((v.keywords as Record<string, unknown>)[k], 12000),
    ) ||
    !(v.selection === null || ids(v.selection)) ||
    !Array.isArray(v.analyses) ||
    v.analyses.length > 100 ||
    !Array.isArray(v.review) ||
    v.review.length > 60 ||
    !str(v.reviewFingerprint, 12000) ||
    !isRecord(v.positions) ||
    Object.keys(v.positions).length > 600 ||
    !(v.confirmedFingerprint === null || str(v.confirmedFingerprint, 12000))
  )
    return false;
  if (
    v.direction !== null &&
    (!isRecord(v.direction) ||
      (v.direction.card !== undefined && !isDirectionCard(v.direction.card)) ||
      !str(v.direction.text, 4000) ||
      !ids(v.direction.evidenceIds) ||
      !str(v.direction.fingerprint, 12000))
  )
    return false;
  return (
    v.analyses.every(
      (a) =>
        isRecord(a) &&
        str(a.id, 250) &&
        (a.coverage === undefined || isPDFCoverage(a.coverage)) &&
        (a.notices === undefined ||
          (Array.isArray(a.notices) &&
            a.notices.length <= 20 &&
            a.notices.every((n) => str(n, 600)))) &&
        (a.inputSnapshot === undefined || str(a.inputSnapshot, 500000)) &&
        ["directions", "reading", "review"].includes(String(a.kind)) &&
        str(a.fingerprint, 12000) &&
        ids(a.sourceIds) &&
        str(a.createdAt, 100) &&
        Number.isFinite(Date.parse(a.createdAt)) &&
        isSections(a.sections) &&
        (a.synthesis === undefined || isSections(a.synthesis)) &&
        (a.cards === undefined ||
          (Array.isArray(a.cards) &&
            a.cards.length <= 3 &&
            a.cards.every(isDirectionCard))),
    ) &&
    v.review.every(
      (n) =>
        isRecord(n) &&
        str(n.id, 100) &&
        str(n.title, 160) &&
        str(n.body, 4000) &&
        ids(n.evidenceIds) &&
        str(n.uncertainty, 1500) &&
        position(n),
    ) &&
    Object.values(v.positions).every(position)
  );
}
function position(p: unknown) {
  return (
    isRecord(p) &&
    typeof p.x === "number" &&
    Number.isFinite(p.x) &&
    Math.abs(p.x) <= 10000 &&
    typeof p.y === "number" &&
    Number.isFinite(p.y) &&
    Math.abs(p.y) <= 10000
  );
}
export function hash(value: unknown) {
  const s = JSON.stringify(value);
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16);
}
export const workflowEvidence = (p: Project) =>
  (p.library?.items ?? []).filter(
    (i) => p.workflow?.selection == null || p.workflow.selection.includes(i.id),
  );
export const sourceFingerprint = (p: Project, includeDirection = true) =>
  hash([
    p.observation,
    selectedConcepts(p),
    p.exploration?.seed?.workingQuestion,
    p.workflow?.keywords ?? emptyWorkflow().keywords,
    p.workflow?.selection ?? null,
    (p.library?.items ?? []).map((i) => [i.id, i.paper, i.attachment]),
    includeDirection ? cleanDirection(p.workflow?.direction?.text ?? "") : "",
  ]);
export const frameworkFingerprint = (p: Project) =>
  hash([
    sourceFingerprint(p),
    p.workflow?.review ?? [],
    p.workbench?.design ?? null,
  ]);
export function exportFramework(p: Project) {
  const f = p.workflow ?? emptyWorkflow();
  const find = (id: string) =>
    p.library?.items.find((i) => i.id === id)?.paper.title ??
    "来源已移除，需要更新";
  return `# ${p.name} · 研究框架\n\n状态：${f.confirmedFingerprint === frameworkFingerprint(p) ? "用户已确认" : "草案 / 内容已变化，待确认"}\n\n研究想法：${p.observation}\n\n研究方向：${cleanDirection(f.direction?.text ?? "") || "待确认"}\n\n## 文献综述提纲\n\n${f.review.map((n) => `### ${n.title}\n\n${n.body}\n\n依据：${n.evidenceIds.map(find).join("；") || "尚无"}\n\n待核实：${n.uncertainty}`).join("\n\n")}\n\n## 参考文献\n\n${workflowEvidence(
    p,
  )
    .map(
      (i) =>
        `- ${i.paper.authors.join("；") || "作者未获取"} (${i.paper.year ?? "年份未获取"}). ${i.paper.title}. ${i.paper.venue ?? "来源未获取"}. ${i.paper.doi ?? ""} ${i.paper.recordUrl}\n  ${i.paper.source === "import" ? "用户导入题录，未外部认证" : "外部元数据记录"}`,
    )
    .join(
      "\n",
    )}\n\n## 可编辑模型数据\n\n\`\`\`json\n${JSON.stringify(p.workbench?.design ?? {}, null, 2)}\n\`\`\`\n`;
}

/** Reading is tied to its paper, not unrelated papers or selection toggles. Legacy hashes remain readable. */
export const readingFingerprint = (p: Project, sourceIds: string[]) =>
  hash([
    p.observation,
    selectedConcepts(p),
    cleanDirection(p.workflow?.direction?.text ?? ""),
    (p.library?.items ?? [])
      .filter((i) => sourceIds.includes(i.id))
      .map((i) => [i.id, i.paper, i.attachment]),
  ]);
export const isReadingCurrent = (p: Project, a: Analysis) =>
  a.kind === "reading" &&
  (a.fingerprint === readingFingerprint(p, a.sourceIds) ||
    a.fingerprint === sourceFingerprint(p));
export function qualityReadingIds(p: Project) {
  return (p.library?.items ?? [])
    .filter((i) => {
      const a = (p.workflow?.analyses ?? [])
        .filter((a) => a.kind === "reading" && a.sourceIds.includes(i.id))
        .at(-1);
      return (
        (i.bibliography?.confirmedAt || i.paper.identity === "verified") &&
        a &&
        isReadingCurrent(p, a) &&
        ["30 秒读懂", "研究方法与过程", "关键发现与结论"].every((title) =>
          a.sections.some(
            (s) =>
              s.title === title && s.evidenceStatus === "verified" && !s.issue,
          ),
        )
      );
    })
    .map((i) => i.id);
}
