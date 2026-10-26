import { test, expect, type Page } from "@playwright/test";
import { emptyWorkflow } from "../src/lib/workflow";
import { mapOpenAlex } from "../src/lib/literature-mapping";
import records from "./fixtures/metadata-records.json";
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
const ris = Array.from(
  { length: 10 },
  (_, i) =>
    `TY  - JOUR\nTI  - 测试品牌联名文献 ${i + 1}\nAU  - 测试作者${i + 1}\nPY  - 2024\nJO  - 测试期刊\nER  -`,
).join("\n");
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
async function importTen(page: Page) {
  await page.goto("/literature");
  await page
    .getByRole("button", { name: "导入文献", exact: true })
    .first()
    .click();
  await page.getByLabel("粘贴多条参考文献").fill(ris);
  await page.getByRole("button", { name: "解析并预览" }).click();
  await expect(page.getByText("导入预览：10 篇可编辑，0 条失败")).toBeVisible();
  await page.getByRole("button", { name: /导入这 \d+ 篇/ }).click();
  await expect(page.locator(".paper-card")).toHaveCount(10);
}
async function snapshot(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);
}
test("十篇批量导入、重复预览默认跳过、项目切换刷新隔离与书目精析限制", async ({
  page,
}) => {
  await load(page);
  await importTen(page);
  await expect(page.getByText("AI 学术联网检索", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "导入文献", exact: true }).click();
  await page.getByLabel("粘贴多条参考文献").fill(ris);
  await page.getByRole("button", { name: "解析并预览" }).click();
  await expect(page.getByLabel("第 1 条导入方式", { exact: true })).toHaveValue(
    "skip",
  );
  await page.getByRole("button", { name: /导入这 \d+ 篇/ }).click();
  await expect(page.locator(".paper-card")).toHaveCount(10);
  await page.getByLabel("当前项目", { exact: true }).selectOption("b");
  await expect(page.locator(".paper-card")).toHaveCount(0);
  await page.getByLabel("当前项目", { exact: true }).selectOption("a");
  await page.reload();
  await expect(page.locator(".paper-card")).toHaveCount(10);
  await page
    .getByRole("button", { name: "文献精析", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "一键精析" }).click();
  await expect(page.locator(".analysis-card")).toHaveCount(10);
  await expect(page.locator(".analysis-card").nth(5)).toContainText("信息不足");
  expect(
    (await snapshot(page)).projects[0].workflow.analyses[0].sourceIds,
  ).toHaveLength(1);
});
test("真实形状引用网络、二级晋升、方向综述设计导出完整路径（AI使用明确模拟响应）", async ({
  page,
}) => {
  await load(page);
  await importTen(page);
  const p = mapOpenAlex(records.openalex, at)!;
  await page.evaluate(
    ({ key, p }) => {
      const s = JSON.parse(localStorage.getItem(key)!);
      s.projects[0].library.items[0].paper = p;
      localStorage.setItem(key, JSON.stringify(s));
    },
    { key, p },
  );
  await page.reload();
  const ref = {
    ...p,
    key: "doi:10.5555/secondary",
    doi: "10.5555/secondary",
    title: "二级测试文献",
    openAlexId: "https://openalex.org/W9999999911",
    recordUrl: "https://api.openalex.org/works/W9999999911",
  };
  await page.route("**/api/literature/graph?**", (r) =>
    r.fulfill({
      json: {
        center: p.key,
        papers: [p, ref],
        edges: [{ from: p.key, to: ref.key, recordUrl: p.recordUrl }],
        notices: ["隔离测试夹具，不代表真实覆盖"],
        retrievedAt: at,
      },
    }),
  );
  await page.getByRole("button", { name: "文献星图", exact: true }).click();
  await expect(page.locator(".canvas-node")).toHaveCount(10);
  await expect(page.locator(".canvas-edge")).toHaveCount(0);
  await page
    .getByRole("button", { name: "按需加载引用（每次最多 3 篇）" })
    .click();
  await expect(page.locator(".canvas-node")).toHaveCount(11);
  await expect(page.locator(".canvas-edge")).toHaveCount(1);
  await page
    .getByRole("button", { name: "二级测试文献", exact: true })
    .press("Enter");
  await page.getByRole("button", { name: "加入当前文献库" }).click();
  await expect(page.locator(".canvas-node")).toHaveCount(11);
  await expect(page.locator(".is-secondary")).toHaveCount(0);
  await page.route("**/api/workflow", (r) => {
    const b = r.request().postDataJSON();
    return r.fulfill({
      json: {
        sections: [
          {
            title: b.task === "review" ? "概念界定" : "测试候选方向",
            body: "测试建议，非真实学术结论",
            evidenceIds: [b.evidence[0].id],
            quote: b.evidence[0].paper.title,
            page: null,
            uncertainty: "测试资料有限",
          },
        ],
      },
    });
  });
  await page.getByRole("button", { name: "研究脉络", exact: true }).click();
  await page.getByRole("button", { name: "一键生成研究方向" }).click();
  await page.getByRole("button", { name: "选择这个研究方向" }).click();
  await page.getByRole("link", { name: "进入文献综述与研究整合" }).click();
  await page.getByRole("button", { name: "生成综述结构候选" }).click();
  await page.getByRole("button", { name: "追加候选，保留已有编辑" }).click();
  await page.getByRole("button", { name: "保存综述编辑" }).click();
  await page
    .getByRole("button", { name: "概念界定", exact: true })
    .first()
    .press("Enter");
  await page.getByLabel("综述节点内容").fill("用户修改的综述结构");
  await page.getByRole("button", { name: "保存综述编辑" }).click();
  await page.getByRole("link", { name: "进入研究设计" }).click();
  await page.getByRole("button", { name: "添加节点" }).click();
  await page.getByLabel("名称", { exact: true }).fill("品牌契合度");
  await page
    .getByLabel("研究内容", { exact: true })
    .fill("自变量，待选择测量依据");
  await page.getByRole("button", { name: "保存研究设计" }).click();
  await page.goto("/proposal");
  await page.getByRole("button", { name: "确认当前研究框架" }).click();
  await expect(
    page.getByText("已确认 · 确认仅代表你的研究计划，不代表结论已证实。", {
      exact: true,
    }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出完整研究框架 Markdown" }).click();
  expect((await download).suggestedFilename()).toBe("Paperi-研究框架.md");
  expect((await snapshot(page)).projects[0].workflow.review[0].body).toBe(
    "用户修改的综述结构",
  );
});
test("删除来源标记失效，保存失败不破坏旧文献，备份恢复为副本", async ({
  page,
}) => {
  await load(page);
  await importTen(page);
  const s = await snapshot(page);
  const id = s.projects[0].library.items[0].id;
  await page.evaluate(
    ({ key, id, f }) => {
      const s = JSON.parse(localStorage.getItem(key)!);
      s.projects[0].workflow = {
        ...f,
        review: [
          {
            id: "n",
            title: "旧综述",
            body: "用户编辑不能丢",
            evidenceIds: [id],
            uncertainty: "待核对",
            x: 0,
            y: 0,
          },
        ],
        reviewFingerprint: "old",
      };
      localStorage.setItem(key, JSON.stringify(s));
    },
    { key, id, f: emptyWorkflow() },
  );
  await page.reload();
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "删除文献", exact: true })
    .first()
    .click();
  await expect(page.locator(".paper-card")).toHaveCount(9);
  await page.goto("/review");
  await page
    .getByRole("button", { name: "旧综述", exact: true })
    .first()
    .press("Enter");
  await expect(
    page.getByText("来源已移除，需要更新", { exact: true }),
  ).toBeVisible();
  await page.goto("/literature");
  await page
    .getByRole("button", { name: "编辑资料、分类与笔记" })
    .first()
    .click();
  await page.getByLabel("阅读笔记").fill("未保存笔记");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "保存文献资料" }).click();
  await expect(page.getByRole("dialog")).toContainText("保存未完成");
  await expect(page.getByLabel("阅读笔记")).toHaveValue("未保存笔记");
  await page.reload();
  await page.goto("/");
  await page.getByText("项目数据备份与恢复", { exact: true }).click();
  await page.getByLabel("选择项目 JSON 备份").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(await snapshot(page))),
  });
  await page.getByRole("button", { name: "确认恢复为独立副本" }).click();
  expect((await snapshot(page)).projects).toHaveLength(4);
});
test("AI失败明确可重试且不覆盖历史，PDF格式错误不会新增假文献", async ({
  page,
}) => {
  await load(page);
  await importTen(page);
  await page.route("**/api/workflow", (r) =>
    r.fulfill({ status: 504, json: { error: "测试：AI 请求超时" } }),
  );
  await page.getByRole("button", { name: "研究脉络", exact: true }).click();
  await page.getByRole("button", { name: "一键生成研究方向" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "测试：AI 请求超时" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "导入文献", exact: true }).click();
  await page.getByLabel("选择题录或 PDF 文件").setInputFiles({
    name: "bad.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("not a PDF"),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "不是有效 PDF" }),
  ).toBeVisible();
  expect((await snapshot(page)).projects[0].library.items).toHaveLength(10);
});
for (const width of [1440, 390])
  test(`工作台、网络、综述和模型可见交互 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await load(page);
    await importTen(page);
    await page.screenshot({
      path: `docs/screenshots/workflow/library-${width}.png`,
      fullPage: true,
        animations: "disabled",
    });
    for (const mode of ["文献星图", "研究脉络", "文献精析"]) {
      await page
        .getByRole("button", { name: mode, exact: true })
        .first()
        .click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `docs/screenshots/workflow/${mode}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
    for (const path of ["review", "canvas"]) {
      await page.goto("/" + path);
      await page
        .getByRole("button", {
          name: path === "review" ? "添加综述节点" : "添加节点",
          exact: true,
        })
        .click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `docs/screenshots/workflow/${path}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  });

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
