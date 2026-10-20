'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { navigation } from '@/lib/navigation';
import type { Project } from '@/lib/projects';
import { useProjects } from './project-provider';
import { ProjectDialog } from './project-dialog';
import { EmptyState, Icon, LoadingState } from './ui';
import { GlassBloom } from './glass-art';

type Modal = { mode: 'create' | 'rename' | 'delete'; project?: Project; observation?: string };
const journeyCopy = ['让日常观察，长出新的视角', '循着真实文献，找到依据', '让孤立的线索，彼此相连', '为自己的问题，选择方法', '把思考，写成一个起点'];

export function Home() {
  const [observation, setObservation] = useState('');
  const [modal, setModal] = useState<Modal | null>(null);
  const { snapshot, ready, busy, select, error } = useProjects();
  const router = useRouter();
  const date = (value: string) => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

  return <>
    <div className="page-heading">
      <div><span className="eyebrow">YOUR MIND, IN THE MAKING</span><h1>让好奇，慢慢有形<span className="heading-period">.</span></h1></div>
      <p>不必一开始，就有答案。<br/><span>从一个小小的观察开始。</span></p>
    </div>

    <div className="home-workspace">
      <section className="hero frosted-surface" aria-labelledby="hero-title">
        <div className="hero-topline"><span><Icon name="spark" size={16}/>灵感，从这里开始</span><span className="hero-edition">PAPERI / 01</span></div>
        <div className="hero-intro">
          <h2 id="hero-title">今天，你对什么<br/>感到<span>好奇</span>？</h2>
          <p>那些一闪而过的「为什么」，<br/>都值得被认真对待。</p>
        </div>
        <GlassBloom/>
        <form className="idea-input" onSubmit={e => { e.preventDefault(); setModal({ mode: 'create', observation }); }}>
          <label className="sr-only" htmlFor="observation">写下你的日常观察</label>
          <textarea id="observation" maxLength={2000} value={observation} onChange={e => setObservation(e.target.value)} placeholder="比如：为什么我越来越习惯先问 AI，再决定买什么？" rows={2}/>
          <div className="idea-input-bottom"><span>写下一个想法，让它在纸里生长。</span><button className="button primary" type="submit" disabled={!ready || busy}>保存想法，开始探索<Icon name="arrow" size={17}/></button></div>
        </form>
        <p className="hero-disclaimer"><span className="status-light"/>项目可本地保存 · AI 探索待接入</p>
      </section>

      <section className="projects-section frosted-surface" aria-labelledby="projects-title">
        <div className="section-heading"><div><span className="eyebrow">A PLACE FOR YOUR IDEAS</span><h2 id="projects-title">我的研究项目<span className="count-label">{ready ? snapshot.projects.length : '—'}</span></h2></div><button className="icon-button new-project-button" aria-label="新建项目" disabled={!ready || busy} onClick={() => setModal({ mode: 'create' })}><Icon name="plus" size={22}/></button></div>
        {!ready ? (error ? <EmptyState title="本地项目暂不可读取"><p>原有数据未被清除，请先按上方提示恢复读取。</p></EmptyState> : <LoadingState/>) : snapshot.projects.length === 0 ? <div className="project-empty">
          <div className="empty-object" aria-hidden="true"><span/><span/><span/><i><Icon name="plus" size={25}/></i></div>
          <div><h3>这里，留给你的第一个研究</h3><p>一个还没想明白的问题，<br/>就是很好的开始。</p></div>
          <button className="button secondary" onClick={() => setModal({ mode: 'create' })}>创建第一个项目<Icon name="arrow" size={17}/></button>
        </div> : <div className="project-grid">{snapshot.projects.map(p => <article key={p.id} className={`project-card ${p.id === snapshot.activeId ? 'selected' : ''}`}>
          <div className="project-card-top"><span className="project-symbol"><Icon name="leaf" size={18}/></span><span className="project-status">{p.id === snapshot.activeId ? '当前项目' : '起步阶段'}</span></div>
          <h3>{p.name}</h3><p className="project-discipline">{p.discipline || '研究领域待探索'} · 灵感起步</p><p className="project-time">上次更新：{date(p.updatedAt)}</p>
          <div className="project-card-actions"><button className="text-button" disabled={busy} onClick={async () => { if (await select(p.id)) router.push('/lab'); }}>继续项目<Icon name="arrow" size={16}/></button><div><button className="small-button" disabled={busy} onClick={() => setModal({ mode: 'rename', project: p })} aria-label={`重命名项目 ${p.name}`}>重命名</button><button className="small-button delete-button" disabled={busy} onClick={() => setModal({ mode: 'delete', project: p })} aria-label={`删除项目 ${p.name}`}>删除</button></div></div>
        </article>)}</div>}
        <p className="storage-note"><Icon name="lock" size={13}/><span>当前浏览器本地保存<br/>更换设备或清除数据后，可能无法找回。</span></p>
      </section>
    </div>

    <section className="journey-section" aria-labelledby="journey-title">
      <div className="section-heading"><div><span className="eyebrow">FOLLOW YOUR CURIOSITY</span><h2 id="journey-title">让想法，走得更远一点。</h2></div><span className="section-aside">不必按顺序，随时回来看看<Icon name="arrow" size={16}/></span></div>
      <div className="journey-grid">{navigation.slice(1).map((item, index) => <Link href={item.href} className={`journey-card frosted-surface tone-${index}`} key={item.href}>
        <div className="journey-card-top"><span>{item.english}</span><span className="circle-arrow"><Icon name="arrow-up" size={17}/></span></div>
        <span className="journey-number" aria-hidden="true">0{index + 1}</span>
        <div className="journey-card-bottom"><h3>{item.label}</h3><p>{journeyCopy[index]}</p><span className="journey-status">后续阶段接入</span></div>
      </Link>)}</div>
    </section>

    <section className="radar-section" aria-labelledby="radar-title"><div className="radar-orb" aria-hidden="true"/><div><span className="eyebrow">OUT IN THE WORLD</span><h2 id="radar-title">世界的变化，也是研究的起点。</h2><p>热点内容待连接。可靠的来源，值得多等一会儿。</p></div><span className="radar-status"><span/>暂无实时热点</span></section>
    {modal && <ProjectDialog {...modal} onClose={() => setModal(null)}/>}
  </>;
}
