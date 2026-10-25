import 'server-only';
import { AIError, readBoundedJSON } from './ai-server';
import { isRecord } from './exploration';
import { crossrefRecordURL, normalizeDOI, safeWebURL, webKey, type Paper, type SearchResults } from './literature';
import { mapCrossref } from './literature-mapping';
import { fetchJSON, MetadataError } from './literature-server';

export type DiscoveryInput = { query: string; language: 'auto'|'zh'|'en'; concepts: string[]; question: string };
export function parseDiscovery(v: unknown): DiscoveryInput {
  if (!isRecord(v) || typeof v.query !== 'string' || v.query.trim().length < 2 || v.query.length > 200 || /[\x00-\x1f]/.test(v.query) || !['auto','zh','en'].includes(String(v.language)) || !Array.isArray(v.concepts) || v.concepts.length > 24 || !v.concepts.every(c=>typeof c === 'string' && c.length <= 80) || typeof v.question !== 'string' || v.question.length > 400) throw new MetadataError(400,'请填写 2–200 字研究问题，并检查检索语言和当前项目概念。');
  return {query:v.query.trim(),language:v.language as DiscoveryInput['language'],concepts:v.concepts as string[],question:v.question};
}
const cache = new Map<string,{expires:number; value:SearchResults}>();
const inFlight = new Map<string,Promise<SearchResults>>();
let active=0, windowAt=Date.now(), count=0;
function key() {
  const direct=process.env.DEEPSEEK_API_KEY?.trim();
  // Never send a different provider's model credential to DeepSeek.
  if (direct) return direct;
  try { if(new URL(process.env.AI_BASE_URL ?? '').hostname === 'api.deepseek.com' && process.env.AI_API_KEY?.trim()) return process.env.AI_API_KEY.trim(); } catch {}
  throw new MetadataError(503,'DeepSeek 联网检索尚未配置。请在服务端安全设置 DEEPSEEK_API_KEY；没有发送请求，也不会用元数据检索或示例结果冒充联网搜索。');
}
async function tool(name:'search'|'fetch', body:object, signal:AbortSignal) {
  const credential=key();
  let response:Response;
  try {response=await fetch(`https://api.deepseek.com/v1/tools/${name}`,{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(20_000)]),headers:{'Content-Type':'application/json',Authorization:`Bearer ${credential}`},body:JSON.stringify(body)});} catch {throw new MetadataError(504,'DeepSeek 联网检索连接中断或超时，未自动重试。');}
  if(!response.ok){await response.body?.cancel();const messages:Record<number,string>={401:'DeepSeek 密钥无效或缺失，请检查服务端密钥。',402:'DeepSeek 账户余额不足；没有自动充值或重试。',403:'DeepSeek 拒绝访问，请核对账号权限或目标网页访问政策。',429:'DeepSeek 请求受限，请稍后手动重试。',404:'DeepSeek 未能取得可用网页内容。',408:'DeepSeek 请求超时。',504:'DeepSeek 上游超时。'};throw new MetadataError(messages[response.status]?response.status:502,messages[response.status]??'DeepSeek 服务暂不可用。');}
  try{return await readBoundedJSON(response,1_500_000);}catch{throw new MetadataError(502,'DeepSeek 响应格式不完整或超过大小限制。');}
}
const clean=(v:unknown,n:number)=>typeof v==='string'?v.replace(/<[^>]*>/g,' ').trim().slice(0,n):'';
const norm=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
function lead(v:unknown):Paper|null {
  if(!isRecord(v))return null;
  const url=safeWebURL(v.url), title=clean(v.title,1200);if(!url||!title)return null;
  // Search summary/date/authority are not scholarly metadata or citation counts.
  const summary=clean(v.content || v.summary || v.snippet,6000);
  const academic=/doi\.org|cnki\.|wanfangdata\.|cqvip\.|期刊|学报|摘要|学位论文|journal|abstract|论文/i.test(url+' '+title+' '+summary);
  return {key:webKey(url),title,authors:[],authorsTruncated:false,year:null,venue:null,sourceIsCore:null,kind:academic?'论文线索':'参考网页',doi:null,openAlexId:null,abstract:null,abstractTruncated:false,citations:null,retracted:null,oaUrl:null,landingUrl:url,source:'deepseek',recordUrl:url,retrievedAt:new Date().toISOString(),identity:academic?'lead':'webpage',...(summary?{webSummary:summary}:{})};
}
function doiFrom(p:Paper) {
  const url=p.recordUrl;
  if(/^https?:\/\/(?:dx\.)?doi\.org\//i.test(url))return normalizeDOI(url);
  return normalizeDOI((url+' '+(p.webSummary??'')).match(/10\.\d{4,9}\/[^\s<>"\])]+/i)?.[0]?.replace(/[.,;。；]+$/,''));
}
export async function discover(input:DiscoveryInput,signal:AbortSignal):Promise<SearchResults>{
  key(); // Cache never bypasses credential configuration.
  const cacheKey=JSON.stringify(input),hit=cache.get(cacheKey);
  if(hit&&hit.expires>Date.now())return {...hit.value,cached:true};
  const pending=inFlight.get(cacheKey);if(pending)return pending;
  if(Date.now()-windowAt>60_000){windowAt=Date.now();count=0;}
  if(active>=2||count>=6)throw new MetadataError(429,'检索较多，请稍后再试。');
  active++;count++;
  const run=(async()=>{
    const base=[input.query,...input.concepts.slice(0,2)].join(' ').slice(0,95);
    const queries=input.language==='en'?[`${base} lang:en`]:input.language==='zh'?[`${base} 论文 lang:zh`]:[`${base} 论文 lang:zh`,`${base} lang:en`];
    const notices=['网页搜索结果不等同于已核实论文；搜索权威度和排名没有用于被引次数或学术质量评分。'];
    const groups:Paper[][]=[];
    const papers:Paper[]=[];
    for(const query of queries){
      try {const data=await tool('search',{query,count:10,need_content:true,ori_question:input.query.slice(0,128)},signal);
        if(!isRecord(data)||!Array.isArray(data.results))throw new MetadataError(502,'DeepSeek 没有返回有效的 results 数组。');
        const group=data.results.map(lead).filter((p):p is Paper=>!!p);groups.push(group);
        papers.push(...group);
      }catch(e){if(!papers.length || e instanceof MetadataError && [401,402,403,429].includes(e.status))throw e;notices.push('部分搜索失败，仅展示已取得的网页；未自动重试。');}
    }
    const items:Paper[]=[];
    for(let n=0;n<10;n++)for(const group of groups){const p=group[n];if(p&&items.length<10&&!items.some(x=>x.recordUrl===p.recordUrl))items.push(p);}
    const incomplete=items.find(p=>p.identity==='lead'&&!doiFrom(p)&&(!p.webSummary||p.webSummary.length<200));
    if(incomplete){try{const page=await tool('fetch',{url:incomplete.recordUrl},signal);if(isRecord(page)&&typeof page.content==='string'&&page.content.trim())incomplete.webSummary=clean(page.content,6000);}catch(e){if(e instanceof MetadataError&&[401,402,403,429].includes(e.status))notices.push(e.message);else notices.push('一条线索的补充抓取失败，保留原网页信息并标记待核实。');}}
    // At most 3 exact DOI registry lookups; no discovery or fuzzy identity promotion.
    let checks=0;
    for(let i=0;i<items.length&&checks<3;i++){const p=items[i],doi=doiFrom(p);if(!doi)continue;checks++;
      try{const data=await fetchJSON(new URL(crossrefRecordURL(doi)),signal);const verified=isRecord(data)?mapCrossref(data.message,new Date().toISOString()):null;
        if(verified&&verified.doi===doi&&norm(verified.title).length>=10&&norm(p.title).includes(norm(verified.title))&&verified.authors.length&&verified.year){items[i]={...verified,identity:'verified',discoveryUrl:p.recordUrl};}
        else notices.push('发现 DOI 但题名或身份信息不足，未升级为已核实论文。');
      }catch{notices.push('部分 DOI 登记核验未完成，对应结果仍为未核实线索。');}
    }
    const unique=items.filter((p,i)=>items.findIndex(x=>x.key===p.key)===i);
    const value:SearchResults={query:input.query,provider:'deepseek',items:unique,total:unique.length,page:1,pageSize:10,notices:[...new Set(notices)],cached:false,hasMore:false};
    if(cache.size>=40)cache.delete(cache.keys().next().value!);cache.set(cacheKey,{expires:Date.now()+300_000,value});return value;
  })();
  inFlight.set(cacheKey,run);
  try{return await run;}finally{inFlight.delete(cacheKey);active--;}
}
// Re-exporting no credentials, headers or raw provider errors to the client.
export const discoveryError=(e:unknown)=>e instanceof MetadataError||e instanceof AIError?e:new MetadataError(502,'联网检索未完成，未返回模拟论文。');
