import type { ReactNode } from 'react';

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 21v-8h6v8"/></>,
    spark: <><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z"/><path d="M20 2v4m-2-2h4"/></>,
    book: <><path d="M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Zm0 0v15"/></>,
    orbit: <><circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="11" ry="5" transform="rotate(-35 12 12)"/><path d="M8 3a9 9 0 0 1 13 9M3 12a9 9 0 0 0 13 9"/></>,
    canvas: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><path d="M10 6h7v8M6 10v7h8"/></>,
    file: <><path d="M14 2H5v20h14V7Zm0 0v6h5M8 12h8M8 16h6"/></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    leaf: <><path d="M5 19C-1 6 13 3 21 3c0 15-8 21-16 16Zm0 0L16 8"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    chevron: <path d="m6 9 6 6 6-6"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.spark}</svg>;
}

export function EmptyState({ icon = 'leaf', title, children, action }: { icon?: string; title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name={icon} size={28}/></span><h3>{title}</h3><div className="muted">{children}</div>{action}</div>;
}
export function LoadingState() {
  return <div className="loading-state" role="status"><span className="spinner"/>正在读取这个浏览器里的项目…</div>;
}
export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="error-notice" role="alert"><div><strong>暂时没有完成</strong><p>{message}</p></div>{onRetry && <button className="button secondary" onClick={onRetry}>重新读取</button>}</div>;
}
