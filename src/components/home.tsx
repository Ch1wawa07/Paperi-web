'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { navigation } from '@/lib/navigation';
import type { Project } from '@/lib/projects';
import { useProjects } from './project-provider';
import { ProjectDialog } from './project-dialog';
import { EmptyState, Icon, LoadingState } from './ui';

type Modal = { mode: 'create' | 'rename' | 'delete'; project?: Project; observation?: string };
export function Home() {
  const [observation, setObservation] = useState('');
  const [modal, setModal] = useState<Modal | null>(null);
  const { snapshot, ready, busy, select, error } = useProjects();
  const router = useRouter();
  const date = (value: string) => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  return <>
    <div className="page-heading"><div><div className="eyebrow">A LITTLE CURIOSITY, A NEW POSSIBILITY</div><h1>你好，欢迎来到纸里<span className="heading-star">✳</span></h1><p className="muted">不用一开始就有答案。让日常里的好奇，慢慢长成研究。</p></div><span className="soft-badge">你的研究，从这里开始</span></div>
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy"><span className="hero-tag"><span/>IDEAS GROW HERE</span><h2 id="hero-title">今天，你对什么<br/>感到<span className="curiosity">好奇</span>？</h2><p>一个生活里的小观察，也可以是一项研究的起点。<br className="desktop-break"/>先把它写下来，再一步步找到自己的方向。</p>
        <form className="idea-input" onSubmit={e => { e.preventDefault(); setModal({ mode: 'create', observation }); }}><label className="sr-only" htmlFor="observation">写下你的日常观察</label><textarea id="observation" maxLength={2000} value={observation} onChange={e => setObservation(e.target.value)} placeholder="比如：为什么我越来越习惯先问 AI，再决定买什么？" rows={2}/><div className="idea-input-bottom"><span>不必专业，像聊天一样就好</span><button className="button primary" type="submit" disabled={!ready || busy}>保存想法，开始探索<Icon name="arrow" size={17}/></button></div></form>
        <p className="hero-disclaimer"><Icon name="lock" size={13}/>当前可创建并保存项目；AI 探索将在阶段 2 接入。</p>
      </div>
      <div className="hero-art" aria-hidden="true"><div className="art-halo"/><div className="orbit-ring ring-one"/><div className="orbit-ring ring-two"/><span className="art-star star-one">✦</span><span className="art-star star-two">✧</span><div className="floating-note note-one"><Icon name="spark" size={16}/>一个小小的观察</div><div className="paper-sculpture"><div className="paper-sheet sheet-back"/><div className="paper-sheet sheet-front"><span className="sheet-label">the beginning of</span><span className="sheet-word">something<br/><i>curious.</i></span><div className="sprout"><span/><span/><b/></div><span className="sheet-foot">PAPERI / 纸里</span></div></div><div className="floating-note note-two"><span className="note-dot"/>一种新的可能</div><span className="art-caption">LET YOUR CURIOSITY UNFOLD ↗</span></div>
    </section>
    <section className="projects-section" aria-labelledby="projects-title"><div className="section-heading"><div><span className="eyebrow">MY RESEARCH SPACE</span><h2 id="projects-title">我的研究项目<span className="count-label">{ready ? snapshot.projects.length : '—'}</span></h2></div><button className="button secondary" disabled={!ready || busy} onClick={() => setModal({ mode: 'create' })}><Icon name="plus" size={17}/>新建项目</button></div>
      <div className="storage-note"><span className="local-dot"/>当前浏览器本地保存。更换设备、使用隐私模式或清除浏览器数据，可能无法找回项目。</div>
      {!ready ? (error ? <EmptyState title="本地项目暂不可读取"><p>原有数据未被清除，请先按上方提示恢复读取。</p></EmptyState> : <LoadingState/>) : snapshot.projects.length === 0 ? <div className="project-empty"><div className="empty-illustration" aria-hidden="true"><Icon name="leaf" size={32}/></div><div><h3>这里，留给你的第一个研究</h3><p className="muted">从一个还没想明白的问题开始就好。</p></div><button className="text-button" onClick={() => setModal({ mode: 'create' })}>创建第一个项目<Icon name="arrow" size={17}/></button></div> : <div className="project-grid">{snapshot.projects.map(p => <article key={p.id} className={`project-card ${p.id === snapshot.activeId ? 'selected' : ''}`}><div className="project-card-top"><span className="project-symbol"><Icon name="leaf"/></span><span className="project-status">{p.id === snapshot.activeId ? '当前项目' : '起步阶段'}</span></div><h3>{p.name}</h3><p className="project-discipline">{p.discipline || '研究领域待探索'} · 灵感起步</p><p className="project-time">上次更新：{date(p.updatedAt)}</p><div className="project-card-actions"><button className="text-button" disabled={busy} onClick={async () => { if (await select(p.id)) router.push('/lab'); }}>继续项目<Icon name="arrow" size={16}/></button><div><button className="small-button" disabled={busy} onClick={() => setModal({ mode: 'rename', project: p })} aria-label={`重命名项目 ${p.name}`}>重命名</button><button className="small-button delete-button" disabled={busy} onClick={() => setModal({ mode: 'delete', project: p })} aria-label={`删除项目 ${p.name}`}>删除</button></div></div></article>)}</div>}
    </section>
    <section className="journey-section" aria-labelledby="journey-title"><div className="section-heading"><div><span className="eyebrow">FROM CURIOSITY TO CLARITY</span><h2 id="journey-title">每一步，都更靠近一点</h2></div><span className="section-aside">不必按顺序，随时回来看看</span></div><div className="journey-grid">{navigation.slice(1).map((item, index) => <Link href={item.href} className="journey-card" key={item.href}><div className={`journey-icon tone-${index}`}><Icon name={item.icon} size={24}/></div><span className="journey-number">0{index + 1}</span><h3>{item.label}</h3><p>{['捕捉观察，探索研究视角', '寻找并核验真实的文献', '循着文献关系发现线索', '梳理问题，选择研究路径', '把思考整理成初步方案'][index]}</p><span className="journey-link">后续阶段接入<Icon name="arrow" size={15}/></span></Link>)}</div></section>
    <section className="radar-section" aria-labelledby="radar-title"><div><span className="eyebrow">A WINDOW TO THE WORLD</span><h2 id="radar-title">灵感，也藏在世界正在发生的事里。</h2><p className="muted">热点入口已留好位置，可靠来源接入后再与你见面。</p></div><EmptyState icon="orbit" title="热点内容待连接"><p>目前没有实时热点或人工精选内容。</p></EmptyState></section>
    {modal && <ProjectDialog {...modal} onClose={() => setModal(null)}/>}
  </>;
}
