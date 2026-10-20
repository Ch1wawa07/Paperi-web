import Link from 'next/link';
import { EmptyState } from '@/components/ui';
export default function NotFound() { return <EmptyState title="这张纸，还没有写下内容" action={<Link className="button primary" href="/">返回首页</Link>}><p>没有找到这个页面，请从首页或左侧导航继续。</p></EmptyState>; }
