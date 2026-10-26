import { test, expect, type Page } from "@playwright/test";
const at = "2026-10-25T00:00:00Z",
  key = "paperi.projects.v1";
const project = (id = "a") => ({
  id,
  name: id === "a" ? "品牌联名研究" : "另一个项目",
  observation: "品牌联名如何吸引消费者",
  discipline: "广告学",
  status: "starting",
  createdAt: at,
  updatedAt: at,
});
async function load(page: Page) {
  await page.goto("/");
  await page.evaluate(
    ({ key, projects }) =>
      localStorage.setItem(
        key,
        JSON.stringify({ version: 1, revision: 0, activeId: "a", projects }),
      ),
    { key, projects: [project(), project("b")] },
  );
  await page.reload();
}
async function snapshot(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);
}
test("真实PDF解析器读取本地合成文件，确认前不入库，刷新后可下载原文件", async ({
  page,
}) => {
  await load(page);
  await page.goto("/literature");
  await page
    .getByRole("button", { name: "导入文献", exact: true })
    .first()
    .click();
  await page
    .getByLabel("选择题录或 PDF 文件")
    .setInputFiles("tests/fixtures/workflow/readable.pdf");
  await expect(page.getByText("导入预览：1 篇可编辑，0 条失败")).toBeVisible({
    timeout: 20000,
  });
  expect((await snapshot(page)).projects[0].library).toBeUndefined();
  await page.getByLabel("论文标题").fill("测试 PDF 书目（用户确认）");
  await page.getByRole("button", { name: /导入这 \d+ 篇/ }).click();
  await expect(page.locator(".paper-card")).toHaveCount(1);
  await expect(page.locator(".paper-card")).toContainText("有本地 PDF");
  await page.reload();
  await page.getByRole("button", { name: "编辑资料、分类与笔记" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 PDF 原文件备份" }).click();
  expect((await download).suggestedFilename()).toBe("readable.pdf");
  const s = await snapshot(page);
  expect(JSON.stringify(s)).not.toContain("Synthetic Paperi");
  expect(s.projects[0].library.items[0].attachment.pages).toBe(1);
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.goto("/");
  await page.getByText("项目数据备份与恢复", { exact: true }).click();
  await page.getByLabel("选择项目 JSON 备份").setInputFiles({
    name: "pdf-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(s)),
  });
  await page.getByRole("button", { name: "确认恢复为独立副本" }).click();
  await page.goto("/literature");
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "删除文献", exact: true }).click();
  await expect(page.locator(".paper-card")).toHaveCount(0);
  await page.getByLabel("当前项目", { exact: true }).selectOption("a");
  await page.getByRole("button", { name: "编辑资料、分类与笔记" }).click();
  const original = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 PDF 原文件备份" }).click();
  expect((await original).suggestedFilename()).toBe("readable.pdf");
});
