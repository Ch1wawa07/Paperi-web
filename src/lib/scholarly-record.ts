import { isRecord } from './exploration';
import { isScholarlyPaper, normalizeDOI, webKey, type Paper } from './literature';
import { scholarlySource } from './scholarly-source';

export const recordText = (value: string) => value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, ' ').replace(/&#(x[\da-f]+|\d+);/gi, (_, n: string) => { const c = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n); return c > 0 && c <= 0x10ffff ? String.fromCodePoint(c) : ''; }).replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, e => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '})[e] ?? e).replace(/\s+/g, ' ').trim();
export const titleIdentity = (s: string) => recordText(s).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const yearOf = (s: string) => { const y = Number(s.match(/\b(19\d{2}|20\d{2})\b/)?.[1]); return y >= 1900 && y <= new Date().getFullYear() + 1 ? y : null; };
function publication(url: string, fields: {title: string; authors: string[]; year: number|null; venue: string; kind: string; doi?: string|null; abstract?: string|null}, method: 'citation-meta'|'json-ld'|'record-fields'): Paper|null {
  const source = scholarlySource(url);
  if (!source) return null;
  if (!fields.authors.length || fields.authors.some(a=>/未获取|未知|作者信息|责任编辑|^记者|^编辑|https?:|@/.test(a)) || /未获取|待核实|未知/.test(fields.title+' '+fields.venue)) return null;
  const p: Paper = {key: fields.doi ? `doi:${fields.doi}` : webKey(source.url), title: recordText(fields.title), authors: fields.authors.map(recordText).filter(Boolean), authorsTruncated: false, year: fields.year, venue: recordText(fields.venue) || null, kind: fields.kind, doi: fields.doi ?? null, openAlexId: null, sourceIsCore: null, abstract: fields.abstract ? recordText(fields.abstract).slice(0,6000) : null, abstractTruncated: !!fields.abstract && fields.abstract.length > 6000, citations: null, retracted: null, oaUrl: null, landingUrl: source.url, source: 'academic', recordUrl: source.url, retrievedAt: new Date().toISOString(), identity: 'verified', verification: {method, recordId: source.recordId, url: source.url}};
  return isScholarlyPaper(p) ? p : null;
}
// Only machine-readable metadata on a retrieved academic detail page qualifies.
// og:title, description, Search snippets, website dates and affiliation are not bibliographic fields.
export function parseScholarlyHTML(url: string, html: string): Paper|null {
  if (!scholarlySource(url) || html.length > 1_500_000) return null;
  if (/"@type"\s*:\s*"(?:NewsArticle|BlogPosting|ReportageNewsArticle)"/i.test(html)) return null;
  const metadataHTML = (html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  const meta = new Map<string,string[]>();
  for (const match of metadataHTML.matchAll(/<meta\b[^>]{1,6000}>/gi)) {
    const attrs: Record<string,string> = {};
    for (const a of match[0].matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) attrs[a[1].toLowerCase()] = recordText(a[3]);
    const name = (attrs.name ?? attrs.property ?? '').toLowerCase();
    if (name && attrs.content) meta.set(name, [...(meta.get(name) ?? []), attrs.content]);
  }
  const first = (...keys:string[]) => keys.map(k=>meta.get(k)?.[0]).find(Boolean) ?? '';
  const journal = first('citation_journal_title'), institution = first('citation_dissertation_institution'), conference = first('citation_conference_title');
  const kind = journal ? 'journal-article' : institution ? 'dissertation' : conference ? 'proceedings-article' : '';
  const doi = normalizeDOI(first('citation_doi'));
  const issued = first('citation_publication_date','citation_date','dc.date.issued');
  const id = first('citation_issn','citation_volume','citation_issue','citation_firstpage') || doi || (institution && scholarlySource(url)?.recordId);
  if (kind && id) {
    const paper = publication(url, {title:first('citation_title'), authors:meta.get('citation_author') ?? [], year:yearOf(issued), venue:journal || institution || conference, kind, doi, abstract:first('citation_abstract') || null}, 'citation-meta');
    if (paper) return paper;
  }
  // ScholarlyArticle/Thesis are explicit types; Article/NewsArticle/WebPage are not.
  for (const script of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed:unknown; try { parsed = JSON.parse(script[1]); } catch { continue; }
    const nodes = Array.isArray(parsed) ? parsed : isRecord(parsed) && Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed];
    for (const v of nodes) {
      if (!isRecord(v) || !['ScholarlyArticle','Thesis'].includes(String(v['@type']))) continue;
      if (typeof v.url !== 'string' || v.url !== scholarlySource(url)?.url) continue;
      const part = isRecord(v.isPartOf) ? v.isPartOf : null;
      const venue = part && typeof part.name === 'string' ? part.name : '';
      const authors = (Array.isArray(v.author) ? v.author : [v.author]).flatMap(a=>isRecord(a) && a['@type'] === 'Person' && typeof a.name === 'string' ? [a.name] : []);
      const paper = publication(url, {title:typeof v.headline === 'string' ? v.headline : typeof v.name === 'string' ? v.name : '', authors, year:yearOf(String(v.datePublished ?? '')), venue, kind:v['@type'] === 'Thesis' ? 'dissertation' : 'journal-article', doi:normalizeDOI(v.identifier), abstract:typeof v.abstract === 'string' ? v.abstract : null}, 'json-ld');
      if (paper) return paper;
    }
  }
  return null;
}
// Fetched record text only; never invoke this on Search content/summary/snippet.
// Labels are anchored to lines and the record's own header, before references.
export function parseScholarlyRecordText(url: string, text: string): Paper|null {
  const source = scholarlySource(url);
  if (!source || text.length > 100_000) return null;
  const header = text.split(/(?:^|\n)\s*#{0,4}\s*(?:参考文献|References|相关文章|Related articles)\s*[:：]?\s*(?:\n|$)/i)[0].replace(/\[([^\]]+)\]\([^\n)]*\)/g,'$1').replace(/\*\*|`/g,'');
  const lines = header.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const field = (label:string) => lines.map(s=>s.match(new RegExp(`^(?:#{1,4}\\s*)?(?:${label})\\s*[:：]\\s*(.+)$`,'i'))?.[1]).find(Boolean) ?? '';
  let title = field('篇名|题名|论文题目|Title'), authors = field('作者|Authors?'), venue = field('刊名|期刊名称|学位授予单位|会议名称|Journal|Institution|Conference');
  let year = yearOf(field('出版年|发表年份|出版时间|出版日期|学位年度|Year|Published'));
  // CNKI journal-portal header has a journal heading, issue selector, title,
  // author line, affiliation. It need not contain a DOI.
  if (/\.cbpt\.cnki\.net$/.test(new URL(url).hostname) && !title) {
    const issue = lines.findIndex(s=>/^(?:\[Select\]\s*)?\d{4},\s*\d{1,2},\s*v\.\d+\s+\d+-\d+$/.test(s));
    const journal = lines.slice(0,issue).find(s=>/^#\s+[^#]/.test(s));
    if (issue >= 0 && journal) {title=lines[issue+1]??'';authors=lines[issue+2]??'';venue=journal.replace(/^#\s+/,'');year=yearOf(lines[issue]);}
  }
  const kind = source.kind === 'unknown' ? '' : source.kind;
  const authorList = authors.split(/[;；、,，]|\s+(?=[\u3400-\u9fff])/).filter(Boolean);
  // Generic unlabeled page bodies and headings never establish publication identity.
  if (!kind) return null;
  const abstract=header.match(/(?:^|\n)\s*#{0,4}\s*(?:摘要|Abstract)\s*[:：]\s*([^\n]+(?:\n(?!\s*#{0,4}\s*(?:关键词|Keywords|基金|参考文献|Abstract|作者简介)\s*[:：])[^\n]+)*)/i)?.[1] ?? null;
  return publication(url, {title,authors:authorList,year,venue,kind,doi:normalizeDOI(field('DOI')),abstract}, 'record-fields');
}
