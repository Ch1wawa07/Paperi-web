'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { navigation } from '@/lib/navigation';
import { useProjects } from './project-provider';
import { ErrorNotice, Icon } from './ui';

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { snapshot, ready, busy, select, error, reload, feedback } = useProjects();
  const active = snapshot.projects.find(p => p.id === snapshot.activeId);
  const current = navigation.find(n => n.href === pathname);
  return <div className="app-shell">
    <a className="skip-link" href="#main">跳到主要内容</a>
    <aside className="sidebar">
      <Link href="/" className="brand" aria-label="Paperi 纸里首页"><span className="brand-mark"><Icon name="leaf" size={24}/></span><span>paperi<span className="brand-cn">纸里</span></span></Link>
      <div className="sidebar-caption">给好奇心，一个生长的地方</div>
      <button className="mobile-toggle button secondary" aria-expanded={mobileOpen} aria-controls="main-navigation" onClick={() => setMobileOpen(v => !v)}><Icon name={mobileOpen ? 'close' : 'chevron'}/>{mobileOpen ? '收起导航' : '展开导航'}</button>
      <nav id="main-navigation" aria-label="主要导航" className={mobileOpen ? 'navigation is-open' : 'navigation'}>
        <div className="nav-caption">你的研究工作间</div>
        {navigation.map((item, index) => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? 'page' : undefined} className={`nav-link ${pathname === item.href ? 'active' : ''}`} onClick={() => setMobileOpen(false)}><Icon name={item.icon}/><span>{item.label}</span><span className="nav-index">0{index + 1}</span></Link>)}
      </nav>
      <div className="sidebar-bottom"><span className="tiny-orbit">✧</span><p>从一个小小的观察，<br/>到自己的研究方向。</p><span className="phase-label">V1 · 基础工程 / 阶段 1</span></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb">工作间<span>/</span><strong>{current?.label ?? '未找到页面'}</strong></div><div className="project-selector"><span className="local-dot"/><label htmlFor="current-project">当前项目</label><select id="current-project" value={snapshot.activeId ?? ''} disabled={!ready || busy || !snapshot.projects.length} onChange={e => void select(e.target.value)}><option value="" disabled>{ready ? '尚未创建' : '读取中'}</option>{snapshot.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div></header>
      <main id="main" tabIndex={-1}><div className="global-feedback" role="status" aria-live="polite">{feedback}</div>{error && <ErrorNotice message={error} onRetry={() => void reload()}/>}<div key={pathname} className="page-enter">{children}</div></main>
      <footer className="footer"><span>paperi 纸里 <span className="footer-dot">·</span> 好研究，从好奇开始</span><span><Icon name="lock" size={13}/>当前浏览器本地保存 · 未连接云同步</span></footer>
      <span className="sr-only" aria-live="polite">{active ? `当前项目：${active.name}` : ''}</span>
    </div>
  </div>;
}
