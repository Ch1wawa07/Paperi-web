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

  return <div className="app-shell">
    <a className="skip-link" href="#main">跳到主要内容</a>
    <header className="site-header">
      <Link href="/" className="brand mobile-brand" aria-label="Paperi 纸里首页">
        <span className="brand-symbol" aria-hidden="true"><Icon name="leaf" size={24}/></span>
        <span className="brand-word">paperi<span>纸里</span></span>
      </Link>
      <p className="header-motto">A little curiosity. <span>A world of possibilities.</span></p>
      <div className="header-actions">
        <div className="project-selector">
          <span className="local-dot"/>
          <label className="sr-only" htmlFor="current-project">当前项目</label>
          <select id="current-project" value={snapshot.activeId ?? ''} disabled={!ready || busy || !snapshot.projects.length} onChange={e => void select(e.target.value)}>
            <option value="" disabled>{ready ? '当前项目 · 尚未创建' : '正在读取项目'}</option>
            {snapshot.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button className="mobile-toggle icon-button" aria-label={mobileOpen ? '收起导航' : '展开导航'} aria-expanded={mobileOpen} aria-controls="main-navigation" onClick={() => setMobileOpen(v => !v)}><Icon name={mobileOpen ? 'close' : 'menu'}/></button>
      </div>
    </header>
    <aside className={`workspace-sidebar ${mobileOpen?'sidebar-mobile-open':''}`} aria-label="研究进程导航">
      <Link href="/" className="brand sidebar-brand" aria-label="Paperi 纸里首页"><span className="brand-symbol"><Icon name="leaf" size={22}/></span><span className="brand-word">paperi<span>纸里</span></span></Link>
      <div className="sidebar-intro"><span className="eyebrow">YOUR RESEARCH JOURNEY</span><p>从好奇，到自己的问题。</p></div>
      <nav id="main-navigation" aria-label="主要导航" className={mobileOpen?'navigation is-open':'navigation'}>
        {navigation.map((item,index)=><Link key={item.href} href={item.href} aria-current={pathname===item.href?'page':undefined} className={`nav-link ${pathname===item.href?'active':''}`} onClick={()=>setMobileOpen(false)}><Icon name={item.icon} size={18}/><span>{item.label}<small>{index===0?'工作间':index===1?(active?.exploration?.seed?'问题已确认':'理解现象与概念'):index===2?`${active?.library?.items.length??0} 篇收藏`: '待接入'}</small></span><i>{String(index).padStart(2,'0')}</i></Link>)}
      </nav>
      <div className="sidebar-note"><span className="local-dot"/><p>阶段之间可自由往返<br/>确认的内容由你决定</p></div>
    </aside>
    <main id="main" tabIndex={-1}>
      <div className="global-feedback" role="status" aria-live="polite">{feedback}</div>
      {error && <ErrorNotice message={error} onRetry={() => void reload()}/>}
      <div key={pathname} className="page-enter">{children}</div>
    </main>
    <footer className="footer"><span>paperi © 2026 <span className="footer-dot">/</span> 给好奇心，一个生长的地方。</span><span><Icon name="lock" size={13}/>当前浏览器本地保存 · 未连接云同步</span></footer>
    <span className="sr-only" aria-live="polite">{active ? `当前项目：${active.name}` : ''}</span>
  </div>;
}
