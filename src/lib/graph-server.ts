import "server-only";
import { fetchJSON, MetadataError } from "./literature-server";
import { mapOpenAlex } from "./literature-mapping";
import { normalizeDOI, type Paper } from "./literature";
import { isRecord } from "./exploration";
export type CitationGraph = {
  center: string;
  papers: Paper[];
  edges: { from: string; to: string; recordUrl: string }[];
  notices: string[];
  retrievedAt: string;
};
const cache = new Map<string, { at: number; value: CitationGraph }>();
let active = 0,
  count = 0,
  start = Date.now();
function url(path: string, params: Record<string, string> = {}) {
  const u = new URL("https://api.openalex.org/works" + path);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  if (process.env.OPENALEX_API_KEY?.trim())
    u.searchParams.set("api_key", process.env.OPENALEX_API_KEY.trim());
  return u;
}
export async function citationGraph(
  id: string,
  signal: AbortSignal,
): Promise<CitationGraph> {
  const work = id.match(/^(?:https:\/\/openalex.org\/)?(W\d+)$/)?.[1],
    doi = normalizeDOI(id);
  if (!work && !doi)
    throw new MetadataError(400, "请选择真实 OpenAlex 文献或有效 DOI。");
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < 300000) return hit.value;
  if (Date.now() - start > 60000) {
    start = Date.now();
    count = 0;
  }
  if (active >= 2 || count >= 12)
    throw new MetadataError(429, "星图请求较多，请稍后再试。");
  active++;
  count++;
  try {
    const raw = await fetchJSON(
      url("/" + (work ?? encodeURIComponent("https://doi.org/" + doi))),
      signal,
    );
    const now = new Date().toISOString();
    const center = mapOpenAlex(raw, now);
    if (
      !center?.openAlexId ||
      !isRecord(raw) ||
      !Array.isArray(raw.referenced_works)
    )
      throw new MetadataError(
        502,
        "OpenAlex 未提供可核对的中心文献或引用关系。",
      );
    if (
      (work && center.openAlexId !== `https://openalex.org/${work}`) ||
      (doi && center.doi !== doi)
    )
      throw new MetadataError(502, "中心记录标识不匹配。");
    const refs = raw.referenced_works
      .filter(
        (x): x is string =>
          typeof x === "string" && /^https:\/\/openalex.org\/W\d+$/.test(x),
      )
      .slice(0, 6);
    const notices = [
      "仅展开一层：最多6篇参考文献、6篇引用文献。箭头从引用方指向被引用方。缺失关系不代表不存在。",
    ];
    const papers = [center],
      edges: CitationGraph["edges"] = [];
    const requests = await Promise.allSettled([
      refs.length
        ? fetchJSON(
            url("", {
              filter:
                "openalex_id:" + refs.map((r) => r.split("/").at(-1)).join("|"),
              "per-page": "6",
            }),
            signal,
          )
        : Promise.resolve({ results: [] }),
      fetchJSON(
        url("", {
          filter: "cites:" + center.openAlexId.split("/").at(-1),
          "per-page": "6",
          sort: "cited_by_count:desc",
        }),
        signal,
      ),
    ]);
    requests.forEach((r, index) => {
      if (r.status === "rejected") {
        notices.push(
          `${index === 0 ? "参考文献" : "引用文献"}本次读取失败；只展示成功取得的关系。`,
        );
        return;
      }
      if (!isRecord(r.value) || !Array.isArray(r.value.results)) {
        notices.push("部分关系响应结构不完整，未绘制。");
        return;
      }
      for (const item of r.value.results) {
        const p = mapOpenAlex(item, now);
        if (!p?.openAlexId || p.retracted === true || p.key === center.key) continue;
        const verified =
          index === 0
            ? refs.includes(p.openAlexId)
            : isRecord(item) &&
              Array.isArray(item.referenced_works) &&
              item.referenced_works.includes(center.openAlexId);
        if (!verified) continue;
        if (!papers.some((x) => x.key === p.key)) papers.push(p);
        const edge =
          index === 0
            ? { from: center.key, to: p.key, recordUrl: center.recordUrl }
            : { from: p.key, to: center.key, recordUrl: p.recordUrl };
        if (!edges.some((e) => e.from === edge.from && e.to === edge.to))
          edges.push(edge);
      }
    });
    if (!edges.length)
      notices.push(
        "当前来源记录没有返回可绘制的引用关系，可尝试另一篇文献；未补造连线。",
      );
    const value = {
      center: center.key,
      papers,
      edges,
      notices,
      retrievedAt: now,
    };
    if (cache.size >= 40) cache.delete(cache.keys().next().value!);
    cache.set(id, { at: Date.now(), value });
    return value;
  } finally {
    active--;
  }
}
