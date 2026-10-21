import { isRecord } from './exploration';
import { crossrefRecordURL, isPaper, normalizeDOI, safeWebURL, type Paper } from './literature';

const plain = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, ' ').replace(/&(?:amp|lt|gt|quot|apos);/g, e => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" })[e] ?? e).replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
};
const count = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0 ? Number(v) : null;
const year = (v: unknown) => Number.isInteger(v) && Number(v) >= 1000 && Number(v) <= 2200 ? Number(v) : null;
const record = (v: unknown) => isRecord(v) ? v : {};
const list = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
function abstractFromIndex(v: unknown): { text: string | null; truncated: boolean } {
  if (!isRecord(v)) return { text: null, truncated: false };
  const words = new Map<number, string>();
  for (const [word, positions] of Object.entries(v)) {
    if (word.length > 200 || !Array.isArray(positions)) continue;
    for (const p of positions) if (Number.isInteger(p) && p >= 0 && p < 3000) words.set(p, word);
  }
  const raw = [...words].sort((a,b) => a[0]-b[0]).map(x => x[1]).join(' ');
  return { text: plain(raw, 6000), truncated: raw.length > 6000 || Object.values(v).some(ps => Array.isArray(ps) && ps.some(p => Number(p) >= 3000)) };
}
export function mapOpenAlex(value: unknown, retrievedAt: string): Paper | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' && /^https:\/\/openalex\.org\/W\d+$/.test(value.id) ? value.id : null;
  if (!id) return null;
  const doi = normalizeDOI(value.doi), title = plain(value.display_name ?? value.title, 1200);
  if (!title) return null;
  const location = record(value.primary_location), oa = record(value.best_oa_location), source = record(location.source);
  const authors = list(value.authorships).map(a => plain(record(record(a).author).display_name, 180)).filter((a): a is string => !!a);
  const abstract = abstractFromIndex(value.abstract_inverted_index);
  const paper: Paper = { key: doi ? `doi:${doi}` : `openalex:${id}`, title, doi, openAlexId: id,
    authors: authors.slice(0,50), authorsTruncated: authors.length > 50, year: year(value.publication_year), venue: plain(source.display_name, 500), sourceIsCore: typeof source.is_core === 'boolean' ? source.is_core : null, kind: plain(value.type,80) ?? '未提供类型',
    abstract: abstract.text, abstractTruncated: abstract.truncated, citations: count(value.cited_by_count), retracted: typeof value.is_retracted === 'boolean' ? value.is_retracted : null,
    oaUrl: record(value.open_access).is_oa === true ? safeWebURL(oa.pdf_url) ?? safeWebURL(oa.landing_page_url) : null,
    landingUrl: safeWebURL(location.landing_page_url), source: 'openalex', recordUrl: `https://api.openalex.org/works/${id.split('/').at(-1)}`, retrievedAt };
  return isPaper(paper) ? paper : null;
}
export function mapCrossref(value: unknown, retrievedAt: string): Paper | null {
  if (!isRecord(value)) return null;
  const doi = normalizeDOI(value.DOI), title = plain(list(value.title)[0],1200);
  if (!doi || !title) return null;
  const authors = list(value.author).map(a => { const r = record(a); return plain([r.given, r.family].filter(x => typeof x === 'string').join(' ') || r.name,180); }).filter((a): a is string => !!a);
  const parts = list(record(value.published)['date-parts']);
  const rawAbstract = typeof value.abstract === 'string' ? value.abstract : '';
  const relation = record(value.relation);
  const paper: Paper = { key: `doi:${doi}`, title, doi, openAlexId: null, authors: authors.slice(0,50), authorsTruncated: authors.length > 50,
    year: year(list(parts[0])[0]), venue: plain(list(value['container-title'])[0],500), sourceIsCore: null, kind: plain(value.type,80) ?? '未提供类型',
    abstract: plain(rawAbstract,6000), abstractTruncated: rawAbstract.replace(/<[^>]*>/g,' ').length > 6000,
    citations: count(value['is-referenced-by-count']), retracted: list(relation['is-retracted-by']).length || list(value['update-to']).some(u=>record(u).type==='retraction') ? true : null,
    oaUrl: null, landingUrl: safeWebURL(value.URL), source: 'crossref', recordUrl: crossrefRecordURL(doi), retrievedAt };
  return isPaper(paper) ? paper : null;
}
export function deduplicate(papers: Paper[]): Paper[] {
  const seen = new Set<string>(); return papers.filter(p => { if (seen.has(p.key)) return false; seen.add(p.key); return true; });
}
