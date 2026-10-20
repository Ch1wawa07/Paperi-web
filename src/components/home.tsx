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
const journeyCopy = ['发现新视角', '找到可靠依据', '连接研究线索', '构思研究方法', '让思路成形'];

export function Home() {
  const [observation, setObservation] = useState('');
  const [modal, setModal] = useState<Modal | null>(null);
  const { snapshot, ready, busy, select, error } = useProjects();
  const router = useRouter();
  const date = (value: string) => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

  return <>
    <div className="page-heading">
      <div><span className="eyebrow">YOUR MIND, IN THE MAKING</span><h1>让好奇，慢慢有形<span className="heading-period">.</span></h1></div>
      <p>从一个小小的观察开始。</p>
    </div>

    <div className="home-workspace">
      <section className="hero frosted-surface" aria-labelledby="hero-title">
        <div className="hero-topline"><span><Icon name="spark" size={16}/>灵感，从这里开始</span><span className="hero-edition">PAPERI / 01</span></div>
        <div className="hero-intro">
          <h2 id="hero-title">此刻，有什么<span>新想法</span>？</h2>
        </div>
        <GlassBloom/>
        <form className="idea-input" onSubmit={e => { e.preventDefault(); setModal({ mode: 'create', observation }); }}>
          <label className="sr-only" htmlFor="observation">写下你的日常观察</label>
          <textarea id="observation" maxLength={2000} value={observation} onChange={e => setObservation(e.target.value)} placeholder="记下一句话，或一个还没想明白的问题…" rows={2}/>
          <div className="idea-input-bottom"><span>先记下来，慢慢探索。</span><button className="button primary" type="submit" disabled={!ready || busy}>保存灵感<Icon name="arrow" size={17}/></button></div>
        </form>
        <p className="hero-disclaimer"><span className="status-light"/>本地保存 · AI 探索待接入</p>
      </section>

      <section className="projects-section frosted-surface" aria-labelledby="projects-title">
        <div className="section-heading"><div><span className="eyebrow">YOUR PROJECTS</span><h2 id="projects-title">我的项目<span className="count-label">{ready ? snapshot.projects.length : '—'}</span></h2></div><button className="icon-button new-project-button" aria-label="新建项目" disabled={!ready || busy} onClick={() => setModal({ mode: 'create' })}><Icon name="plus" size={22}/></button></div>
        {!ready ? (error ? <EmptyState title="本地项目暂不可读取"><p>原有数据未被清除，请先按上方提示恢复读取。</p></EmptyState> : <LoadingState/>) : snapshot.projects.length === 0 ? <div className="project-empty">
          <div className="empty-object" aria-hidden="true"><span/><span/><span/><i><Icon name="plus" size={25}/></i></div>
          <div><h3>留给你的第一个研究</h3><p>从一个问题开始。</p></div>
          <button className="button secondary" onClick={() => setModal({ mode: 'create' })}>新建研究<Icon name="arrow" size={17}/></button>
        </div> : <div className="project-grid">{snapshot.projects.map(p => <article key={p.id} className={`project-card ${p.id === snapshot.activeId ? 'selected' : ''}`}>
          <div className="project-card-top"><span className="project-symbol"><Icon name="leaf" size={18}/></span><span className="project-status">{p.id === snapshot.activeId ? '当前项目' : '起步阶段'}</span></div>
          <h3>{p.name}</h3><p className="project-discipline">{p.discipline || '研究领域待探索'} · 灵感起步</p><p className="project-time">上次更新：{date(p.updatedAt)}</p>
          <div className="project-card-actions"><button className="text-button" disabled={busy} onClick={async () => { if (await select(p.id)) router.push('/lab'); }}>继续项目<Icon name="arrow" size={16}/></button><div><button className="small-button" disabled={busy} onClick={() => setModal({ mode: 'rename', project: p })} aria-label={`重命名项目 ${p.name}`}>重命名</button><button className="small-button delete-button" disabled={busy} onClick={() => setModal({ mode: 'delete', project: p })} aria-label={`删除项目 ${p.name}`}>删除</button></div></div>
        </article>)}</div>}
        <p className="storage-note"><Icon name="lock" size={13}/><span>仅存于当前浏览器，清除数据后可能丢失。</span></p>
      </section>
    </div>

    <section className="journey-section" aria-labelledby="journey-title">
      <div className="section-heading"><div><span className="eyebrow">FOLLOW YOUR CURIOSITY</span><h2 id="journey-title">继续探索</h2></div><span className="section-aside">以下模块待接入</span></div>
      <div className="journey-grid">{navigation.slice(1).map((item, index) => <Link href={item.href} className={`journey-card frosted-surface tone-${index}`} key={item.href}>
        <div className="journey-card-top"><span>{item.english}</span><span className="circle-arrow"><Icon name="arrow-up" size={17}/></span></div>
        <span className="journey-number" aria-hidden="true">0{index + 1}</span>
        <div className="journey-card-bottom"><h3>{item.label}</h3><p>{journeyCopy[index]}</p></div>
      </Link>)}</div>
    </section>

    <section className="radar-section" aria-labelledby="radar-title"><div className="radar-orb" aria-hidden="true"/><div><h2 id="radar-title">留意世界，也发现问题。</h2><p>研究热点 · 待接入</p></div></section>
    {modal && <ProjectDialog {...modal} onClose={() => setModal(null)}/>}
  </>;
}
