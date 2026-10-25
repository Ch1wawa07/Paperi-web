import 'server-only';
import { isRecord } from './exploration';
import { crossrefRecordURL, doiURL, normalizeDOI, safeWebURL, type Paper, type SearchOptions, type SearchResults } from './literature';
import { deduplicate, mapCrossref, mapOpenAlex } from './literature-mapping';

export class MetadataError extends Error { constructor(public status: number, message: string) { super(message); } }
const pageSize = 10;
const cache = new Map<string, { expires: number; value: SearchResults }>();
let active = 0, windowStart = Date.now(), requests = 0, openAlexRetryAt = 0;
function reserve() {
  if (Date.now() - windowStart >= 60_000) { windowStart = Date.now(); requests = 0; }
  if (active >= 3 || requests >= 30) throw new MetadataError(429, '检索请求较多，请稍后再试。已有收藏不会受影响。');
  active++; requests++; return () => { active--; };
}
export function parseSearch(params: URLSearchParams): SearchOptions {
  const query = (params.get('query') ?? '').trim();
  const provider = params.get('provider') ?? 'auto', sort = params.get('sort') ?? 'relevance';
  const from = params.get('yearFrom') ?? '', to = params.get('yearTo') ?? '';
  const page = Number(params.get('page') ?? '1');
  if (query.length < 2 || query.length > 200 || /[\x00-\x1f]/.test(query) || !['auto','openalex','crossref'].includes(provider) || !['relevance','newest','citations'].includes(sort) ||
    !Number.isInteger(page) || page < 1 || page > 5 || [from,to].some(y => y && (!/^\d{4}$/.test(y) || Number(y) < 1000 || Number(y) > new Date().getFullYear()+1)) ||
    (from && to && Number(from) > Number(to)) || ['journalsOnly','doiOnly','coreOnly'].some(k => params.has(k) && !['true','false'].includes(params.get(k)!))) {
    throw new MetadataError(400, '请填写 2–200 字的关键词或完整 DOI，并检查年份范围。最多浏览前 5 页，可缩小关键词继续查找。');
  }
  return { query, provider: provider as SearchOptions['provider'], sort: sort as SearchOptions['sort'], yearFrom: from, yearTo: to,
    page, journalsOnly: params.get('journalsOnly') !== 'false', doiOnly: params.get('doiOnly') !== 'false', coreOnly: params.get('coreOnly') !== 'false' };
}
export async function fetchJSON(url: URL, signal: AbortSignal): Promise<unknown> {
  let response: Response;
  try { response = await fetch(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(16_000)]), headers: { Accept: 'application/json', 'User-Agent': 'Paperi/0.1 (research metadata discovery)' } }); }
  catch { throw new MetadataError(502, '文献数据源连接中断或超时，请检查网络后重试。没有用示例论文代替结果。'); }
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 404) throw new MetadataError(404, '该数据源没有收录这个 DOI，不能据此确认其书目信息。可以打开 DOI 链接进一步核查。');
    if (response.status === 401 || response.status === 403) throw new MetadataError(503, '文献数据源拒绝访问，请检查接口密钥及云环境网络权限。');
    if (response.status === 429) throw new MetadataError(429, '文献数据源达到请求或额度限制，请稍后再试。');
    throw new MetadataError(502, '文献数据源暂时不可用，请稍后再试。');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new MetadataError(502, '文献数据源返回空响应。');
  let length = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 3_000_000) { await reader.cancel(); throw new MetadataError(502, '文献数据源响应过大，请缩小检索范围。'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const c of chunks) { bytes.set(c,offset); offset += c.length; }
    try { return JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new MetadataError(502, '文献数据源返回的格式异常，请稍后再试。'); }
  } finally { reader.releaseLock(); }
}
function result(options: SearchOptions, provider: SearchResults['provider'], rawItems: unknown[], total: number, mapper: (v: unknown, at: string) => Paper | null, notices: string[]): SearchResults {
  const at = new Date().toISOString(); const mapped = rawItems.map(v => mapper(v,at));
  let papers = deduplicate(mapped.filter((p): p is Paper => !!p));
  const excluded = mapped.filter(p => !p).length + papers.filter(p => p.retracted === true).length;
  papers = papers.filter(p => p.retracted !== true && (!options.doiOnly || !!p.doi) && (!options.coreOnly || p.sourceIsCore === true) &&
    (!options.journalsOnly || (provider==='crossref' ? p.kind==='journal-article' : ['article','review'].includes(p.kind))) &&
    (!options.yearFrom || (p.year!==null && p.year>=Number(options.yearFrom))) && (!options.yearTo || (p.year!==null && p.year<=Number(options.yearTo))));
  if (excluded) notices.push('部分缺少可核验标识、结构异常或已标记撤稿的记录未展示。');
  if (/[\u3400-\u9fff]/.test(options.query)) notices.push('国际数据源的中文覆盖有限；可改用英文关键词，或直接输入已知 DOI。');
  return { query: options.query, provider, items: papers.slice(0,pageSize), total, page: options.page, pageSize, notices, cached: false, hasMore: options.page < 5 && total > options.page * pageSize };
}
async function searchOpenAlex(o: SearchOptions, signal: AbortSignal): Promise<SearchResults> {
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('search',o.query); url.searchParams.set('per-page',String(pageSize)); url.searchParams.set('page',String(o.page));
  const filters = ['is_retracted:false'];
  if (o.journalsOnly) filters.push('type:article|review', 'primary_location.source.type:journal');
  if (o.doiOnly) filters.push('has_doi:true');
  if (o.coreOnly) filters.push('primary_location.source.is_core:true');
  if (o.yearFrom) filters.push(`from_publication_date:${o.yearFrom}-01-01`);
  if (o.yearTo) filters.push(`to_publication_date:${o.yearTo}-12-31`);
  url.searchParams.set('filter',filters.join(','));
  if (o.sort !== 'relevance') url.searchParams.set('sort',o.sort === 'newest' ? 'publication_date:desc' : 'cited_by_count:desc');
  if (process.env.OPENALEX_API_KEY?.trim()) url.searchParams.set('api_key',process.env.OPENALEX_API_KEY.trim());
  const data = await fetchJSON(url,signal);
  if (!isRecord(data) || !Array.isArray(data.results) || !isRecord(data.meta) || !Number.isSafeInteger(data.meta.count) || Number(data.meta.count) < 0) throw new MetadataError(502, 'OpenAlex 返回的书目结构不完整。');
  return result(o,'openalex',data.results,Number(data.meta.count),mapOpenAlex,o.coreOnly ? ['已限定 OpenAlex 标记的 CWTS 核心来源，按照当前选择的排序展示；这是一项来源筛选依据，不保证单篇论文质量。'] : []);
}
async function searchCrossref(o: SearchOptions, signal: AbortSignal, notices: string[] = []): Promise<SearchResults> {
  if(o.coreOnly){notices.push('Crossref 不支持 CWTS 来源筛选，已为你关闭。');o={...o,coreOnly:false};}
  const url = new URL('https://api.crossref.org/works');
  url.searchParams.set('query.bibliographic',o.query); url.searchParams.set('rows',String(pageSize)); url.searchParams.set('offset',String((o.page-1)*pageSize));
  const filters = [];
  if (o.journalsOnly) filters.push('type:journal-article');
  if (o.yearFrom) filters.push(`from-pub-date:${o.yearFrom}-01-01`);
  if (o.yearTo) filters.push(`until-pub-date:${o.yearTo}-12-31`);
  if (filters.length) url.searchParams.set('filter',filters.join(','));
  url.searchParams.set('sort',o.sort === 'relevance' ? 'relevance' : o.sort === 'newest' ? 'published' : 'is-referenced-by-count');
  url.searchParams.set('order','desc');
  const data = await fetchJSON(url,signal);
  if (!isRecord(data) || !isRecord(data.message) || !Array.isArray(data.message.items) || !Number.isSafeInteger(data.message['total-results']) || Number(data.message['total-results']) < 0) throw new MetadataError(502, 'Crossref 返回的书目结构不完整。');
  return result(o,'crossref',data.message.items,Number(data.message['total-results']),mapCrossref,[...notices,'Crossref 提供 DOI 登记元数据；摘要、被引与撤稿状态可能缺失，不代表已获取全文或确认同行评审质量。']);
}
async function lookupDOI(doi: string, signal: AbortSignal): Promise<Paper> {
  const data = await fetchJSON(new URL(crossrefRecordURL(doi)),signal);
  const paper = isRecord(data) ? mapCrossref(data.message,new Date().toISOString()) : null;
  if (!paper || paper.doi !== doi) throw new MetadataError(502, 'DOI 登记记录不完整或与请求标识不一致，未标记为核验成功。');
  return paper;
}
export async function searchLiterature(o: SearchOptions, signal: AbortSignal): Promise<SearchResults> {
  if(o.provider === 'auto' && !normalizeDOI(o.query)) throw new MetadataError(400,'默认文献发现请从 AI 学术联网检索提交研究问题；此接口只用于显式元数据查询或 DOI 核验。');
  const key = JSON.stringify(o), hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return { ...hit.value, cached: true };
  const release = reserve();
  try {
    let data: SearchResults;
    const doi = normalizeDOI(o.query);
    if (doi) {
      const paper = await lookupDOI(doi,signal);
      data = { query: o.query, provider: 'crossref', items: [paper], total: 1, page: 1, pageSize, notices: ['按 DOI 精确获取登记记录，不应用关键词排序、来源或年份筛选；该记录不代表通过质量筛选。'], cached: false, hasMore: false };
    } else if (o.provider === 'crossref') data = await searchCrossref(o,signal);
    else if (o.provider === 'auto' && Date.now() < openAlexRetryAt) data = await searchCrossref(o,signal,['OpenAlex 暂不可访问，当前使用 Crossref 的真实 DOI 登记记录。']);
    else {
      try { data = await searchOpenAlex(o,signal); }
      catch (e) {
        if (o.provider !== 'auto' || signal.aborted) throw e;
        if (e instanceof MetadataError && e.status === 503) openAlexRetryAt = Date.now()+600_000;
        data = await searchCrossref(o,signal,['OpenAlex 本次不可用，已改用 Crossref 的真实 DOI 登记记录。检索词没有改变。']);
      }
    }
    if (cache.size >= 80) cache.delete(cache.keys().next().value!);
    cache.set(key,{ expires: Date.now()+300_000, value: data });
    return data;
  } finally { release(); }
}
export async function verifyDOI(value: string, signal: AbortSignal) {
  const doi = normalizeDOI(value); if (!doi) throw new MetadataError(400,'请使用有效、完整的 DOI。');
  const release = reserve();
  try {
    const paper = await lookupDOI(doi,signal); let resolves: boolean | null = null;
    try { const r = await fetch(doiURL(doi),{ method: 'HEAD', redirect: 'manual', signal: AbortSignal.any([signal,AbortSignal.timeout(8000)]), cache: 'no-store' }); resolves = r.ok || ([301,302,303,307,308].includes(r.status) && !!safeWebURL(r.headers.get('Location'))) ? true : r.status === 404 ? false : null; await r.body?.cancel(); } catch { /* Registry metadata remains available when the resolver cannot be checked. */ }
    return { paper, resolves, checkedAt: new Date().toISOString() };
  } finally { release(); }
}
