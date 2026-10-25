/** A stalled worker must not leave the import UI waiting indefinitely. */
export function pdfOperation<T>(
  promise: Promise<T>,
  signal: AbortSignal,
  timeoutMs = 15000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error: unknown, value?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(value as T);
    };
    const abort = () => finish(signal.reason ?? new Error("已取消 PDF 读取。"));
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            "PDF 读取超时，可能是加密、扫描或复杂版式文件。请重试、拆分文件，或先导入题录和摘要。",
          ),
        ),
      timeoutMs,
    );
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    promise.then(
      (value) => finish(null, value),
      (error) => finish(error),
    );
  });
}
export type PDFProgress = { stage: string; page: number; total: number };
