import { isWorkbench, type Workbench } from './workbench';
import { isExploration, type Exploration } from './exploration';
import { isLibrary, type Library } from './literature';

export type Project = {
  id: string;
  name: string;
  discipline: string;
  status: 'starting';
  observation: string;
  createdAt: string;
  updatedAt: string;
  exploration?: Exploration;
  library?: Library;
  workbench?: Workbench;
};

export type ProjectSnapshot = {
  version: 1;
  revision: number;
  projects: Project[];
  activeId: string | null;
};

/** 异步数据访问边界：后续可替换为 Supabase 实现，页面无需直接访问 localStorage。 */
export interface ProjectRepository {
  load(): Promise<ProjectSnapshot>;
  save(next: ProjectSnapshot, expectedRevision: number): Promise<void>;
}

export const STORAGE_KEY = 'paperi.projects.v1';
export const emptySnapshot = (): ProjectSnapshot => ({ version: 1, revision: 0, projects: [], activeId: null });
const validDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const validText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;

function parseSnapshot(raw: string | null): ProjectSnapshot {
  if (raw === null) return emptySnapshot();
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') throw new Error();
    const s = data as Partial<ProjectSnapshot>;
    if (s.version !== 1 || !Number.isSafeInteger(s.revision) || (s.revision ?? -1) < 0 || !Array.isArray(s.projects)) throw new Error();
    const ids = new Set<string>();
    for (const p of s.projects) {
      if (!p || typeof p !== 'object' || !validText(p.id, 100) || !p.id || ids.has(p.id) ||
          !validText(p.name, 80) || !p.name.trim() || !validText(p.discipline, 60) ||
          !validText(p.observation, 2000) || p.status !== 'starting' || !validDate(p.createdAt) || !validDate(p.updatedAt) ||
          (p.exploration !== undefined && !isExploration(p.exploration)) ||
          (p.library !== undefined && !isLibrary(p.library)) ||
          (p.workbench !== undefined && !isWorkbench(p.workbench))) throw new Error();
      ids.add(p.id);
    }
    if (s.activeId !== null && (typeof s.activeId !== 'string' || !ids.has(s.activeId))) throw new Error();
    return s as ProjectSnapshot;
  } catch {
    throw new Error('浏览器里的项目数据格式异常。为保护原有内容，已暂停保存，请勿清除浏览器数据；可以重试读取或联系协助。');
  }
}

export class LocalProjectRepository implements ProjectRepository {
  async load() {
    let raw: string | null;
    try { raw = window.localStorage.getItem(STORAGE_KEY); }
    catch { throw new Error('无法读取浏览器存储，请允许本站保存数据后重试。'); }
    return parseSnapshot(raw);
  }
  async save(next: ProjectSnapshot, expectedRevision: number) {
    const current = await this.load();
    if (current.revision !== expectedRevision) throw new Error('项目已在另一个页面更新。请先重新读取，再进行操作。');
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { throw new Error('保存失败，浏览器存储可能已满或被禁用。原有项目未被更改，请检查浏览器设置后重试。'); }
  }
}
