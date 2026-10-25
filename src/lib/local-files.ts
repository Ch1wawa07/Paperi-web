import { pdfOperation, type PDFProgress } from "./pdf-operation";
export type LocalPDF = {
  id: string;
  projectId: string;
  blob: Blob;
  name: string;
  pages: string[];
  updatedAt: string;
};
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("paperi.files.v1", 1);
    r.onupgradeneeded = () => {
      const s = r.result.createObjectStore("pdfs", { keyPath: "id" });
      s.createIndex("projectId", "projectId");
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () =>
      reject(new Error("无法打开本地 PDF 存储，请检查浏览器权限。"));
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction("pdfs", mode);
    const r = fn(t.objectStore("pdfs"));
    t.oncomplete = () => {
      db.close();
      resolve(r.result);
    };
    t.onerror = t.onabort = () => {
      db.close();
      reject(new Error("PDF 存储失败或容量不足，已有资料未替换。"));
    };
  });
}
export const savePDF = (file: LocalPDF) =>
  transaction("readwrite", (s) => s.put(file));
export async function getPDF(projectId: string, id: string) {
  const p = await transaction<LocalPDF | undefined>("readonly", (s) =>
    s.get(id),
  );
  return p?.projectId === projectId ? p : undefined;
}
export async function removePDF(projectId: string, id: string) {
  const existing = await getPDF(projectId, id);
  if (existing) await transaction("readwrite", (s) => s.delete(id));
}
export async function deleteProjectPDFs(projectId: string) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const t = db.transaction("pdfs", "readwrite");
    const c = t
      .objectStore("pdfs")
      .index("projectId")
      .openCursor(IDBKeyRange.only(projectId));
    c.onsuccess = () => {
      const cur = c.result;
      if (cur) {
        cur.delete();
        cur.continue();
      }
    };
    t.oncomplete = () => {
      db.close();
      resolve();
    };
    t.onerror = () => {
      db.close();
      reject(new Error("项目已移除，但本地 PDF 清理未完成。"));
    };
  });
}
export async function extractPDF(
  file: File,
  options: {
    signal?: AbortSignal;
    onProgress?: (progress: PDFProgress) => void;
  } = {},
) {
  const deadline = new AbortController();
  const timer = setTimeout(
    () =>
      deadline.abort(
        new Error("PDF 总读取时间超过 60 秒，请拆分文件或先使用摘要。"),
      ),
    60000,
  );
  const signal = options.signal
    ? AbortSignal.any([options.signal, deadline.signal])
    : deadline.signal;
  const report = (stage: string, page = 0, total = 0) =>
    options.onProgress?.({ stage, page, total });
  let task: import("pdfjs-dist").PDFDocumentLoadingTask | undefined;
  try {
    report("正在打开 PDF…");
    if (file.size > 20 * 1024 * 1024)
      throw new Error("PDF 最大 20 MB，请拆分文件。");
    const data = new Uint8Array(await pdfOperation(file.arrayBuffer(), signal));
    if (new TextDecoder().decode(data.slice(0, 5)) !== "%PDF-")
      throw new Error("文件不是有效 PDF。");
    const pdfjs = await pdfOperation(import("pdfjs-dist"), signal);
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    task = pdfjs.getDocument({
      data,
      useSystemFonts: true,
      cMapUrl: "/pdfjs/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/pdfjs/standard_fonts/",
      stopAtErrors: true,
    });
    task.onPassword = () => {
      deadline.abort(
        new Error("PDF 需要密码，暂不支持读取。请在本地解密后重新导入。"),
      );
    };
    const doc = await pdfOperation(task.promise, signal);
    if (doc.numPages > 150)
      throw new Error("当前支持最多 150 页的 PDF，请拆分。");
    const pages: string[] = [];
    let count = 0;
    for (let i = 1; i <= doc.numPages; i++) {
      report(`正在提取文字：第 ${i} / ${doc.numPages} 页`, i, doc.numPages);
      const page = await pdfOperation(doc.getPage(i), signal);
      const content = await pdfOperation(page.getTextContent(), signal);
      const text = content.items
        .map((x) =>
          "str" in x ? x.str + ("hasEOL" in x && x.hasEOL ? "\n" : " ") : "",
        )
        .join("");
      count += text.length;
      if (count > 600000) throw new Error("全文文字超过 60 万字符，请拆分。");
      pages.push(text);
      page.cleanup();
    }
    if (pages.join("").trim().length < 80)
      throw new Error(
        "此 PDF 没有足够可提取文字，可能为扫描件。当前不提供 OCR，请补充摘要。",
      );
    report("文字提取完成，正在整理导入预览…", doc.numPages, doc.numPages);
    const metadata = await pdfOperation(doc.getMetadata(), signal);
    const info = metadata.info as Record<string, unknown>;
    return {
      pages,
      title: typeof info.Title === "string" ? info.Title : "",
      author: typeof info.Author === "string" ? info.Author : "",
    };
  } finally {
    clearTimeout(timer);
    if (task) void task.destroy().catch(() => {});
  }
}
