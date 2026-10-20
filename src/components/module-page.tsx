'use client';

import Link from 'next/link';
import { useProjects } from './project-provider';
import { EmptyState, Icon, LoadingState } from './ui';
import { navigation } from '@/lib/navigation';
import { GlassBloom } from './glass-art';

const modules = {
  lab: { index: 1, title: '让想法，慢慢清晰起来。', description: '从生活观察出发，探索不同的研究视角。无需一开始就提出完美的问题。', stage: 2, status: 'AI 服务待连接', features: ['连续对话，探索 2–3 种候选视角', '编辑并亲自采纳研究种子', '保留已确认的问题与对话历史'], empty: '你的灵感，值得被认真对待', detail: '阶段 1 已能保存项目与起始观察。AI 聊天和研究种子编辑尚未接入，这里不会生成模拟回答。' },
  literature: { index: 2, title: '给每一个想法，找到依据。', description: '搜索、核验并收藏真实文献，分清哪些有证据，哪些还需要探索。', stage: 3, status: 'OpenAlex 检索待连接', features: ['编辑中英文检索词', '查看真实来源、DOI 与摘要', '收藏文献到当前项目'], empty: '真实的研究，需要真实的来源', detail: '文献检索尚未接入，没有论文结果或收藏。未来会明确标出缺失信息与全文可用情况。' },
  map: { index: 3, title: '顺着一篇文献，发现更大的世界。', description: '围绕真实论文探索一层参考文献与后续引用，找到可核验的研究线索。', stage: 4, status: '文献关系数据待连接', features: ['一层真实引用与被引关系', '查看节点详情，切换焦点', '区分引用关系与主题相关'], empty: '星图，等待第一篇真实文献', detail: '尚无焦点论文或引用关系。本页没有示例关系图，星图将在真实文献检索完成后接入。' },
  canvas: { index: 4, title: '让一个问题，有自己的研究路径。', description: '定量与质化都可以。从问题出发，选择适合自己的方法。', stage: 4, status: '研究设计编辑待接入', features: ['分别支持定量与质化路径', '手动编辑变量、主题与研究方法', '关联文献证据与待验证建议'], empty: '画布，留给你自己的思考', detail: '研究设计的编辑与保存尚未实现。后续不会将质化研究强制套入自变量—因变量框架。' },
  proposal: { index: 5, title: '把散落的思考，整理成一个起点。', description: '汇总已确认的问题、真实文献与研究方法，形成初步研究设计方案。', stage: 4, status: '方案编辑与导出待接入', features: ['汇总项目中的实际研究内容', '编辑与保存，保留你的修改', '优先支持 Markdown 导出'], empty: '你的初步方案，还在酝酿', detail: '目前没有方案内容，编辑与导出将在阶段 4 实现。不会导出空白文件来冒充研究成果。' },
} as const;
export type ModuleKey = keyof typeof modules;
export function ModulePage({ module }: { module: ModuleKey }) {
  const m = modules[module];
  const nav = navigation[m.index];
  const previous = navigation[m.index - 1];
  const { ready, snapshot, error } = useProjects();
  const project = snapshot.projects.find(p => p.id === snapshot.activeId);
  return <div className={`module-page module-${module}`}>
    <Link href={previous.href} className="back-link">← 返回{previous.label}</Link>
    <div className="module-heading"><div className="eyebrow">0{m.index} / {nav.english.toUpperCase()}</div><h1>{nav.label}</h1><p>{m.description}</p></div>
    {!ready ? (error ? <p className="muted">当前项目暂不可读取，请先处理上方的存储提示。</p> : <LoadingState/>) : <div className="current-project-panel"><Icon name="leaf"/><div><span>当前项目</span><strong>{project?.name ?? '尚未选择项目'}</strong></div><Link className="text-button" href="/">{project ? '管理 / 切换项目' : '先创建项目'}<Icon name="arrow" size={16}/></Link></div>}
    {module === 'lab' && project?.observation && <section className="observation-card"><span className="eyebrow">你保存的日常观察 · 用户输入</span><p>{project.observation}</p><span className="muted">这是起始想法，尚不是已确认的研究问题。</span></section>}
    <div className="module-grid"><section className="module-main frosted-surface"><div className="module-panel-top"><span className="soft-badge">阶段 {m.stage} · 待接入</span><span className="muted">{m.status}</span></div><GlassBloom compact/><EmptyState icon={nav.icon} title={m.empty}><p>{m.detail}</p><p className="future-note">功能将在后续阶段接入</p></EmptyState><div className="module-bottom-note"><Icon name="lock" size={15}/>本页不会发起 AI 调用或产生 API 费用。</div></section><aside className="module-aside frosted-surface"><span className="eyebrow">ROOM TO GROW</span><h2>{m.title}</h2><p className="muted">后续会在这里实现：</p><ul>{m.features.map((f, i) => <li key={f}><span>0{i + 1}</span>{f}</li>)}</ul><div className="honesty-note">把不确定，诚实地留下。<br/>AI 建议、用户确认和文献依据会分别标明。</div></aside></div>
  </div>;
}
