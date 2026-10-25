'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { LocalProjectRepository, STORAGE_KEY, emptySnapshot, type Project, type ProjectSnapshot } from '@/lib/projects';
import { emptyExploration, isExploration, type Exploration } from '@/lib/exploration';
import { isLibrary, type Library } from '@/lib/literature';
import { isWorkbench, type Workbench } from '@/lib/workbench';
import { emptyNavigation } from '@/lib/research-navigation';

import {deleteProjectPDFs} from '@/lib/local-files';
import {isWorkflow,type Workflow} from '@/lib/workflow';
import {parseSnapshot} from '@/lib/projects';
const repository = new LocalProjectRepository();
type ProjectActions = {
  saveWorkflow:(id:string,revision:number,workflow:Workflow)=>Promise<boolean>;
  restore:(raw:string)=>Promise<boolean>;
  snapshot: ProjectSnapshot; ready: boolean; busy: boolean; error: string; feedback: string;
  reload: () => Promise<void>;
  create: (name: string, discipline: string, observation: string) => Promise<boolean>;
  startExploration: (observation: string, projectId: string) => Promise<boolean>;
  rename: (id: string, name: string) => Promise<boolean>;
  select: (id: string) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  saveExploration: (id: string, expectedRevision: number, exploration: Exploration) => Promise<boolean>;
  saveWorkbench: (id: string, expectedRevision: number, workbench: Workbench) => Promise<boolean>;
  saveLibrary: (id: string, expectedRevision: number, library: Library) => Promise<boolean>;
};
const Context = createContext<ProjectActions | null>(null);
const errorMessage = (e: unknown) => e instanceof Error ? e.message : '操作失败，请重试。';

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<ProjectSnapshot>(emptySnapshot);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const snapshotRef = useRef(snapshot);
  const locked = useRef(false);
  const reload = useCallback((): Promise<void> => {
    if (locked.current) return Promise.resolve();
    return repository.load().then(next => {
      snapshotRef.current = next; setSnapshot(next); setReady(true); setError('');
    }).catch((e: unknown) => { setError(errorMessage(e)); setReady(false); });
  }, []);
  useEffect(() => {
    void reload();
    const sync = (e: StorageEvent) => { if (e.key === STORAGE_KEY || e.key === null) void reload(); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [reload]);

  async function commit(update: (s: ProjectSnapshot) => ProjectSnapshot, message: string) {
    if (locked.current || !ready) return false;
    locked.current = true; setBusy(true); setError(''); setFeedback('');
    try {
      const previous = snapshotRef.current;
      const next = { ...update(previous), revision: previous.revision + 1 };
      await repository.save(next, previous.revision);
      snapshotRef.current = next; setSnapshot(next); setFeedback(message);
      return true;
    } catch (e) { setError(errorMessage(e)); return false; }
    finally { locked.current = false; setBusy(false); }
  }
  const actions: ProjectActions = {
    snapshot, ready, busy, error, feedback, reload,
    restore: raw => commit(s=>{const imported=parseSnapshot(raw);const copies=imported.projects.map(p=>({...p,id:crypto.randomUUID(),name:(p.name+' · 恢复副本').slice(0,80)}));return {...s,projects:[...s.projects,...copies],activeId:copies[0]?.id??s.activeId};},'备份已作为独立项目恢复，原项目保留。PDF 需从单独备份重新附加。'),
    saveWorkflow:(id,revision,workflow)=>commit(s=>{const p=s.projects.find(p=>p.id===id);if(!p||(p.workflow?.revision??0)!==revision)throw new Error('研究资料已更新，请重新读取后保存。');const next={...workflow,revision:revision+1};if(!isWorkflow(next))throw new Error('工作流数据不完整或超过容量，原有内容未被覆盖。');return {...s,projects:s.projects.map(p=>p.id===id?{...p,workflow:next,updatedAt:new Date().toISOString()}:p)};},'研究进度已保存。'),
    saveWorkbench: (id, expectedRevision, workbench) => commit(s => {
      const project=s.projects.find(p=>p.id===id);
      if(!project||(project.workbench?.revision??0)!==expectedRevision)throw new Error('研究工作台已在其他页面更新，请重新读取后再保存。你的编辑尚未覆盖原有内容。');
      const next={...workbench,revision:expectedRevision+1};
      if(!isWorkbench(next))throw new Error('工作台内容不完整或超过容量，原有内容未被覆盖。');
      return {...s,projects:s.projects.map(p=>p.id===id?{...p,workbench:next,updatedAt:new Date().toISOString()}:p)};
    }, '研究工作台已保存。'),
    saveLibrary: (id, expectedRevision, library) => commit(s => {
      const project = s.projects.find(p => p.id === id);
      if (!project) throw new Error('这个研究项目已经不存在，请重新读取后选择项目。');
      if ((project.library?.revision ?? 0) !== expectedRevision) throw new Error('文献库已在其他页面更新，请重新读取后再保存。你的修改没有覆盖已保存内容。');
      const next = { ...library, revision: expectedRevision + 1 };
      if (!isLibrary(next)) throw new Error('文献库内容不完整、重复或超过容量，原有收藏未被覆盖。每项目最多 300 篇、30 个分类。');
      return { ...s, projects: s.projects.map(p => p.id === id ? { ...p, library: next, updatedAt: new Date().toISOString() } : p) };
    }, '文献库已保存在当前浏览器。'),
    saveExploration: (id, expectedRevision, exploration) => commit(s => {
      const project = s.projects.find(p => p.id === id);
      if (!project) throw new Error('这个项目已经不存在，请重新读取项目列表。');
      if ((project.exploration?.revision ?? 0) !== expectedRevision) throw new Error('这段探索已在另一页面更新。请重新读取后再操作，你的编辑未覆盖已保存内容。');
      const next = { ...exploration, revision: expectedRevision + 1 };
      if (!isExploration(next)) throw new Error('探索内容格式不完整或已达保存上限，原有记录未被覆盖。');
      return { ...s, projects: s.projects.map(p => p.id === id ? { ...p, exploration: next, updatedAt: new Date().toISOString() } : p) };
    }, '探索内容已保存在当前浏览器。'),
    startExploration: async (observation, projectId) => {
      const content = observation.trim();
      if (!content || content.length > 2000) { setError('请先写下 1–2000 字的生活观察。'); return false; }
      return commit(s => {
        const existing = s.projects.find(p => p.id === projectId);
        if (existing) return { ...s, activeId: existing.id };
        const now = new Date().toISOString(), messageId = crypto.randomUUID();
        const title = new Intl.DateTimeFormat('zh-CN', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
        const project: Project = { id: projectId, name: `新探索 · ${title}`, discipline: '', observation: content, status: 'starting', createdAt: now, updatedAt: now,
          exploration: { ...emptyExploration(), messages: [{id:messageId,role:'user',content,createdAt:now}], navigation:emptyNavigation(), launch:{messageId,attempted:false} } };
        return { ...s, projects: [project,...s.projects], activeId: projectId };
      }, '观察已保存，正在进入灵感探索。项目名称可稍后修改。');
    },
    create: async (name, discipline, observation) => {
      if (!name.trim() || name.trim().length > 80 || discipline.length > 60 || observation.length > 2000) { setError('请填写 1–80 字的项目名称，想法最多 2000 字。'); return false; }
      const now = new Date().toISOString();
      const project: Project = { id: crypto.randomUUID(), name: name.trim(), discipline: discipline.trim(), observation: observation.trim(), status: 'starting', createdAt: now, updatedAt: now };
      return commit(s => ({ ...s, projects: [project, ...s.projects], activeId: project.id }), '项目已创建，已保存在当前浏览器。');
    },
    rename: async (id, name) => {
      if (!name.trim() || name.trim().length > 80) { setError('项目名称需要 1–80 个字。'); return false; }
      return commit(s => {
        if (!s.projects.some(p => p.id === id)) throw new Error('这个项目已经不存在，请重新读取后选择项目。');
        return { ...s, projects: s.projects.map(p => p.id === id ? { ...p, name: name.trim(), updatedAt: new Date().toISOString() } : p) };
      }, '项目名称已保存。');
    },
    select: id => commit(s => {
      if (!s.projects.some(p => p.id === id)) throw new Error('这个项目已经不存在，请重新读取后选择项目。');
      return { ...s, activeId: id };
    }, '已切换当前项目。'),
    remove: async id => { const ok=await commit(s => {
      if (!s.projects.some(p => p.id === id)) throw new Error('这个项目已经被删除，请重新读取项目列表。');
      return { ...s, projects: s.projects.filter(p => p.id !== id), activeId: s.activeId === id ? s.projects.find(p => p.id !== id)?.id ?? null : s.activeId };
    }, '项目已从当前浏览器删除。');if(ok)try{await deleteProjectPDFs(id);}catch(e){setError(errorMessage(e));}return ok;},
  };
  return <Context.Provider value={actions}>{children}</Context.Provider>;
}
export function useProjects() {
  const context = useContext(Context);
  if (!context) throw new Error('ProjectProvider is required');
  return context;
}
