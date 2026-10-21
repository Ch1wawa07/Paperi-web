'use client';

import { useEffect, useRef, useState } from 'react';
import { useProjects } from './project-provider';
import { Icon } from './ui';
import type { Project } from '@/lib/projects';

type DialogProps = { mode: 'create' | 'rename' | 'delete'; project?: Project; observation?: string; onClose: () => void };
export function ProjectDialog({ mode, project, observation = '', onClose }: DialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState(project?.name ?? '');
  const [discipline, setDiscipline] = useState('');
  const [localError, setLocalError] = useState('');
  const { create, rename, remove, busy } = useProjects();
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement;
    element?.showModal();
    if (mode === 'delete') cancelButton.current?.focus();
    else nameInput.current?.focus();
    return () => { element?.close(); if (opener instanceof HTMLElement) opener.focus(); };
  }, [mode]);
  const title = mode === 'create' ? '让一个想法，在纸里发芽' : mode === 'rename' ? '给项目换个名字' : '确认删除这个项目？';
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLocalError('');
    const ok = mode === 'create' ? await create(name, discipline, observation) : mode === 'rename' ? await rename(project!.id, name) : await remove(project!.id);
    if (ok) onClose(); else setLocalError('操作未完成，内容仍保留在这里。请关闭此窗口，查看页面中的具体提示，重新读取后再试。');
  }
  return <dialog ref={dialog} className="project-dialog frosted-surface" aria-labelledby="dialog-title" onCancel={e => { if (busy) e.preventDefault(); else onClose(); }}>
    <div className="dialog-top"><span className="eyebrow">YOUR LITTLE BEGINNING</span><button className="icon-button" disabled={busy} onClick={onClose} aria-label="关闭对话框"><Icon name="close"/></button></div>
    <h2 id="dialog-title">{title}</h2>
    <form onSubmit={submit}>
      {mode === 'delete' ? <p className="delete-description">将删除「{project?.name}」及其本地项目记录。此操作不能撤销，也不会影响其他项目。</p> : <><label className="field-label" htmlFor="project-name">项目名称 <span>必填，最多 80 字</span></label><input id="project-name" ref={nameInput} required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="例如：AI 推荐如何影响我的消费选择"/>{mode === 'create' && <><label className="field-label" htmlFor="discipline">研究领域 <span>选填</span></label><select id="discipline" value={discipline} onChange={e => setDiscipline(e.target.value)}><option value="">还没想好，慢慢探索</option><option>广告与消费者研究</option><option>新闻与传播</option><option>社会学</option><option>其他人文社科领域</option></select></>}</>}
      <p className="dialog-note"><Icon name="lock" size={15}/>仅保存在当前浏览器，清除浏览器数据或更换设备后可能无法找回。</p>
      {localError && <p role="alert" className="field-error">{localError}</p>}
      <div className="dialog-actions"><button ref={cancelButton} type="button" className="button secondary" onClick={onClose} disabled={busy}>取消</button><button type="submit" className={`button ${mode === 'delete' ? 'danger' : 'primary'}`} disabled={busy || (mode !== 'delete' && !name.trim())}>{busy ? '正在保存…' : mode === 'delete' ? '确认删除' : mode === 'rename' ? '保存名称' : '创建项目'}</button></div>
    </form>
  </dialog>;
}
