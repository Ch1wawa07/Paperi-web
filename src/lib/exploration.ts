export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string };
export type Direction = {
  id: string; title: string; description: string; concepts: string[];
  rationale: string; question: string; uncertainties: string[];
  status: 'suggested' | 'adopted' | 'discarded';
};
export type ResearchSeed = {
  angle: string; workingQuestion: string; concepts: string[]; rawObservation: string;
  version: number; confirmedAt: string; sourceDirectionId: string | null;
};
export type Exploration = { revision: number; messages: ChatMessage[]; directions: Direction[]; seed: ResearchSeed | null };
export type AIReply = { reply: string; directions: Omit<Direction, 'id' | 'status'>[] };
export const emptyExploration = (): Exploration => ({ revision: 0, messages: [], directions: [], seed: null });
export const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const list = (v: unknown, max: number, length: number): v is string[] => Array.isArray(v) && v.length <= length && v.every(x => text(x, max));
function directionFields(v: unknown): v is AIReply['directions'][number] {
  return isRecord(v) && text(v.title, 120) && text(v.description, 800) && list(v.concepts, 80, 8) &&
    text(v.rationale, 800) && text(v.question, 400) && list(v.uncertainties, 300, 5);
}
export function isAIReply(v: unknown): v is AIReply {
  return isRecord(v) && text(v.reply, 6000) && Array.isArray(v.directions) &&
    v.directions.length >= 2 && v.directions.length <= 3 && v.directions.every(directionFields);
}
export function isResearchSeed(v: unknown): v is ResearchSeed {
  return isRecord(v) && text(v.angle, 120) && text(v.workingQuestion, 400) && list(v.concepts, 80, 8) &&
    typeof v.rawObservation === 'string' && v.rawObservation.length <= 2000 &&
    Number.isSafeInteger(v.version) && Number(v.version) >= 1 && date(v.confirmedAt) &&
    (v.sourceDirectionId === null || text(v.sourceDirectionId, 100));
}
export function isExploration(v: unknown): v is Exploration {
  if (!isRecord(v) || !Number.isSafeInteger(v.revision) || Number(v.revision) < 0 ||
    !Array.isArray(v.messages) || v.messages.length > 120 || !Array.isArray(v.directions) || v.directions.length > 60 ||
    (v.seed !== null && !isResearchSeed(v.seed))) return false;
  const ids = new Set<string>();
  for (const m of v.messages) {
    if (!isRecord(m) || !text(m.id, 100) || ids.has(m.id) || !['user', 'assistant'].includes(String(m.role)) ||
      !text(m.content, m.role === 'user' ? 2000 : 6000) || !date(m.createdAt)) return false;
    ids.add(m.id);
  }
  for (const d of v.directions) {
    if (!isRecord(d) || !text(d.id, 100) || ids.has(d.id) ||
      !['suggested', 'adopted', 'discarded'].includes(String(d.status))) return false;
    const id = d.id;
    if (!directionFields(d)) return false;
    ids.add(id);
  }
  return true;
}
