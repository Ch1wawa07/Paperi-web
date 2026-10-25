import { isRecord } from "./exploration";
import { safeWebURL } from "./literature";
import type { Project } from "./projects";
import { selectedConcepts } from "./workbench";
export type ReadingSection = {
  title: string;
  body: string;
  evidenceIds: string[];
  quote: string;
  page: number | null;
  uncertainty: string;
};
export type Analysis = {
  inputSnapshot?: string;
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
        str(s.title, 160) &&
        !!s.title.trim() &&
        str(s.body, 4000) &&
        ids(s.evidenceIds) &&
        str(s.quote, 1200) &&
        (s.page === null || (Number.isInteger(s.page) && Number(s.page) > 0)) &&
        str(s.uncertainty, 1500),
    )
  );
}
export function isWorkflow(v: unknown): v is Workflow {
  if (
    !isRecord(v) ||
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
        (a.inputSnapshot === undefined || str(a.inputSnapshot, 500000)) &&
        ["directions", "reading", "review"].includes(String(a.kind)) &&
        str(a.fingerprint, 12000) &&
        ids(a.sourceIds) &&
        str(a.createdAt, 100) &&
        Number.isFinite(Date.parse(a.createdAt)) &&
        isSections(a.sections),
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
export const sourceFingerprint = (p: Project) =>
  hash([
    p.observation,
    selectedConcepts(p),
    p.exploration?.seed?.workingQuestion,
    p.workflow?.keywords ?? emptyWorkflow().keywords,
    p.workflow?.selection ?? null,
    (p.library?.items ?? []).map((i) => [i.id, i.paper, i.attachment]),
    p.workflow?.direction?.text,
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
  return `# ${p.name} · 研究框架\n\n状态：${f.confirmedFingerprint === frameworkFingerprint(p) ? "用户已确认" : "草案 / 内容已变化，待确认"}\n\n研究想法：${p.observation}\n\n研究方向：${f.direction?.text || "待确认"}\n\n## 文献综述提纲\n\n${f.review.map((n) => `### ${n.title}\n\n${n.body}\n\n依据：${n.evidenceIds.map(find).join("；") || "尚无"}\n\n待核实：${n.uncertainty}`).join("\n\n")}\n\n## 参考文献\n\n${workflowEvidence(
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
