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
export async function extractPDF(file: File) {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("PDF 最大 20 MB，请拆分文件。");
  const data = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(data.slice(0, 5)) !== "%PDF-")
    throw new Error("文件不是有效 PDF。");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({
    data,
    useSystemFonts: true,
    stopAtErrors: true,
  });
  let doc;
  try {
    doc = await task.promise;
    if (doc.numPages > 150)
      throw new Error("当前支持最多 150 页的 PDF，请拆分。");
    const pages: string[] = [];
    let count = 0;
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
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
    const metadata = await doc.getMetadata();
    const info = metadata.info as Record<string, unknown>;
    return {
      pages,
      title: typeof info.Title === "string" ? info.Title : "",
      author: typeof info.Author === "string" ? info.Author : "",
    };
  } finally {
    await task.destroy();
  }
}
