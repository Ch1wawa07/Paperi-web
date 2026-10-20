'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { LocalProjectRepository, STORAGE_KEY, emptySnapshot, type Project, type ProjectSnapshot } from '@/lib/projects';
import { isExploration, type Exploration } from '@/lib/exploration';

const repository = new LocalProjectRepository();
type ProjectActions = {
  snapshot: ProjectSnapshot; ready: boolean; busy: boolean; error: string; feedback: string;
  reload: () => Promise<void>;
  create: (name: string, discipline: string, observation: string) => Promise<boolean>;
  rename: (id: string, name: string) => Promise<boolean>;
  select: (id: string) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  saveExploration: (id: string, expectedRevision: number, exploration: Exploration) => Promise<boolean>;
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
    saveExploration: (id, expectedRevision, exploration) => commit(s => {
      const project = s.projects.find(p => p.id === id);
      if (!project) throw new Error('这个项目已经不存在，请重新读取项目列表。');
      if ((project.exploration?.revision ?? 0) !== expectedRevision) throw new Error('这段探索已在另一页面更新。请重新读取后再操作，你的编辑未覆盖已保存内容。');
      const next = { ...exploration, revision: expectedRevision + 1 };
      if (!isExploration(next)) throw new Error('探索内容格式不完整或已达保存上限，原有记录未被覆盖。');
      return { ...s, projects: s.projects.map(p => p.id === id ? { ...p, exploration: next, updatedAt: new Date().toISOString() } : p) };
    }, '探索内容已保存在当前浏览器。'),
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
    remove: id => commit(s => {
      if (!s.projects.some(p => p.id === id)) throw new Error('这个项目已经被删除，请重新读取项目列表。');
      return { ...s, projects: s.projects.filter(p => p.id !== id), activeId: s.activeId === id ? s.projects.find(p => p.id !== id)?.id ?? null : s.activeId };
    }, '项目已从当前浏览器删除。'),
  };
  return <Context.Provider value={actions}>{children}</Context.Provider>;
}
export function useProjects() {
  const context = useContext(Context);
  if (!context) throw new Error('ProjectProvider is required');
  return context;
}
