import { AIError, readBoundedJSON, requestKeywords } from '@/lib/ai-server';
import { isRecord, isResearchSeed } from '@/lib/exploration';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin'); let allowed = false;
    try { const u = new URL(origin ?? ''); allowed = u.origin === origin && u.host === request.headers.get('host') && u.protocol === new URL(request.url).protocol; } catch { /* invalid origin */ }
    if (!allowed) throw new AIError(403,'请从 Paperi 页面生成检索词。');
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new AIError(415,'请求需要 JSON 内容。');
    const body = await readBoundedJSON(request,20_000);
    if (!isRecord(body) || !isResearchSeed(body.seed)) throw new AIError(400,'请先在灵感实验室确认研究种子，或直接手动填写检索词。');
    return Response.json(await requestKeywords(body.seed,request.signal),{ headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { const error = e instanceof AIError ? e : new AIError(502,'检索词生成暂未完成，请手动填写或稍后重试。'); return Response.json({ error: error.message },{ status: error.status, headers: { 'Cache-Control': 'no-store' } }); }
}
