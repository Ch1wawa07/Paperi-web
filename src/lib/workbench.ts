import { isRecord } from "./exploration";
import { isIds } from "./research-navigation";
import type { Project } from "./projects";
import { isPaper, type Paper, type KeywordSuggestions } from "./literature";
export type DesignNode = {
  id: string;
  kind: string;
  title: string;
  body: string;
  x: number;
  y: number;
  status: "suggested" | "confirmed" | "rejected";
  evidenceIds: string[];
  uncertainty: string;
};
export type DesignEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
};
export type Design = {
  path: "quantitative" | "qualitative";
  nodes: DesignNode[];
  edges: DesignEdge[];
};
export type Thread = {
  title: string;
  body: string;
  evidenceIds: string[];
  uncertainty: string;
  kind: string;
};
export type Assessment = {
  id: string;
  level: "direct" | "background" | "unrelated" | "insufficient";
  reason: string;
  use: string;
  basis: string;
  limitation: string;
};
export type Workbench = {
  revision: number;
  evidenceIds: string[];
  design: Design;
  analysis: Thread[];
  analysisFingerprint?: string;
  search?: {
    input: string;
    origin: "manual" | "concepts" | "history";
    fingerprint: string;
    keywords: KeywordSuggestions;
    history: string[];
  };
  designSources: Paper[];
};
export const emptyWorkbench = (): Workbench => ({
  revision: 0,
  evidenceIds: [],
  design: { path: "quantitative", nodes: [], edges: [] },
  analysis: [],
  designSources: [],
});
const txt = (v: unknown, max: number, empty = false): v is string =>
  typeof v === "string" && v.length <= max && (empty || !!v.trim());
const sourceIds=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=20&&new Set(v).size===v.length&&v.every(x=>txt(x,250));
export function isDesign(v: unknown): v is Design {
  if (
    !isRecord(v) ||
    !["quantitative", "qualitative"].includes(String(v.path)) ||
    !Array.isArray(v.nodes) ||
    v.nodes.length > 60 ||
    !Array.isArray(v.edges) ||
    v.edges.length > 100
  )
    return false;
  const ids = new Set<string>();
  for (const n of v.nodes) {
    if (
      !isRecord(n) ||
      !txt(n.id, 100) ||
      ids.has(n.id) ||
      !txt(n.title, 160) ||
      !txt(n.kind, 80) ||
      !txt(n.body, 2000, true) ||
      !txt(n.uncertainty, 800, true) ||
      !["suggested", "confirmed", "rejected"].includes(String(n.status)) ||
      !sourceIds(n.evidenceIds) ||
      typeof n.x !== "number" ||
      !Number.isFinite(n.x) ||
      Math.abs(n.x) > 10000 ||
      typeof n.y !== "number" ||
      !Number.isFinite(n.y) ||
      Math.abs(n.y) > 10000
    )
      return false;
    ids.add(n.id);
  }
  const edgeIds = new Set<string>();
  return v.edges.every((e) => {
    if (
      !isRecord(e) ||
      !txt(e.id, 100) ||
      edgeIds.has(e.id) ||
      !ids.has(String(e.from)) ||
      !ids.has(String(e.to)) ||
      e.from === e.to ||
      !txt(e.label, 160)
    )
      return false;
    edgeIds.add(e.id);
    return true;
  });
}
export function isThreads(v: unknown): v is Thread[] {
  return (
    Array.isArray(v) &&
    v.length <= 8 &&
    v.every(
      (t) =>
        isRecord(t) &&
        txt(t.title, 160) &&
        txt(t.body, 1600) &&
        txt(t.kind, 80) &&
        isIds(t.evidenceIds, 20) &&
        t.evidenceIds.length > 0 &&
        txt(t.uncertainty, 800),
    )
  );
}
export function isAssessments(v: unknown): v is Assessment[] {
  return (
    Array.isArray(v) &&
    v.length <= 30 &&
    v.every(
      (a) =>
        isRecord(a) &&
        txt(a.id, 250) &&
        ["direct", "background", "unrelated", "insufficient"].includes(
          String(a.level),
        ) &&
        txt(a.reason, 800) &&
        txt(a.use, 100) &&
        txt(a.basis, 1000) &&
        txt(a.limitation, 600),
    )
  );
}
export function isWorkbench(v: unknown): v is Workbench {
  if (
    !isRecord(v) ||
    !Number.isSafeInteger(v.revision) ||
    Number(v.revision) < 0 ||
    !isIds(v.evidenceIds, 20) ||
    !isDesign(v.design) ||
    !isThreads(v.analysis) ||
    !Array.isArray(v.designSources) ||
    v.designSources.length > 40 ||
    !v.designSources.every(isPaper) ||
    (v.analysisFingerprint !== undefined &&
      !txt(v.analysisFingerprint, 12000, true))
  )
    return false;
  if (v.search !== undefined) {
    const s = v.search;
    if (
      !isRecord(s) ||
      !txt(s.input, 200, true) ||
      !txt(s.fingerprint, 12000, true) ||
      !["manual", "concepts", "history"].includes(String(s.origin)) ||
      !isRecord(s.keywords) ||
      ![s.keywords.zh, s.keywords.en].every(
        (a) => Array.isArray(a) && a.length <= 6 && a.every((x) => txt(x, 100)),
      ) ||
      !Array.isArray(s.history) ||
      s.history.length > 12 ||
      !s.history.every((x) => txt(x, 200))
    )
      return false;
  }
  return true;
}
export const selectedConcepts = (p: Project) =>
  p.exploration?.navigation
    ? p.exploration.navigation.concepts
        .filter((c) => c.status === "selected")
        .map((c) => c.term)
    : (p.exploration?.seed?.concepts ?? []);
export const profileFingerprint = (p: Project) =>
  JSON.stringify([
    p.observation,
    selectedConcepts(p),
    p.exploration?.seed?.workingQuestion ?? "",
  ]);
export const selectedEvidence = (p: Project) =>
  (p.library?.items ?? []).filter((i) =>
    (
      p.workbench?.evidenceIds ??
      p.exploration?.navigation?.evidenceIds ??
      []
    ).includes(i.id),
  );
export function researchContext(p: Project) {
  return {
    observation: p.observation,
    concepts: selectedConcepts(p),
    question: p.exploration?.seed?.workingQuestion ?? "",
    messages: (p.exploration?.messages ?? [])
      .slice(-4)
      .map((m) => m.content.slice(0, 1000)),
    evidence: selectedEvidence(p)
      .slice(0, 8)
      .map((i) => ({ id: i.id, paper: i.paper })),
  };
}
export function exportDesign(p: Project) {
  const w = p.workbench ?? emptyWorkbench();
  const sources = [
    ...(p.library?.items ?? []).map((i) => ({ id: i.id, paper: i.paper })),
    ...w.designSources.map((paper) => ({ id: paper.key, paper })),
  ];
  return (
    `# ${p.name} · 初步研究设计\n\n路径：${w.design.path === "quantitative" ? "定量研究" : "质化研究"}\n\n原始观察：${p.observation}\n\n已选概念：${selectedConcepts(p).join("、")}\n\n已确认研究起点：${p.exploration?.seed?.workingQuestion || "尚未确认"}\n\n本方案为可编辑草案。用户确认不等于文献验证；仅依据可获得的题录/摘要，未宣称阅读全文。\n\n` +
    w.design.nodes
      .map(
        (n) =>
          `## ${n.title}\n\n${n.kind} · ${n.status === "confirmed" ? "用户已确认" : n.status === "rejected" ? "已拒绝" : "AI / 用户草案，待确认"}\n\n${n.body}\n\n待核实：${n.uncertainty || "需自行核查可行性与证据"}\n\n依据：${n.evidenceIds.map((id) => sources.find((s) => s.id === id)?.paper.title ?? "来源已移出，需重新核对").join("；") || "尚无文献依据"}\n`,
      )
      .join("\n") +
    "\n## 设计关系（假设 / 规划，不是已验证因果）\n\n" +
    w.design.edges
      .map(
        (e) =>
          `- ${w.design.nodes.find((n) => n.id === e.from)?.title} → ${w.design.nodes.find((n) => n.id === e.to)?.title}：${e.label}`,
      )
      .join("\n") +
    "\n\n## 真实来源\n\n" +
    sources
      .filter((s) => w.design.nodes.some((n) => n.evidenceIds.includes(s.id)))
      .map(
        (s) =>
          `- ${s.paper.title} (${s.paper.year ?? "年份缺失"})\n  DOI: ${s.paper.doi ?? "无"}\n  ${s.paper.recordUrl}`,
      )
      .join("\n")
  );
}
