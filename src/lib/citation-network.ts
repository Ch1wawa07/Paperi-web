import { isRecord } from "./exploration";
import { isPaper, samePaper, type Paper } from "./literature";
import type { CitationGraph } from "./graph-server";
export function isCitationGraph(v: unknown): v is CitationGraph {
  if (
    !isRecord(v) ||
    typeof v.center !== "string" ||
    !Array.isArray(v.papers) ||
    v.papers.length > 20 ||
    !v.papers.every(isPaper) ||
    !Array.isArray(v.edges) ||
    v.edges.length > 20 ||
    !Array.isArray(v.notices) ||
    !v.notices.every((n) => typeof n === "string") ||
    typeof v.retrievedAt !== "string"
  )
    return false;
  const papers = v.papers as Paper[];
  return (
    papers.some((p) => p.key === v.center) &&
    v.edges.every(
      (e) =>
        isRecord(e) &&
        e.from !== e.to &&
        papers.some((p) => p.key === e.from && p.recordUrl === e.recordUrl) &&
        papers.some((p) => p.key === e.to),
    )
  );
}
export function combineNetwork(primary: Paper[], graphs: CitationGraph[]) {
  const papers = primary.filter((p,i)=>!primary.slice(0,i).some(x=>samePaper(x,p)||(x.doi&&x.doi===p.doi))),
    edges: CitationGraph["edges"] = [];
  for (const g of graphs) {
    const remap = new Map<string, string>();
    for (const p of g.papers) {
      const existing = papers.find(
        (x) => samePaper(x, p) || (x.doi && x.doi === p.doi),
      );
      if (existing) remap.set(p.key, existing.key);
      else {
        papers.push(p);
        remap.set(p.key, p.key);
      }
    }
    for (const e of g.edges) {
      const from = remap.get(e.from)!,
        to = remap.get(e.to)!;
      if (from !== to && !edges.some((x) => x.from === from && x.to === to))
        edges.push({ ...e, from, to });
    }
  }
  return { papers, edges };
}
/** Deterministic repulsion/spring layout; positions do not create edges. */
export function networkLayout(
  ids: string[],
  edges: { from: string; to: string }[],
) {
  const n = ids.length;
  const pts = ids.map((id, i) => ({
    id,
    x: 450 + Math.cos(i * 2.39996) * Math.sqrt(i + 1) * 180,
    y: 350 + Math.sin(i * 2.39996) * Math.sqrt(i + 1) * 130,
  }));
  const map = new Map(pts.map((p, i) => [p.id, i]));
  for (let step = 0; step < 80; step++) {
    const force = pts.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const dx = pts[i].x - pts[j].x,
          dy = pts[i].y - pts[j].y,
          d = Math.max(20, Math.hypot(dx, dy));
        const f = 16000 / (d * d);
        force[i].x += (dx / d) * f;
        force[i].y += (dy / d) * f;
        force[j].x -= (dx / d) * f;
        force[j].y -= (dy / d) * f;
      }
    for (const e of edges) {
      const a = map.get(e.from),
        b = map.get(e.to);
      if (a === undefined || b === undefined) continue;
      const dx = pts[b].x - pts[a].x,
        dy = pts[b].y - pts[a].y,
        d = Math.max(1, Math.hypot(dx, dy)),
        f = (d - 330) * 0.015;
      force[a].x += (dx / d) * f;
      force[a].y += (dy / d) * f;
      force[b].x -= (dx / d) * f;
      force[b].y -= (dy / d) * f;
    }
    pts.forEach((p, i) => {
      p.x += Math.max(-12, Math.min(12, force[i].x));
      p.y += Math.max(-12, Math.min(12, force[i].y));
    });
  }
  return pts;
}
