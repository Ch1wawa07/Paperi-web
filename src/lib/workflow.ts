import { isRecord } from "./exploration";
import { safeWebURL } from "./literature";
import type { Project } from "./projects";
import { selectedConcepts } from "./workbench";
import { isResearchWorkspace, type ResearchWorkspace } from "./research-workspace";
export type ReadingSection = {
  title: string;
  body: string;
  evidenceIds: string[];
  quote: string;
  page: number | null;
  uncertainty: string;
  evidenceStatus?: "verified" | "insufficient" | "proposal";
};
export type DirectionCard = {title:string;question:string;value:string;method:string;limitations:string;evidenceIds:string[]};
export function isDirectionCard(v:unknown):v is DirectionCard{
 return isRecord(v)&&["title","question","value","method","limitations"].every(k=>typeof v[k]==="string"&&(v[k] as string).length<=1200)&&typeof v.title==="string"&&!!v.title.trim()&&Array.isArray(v.evidenceIds)&&v.evidenceIds.every(id=>typeof id==="string");
}
export const directionPlainText=(c:DirectionCard,titles:string[])=>`${c.title}\n\n研究问题：${c.question}\n\n为什么值得研究：${c.value}\n\n文献依据：${titles.join("；")||"待补充"}\n\n初步可以怎样研究：${c.method}\n\n待确认事项：${c.limitations}`;
export type Analysis = {
  inputSnapshot?: string;
  synthesis?:ReadingSection[];
  cards?:DirectionCard[];
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
    card?:DirectionCard;
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
        str(s.uncertainty, 1500) && (s.evidenceStatus === undefined || ["verified","insufficient","proposal"].includes(String(s.evidenceStatus))),
    )
  );
}
/** Old diagnostics stay in stored history, but never become the active research topic. */
export function cleanDirection(text: string) {
  return text.replace(/无法从本次提供的原文核对这一分析，请补充资料或重试。/g, "").trim();
}
export function isFailedSection(s: ReadingSection) {
  return s.evidenceStatus === "insufficient" || s.body.includes("无法从本次提供的原文核对这一分析");
}

/** Sample across the document, prioritizing methods/results instead of silently sending only its start. */
export function pdfExcerpts(pages: string[], budget: number) {
  const all = pages.reduce((n,p)=>n+p.length,0);
  if (all <= budget) return pages.map((text,i)=>({page:i+1,text}));
  const headings = pages.flatMap((text,i)=> /研究方法|研究设计|数据分析|研究结果|结论|讨论|method|results|discussion|conclusion/i.test(text) ? [i] : []);
  const indices = [...new Set([0, ...headings, ...Array.from({length:12},(_,i)=>Math.round(i*(pages.length-1)/11))])];
  const perPage = Math.floor(budget/indices.length);
  return indices.sort((a,b)=>a-b).map(i=>({page:i+1,text:pages[i].slice(0,perPage)}));
}
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
      (v.direction.card!==undefined&&!isDirectionCard(v.direction.card)) ||
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
        isSections(a.sections) && (a.synthesis===undefined||isSections(a.synthesis)) && (a.cards===undefined||(Array.isArray(a.cards)&&a.cards.length<=3&&a.cards.every(isDirectionCard))),
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
export const sourceFingerprint = (p: Project, includeDirection=true) =>
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
