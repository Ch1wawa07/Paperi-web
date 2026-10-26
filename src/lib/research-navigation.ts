import { isRecord } from './exploration';

export const researchStages = [
  { id: 'phenomenon', label: '现象理解', hint: '先辨认现象、对象和你在意的矛盾。' },
  { id: 'concepts', label: '概念锚定', hint: '选择或排除候选概念，解释仍待文献验证。' },
  { id: 'literature', label: '文献初探', hint: '带着可编辑的短检索组合，去找真实来源。' },
  { id: 'context', label: '研究脉络', hint: '只围绕你选定的真实题录与摘要讨论。' },
  { id: 'questions', label: '候选问题', hint: '结合选定概念和文献依据，再讨论可行的问题。' },
  { id: 'design', label: '设计衔接', hint: '把已确认的问题、概念与依据带到下一环节。' },
] as const;
export type ResearchStage = typeof researchStages[number]['id'];
export type ConceptSuggestion = { term: string; explanation: string; everyday: string; uncertainty: string; relevance?:string; group?:string };
export type ResearchConcept = ConceptSuggestion & { id: string; status: 'suggested' | 'selected' | 'excluded'; origin: 'ai' | 'user' };
export type Guide = {
  stage: ResearchStage; understanding: string;
  concepts: ConceptSuggestion[];
  keywords: { zh: string[]; en: string[] };
  threads: { title: string; description: string; evidenceIds: string[]; uncertainty: string }[];
};
export type ResearchNavigation = { stage: ResearchStage; concepts: ResearchConcept[]; evidenceIds: string[]; guide: Guide | null; guides?: Partial<Record<ResearchStage,Guide>> };
export const emptyNavigation = (): ResearchNavigation => ({ stage: 'phenomenon', concepts: [], evidenceIds: [], guide: null });
export const isStage = (v: unknown): v is ResearchStage => researchStages.some(s => s.id === v);
const text = (v: unknown, max: number, empty = false): v is string => typeof v === 'string' && v.length <= max && (empty || !!v.trim());
export const isIds = (v: unknown, max = 5): v is string[] => Array.isArray(v) && v.length <= max && new Set(v).size === v.length && v.every(x => text(x, 100));
export function isConceptSuggestion(v: unknown): v is ConceptSuggestion & Record<string, unknown> {
  return isRecord(v) && text(v.term, 80) && text(v.explanation, 500) && text(v.everyday, 300, true) && text(v.uncertainty, 300) && (v.relevance===undefined||text(v.relevance,300,true)) && (v.group===undefined||text(v.group,40));
}
export function isGuide(v: unknown): v is Guide {
  return isRecord(v) && isStage(v.stage) && text(v.understanding, 1200, true) &&
    Array.isArray(v.concepts) && v.concepts.length <= 12 && v.concepts.every(isConceptSuggestion) &&
    isRecord(v.keywords) && [v.keywords.zh, v.keywords.en].every(a => Array.isArray(a) && a.length <= 6 && a.every(x => text(x, 100))) &&
    Array.isArray(v.threads) && v.threads.length <= 4 && v.threads.every(t => isRecord(t) && text(t.title, 120) && text(t.description, 1000) && isIds(t.evidenceIds) && text(t.uncertainty, 500));
}
export function isNavigation(v: unknown): v is ResearchNavigation {
  if (!isRecord(v) || !isStage(v.stage) || !isIds(v.evidenceIds) || (v.guide !== null && !isGuide(v.guide)) || !Array.isArray(v.concepts) || v.concepts.length > 24) return false;
  if(v.guides!==undefined&&(!isRecord(v.guides)||Object.entries(v.guides).some(([stage,guide])=>!isStage(stage)||!isGuide(guide)||guide.stage!==stage))) return false;
  const ids = new Set<string>(), terms = new Set<string>();
  for (const c of v.concepts) {
    if (!isConceptSuggestion(c) || !isRecord(c) || !text(c.id, 100) || !['suggested','selected','excluded'].includes(String(c.status)) || !['ai','user'].includes(String(c.origin))) return false;
    const term = c.term.normalize('NFKC').toLowerCase().trim();
    if (ids.has(c.id) || terms.has(term)) return false;
    ids.add(c.id); terms.add(term);
  }
  return true;
}
export function mergeConcepts(current: ResearchConcept[], suggestions: ConceptSuggestion[]): ResearchConcept[] {
  const next = [...current], terms = new Set(current.map(c => c.term.normalize('NFKC').trim().toLowerCase()));
  for (const c of suggestions) {
    const term = c.term.normalize('NFKC').trim().toLowerCase();
    if (!terms.has(term) && next.length < 24) { next.push({ ...c, id: crypto.randomUUID(), status: 'suggested', origin: 'ai' }); terms.add(term); }
  }
  return next;
}
