import type { SavedPaper } from "./literature";
import type { LocalPDF } from "./local-files";
import { pdfMetadataCandidates } from "./pdf-metadata";
/** Local, opt-in diagnostic. No whole document, Blob, project observation or environment values. */
export function redactDiagnostic(s: string) {
  return s
    .split(/\n/)
    .filter(
      (line) =>
        !/(?:E\s*-?\s*M\s*a\s*i\s*l|邮\s*箱|通\s*[讯信]|地\s*址|邮\s*编|电\s*话|API[_\s-]*KEY|password|secret|Bearer)/i.test(
          line,
        ),
    )
    .join("\n")
    .replace(
      /[A-Za-z\d._%+-](?:[A-Za-z\d._%+\- ]{0,80})@\s*(?:[A-Za-z\d.-]\s*)+\.\s*(?:[A-Za-z]\s*){2,12}/g,
      "[邮箱已移除]",
    )
    .replace(
      /\b(?:sk-|ghp_|github_pat_|AKIA)[A-Za-z\d_-]{8,}\b/g,
      "[凭证已移除]",
    )
    .replace(/(?:\+?86[- ]?)?1[3-9]\d{9}\b/g, "[电话已移除]");
}
export function pdfDiagnosticRecord(item: SavedPaper, file?: LocalPDF) {
  const bibliographic = (p: Partial<SavedPaper["paper"]>) => ({
    title: redactDiagnostic(p.title ?? ""),
    authors: (p.authors ?? []).map(redactDiagnostic).filter(Boolean),
    year: p.year ?? null,
    venue: redactDiagnostic(p.venue ?? ""),
  });
  const candidates = file
    ? pdfMetadataCandidates(file.pages, {
        ...file.metadata,
        filename: file.name,
      })
    : null;
  const patterns = [
    /摘\s*要|abstract/i,
    /研究假设|研究方法|method/i,
    /研究结果|数据分析|results/i,
    /讨\s*论|结\s*论|discussion|conclusion/i,
  ];
  const selected = new Set<number>([0]);
  patterns.forEach((pattern) => {
    const i = file?.pages.findIndex((p) => pattern.test(p));
    if (i !== undefined && i >= 0) selected.add(i);
  });
  return {
    filename: redactDiagnostic(item.attachment?.name ?? ""),
    current: bibliographic(item.paper),
    candidates: candidates ? bibliographic(candidates.fields) : null,
    origins: item.bibliography ?? null,
    status: !file
      ? "原PDF当前不可读"
      : file.pages.join("").trim().length < 80
        ? "提取文字不足"
        : "有可提取文字，未证明学术理解质量",
    pageCount: file?.pages.length ?? item.attachment?.pages ?? 0,
    pageTextLengths: file?.pages.map((p) => p.length) ?? [],
    snippets: file
      ? [...selected].slice(0, 5).map((i) => {
          const page = file.pages[i];
          const hit = page.search(
            /摘\s*要|研究假设|研究方法|研究结果|结\s*论|讨\s*论|abstract|method|results|conclusion/i,
          );
          return {
            page: i + 1,
            text: redactDiagnostic(
              page.slice(Math.max(0, hit - 60), Math.max(0, hit - 60) + 600),
            ).slice(0, 450),
          };
        })
      : [],
  };
}
export function serializePDFDiagnostics(
  records: ReturnType<typeof pdfDiagnosticRecord>[],
) {
  if (records.length > 20) throw new Error("诊断一次最多选择20篇。");
  const content = JSON.stringify(
    {
      version: 1,
      notice:
        "仅本地手动导出；短节选已脱敏，不代表全文，不包含原PDF。分享前请再次核对。",
      records,
    },
    null,
    2,
  );
  if (new TextEncoder().encode(content).length > 65536)
    throw new Error("诊断超过64KB，请减少所选文献后重试。");
  return content;
}
