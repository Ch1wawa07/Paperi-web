import { test, expect } from "@playwright/test";
import { setup } from "./fixtures/pdf-project";
test("五篇批量校对一次保存，旧历史/附件/笔记及其他项目保留；诊断显式选择并脱敏", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "批量校对书目", exact: true }).click();
  for (let i = 0; i < 5; i++) {
    await page
      .getByLabel(`p${i}-title`, { exact: true })
      .fill(`合成校对论文题名${i}`);
    await page.getByLabel(`p${i}-authors`, { exact: true }).fill("张三；李四");
    await page.getByLabel(`p${i}-year`, { exact: true }).fill("2024");
    await page.getByLabel(`p${i}-venue`, { exact: true }).fill("合成测试期刊");
  }
  await page.getByRole("button", { name: "确认并保存本项目全部书目" }).click();
  await expect(page.locator(".paper-card")).toHaveCount(5);
  await page.reload();
  await expect(page.locator(".paper-card").first()).toContainText(
    "合成校对论文题名0",
  );
  await expect(page.locator(".paper-card").first()).toContainText("已人工校对");
  const s = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("paperi.projects.v1")!),
  );
  expect(s.projects[0].workflow.analyses[0].sections[0].body).toContain(
    "历史测试解释",
  );
  expect(s.projects[0].library.items[0].attachment.id).toBe("pdf0");
  expect(s.projects[0].library.items[0].note).toBe("保留笔记0");
  expect(s.projects[1].library).toBeUndefined();
  await page.getByText("导入诊断导出（本地、可选）", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "导出所选文献诊断（不调用 AI）" }),
  ).toBeDisabled();
  await page.locator(".pdf-diagnostics label").first().click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "导出所选文献诊断（不调用 AI）" })
    .click();
  const d = await download;
  const stream = await d.createReadStream();
  let text = "";
  for await (const chunk of stream!) text += chunk.toString();
  expect(JSON.parse(text).records).toHaveLength(1);
  expect(text).not.toContain("private@");
  expect(text).not.toContain("%PDF");
  await page
    .getByRole("button", { name: "编辑资料、分类与笔记" })
    .first()
    .click();
  const original = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 PDF 原文件备份" }).click();
  expect((await original).suggestedFilename()).toBe("测试PDF0.pdf");
});
