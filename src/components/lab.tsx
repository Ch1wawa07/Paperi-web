'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { emptyExploration, isAIReply, isRecord, type Direction, type Exploration, type ResearchSeed } from '@/lib/exploration';
import type { Project } from '@/lib/projects';
import { useProjects } from './project-provider';
import { Icon, LoadingState } from './ui';

type Editor = { direction?: Direction; seed?: ResearchSeed; revision: number };
type SeedFields = Pick<ResearchSeed, 'angle' | 'workingQuestion' | 'concepts'>;

export function Lab() {
  const { snapshot, ready, error } = useProjects();
  const project = snapshot.projects.find(p => p.id === snapshot.activeId);
  return <div className="module-page module-lab">
    <Link href="/" className="back-link">← 返回首页</Link>
    <div className="module-heading"><div className="eyebrow">01 / IDEA LAB</div><h1>灵感实验室</h1><p>聊聊你的观察，让一个问题慢慢清晰。</p></div>
    {!ready ? (error ? <p className="muted">请先处理上方的存储提示，原有项目未被清除。</p> : <LoadingState/>) : project ? <LabProject key={project.id} project={project}/> :
      <section className="lab-no-project frosted-surface"><Icon name="leaf" size={32}/><h2>为想法留一个位置</h2><p className="muted">先创建项目，对话和研究种子会保存在这个项目里。</p><Link className="button primary" href="/">去创建项目<Icon name="arrow" size={16}/></Link></section>}
  </div>;
}

function LabProject({ project }: { project: Project }) {
  const { busy, saveExploration } = useProjects();
  const exploration = project.exploration ?? emptyExploration();
  const [draft, setDraft] = useState(exploration.messages.length ? '' : project.observation);
  const [status, setStatus] = useState<{ configured: boolean; message: string } | null>(null);
  const [connectionError, setConnectionError] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [unsavedReply, setUnsavedReply] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const mounted = useRef(false);
  const request = useRef<AbortController | null>(null);
  const sending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    fetch('/api/lab', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data: unknown = await response.json();
      if (!response.ok || !isRecord(data) || typeof data.configured !== 'boolean' || typeof data.message !== 'string') throw new Error();
      if (mounted.current) setStatus({ configured: data.configured, message: data.message });
    }).catch(() => { if (!controller.signal.aborted) setConnectionError('无法检查 AI 连接，请刷新页面后重试。'); });
    return () => { mounted.current = false; controller.abort(); request.current?.abort(); };
  }, []);

  async function send(retry = false) {
    if (sending.current || busy || !status?.configured) return;
    if (!retry && (!draft.trim() || draft.length > 2000)) return;
    if ((retry && exploration.messages.at(-1)?.role !== 'user') || exploration.messages.length > (retry ? 119 : 118) || exploration.directions.length > 57) {
      setError('这个项目已达到探索保存上限，或没有待重试的提问。原有历史仍保留。'); return;
    }
    sending.current = true; setPending(true); setError(''); setUnsavedReply('');
    let next: Exploration = exploration;
    try {
      if (!retry) {
        next = { ...exploration, revision: exploration.revision + 1, messages: [...exploration.messages,
          { id: crypto.randomUUID(), role: 'user', content: draft.trim(), createdAt: new Date().toISOString() }] };
        if (!await saveExploration(project.id, exploration.revision, next)) throw new Error('提问还没有保存，请处理页面中的存储提示后重试。');
        if (!mounted.current) return;
        setDraft('');
      }
      const messages = next.messages.slice(-20).map(({ role, content }) => ({ role, content }));
      while (messages.reduce((sum, m) => sum + m.content.length, 0) > 16000 && messages.length > 1) messages.shift();
      const controller = new AbortController(); request.current = controller;
      const response = await fetch('/api/lab', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ messages, observation: project.observation, seed: next.seed }) });
      const data: unknown = await response.json();
      if (!response.ok) throw new Error(isRecord(data) && typeof data.error === 'string' ? data.error : 'AI 暂时没有完成回复，请重试。');
      if (!isAIReply(data)) throw new Error('AI 回复格式不完整，没有保存为有效建议。');
      if (!mounted.current) return;
      const saved = await saveExploration(project.id, next.revision, { ...next,
        messages: [...next.messages, { id: crypto.randomUUID(), role: 'assistant', content: data.reply, createdAt: new Date().toISOString() }],
        directions: [...next.directions, ...data.directions.map(d => ({ ...d, id: crypto.randomUUID(), status: 'suggested' as const }))],
      });
      if (!saved) { setUnsavedReply(data.reply); throw new Error('回复已收到，但没有写入历史。请复制保留下面的未保存回复，并处理存储或其他页面的更新提示。'); }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : '这次探索暂未完成，请重试。');
    } finally {
      sending.current = false;
      if (mounted.current) setPending(false);
    }
  }

  async function saveSeed(fields: SeedFields) {
    if (!editor || exploration.revision !== editor.revision) { setError('探索内容已更新，请关闭编辑窗口并重新打开，避免覆盖其他页面的修改。'); return false; }
    const sourceDirectionId = editor.direction?.id ?? editor.seed?.sourceDirectionId ?? null;
    const seed: ResearchSeed = { ...fields, rawObservation: project.observation, sourceDirectionId,
      version: (exploration.seed?.version ?? 0) + 1, confirmedAt: new Date().toISOString() };
    const ok = await saveExploration(project.id, editor.revision, { ...exploration, seed,
      directions: exploration.directions.map(d => ({ ...d, status: d.id === sourceDirectionId ? 'adopted' : d.status === 'adopted' ? 'suggested' : d.status })) });
    if (ok) setEditor(null);
    return ok;
  }

  const suggested = exploration.directions.filter(d => d.status === 'suggested').slice().reverse();
  const locked = busy || pending;
  return <>
    <div className="current-project-panel"><Icon name="leaf"/><div><span>当前项目 · 本地保存</span><strong>{project.name}</strong></div><Link className="text-button" href="/">管理 / 切换项目<Icon name="arrow" size={16}/></Link></div>
    <div className="lab-grid">
      <section className="lab-chat frosted-surface" aria-labelledby="chat-title">
        <div className="lab-panel-heading"><h2 id="chat-title">从一个念头开始</h2><span className="soft-badge">{status?.configured ? 'AI 已配置' : 'AI 待连接'}</span></div>
        {project.observation && <div className="lab-observation"><span>起始观察 · 用户输入</span><p>{project.observation}</p></div>}
        <div className="lab-transcript" aria-label="本项目对话历史" tabIndex={0}>
          {!exploration.messages.length && <div className="lab-welcome"><Icon name="spark" size={24}/><p>不必先想清楚，说说你的发现。</p><span>AI 建议需要核实，研究问题由你确认。</span></div>}
          {exploration.messages.map(m => <article key={m.id} className={`chat-message chat-${m.role}`}><span>{m.role === 'user' ? '你' : 'AI 建议 · 待核实'}</span><p>{m.content}</p></article>)}
        </div>
        <p className="lab-connection" role="status">{connectionError || status?.message || '正在检查 AI 连接…'}</p>
        {error && <p className="lab-error" role="alert">{error}</p>}
        {unsavedReply && <details className="lab-unsaved"><summary>未保存的 AI 回复</summary><p>{unsavedReply}</p></details>}
        {exploration.messages.at(-1)?.role === 'user' && !pending && <button className="text-button lab-retry" onClick={() => void send(true)} disabled={locked || !status?.configured}>重试 AI 回复</button>}
        <form className="lab-composer" onSubmit={e => { e.preventDefault(); void send(); }}>
          <label className="sr-only" htmlFor="lab-message">给 AI 的消息</label><textarea id="lab-message" rows={3} maxLength={2000} value={draft} onChange={e => setDraft(e.target.value)} placeholder="我最近注意到…" disabled={pending}/>
          <div><span>{draft.length} / 2000</span><button className="button primary" disabled={locked || !status?.configured || !draft.trim()}>{pending ? '正在探索…' : '发送'}<Icon name="arrow" size={16}/></button></div>
        </form>
        <p className="lab-privacy">发送时，对话上下文和研究种子会交给你配置的 AI 服务商。页面不会自动发起对话。</p>
      </section>
      <aside className="lab-directions" aria-label="研究方向与种子">
        <section className="lab-seed frosted-surface" aria-labelledby="seed-title"><div className="lab-panel-heading"><h2 id="seed-title">研究种子</h2><span className="seed-status">{exploration.seed ? '用户已确认' : '尚未确认'}</span></div>
          {exploration.seed ? <><h3>{exploration.seed.angle}</h3><p className="seed-question">{exploration.seed.workingQuestion}</p><div className="concept-tags">{exploration.seed.concepts.map((c, i) => <span key={i}>{c}</span>)}</div><p className="muted">第 {exploration.seed.version} 版 · 文献依据待核实</p><button className="text-button" disabled={locked} onClick={() => setEditor({ seed: exploration.seed!, revision: exploration.revision })}>编辑研究种子<Icon name="arrow" size={15}/></button></> :
            <><p className="muted">采纳一个候选方向，或先手动写下问题。</p><button className="text-button" disabled={locked} onClick={() => setEditor({ revision: exploration.revision })}>手动写研究种子<Icon name="plus" size={15}/></button></>}
          <p className="seed-note">继续对话不会自动覆盖你确认的内容。</p>
        </section>
        <div className="lab-candidates-heading"><h2>候选方向</h2><span>AI 建议 · 待核实</span></div>
        {!suggested.length && <div className="lab-candidates-empty"><Icon name="spark" size={24}/><p>方向，会在交流中浮现。</p><span>连接 AI 并发送消息后，这里显示真实候选。</span></div>}
        <div className="lab-candidate-list">{suggested.map(d => <article className="direction-card frosted-surface" key={d.id}><h3>{d.title}</h3><p>{d.description}</p><div className="concept-tags">{d.concepts.map((c, i) => <span key={i}>{c}</span>)}</div><details><summary>为什么值得探索</summary><p>{d.rationale}</p><p>候选问题：{d.question}</p>{!!d.uncertainties.length && <ul>{d.uncertainties.map((q, i) => <li key={i}>{q}</li>)}</ul>}</details><div className="direction-actions"><button className="text-button" disabled={locked} onClick={() => setEditor({ direction: d, revision: exploration.revision })}>编辑并采纳<Icon name="arrow" size={15}/></button><button className="small-button" disabled={locked} onClick={async () => { setError(''); if (!await saveExploration(project.id, exploration.revision, { ...exploration, directions: exploration.directions.map(x => x.id === d.id ? { ...x, status: 'discarded' } : x) })) setError('未能丢弃该方向，请处理存储提示后重试。'); }}>丢弃</button></div></article>)}</div>
      </aside>
    </div>
    {editor && <SeedEditor editor={editor} replacing={!!editor.direction && !!exploration.seed} busy={busy} onClose={() => setEditor(null)} onSave={saveSeed}/>}
  </>;
}

function SeedEditor({ editor, replacing, busy, onClose, onSave }: { editor: Editor; replacing: boolean; busy: boolean; onClose: () => void; onSave: (fields: SeedFields) => Promise<boolean> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const first = useRef<HTMLInputElement>(null);
  const [angle, setAngle] = useState(editor.direction?.title ?? editor.seed?.angle ?? '');
  const [question, setQuestion] = useState(editor.direction?.question ?? editor.seed?.workingQuestion ?? '');
  const [concepts, setConcepts] = useState((editor.direction?.concepts ?? editor.seed?.concepts ?? []).join('，'));
  const [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current; const opener = document.activeElement;
    element?.showModal(); first.current?.focus();
    return () => { element?.close(); if (opener instanceof HTMLElement) opener.focus(); };
  }, []);
  return <dialog ref={dialog} className="project-dialog seed-editor frosted-surface" aria-labelledby="seed-editor-title" onCancel={e => { if (busy) e.preventDefault(); else onClose(); }}>
    <div className="dialog-top"><span className="eyebrow">YOUR RESEARCH SEED</span><button className="icon-button" onClick={onClose} disabled={busy} aria-label="关闭种子编辑"><Icon name="close"/></button></div><h2 id="seed-editor-title">{replacing ? '替换已确认的研究种子？' : '让问题，慢慢清晰'}</h2>
    {replacing && <p className="muted">确认后用以下内容替换当前研究种子；取消会保留原有问题。</p>}
    <form onSubmit={async e => { e.preventDefault(); setError(''); const items = concepts.split(/[，,、\n]/).map(s => s.trim()).filter(Boolean); if (items.length > 8 || items.some(c => c.length > 80)) { setError('最多填写 8 个概念，每个最多 80 字，用逗号分隔。'); return; } if (!await onSave({ angle: angle.trim(), workingQuestion: question.trim(), concepts: items })) setError('未完成保存，你的编辑仍保留在这里，请查看页面提示。'); }}>
      <label className="field-label" htmlFor="seed-angle">研究视角</label><input id="seed-angle" ref={first} required maxLength={120} value={angle} onChange={e => setAngle(e.target.value)}/>
      <label className="field-label" htmlFor="seed-question">研究问题</label><textarea id="seed-question" required maxLength={400} rows={3} value={question} onChange={e => setQuestion(e.target.value)}/>
      <label className="field-label" htmlFor="seed-concepts">候选概念 <span>选填，逗号分隔</span></label><input id="seed-concepts" maxLength={650} value={concepts} onChange={e => setConcepts(e.target.value)}/>
      <p className="dialog-note">保存代表你确认这个研究起点，概念与证据仍需后续核实。</p>{error && <p role="alert" className="field-error">{error}</p>}
      <div className="dialog-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>取消</button><button className="button primary" disabled={busy || !angle.trim() || !question.trim()}>{busy ? '正在保存…' : replacing ? '确认替换研究种子' : '保存研究种子'}</button></div>
    </form>
  </dialog>;
}
