import { AIError, readBoundedJSON } from "@/lib/ai-server";
import { researchRequest } from "@/lib/research-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    let valid = false;
    try {
      const u = new URL(origin ?? "");
      valid =
        u.origin === origin &&
        u.host === request.headers.get("host") &&
        u.protocol === new URL(request.url).protocol;
    } catch {}
    if (!valid) throw new AIError(403, "请从 Paperi 页面发起请求。");
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw new AIError(415, "需要 JSON 内容。");
    return Response.json(
      await researchRequest(
        await readBoundedJSON(request, 220000),
        request.signal,
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const error =
      e instanceof AIError ? e : new AIError(500, "研究辅助暂未完成，请重试。");
    return Response.json(
      { error: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
