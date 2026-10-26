'use client';
import {useEffect,useRef,useState} from 'react';
import type {Project} from '@/lib/projects';
import {emptyWorkflow,sourceFingerprint,workflowEvidence,cleanDirection,isFailedSection,directionPlainText,type Analysis,type DirectionCard,type ReadingSection} from '@/lib/workflow';
import {useProjects} from './project-provider';
import {requestWorkflow,Sources,WorkflowSelection} from './literature-analysis';
const blank=():DirectionCard=>({title:'',question:'',value:'',method:'',limitations:'',evidenceIds:[]});
const labels={title:'方向名称',question:'我想研究什么',value:'为什么值得研究',method:'初步可以怎样研究',limitations:'哪些地方还需要证据'} as const;
export function StudyWorkspace({project:p,mode}:{project:Project;mode:'reading'|'context'}){
 const {saveWorkflow,saveLibrary,busy}=useProjects(),f=p.workflow??emptyWorkflow();
 const items=p.library?.items??[],kind=mode==='reading'?'reading':'directions';
 const [selected,setSelected]=useState(()=>{const id=typeof window==='undefined'?'':sessionStorage.getItem(`paperi.reading.${p.id}`);return items.some(i=>i.id===id)?id!:items[0]?.id??'';});
 const [result,setResult]=useState<Analysis|null>(null),[pending,setPending]=useState(false),[error,setError]=useState(''),[phase,setPhase]=useState('');
 const [draft,setDraft]=useState<DirectionCard>(()=>f.direction?.card??{...blank(),title:cleanDirection(f.direction?.text??'').split('\n')[0]??'',question:cleanDirection(f.direction?.text??'').split('\n').slice(1).join('\n'),evidenceIds:f.direction?.evidenceIds??[]});
 const [changed,setChanged]=useState(false),[message,setMessage]=useState('');
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const history=f.analyses.filter(a=>a.kind===kind&&(kind!=='reading'||a.sourceIds.includes(selected)));
 const analysis=result??history.at(-1),item=items.find(i=>i.id===selected);
 const stale=!!analysis&&analysis.fingerprint!==sourceFingerprint(p,kind!=='directions');
 const chosenStale=!!f.direction&&(f.direction.fingerprint!==sourceFingerprint(p,false)||f.direction.evidenceIds.some(id=>!items.some(i=>i.id===id)));
 async function generate(){
  if(f.analyses.length>=100){setError('分析历史已达上限，请先备份项目并分项目继续；没有覆盖旧成果。');return;}
  setError('');setPending(true);setPhase('正在准备当前项目资料…');const c=new AbortController();controller.current=c;
  try{const a=await requestWorkflow(p,kind,kind==='reading'?[selected]:workflowEvidence(p).map(i=>i.id),'',c.signal,setPhase);if(c.signal.aborted)return;
   setResult(a);if(!await saveWorkflow(p.id,f.revision,{...f,analyses:[...f.analyses,a]}))setError('结果已返回但尚未保存，原项目保留。请处理存储提示，勿关闭当前页面。');
  }catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'分析未完成，请重试。');}finally{if(!c.signal.aborted){setPending(false);setPhase('');}}
 }
 async function saveCard(card=draft){
  setError('');const text=directionPlainText(card,card.evidenceIds.map(id=>items.find(i=>i.id===id)?.paper.title??'来源已移除，需要核对'));
  if(text.length>4000){setError('方向卡内容过长，请精简后保存。');return;}
  if(await saveWorkflow(p.id,f.revision,{...f,direction:{text,card,evidenceIds:card.evidenceIds,fingerprint:sourceFingerprint(p,false)}})){setDraft(card);setChanged(false);setMessage('研究方向卡已保存到当前项目。');}
 }
 async function copyCard(){try{await navigator.clipboard.writeText(directionPlainText(draft,draft.evidenceIds.map(id=>items.find(i=>i.id===id)?.paper.title??'来源已移除，需要核对')));setMessage('已复制研究方向卡普通文字。');}catch{setMessage('浏览器未允许复制，请在卡片中选择文字复制。');}}
 async function note(s:ReadingSection){
  if(!item||!p.library)return;const text=[item.note,s.title,s.body,`证据限制：${s.uncertainty}`].filter(Boolean).join('\n');
  if(text.length>4000){setError('笔记超过 4000 字，请先整理原笔记。');return;}
  await saveLibrary(p.id,p.library.revision,{...p.library,items:items.map(i=>i.id===item.id?{...i,note:text,updatedAt:new Date().toISOString()}:i)});
 }
 function section(s:ReadingSection,index:number){return <article id={`study-section-${index}`} key={index} className={`study-section ${index===0&&mode==='reading'?'study-lead':''} ${isFailedSection(s)?'study-insufficient':''}`}><span className="study-section-number">{String(index+1).padStart(2,'0')}</span><h3>{s.title}</h3><p>{isFailedSection(s)?'当前资料无法核对这一判断，需要补充原文或摘要。':s.body}</p><details className="study-evidence"><summary>查看依据与信息边界{s.page?` · PDF 第 ${s.page} 页`:''}</summary>{s.quote&&<blockquote>{s.quote}{s.page&&<small>PDF 第 {s.page} 页</small>}</blockquote>}<p>{s.uncertainty}</p><Sources project={p} ids={s.evidenceIds}/></details>{mode==='reading'&&<button disabled={busy||stale||isFailedSection(s)} onClick={()=>void note(s)}>保存到阅读笔记</button>}</article>}
 return <section className={`study-workspace study-${mode}`}>
  <header className="study-header"><span className="eyebrow">{mode==='reading'?'READ & UNDERSTAND':'FIND YOUR DIRECTION'}</span><h2>{mode==='reading'?'读懂这篇论文':'研究脉络与方向'}</h2><p>{mode==='reading'?'从论文实际内容出发，先理解问题、方法与发现。':'把多篇论文放在一起理解，再选择你想继续研究的问题。'}</p></header>
  {mode==='reading'?<div className="paper-identity frosted-surface"><label>选择精析文献<select aria-label="选择精析文献" value={selected} onChange={e=>{setSelected(e.target.value);setResult(null);sessionStorage.setItem(`paperi.reading.${p.id}`,e.target.value);}}>{items.map(i=><option key={i.id} value={i.id}>{i.paper.title}</option>)}</select></label>{item&&<><h3>{item.paper.title}</h3><p>{item.paper.authors.join('；')||'作者待确认'} · {item.paper.year??'年份待确认'} · {item.paper.venue??'出版来源待确认'}</p><p className="source-notice">{item.attachment?`文字已提取：${item.attachment.pages} 页 / ${item.attachment.characters} 字。分析使用有页码的限量节选，不声称全文覆盖。`:item.paper.abstract?'已有摘要：只能回答摘要支持的内容。':'只有题录：不能判断理论、方法与结论，请补充摘要或 PDF。'}</p></>}</div>:<WorkflowSelection project={p}/>}
  <div className="study-actions"><button className="button primary" disabled={busy||pending||!items.length||kind==='directions'&&!workflowEvidence(p).length} onClick={()=>void generate()}>{pending?'正在分析…':mode==='reading'?'一键精析':'梳理研究脉络'}</button><p>点击后仅调用一次已配置的 AI；无需填写追问。失败不会自动重试。</p></div>
  {pending&&<p role="status" className="pdf-progress"><span className="spinner"/>{phase}</p>}{error&&<p role="alert" className="literature-error">{error} 可重新点击当前操作重试，原件与已确认方向保留。</p>}
  {stale&&<p className="source-notice">文献或研究内容已变化，下方分析基于旧资料，需要更新；旧分析仍保留。</p>}
  {analysis&&<div className="study-reading-layout"><nav className="study-toc" aria-label="分析章节">{(mode==='reading'?analysis.sections:analysis.synthesis??[]).map((s,i)=><a key={i} href={`#study-section-${i}`}>{s.title}</a>)}</nav><div className="study-content">{(mode==='reading'?analysis.sections:analysis.synthesis??[]).map(section)}{mode==='context'&&!analysis.synthesis&&<p className="source-notice">这份旧分析没有跨文献梳理，历史保留；可点击“梳理研究脉络”更新。</p>}</div></div>}
  {mode==='context'&&<><section className="direction-candidates"><h3>可以继续探索的方向</h3><p>这些是研究提议，不是论文已经证实的结论。数量取决于资料，关联不足不凑数。</p>{analysis?.cards?.map((c,i)=><article className="direction-choice frosted-surface" key={i}><span>方向 {i+1}</span><h4>{c.title}</h4><p>{c.question}</p><h5>为什么值得研究</h5><p>{c.value}</p><h5>可以怎样开展</h5><p>{c.method}</p><Sources ids={c.evidenceIds} project={p}/><p className="source-notice">待确认：{c.limitations}</p><button className="button primary" disabled={busy||stale} onClick={()=>{if(!changed||confirm('用这个候选替换未保存的方向卡编辑？'))void saveCard(c);}}>选择这个方向</button></article>)}</section>
  <section className="my-direction-card frosted-surface" aria-label="我的研究方向卡"><span className="eyebrow">MY RESEARCH DIRECTION</span><h3>我的研究方向卡</h3>{chosenStale&&<p className="source-notice">方向依据已变化或有来源被移除，请复核；已保存内容没有清空。</p>}{(Object.entries(labels) as [keyof typeof labels,string][]).map(([key,label])=><label key={key}>{label}<textarea aria-label={label} rows={key==='title'?1:3} maxLength={key==='title'?160:1000} value={draft[key]} onChange={e=>{setDraft({...draft,[key]:e.target.value});setChanged(true);}}/></label>)}<h4>文献依据</h4><Sources project={p} ids={draft.evidenceIds}/><details><summary>调整关联文献</summary>{items.map(i=><label key={i.id}><input type="checkbox" checked={draft.evidenceIds.includes(i.id)} onChange={e=>{setDraft({...draft,evidenceIds:e.target.checked?[...draft.evidenceIds,i.id]:draft.evidenceIds.filter(id=>id!==i.id)});setChanged(true);}}/>{i.paper.title}</label>)}</details><div className="workspace-actions"><button className="button primary" disabled={busy||!draft.title.trim()} onClick={()=>void saveCard()}>保存研究方向卡</button><button disabled={!draft.title.trim()} onClick={()=>void copyCard()}>复制研究方向卡文字</button><button onClick={()=>window.print()}>打印方向卡</button></div>{changed&&<p>有未保存编辑</p>}<p role="status">{message}</p></section></>}
  <details className="study-history"><summary>已保存分析 · {history.length} 次</summary>{history.map(a=><button key={a.id} onClick={()=>setResult(a)}>{new Date(a.createdAt).toLocaleString()}</button>)}</details>
 </section>;
}
