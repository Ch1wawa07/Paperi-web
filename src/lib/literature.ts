import { isRecord } from './exploration';

export type Paper = {
  key: string; title: string; authors: string[]; authorsTruncated: boolean; year: number | null;
  venue: string | null; sourceIsCore: boolean | null; kind: string; doi: string | null; openAlexId: string | null;
  abstract: string | null; abstractTruncated: boolean; citations: number | null;
  retracted: boolean | null; oaUrl: string | null; landingUrl: string | null;
  source: 'openalex' | 'crossref' | 'deepseek';
  discoveryUrl?: string; webSummary?: string; identity?: 'verified' | 'lead' | 'webpage'; recordUrl: string; retrievedAt: string;
};
export type Category = { id: string; name: string };
export type SavedPaper = { id: string; paper: Paper; categoryIds: string[]; note: string; savedAt: string; updatedAt: string };
export type Library = { revision: number; categories: Category[]; items: SavedPaper[] };
export type SearchOptions = { query: string; provider: 'auto' | 'openalex' | 'crossref'; sort: 'relevance' | 'newest' | 'citations'; yearFrom: string; yearTo: string; journalsOnly: boolean; doiOnly: boolean; coreOnly: boolean; page: number };
export type SearchResults = { query: string; provider: 'openalex' | 'crossref' | 'deepseek'; items: Paper[]; total: number; page: number; pageSize: number; notices: string[]; cached: boolean; hasMore: boolean };
export type KeywordSuggestions = { zh: string[]; en: string[] };
export const emptyLibrary = (): Library => ({ revision: 0, categories: [
  { id: 'reading', name: '待读' }, { id: 'core', name: '核心文献' },
  { id: 'theory', name: '理论与概念' }, { id: 'methods', name: '研究方法' },
], items: [] });
export function normalizeDOI(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let doi = value.trim();
  if (/^https?:\/\/(?:dx\.)?doi\.org\//i.test(doi)) {
    doi=doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'');
    try { doi=decodeURIComponent(doi); } catch { return null; }
  }
  doi=doi.replace(/^doi:\s*/i,'').toLowerCase();
  // Legacy Wiley and other registered DOIs can legitimately contain angle brackets and punctuation.
  return doi.length <= 200 && /^10\.\d{4,9}\/\S+$/i.test(doi) && !/[\x00-\x20]/.test(doi) ? doi : null;
}
export function safeWebURL(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2000 || /[\x00-\x20]/.test(value)) return null;
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export const doiURL = (doi: string) => `https://doi.org/${encodeURIComponent(doi)}`;
export const crossrefRecordURL = (doi: string) => `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
export const samePaper = (a: Paper, b: Paper) => a.key === b.key || !!(a.doi && b.doi && a.doi === b.doi) || !!(a.openAlexId && b.openAlexId && a.openAlexId === b.openAlexId);
const text = (v: unknown, max: number) => typeof v === 'string' && !!v.trim() && v.length <= max;
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
export function isPaper(v: unknown): v is Paper {
  if (!isRecord(v) || !text(v.title, 1200) || !Array.isArray(v.authors) || v.authors.length > 50 || !v.authors.every(a => text(a, 180)) ||
    typeof v.authorsTruncated !== 'boolean' || typeof v.abstractTruncated !== 'boolean' || !text(v.kind, 80) || !date(v.retrievedAt) ||
    (v.year !== null && (!Number.isInteger(v.year) || Number(v.year) < 1000 || Number(v.year) > 2200)) ||
    (v.venue !== null && !text(v.venue, 500)) || (v.abstract !== null && !text(v.abstract, 6000)) ||
    (v.citations !== null && (!Number.isSafeInteger(v.citations) || Number(v.citations) < 0)) ||
    (v.retracted !== null && typeof v.retracted !== 'boolean') || (v.sourceIsCore !== null && typeof v.sourceIsCore !== 'boolean')) return false;
  if (v.doi !== null && normalizeDOI(v.doi) !== v.doi) return false;
  if (v.openAlexId !== null && (typeof v.openAlexId !== 'string' || !/^https:\/\/openalex\.org\/W\d+$/.test(v.openAlexId))) return false;
  if (v.discoveryUrl !== undefined && safeWebURL(v.discoveryUrl) !== v.discoveryUrl) return false;
  if (v.webSummary !== undefined && !text(v.webSummary, 6000)) return false;
  if (v.identity !== undefined && !['verified','lead','webpage'].includes(String(v.identity))) return false;
  if (v.source === 'deepseek') return ['lead','webpage'].includes(String(v.identity)) && v.doi === null && v.openAlexId === null && v.citations === null && v.abstract === null && v.authors.length === 0 && v.year === null && v.venue === null && safeWebURL(v.recordUrl) === v.recordUrl && v.key === webKey(String(v.recordUrl)) && v.landingUrl === v.recordUrl && v.oaUrl === null;
  if (v.identity !== undefined && v.identity !== 'verified') return false;
  if (!v.doi && !v.openAlexId) return false;
  if (v.key !== (v.doi ? `doi:${v.doi}` : `openalex:${v.openAlexId}`)) return false;
  if (v.source === 'crossref') { if (!v.doi || v.recordUrl !== crossrefRecordURL(String(v.doi))) return false; }
  else if (v.source === 'openalex') { if (!v.openAlexId || v.recordUrl !== `https://api.openalex.org/works/${String(v.openAlexId).split('/').at(-1)}`) return false; }
  else return false;
  return [v.oaUrl, v.landingUrl].every(u => u === null || safeWebURL(u) === u);
}
export function isLibrary(v: unknown): v is Library {
  if (!isRecord(v) || !Number.isSafeInteger(v.revision) || Number(v.revision) < 0 || !Array.isArray(v.categories) || v.categories.length > 30 || !Array.isArray(v.items) || v.items.length > 300) return false;
  const ids = new Set<string>(), names = new Set<string>();
  for (const c of v.categories) {
    if (!isRecord(c) || !text(c.id, 100) || !text(c.name, 40) || ids.has(String(c.id)) || names.has(String(c.name).trim().toLowerCase())) return false;
    ids.add(String(c.id)); names.add(String(c.name).trim().toLowerCase());
  }
  const itemIds = new Set<string>(); const papers: Paper[] = [];
  for (const i of v.items) {
    if (!isRecord(i) || !text(i.id, 100) || itemIds.has(String(i.id)) || !isPaper(i.paper) || papers.some(p => samePaper(p, i.paper as Paper)) ||
      !Array.isArray(i.categoryIds) || i.categoryIds.length > 30 || new Set(i.categoryIds).size !== i.categoryIds.length || !i.categoryIds.every(c => typeof c === 'string' && ids.has(c)) ||
      typeof i.note !== 'string' || i.note.length > 4000 || !date(i.savedAt) || !date(i.updatedAt)) return false;
    itemIds.add(String(i.id)); papers.push(i.paper);
  }
  return true;
}
export function isSearchResults(v: unknown): v is SearchResults {
  return isRecord(v) && typeof v.query === 'string' && ['openalex', 'crossref', 'deepseek'].includes(String(v.provider)) &&
    Array.isArray(v.items) && v.items.length <= 10 && v.items.every(isPaper) && Number.isSafeInteger(v.total) && Number(v.total) >= 0 &&
    Number.isInteger(v.page) && Number(v.page) >= 1 && Number(v.page) <= 5 && v.pageSize === 10 &&
    Array.isArray(v.notices) && v.notices.every(n => text(n, 500)) && typeof v.cached === 'boolean' && typeof v.hasMore === 'boolean';
}

// Compact deterministic URL identity fits existing evidence-id limits.
export function webKey(url: string) { let h = 2166136261; for (const c of url) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return 'web:' + (h >>> 0).toString(16); }
export const identityLabel = (p: Paper) => p.source === 'deepseek' ? p.identity === 'lead' ? '论文线索 · 待核实' : '参考网页 · 非已核实论文' : '已核实的论文元数据';
