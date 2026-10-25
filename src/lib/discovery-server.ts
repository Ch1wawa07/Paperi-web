import 'server-only';
import { AIError, readBoundedJSON } from './ai-server';
import { isRecord } from './exploration';
import { crossrefRecordURL, isScholarlyPaper, normalizeDOI, safeWebURL, samePaper, type Paper, type SearchResults } from './literature';
import { parseScholarlyHTML, parseScholarlyRecordText, titleIdentity } from './scholarly-record';
import { scholarlySource } from './scholarly-source';
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
type Candidate = {url: string; title: string};
function candidate(v:unknown):Candidate|null {
  if (!isRecord(v) || typeof v.title !== 'string') return null;
  const url=safeWebURL(v.url);
  if (!url || (!scholarlySource(url) && !/^https:\/\/(?:dx\.)?doi\.org\//i.test(url))) return null;
  return {url,title:v.title.slice(0,1200)};
}
// Acronym expansion is a query aid, never evidence or a topic-specific result list.
export function academicQueries(input: DiscoveryInput): string[] {
  const terms=[input.query,...input.concepts.slice(0,2)].join(' ').replace(/\bAIGC\b/gi,'生成式人工智能 AIGC').replace(/(?<!微)短剧/g,'微短剧').replace(/\bGEO\b/gi,'生成式搜索 GEO');
  const build=(suffix:string)=>[...terms].slice(0,128-[...suffix].length).join('')+suffix;
  if(input.language==='en') return [build(' scholarly journal article lang:en'),build(' site:doi.org OR site:link.springer.com lang:en')];
  const queries=[build(' 期刊论文 学位论文 lang:zh'),build(' site:cnki.net OR site:wanfangdata.com.cn OR site:cqvip.com lang:zh')];
  if(input.language==='auto')queries.push(build(' 学术研究 期刊 传播机制 -新闻 -资讯 lang:zh,en'));
  return [...new Set(queries)];
}
async function recordHTML(url:string,signal:AbortSignal):Promise<string|null> {
  // Restrict every hop to supported scholarly detail pages. Never fetch arbitrary
  // user-provided URLs, PDF/full text, search pages or redirects to private hosts.
  let target=url;
  for(let hop=0;hop<2;hop++) {
    if(!scholarlySource(target))return null;
    const r=await fetch(target,{redirect:'manual',cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(8000)]),headers:{Accept:'text/html','User-Agent':'Paperi scholarly metadata verification'}});
    if([301,302,303,307,308].includes(r.status)) {const location=r.headers.get('location');await r.body?.cancel();if(!location)return null;target=new URL(location,target).href;continue;}
    if(!r.ok || !r.headers.get('content-type')?.includes('text/html')){await r.body?.cancel();return null;}
    const reader=r.body?.getReader();if(!reader)return null;
    let length=0;const chunks:Uint8Array[]=[];
    try {while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>1_500_000){await reader.cancel();return null;}chunks.push(value);}}
    finally {reader.releaseLock();}
    const bytes=new Uint8Array(length);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
    const head=new TextDecoder().decode(bytes.slice(0,5000));
    const charset=r.headers.get('content-type')?.match(/charset=["']?([\w-]+)/i)?.[1]??head.match(/charset=["']?([\w-]+)/i)?.[1]??'utf-8';
    try{return new TextDecoder(charset).decode(bytes);}catch{return null;}
  }
  return null;
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
    const queries=academicQueries(input);
    const notices:string[]=[];
    const candidates:Candidate[]=[];
    let successfulSearches=0;
    for(const query of queries){
      try {
        const data=await tool('search',{query,count:10,need_content:false,ori_question:[...input.query].slice(0,128).join('')},signal);
        if(!isRecord(data)||!Array.isArray(data.results))throw new MetadataError(502,'DeepSeek 没有返回有效的 results 数组。');
        successfulSearches++;
        for(const item of data.results){const c=candidate(item);if(c&&!candidates.some(x=>x.url===c.url))candidates.push(c);}
      }catch(e){if(!successfulSearches || e instanceof MetadataError && [401,402,403,429].includes(e.status))throw e;notices.push('部分学术查询失败，未自动重试；仅核验成功查询中的候选。');}
    }
    const unique:Paper[]=[];
    let fetches=0;
    const checkedSignal=AbortSignal.any([signal,AbortSignal.timeout(65_000)]);
    // Candidate pages never become cards. Up to six individual records are read;
    // unsupported/inaccessible records are excluded rather than completed by AI.
    for(const c of candidates.slice(0,6)){
      if(checkedSignal.aborted){notices.push('身份核验达到等待上限，只展示已完成核验的论文。');break;}
      let paper:Paper|null=null;
      const doi=normalizeDOI(c.url);
      if(doi){
        try{const data=await fetchJSON(new URL(crossrefRecordURL(doi)),checkedSignal);const p=isRecord(data)?mapCrossref(data.message,new Date().toISOString()):null;
          if(p&&p.doi===doi&&titleIdentity(p.title)===titleIdentity(c.title)&&isScholarlyPaper(p))paper={...p,identity:'verified',discoveryUrl:c.url};
        }catch{notices.push('部分 DOI 身份核验失败，对应候选未进入论文列表。');}
      }else{
        try{const html=await recordHTML(c.url,checkedSignal);if(html)paper=parseScholarlyHTML(c.url,html);}catch{ /* Bounded Fetch can retrieve public record text when HTML is inaccessible. */ }
        if(!paper&&fetches<2&&!checkedSignal.aborted){
          fetches++;
          try{const page=await tool('fetch',{url:c.url},checkedSignal);if(isRecord(page)&&typeof page.content==='string')paper=parseScholarlyRecordText(c.url,page.content);}
          catch(e){if(e instanceof MetadataError&&[401,402,403,429].includes(e.status))throw e;notices.push('部分学术详情页未能读取，未用网页简介或 AI 补全身份。');}
        }
      }
      if(paper&&isScholarlyPaper(paper)&&!unique.some(x=>samePaper(x,paper)))unique.push(paper);
    }
    notices.push(`本次执行 ${queries.length} 组学术查询；最多核验 6 个详情记录、补充 ${fetches} 次 Fetch。只有通过身份核验的论文进入列表。`);
    if(!unique.length)notices.push('本次搜索尚未找到可核实的学术文献。新闻、行业资讯及身份不足的网页均未展示。');
    const value:SearchResults={query:input.query,provider:'deepseek',items:unique,total:unique.length,page:1,pageSize:10,notices:[...new Set(notices)],cached:false,hasMore:false};
    if(cache.size>=40)cache.delete(cache.keys().next().value!);cache.set(cacheKey,{expires:Date.now()+300_000,value});return value;
  })();
  inFlight.set(cacheKey,run);
  try{return await run;}finally{inFlight.delete(cacheKey);active--;}
}
// Re-exporting no credentials, headers or raw provider errors to the client.
export const discoveryError=(e:unknown)=>e instanceof MetadataError||e instanceof AIError?e:new MetadataError(502,'联网检索未完成，未返回模拟论文。');
