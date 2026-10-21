import { MetadataError, verifyDOI } from '@/lib/literature-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try { return Response.json(await verifyDOI(new URL(request.url).searchParams.get('doi') ?? '',request.signal),{ headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { const error = e instanceof MetadataError ? e : new MetadataError(502,'暂时无法取得核查记录，请稍后重试。'); return Response.json({ error: error.message },{ status: error.status, headers: { 'Cache-Control': 'no-store' } }); }
}
