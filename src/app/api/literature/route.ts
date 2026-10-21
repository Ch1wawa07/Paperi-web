import { MetadataError, parseSearch, searchLiterature } from '@/lib/literature-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try { return Response.json(await searchLiterature(parseSearch(new URL(request.url).searchParams),request.signal),{ headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { const error = e instanceof MetadataError ? e : new MetadataError(502,'文献检索暂未完成，请稍后重试。'); return Response.json({ error: error.message },{ status: error.status, headers: { 'Cache-Control': 'no-store' } }); }
}
