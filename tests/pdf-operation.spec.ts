import { test, expect } from "@playwright/test";
import { pdfOperation } from "../src/lib/pdf-operation";
test("PDF worker永久不响应时有界超时；取消立即结束且晚到结果不改变状态", async () => {
  const c = new AbortController();
  await expect(
    pdfOperation(new Promise(() => {}), c.signal, 20),
  ).rejects.toThrow("PDF 读取超时");
  let resolve!: (x: string) => void;
  const pending = pdfOperation(
    new Promise<string>((r) => {
      resolve = r;
    }),
    c.signal,
    1000,
  );
  c.abort(new Error("用户取消"));
  await expect(pending).rejects.toThrow("用户取消");
  resolve("late data");
  await expect(
    pdfOperation(Promise.resolve("ok"), new AbortController().signal),
  ).resolves.toBe("ok");
});
