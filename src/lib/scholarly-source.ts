// A domain is only a routing hint. Publication identity must also be parsed from
// the specific record page; news, directory and search pages never qualify.
export function scholarlySource(value: string): { url: string; recordId: string; kind: 'journal-article'|'dissertation'|'proceedings-article'|'unknown' } | null {
  let u: URL;
  try { u = new URL(value); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port || value.length > 2000) return null;
  const h = u.hostname.toLowerCase(), p = u.pathname;
  const within = (domain: string) => h === domain || h.endsWith('.' + domain);
  if (/\/(?:news|blog|press|about|search|list|index|notice|announcement|uploadfile|pdf)(?:\/|\.|$)/i.test(p) || /\.(?:pdf|zip)$/i.test(p)) return null;
  let kind: 'journal-article'|'dissertation'|'proceedings-article'|'unknown' = 'unknown';
  let id: string | null = null;
  if (within('cnki.net') || within('cnki.com.cn')) {
    id = p.match(/\/portal\/journal\/portal\/client\/paper\/([\da-f]{24,40})$/i)?.[1]
      ?? p.match(/\/Article\/(?:CJFD|CDMD|CPFD)[\w-]+\.htm$/i)?.[0]
      ?? (/\/kcms(?:2)?\/(?:detail\/detail|article\/abstract)\.(?:aspx|html)$/i.test(p) ? u.searchParams.get('filename') ?? u.searchParams.get('FileName') : null);
    const db = (u.searchParams.get('dbcode') ?? u.searchParams.get('DBCode') ?? '').toUpperCase();
    if(db && !['CJFD','CJFN','CDFD','CMFD','CDMD','CPFD'].includes(db))return null;
    kind = /CMFD|CDFD|CDMD/.test(db + p) ? 'dissertation' : /CPFD/.test(db + p) ? 'proceedings-article' : 'journal-article';
  } else if (within('wanfangdata.com.cn')) {
    const m = p.match(/\/(periodical|thesis|conference)\/([\w.-]+)$/i);
    if (m) { id = m[2]; kind = m[1].toLowerCase() === 'thesis' ? 'dissertation' : m[1].toLowerCase() === 'conference' ? 'proceedings-article' : 'journal-article'; }
  } else if (within('cqvip.com')) {
    if (/\/Qikan\/Article\/Detail$/i.test(p)) { id = u.searchParams.get('id'); kind = 'journal-article'; }
  } else if (h === 'opaj.napstic.cn' && /^\/periodicalArticle\/\d+$/.test(p)) {
    id = p; kind = 'journal-article';
  } else {
    const institution = within('edu.cn') || within('ac.cn');
    const publisher = ['hep.com.cn','magtech.com.cn','sciengine.com','springer.com','wiley.com','sagepub.com','tandfonline.com','sciencedirect.com','cambridge.org','oup.com','hanspub.org'].some(within);
    if ((institution || publisher) && /\/(?:[^/]+\/)*(?:CN\/(?:abstract\/abstract\d+\.(?:s?html)|Y\d{4}\/V[^/]+\/I[^/]+\/[^/]+|10\.[^\s]+|\d{10,})|article\/(?:doi\/|[^/]+)|doi\/(?:abs\/|full\/)?10\.[^\s]+|handle\/[^/]+\/[^/]+)$/i.test(p)) id = p;
    if (id && /\/handle\//.test(p)) kind = 'dissertation';
  }
  return id && !/[\x00-\x20]/.test(id) ? { url: u.href, recordId: id, kind } : null;
}
