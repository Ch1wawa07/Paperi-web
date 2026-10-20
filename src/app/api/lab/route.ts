import { aiStatus, AIError, parseInput, readBoundedJSON, requestAI } from '@/lib/ai-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
export function GET() { return Response.json(aiStatus(), { headers }); }
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    let sameOrigin = false;
    try {
      const source = new URL(origin ?? '');
      // Next may use the bind hostname in request.url; Host is the browser-facing authority.
      sameOrigin = source.origin === origin && source.host === request.headers.get('host') && source.protocol === new URL(request.url).protocol;
    } catch { /* invalid or absent Origin */ }
    if (!sameOrigin) throw new AIError(403, '请从 Paperi 页面发送请求。');
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new AIError(415, '请求需要 JSON 内容。');
    const input = parseInput(await readBoundedJSON(request, 80_000));
    return Response.json(await requestAI(input, request.signal), { headers });
  } catch (e) {
    const error = e instanceof AIError ? e : new AIError(500, '这次探索暂未完成，请稍后重试。');
    return Response.json({ error: error.message }, { status: error.status, headers });
  }
}
