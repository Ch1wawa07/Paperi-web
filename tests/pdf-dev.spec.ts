import { test, expect } from "@playwright/test";
test("Mac常用的Next开发模式：StrictMode重挂载后PDF完成预览并可确认导入", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "新建项目", exact: true }).click();
  await page.getByLabel("项目名称").fill("开发模式PDF回归");
  await page.getByRole("button", { name: "创建项目", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/literature");
  await expect(
    page.getByRole("heading", { name: "把找到的论文，带进研究里。" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "已导入文献", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("选择题录或 PDF 文件")
    .setInputFiles("tests/fixtures/workflow/readable.pdf");
  await expect(page.getByText("导入预览：1 篇可编辑，0 条失败")).toBeVisible({
    timeout: 30000,
  });
  await expect(
    page.getByRole("button", { name: "取消读取", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "确认批量导入当前项目" }).click();
  await expect(page.locator(".paper-card")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "已导入文献", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
