import { AIError, aiStatus, readBoundedJSON } from "@/lib/ai-server";
import { researchJourneyRequest } from "@/lib/research-journey-server";
export const runtime = "nodejs";
export function GET() {
  return Response.json(aiStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (
      !origin ||
      new URL(origin).origin !== origin ||
      new URL(origin).host !== request.headers.get("host") ||
      new URL(origin).protocol !== new URL(request.url).protocol
    )
      throw new AIError(403, "请从 Paperi 页面发起研究请求。");
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw new AIError(415, "需要 JSON 格式的研究请求。");
    return Response.json(
      await researchJourneyRequest(
        await readBoundedJSON(request, 900000),
        request.signal,
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const e =
      error instanceof AIError
        ? error
        : new AIError(500, "研究助手未完成。原有内容保留，请手动重试。");
    return Response.json(
      { error: e.message },
      { status: e.status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
