'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { navigation } from '@/lib/navigation';
import type { Project } from '@/lib/projects';
import { useProjects } from './project-provider';
import { ProjectDialog } from './project-dialog';
import { EmptyState, Icon, LoadingState } from './ui';
import { GlassBloom } from './glass-art';

type Modal = { mode: 'create' | 'rename' | 'delete'; project?: Project };
const journeyCopy = ['理解现象，探索概念', '用真实文献验证', '沿引用继续发现', '衔接定量或质化', '整理自己的方案'];

export function Home() {
  const [observation, setObservation] = useState('');
  const [modal, setModal] = useState<Modal | null>(null);
  const [starting, setStarting] = useState(false);
  const { snapshot, ready, busy, select, error, startExploration } = useProjects();
  const launchId = useRef<string | null>(null), submitting = useRef(false);
  const router = useRouter();
  const date = (value: string) => new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  async function start() {
    if (submitting.current || !observation.trim()) return;
    submitting.current = true; setStarting(true);
    launchId.current ??= crypto.randomUUID();
    try { if (await startExploration(observation, launchId.current)) router.push('/lab'); }
    finally { submitting.current = false; setStarting(false); }
  }
  return <>
    <div className="page-heading"><div><span className="eyebrow">A LITTLE CURIOSITY, A NEW BEGINNING</span><h1>让好奇，慢慢有形<span className="heading-period">.</span></h1></div><p>先探索概念，再让问题清晰。</p></div>
    <div className="home-workspace">
      <section className="hero frosted-surface" aria-labelledby="hero-title">
        <div className="hero-topline"><span><Icon name="spark" size={16}/>灵感，从这里开始</span><span className="hero-edition">PAPERI / EXPLORE</span></div>
        <div className="hero-intro"><h2 id="hero-title">此刻，有什么<span>新想法</span>？</h2></div>
        <GlassBloom/>
        <form className="idea-input" onSubmit={e => { e.preventDefault(); void start(); }}>
          <label className="sr-only" htmlFor="observation">写下你的日常观察</label>
          <textarea id="observation" required maxLength={2000} value={observation} onChange={e => setObservation(e.target.value)} placeholder="比如：为什么有些广告越劝我买，我反而越不想买？" rows={2} disabled={starting}/>
          <div className="idea-input-bottom"><span>保存原话，接着与 AI 探索。</span><button className="button primary" type="submit" disabled={!ready || busy || starting || !observation.trim()}>{starting ? '正在进入…' : '开始探索'}<Icon name="arrow" size={17}/></button></div>
        </form>
        <p className="hero-disclaimer"><span className="status-light"/>点击后进入同一段对话，自动发送首次观察；AI 建议仍需核实。</p>
      </section>
    </div>
    <section className="journey-section" aria-labelledby="journey-title">
      <div className="section-heading"><div><span className="eyebrow">FOLLOW YOUR CURIOSITY</span><h2 id="journey-title">你的研究路径</h2></div><span className="section-aside">随时返回，也可以交叉探索</span></div>
      <div className="journey-grid">{navigation.slice(1).map((item, index) => <Link href={item.href} className={`journey-card frosted-surface tone-${index}`} key={item.href}>
        <div className="journey-card-top"><span>{item.english}</span><span className="circle-arrow"><Icon name="arrow-up" size={17}/></span></div>
        <span className="journey-number" aria-hidden="true">0{index + 1}</span><div className="journey-card-bottom"><h3>{item.label}</h3><p>{journeyCopy[index]}</p></div>
      </Link>)}</div>
    </section>
    <section className="projects-section recent-projects frosted-surface" aria-labelledby="projects-title">
      <div className="section-heading"><div><span className="eyebrow">COME BACK TO YOUR THOUGHTS</span><h2 id="projects-title">最近项目<span className="count-label">{ready ? snapshot.projects.length : '—'}</span></h2></div><button className="text-button new-project-button" aria-label="新建项目" disabled={!ready || busy} onClick={() => setModal({mode:'create'})}><Icon name="plus" size={17}/>仅新建项目</button></div>
      {!ready ? error ? <EmptyState title="本地项目暂不可读取"><p>原有数据未被清除，请先按上方提示恢复读取。</p></EmptyState> : <LoadingState/> : !snapshot.projects.length ? <div className="project-empty"><div><h3>留给你的第一个研究</h3><p>从上方开始探索，或先建一个空项目。</p></div><button className="button secondary" onClick={() => setModal({mode:'create'})}>新建研究<Icon name="arrow" size={16}/></button></div> :
      <div className="project-grid">{snapshot.projects.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(p=><article key={p.id} className={`project-card ${p.id===snapshot.activeId?'selected':''}`}>
        <div className="project-card-top"><span className="project-status">{p.id===snapshot.activeId?'当前项目':'研究项目'}</span><span className="project-time">{date(p.updatedAt)}</span></div><h3>{p.name}</h3><p className="project-discipline">{p.discipline||'领域探索中'} · {p.library?.items.length??0} 篇收藏</p>
        <div className="project-card-actions"><button className="text-button" disabled={busy} onClick={async()=>{if(await select(p.id))router.push('/lab');}}>继续项目<Icon name="arrow" size={15}/></button><div><button className="small-button" disabled={busy} onClick={()=>setModal({mode:'rename',project:p})} aria-label={`重命名项目 ${p.name}`}>重命名</button><button className="small-button delete-button" disabled={busy} onClick={()=>setModal({mode:'delete',project:p})} aria-label={`删除项目 ${p.name}`}>删除</button></div></div>
      </article>)}</div>}
      <p className="storage-note"><Icon name="lock" size={13}/><span>项目和对话仅存于当前浏览器，清除数据后可能丢失。</span></p>
    </section>
    {modal && <ProjectDialog {...modal} onClose={()=>setModal(null)}/>}
  </>;
}
