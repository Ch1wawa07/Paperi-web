import {normalizeDOI,type Paper} from './literature';
/** Literal, conservative candidates only; no external lookup or AI is required to import. */
export function pdfMetadataCandidates(pages:string[],info:{title?:string;author?:string}={}){
 const text=pages.slice(0,3).map((p,i)=>`[第 ${i+1} 页]\n${p}`).join('\n');
 const lines=(pages[0]??'').split(/\n/).map(s=>s.trim()).filter(Boolean);
 const fields:Partial<Paper>={};
 const explicitTitle=text.match(/(?:论文题目|题\s*名|题\s*目)\s*[:：]\s*([^\n]{4,160})/);
 const first=lines.find(s=>s.length>=6&&s.length<=70&&!/摘要|abstract|关键词|第.*期|大学|学院|DOI|ISSN|CN\s*\d|https?:/i.test(s));
 const title=explicitTitle?.[1]||info.title||first;
 if(title)fields.title=title;
 const authors=text.match(/(?:作\s*者|研究生姓名|姓\s*名)\s*[:：]\s*([^\n]{2,80})/);
 if(authors||info.author)fields.authors=(authors?.[1]||info.author||'').split(/[，,；;、]/).map(s=>s.trim()).filter(Boolean);
 const doi=text.match(/\bdoi\s*[:：]?\s*(10\.\d{4,9}\/[^\s<>]+)/i)?.[1];
 if(doi)fields.doi=normalizeDOI(doi);
 const year=text.match(/(?:出版年|发表时间|学位授予时间|答辩日期|出版日期)\s*[:：]?\s*((?:19|20)\d{2})/);
 if(year)fields.year=Number(year[1]);
 const venue=text.match(/(?:刊\s*名|来源期刊|学位授予单位)\s*[:：]\s*([^\n]{2,100})/);
 if(venue)fields.venue=venue[1].trim();
 const abstract=text.match(/(?:摘\s*要)\s*[:：]?\s*([\s\S]{30,3000}?)(?=关\s*键\s*词|\bkeywords\b|\[第|$)/i)?.[1]?.trim();
 if(abstract)fields.abstract=abstract;
 return {fields,evidence:text.slice(0,14000)};
}
