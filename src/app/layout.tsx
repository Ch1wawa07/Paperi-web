import type { Metadata } from 'next';
import { ProjectProvider } from '@/components/project-provider';
import { Shell } from '@/components/shell';
import './globals.css';

export const metadata: Metadata = { title: { default: 'Paperi 纸里 · 让好奇长成研究', template: '%s · Paperi 纸里' }, description: '面向人文社科研究初学者的研究导航工作间。从日常观察出发，慢慢找到自己的研究方向。', robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><ProjectProvider><Shell>{children}</Shell></ProjectProvider></body></html>;
}
