import { citationGraph } from "@/lib/graph-server";
import { MetadataError } from "@/lib/literature-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return Response.json(
      await citationGraph(
        new URL(request.url).searchParams.get("id") ?? "",
        request.signal,
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const err =
      e instanceof MetadataError
        ? e
        : new MetadataError(502, "真实引用关系暂未取得，请稍后重试。");
    return Response.json(
      { error: err.message },
      { status: err.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
