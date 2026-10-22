'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { researchStages, type ConceptSuggestion, type ResearchConcept, type ResearchNavigation } from '@/lib/research-navigation';
import type { SavedPaper } from '@/lib/literature';
import type { ResearchSeed } from '@/lib/exploration';
import { Icon } from './ui';

type Props = {
  projectId:string; navigation: ResearchNavigation; papers: SavedPaper[]; seed: ResearchSeed | null; revision: number; disabled: boolean;
  onChange: (next: ResearchNavigation) => Promise<boolean>; onAsk: (message: string) => void;
};
export function ResearchGuidePanel({projectId,navigation:n,papers,seed,revision,disabled,onChange,onAsk}:Props) {
  const [editing,setEditing] = useState<{concept?:ResearchConcept;revision:number}|null>(null);
  const [error,setError] = useState('');
  const guide = n.guides?.[n.stage] ?? (n.guide?.stage===n.stage?n.guide:null);
  const selected=papers.filter(p=>n.evidenceIds.includes(p.id));
  async function update(next:ResearchNavigation) { setError('');const ok=await onChange(next);if(!ok)setError('本次修改尚未保存，请处理页面提示，原有确认内容没有被覆盖。');return ok; }
  async function saveConcept(fields:ConceptSuggestion) {
    if(!editing || editing.revision!==revision) {setError('探索已在其他页面更新，请取消编辑后重新打开。');return false;}
    const term=fields.term.normalize('NFKC').trim().toLowerCase();
    if(n.concepts.some(c=>c.id!==editing.concept?.id&&c.term.normalize('NFKC').trim().toLowerCase()===term)){setError('已有同名概念，请编辑现有概念。');return false;}
    const concept:ResearchConcept={...fields,id:editing.concept?.id??crypto.randomUUID(),origin:'user',status:editing.concept?.status??'selected'};
    const ok=await update({...n,concepts:editing.concept?n.concepts.map(c=>c.id===concept.id?concept:c):[...n.concepts,concept]});if(ok)setEditing(null);return ok;
  }
  return <section className="research-guide frosted-surface" aria-label="当前探索辅助面板">
    <div className="lab-panel-heading"><h2>{researchStages.find(s=>s.id===n.stage)!.label}</h2><span className="seed-status">AI 建议 · 待核实</span></div>
    <p className="guide-hint">{researchStages.find(s=>s.id===n.stage)!.hint}</p>
    {error&&<p className="guide-error" role="alert">{error}</p>}
    <div className="selected-concepts-bar"><strong>已选概念 · {n.concepts.filter(c=>c.status==='selected').length}</strong><div>{n.concepts.filter(c=>c.status==='selected').map(c=><span className="selected-concept" key={c.id}><button disabled={disabled} onClick={()=>setEditing({concept:c,revision})}>✓ {c.term}</button><button disabled={disabled} aria-label={`移除已选概念 ${c.term}`} onClick={()=>void update({...n,concepts:n.concepts.map(x=>x.id===c.id?{...x,status:'suggested'}:x)})}>×</button></span>)}</div><p>已自动保存在本项目的探索档案，研究问题可以稍后确定。</p><Link className="button primary" href={{pathname:'/literature',query:{project:projectId,concepts:'1'}}}>根据已选概念查找文献 →</Link></div>
    {<>
      <div className="guide-section-heading"><h3>候选概念</h3><button className="text-button" disabled={disabled||n.concepts.length>=24} onClick={()=>{setError('');setEditing({revision});}}><Icon name="plus" size={14}/>添加概念</button></div>
      {!n.concepts.length&&<p className="muted">先说说你的观察。这里会逐渐出现候选解释，不是已经验证的定义。</p>}
      <div className="concept-card-list">{n.concepts.map(c=><article key={c.id} className={`concept-card concept-${c.status}`}><div><h4>{c.term}</h4><span>{c.status==='selected'?'已选择':c.status==='excluded'?'已排除':'候选解释'}</span></div><p>{c.explanation}</p><details><summary>概念边界与待核实</summary>{c.everyday&&<p><strong>与日常用语的区别：</strong>{c.everyday}</p>}<p className="concept-uncertainty">待核实：{c.uncertainty}</p></details><div className="concept-actions"><button className="small-button" disabled={disabled} onClick={()=>void update({...n,concepts:n.concepts.map(x=>x.id===c.id?{...x,status:c.status==='selected'?'suggested':'selected'}:x)})}>{c.status==='selected'?'取消选择':'选择概念'}</button><button className="small-button" disabled={disabled} onClick={()=>void update({...n,concepts:n.concepts.map(x=>x.id===c.id?{...x,status:c.status==='excluded'?'suggested':'excluded'}:x)})}>{c.status==='excluded'?'恢复候选':'排除'}</button><button className="small-button" disabled={disabled} onClick={()=>setEditing({concept:c,revision})}>修改</button><button className="small-button" disabled={disabled} onClick={()=>onAsk(`请进一步解释「${c.term}」与我的观察有什么联系，以及什么时候不适合用这个概念。暂时不要替我确定研究问题。`)}>追问</button></div></article>)}</div>
      <p className="guide-footnote">选择与排除会保存；新一轮建议不会覆盖你编辑或确认的概念。概念识别不是变量操作化。</p>
    </>}
    {n.stage==='literature'&&<>
      <p className="muted">可先请 AI 帮你拟定检索组合，再逐组打开文献探索。跳转只填入搜索框，由你编辑后检索；结果不由 AI 生成。</p>
      {(['zh','en'] as const).map(lang=><div key={lang} className="guide-keywords"><h3>{lang==='zh'?'中文组合':'English queries'}</h3>{guide?.keywords[lang].length?guide.keywords[lang].map(t=><Link key={t} href={{pathname:'/literature',query:{query:t,project:projectId}}}>{t}<Icon name="arrow-up" size={13}/></Link>):<p className="muted">这一轮还没有{lang==='zh'?'中文':'英文'}组合，可在左侧提出检索需求。</p>}</div>)}
      <Link className="button secondary" href="/literature">直接进入真实文献检索<Icon name="arrow" size={14}/></Link>
    </>}
    {['context','questions'].includes(n.stage)&&<>
      <div className="guide-section-heading"><h3>本轮文献依据</h3><span>{selected.length} / 5</span></div><p className="muted">从本研究的真实收藏中主动选取，最多 5 篇；AI 只收到题录与可用摘要。收藏本身不代表你已读过全文。</p>
      {!papers.length&&<Link className="button secondary" href="/literature">先检索并收藏文献<Icon name="arrow" size={14}/></Link>}
      <div className="evidence-picker">{papers.map(p=><label key={p.id}><input type="checkbox" checked={n.evidenceIds.includes(p.id)} disabled={disabled||(!n.evidenceIds.includes(p.id)&&selected.length>=5)} onChange={e=>void update({...n,evidenceIds:e.target.checked?[...selected.map(x=>x.id),p.id]:selected.filter(x=>x.id!==p.id).map(x=>x.id)})}/><span>{p.paper.title}<small>{p.paper.venue??'来源未提供'} · {p.paper.year??'年份未提供'} · {p.paper.abstract?'有摘要，未读全文':'只有题录，解释范围有限'}</small></span></label>)}</div>
      {n.stage==='questions'&&(!selected.length||!n.concepts.some(c=>c.status==='selected'))&&<p className="guide-caution">生成候选问题前，请先选择概念，并选取至少一篇真实文献依据。你仍可以自由返回前面环节或手动记录问题。</p>}
      {guide?.threads.map((t,i)=><article className="evidence-thread" key={i}><h3>{t.title}</h3><p>{t.description}</p><div>{t.evidenceIds.map(id=>{const p=papers.find(p=>p.id===id);return p?<a key={id} href={p.paper.recordUrl} target="_blank" rel="noopener noreferrer">依据：{p.paper.title}</a>:<span key={id}>该依据已不在当前收藏中，请重新选取。</span>;})}</div><p className="guide-caution">待验证 / 限制：{t.uncertainty}</p></article>)}
      <p className="guide-footnote">引用元数据是事实来源；AI 的脉络与可行性解释仍是辅助判断。有限检索不能证明“无人研究”。</p>
    </>}
    {n.stage==='design'&&<div className="design-handoff">{seed?<><h3>已确认的问题</h3><p>{seed.workingQuestion}</p><div className="concept-tags">{seed.concepts.map(c=><span key={c}>{c}</span>)}</div><p className="muted">已关联 {(seed.evidenceIds??[]).filter(id=>papers.some(p=>p.id===id)).length} 篇当前仍在收藏中的文献。问题和依据随项目保存，设计画布读取同一份资料。</p><Link className="button secondary" href="/canvas">查看设计衔接资料<Icon name="arrow" size={14}/></Link></>:<p className="muted">还没有确认的问题。先继续概念、文献和问题探索；也可以在下方手动记录研究种子。</p>}<p className="guide-footnote">前往研究设计可编辑定量 / 质化画布，并导出方案。</p></div>}
    {guide&&<p className="guide-footnote">保留此环节最近一次建议；概念或文献变动后，请重新核对。切换环节不会重新调用 AI。</p>}
    {editing&&<ConceptEditor concept={editing.concept} disabled={disabled} onSave={saveConcept} onClose={()=>setEditing(null)}/>}
  </section>;
}

function ConceptEditor({concept,disabled,onSave,onClose}:{concept?:ResearchConcept;disabled:boolean;onSave:(fields:ConceptSuggestion)=>Promise<boolean>;onClose:()=>void}) {
  const [term,setTerm]=useState(concept?.term??''),[explanation,setExplanation]=useState(concept?.explanation??''),[everyday,setEveryday]=useState(concept?.everyday??''),[uncertainty,setUncertainty]=useState(concept?.uncertainty??'需要结合真实文献进一步核实。'),[error,setError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null),first=useRef<HTMLInputElement>(null);
  useEffect(()=>{const el=dialog.current,opener=document.activeElement;el?.showModal();first.current?.focus();return()=>{el?.close();if(opener instanceof HTMLElement)opener.focus();};},[]);
  return <dialog ref={dialog} className="project-dialog concept-editor frosted-surface" aria-labelledby="concept-editor-title" onCancel={e=>{if(disabled)e.preventDefault();else onClose();}}><div className="dialog-top"><span className="eyebrow">YOUR CONCEPT, YOUR CHOICE</span><button className="icon-button" disabled={disabled} onClick={onClose} aria-label="关闭概念编辑"><Icon name="close"/></button></div><h2 id="concept-editor-title">{concept?'修改候选概念':'添加一个概念'}</h2><form onSubmit={async e=>{e.preventDefault();if(!await onSave({term:term.trim(),explanation:explanation.trim(),everyday:everyday.trim(),uncertainty:uncertainty.trim()}))setError('未保存成功，你的编辑仍保留在这里，请查看面板提示。');}}><label className="field-label" htmlFor="concept-term">概念名称</label><input id="concept-term" ref={first} required maxLength={80} value={term} onChange={e=>setTerm(e.target.value)}/><label className="field-label" htmlFor="concept-explanation">候选解释</label><textarea id="concept-explanation" required rows={3} maxLength={500} value={explanation} onChange={e=>setExplanation(e.target.value)}/><label className="field-label" htmlFor="concept-everyday">与日常用语的区别 <span>选填</span></label><textarea id="concept-everyday" rows={2} maxLength={300} value={everyday} onChange={e=>setEveryday(e.target.value)}/><label className="field-label" htmlFor="concept-uncertainty">适用边界与待核实信息</label><textarea id="concept-uncertainty" required rows={2} maxLength={300} value={uncertainty} onChange={e=>setUncertainty(e.target.value)}/>{error&&<p role="alert" className="field-error">{error}</p>}<div className="dialog-actions"><button type="button" className="button secondary" disabled={disabled} onClick={onClose}>取消</button><button className="button primary" disabled={disabled||!term.trim()||!explanation.trim()||!uncertainty.trim()}>保存概念</button></div></form></dialog>;
}
