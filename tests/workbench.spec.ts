import { test, expect, type Page } from "@playwright/test";
import {
  emptyWorkbench,
  isWorkbench,
  exportDesign,
} from "../src/lib/workbench";
import { emptyExploration } from "../src/lib/exploration";
import { emptyNavigation } from "../src/lib/research-navigation";
import { emptyLibrary } from "../src/lib/literature";
import { mapOpenAlex } from "../src/lib/literature-mapping";
import type { Project } from "../src/lib/projects";
import records from "./fixtures/metadata-records.json";
const at = "2026-10-22T06:00:00Z",
  key = "paperi.projects.v1";
const paper = mapOpenAlex(records.openalex, at)!;
function project(id = "a"): Project {
  return {
    id,
    name: id === "a" ? "AI 推荐与消费者信任" : "反向营销与心理逆反",
    observation:
      id === "a"
        ? "品牌通过 GEO 影响 AI 推荐，消费者如何识别商业意图"
        : "品牌劝别人不要购买，反而更想买",
    discipline: "广告传播",
    status: "starting",
    createdAt: at,
    updatedAt: at,
    exploration: {
      ...emptyExploration(),
      navigation: {
        ...emptyNavigation(),
        concepts: [
          {
            id: "c-" + id,
            term: id === "a" ? "说服知识" : "心理逆反",
            explanation: "待核实概念解释",
            everyday: "",
            uncertainty: "需查文献",
            status: "selected",
            origin: "user",
          },
        ],
      },
    },
    library: {
      ...emptyLibrary(),
      items: [
        {
          id: "source-" + id,
          paper,
          categoryIds: ["reading"],
          note: "旧版笔记-" + id,
          savedAt: at,
          updatedAt: at,
        },
      ],
    },
  };
}
async function load(page: Page, projects = [project()]) {
  await page.goto("/");
  await page.evaluate(
    ({ projects, key }) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          revision: 0,
          activeId: projects[0].id,
          projects,
        }),
      ),
    { projects, key },
  );
  await page.reload();
}
const design = {
  path: "qualitative",
  nodes: [
    {
      id: "n1",
      kind: "研究问题",
      title: "如何识别推荐中的商业影响？",
      body: "比较不同推荐情境的受众解释",
      x: 40,
      y: 40,
      status: "suggested",
      evidenceIds: ["source-a"],
      uncertainty: "尚无完整原文，不能称为空白",
    },
    {
      id: "n2",
      kind: "访谈方案",
      title: "半结构访谈",
      body: "围绕推荐信任与识别过程访谈",
      x: 340,
      y: 220,
      status: "suggested",
      evidenceIds: [],
      uncertainty: "需试访谈与伦理同意",
    },
  ],
  edges: [{ id: "e1", from: "n1", to: "n2", label: "资料收集规划" }],
};
async function mockAI(page: Page) {
  await page.route("**/api/lab", (r) =>
    r.fulfill({ json: { configured: true, message: "测试专用" } }),
  );
  await page.route("**/api/research", (r) => {
    const b = r.request().postDataJSON();
    return r.fulfill({
      json:
        b.task === "design"
          ? { design: { ...design, path: b.path } }
          : b.task === "context"
            ? {
                threads: [
                  {
                    title: "商业意图识别",
                    kind: "主题",
                    body: "仅测试来源归纳",
                    evidenceIds: ["source-a"],
                    uncertainty: "未读全文",
                  },
                ],
              }
            : b.task === "assess"
              ? {
                  assessments: b.context.evidence.map(
                    (e: { id: string; paper: { title: string } }) => ({
                      id: e.id,
                      level: e.paper.title.includes("Mechanical")
                        ? "unrelated"
                        : "direct",
                      reason: "主题匹配测试",
                      basis: e.paper.title,
                      use: "概念定义",
                      limitation: "仅测试摘要",
                    }),
                  ),
                }
              : {
                  zh: ["说服知识 商业意图"],
                  en: [
                    "persuasion knowledge advertising",
                    "algorithmic trust consumer",
                  ],
                },
    });
  });
}

test("V1.1无工作台记录直接读取；新增设计校验并保留来源导出", () => {
  const p = project();
  expect(isWorkbench(emptyWorkbench())).toBe(true);
  expect(isWorkbench({ ...emptyWorkbench(), design })).toBe(true);
  expect(
    isWorkbench({
      ...emptyWorkbench(),
      design: {
        ...design,
        edges: [{ id: "x", from: "missing", to: "n1", label: "错误" }],
      },
    }),
  ).toBe(false);
  p.workbench = {
    ...emptyWorkbench(),
    design: design as NonNullable<Project["workbench"]>["design"],
  };
  expect(exportDesign(p)).toContain(paper.recordUrl);
  expect(exportDesign(p)).toContain("尚无完整原文");
});

test("项目A带入词不串到B，手动输入不被异步建议覆盖，刷新恢复各自历史", async ({
  page,
}) => {
  await mockAI(page);
  const a=project();a.workbench={...emptyWorkbench(),search:{input:"saved AI trust",origin:"history",fingerprint:"",keywords:{zh:[],en:[]},history:["saved AI trust"]}};await load(page, [a, project("b")]);
  await page.goto("/literature?project=a&query=algorithmic%20trust");
  await expect(page.getByLabel("文献关键词或 DOI")).toHaveValue(
    "algorithmic trust",
  );
  await page.getByLabel("当前项目", { exact: true }).selectOption("b");
  await expect(page.getByLabel("文献关键词或 DOI")).toHaveValue("心理逆反");
  await page.getByRole("button", { name: "生成中英文检索词" }).click();
  await page.getByLabel("文献关键词或 DOI").fill("手动编辑后不能覆盖");
  await expect(page.locator(".keyword-suggestions")).toBeAttached();
  await expect(page.getByLabel("文献关键词或 DOI")).toHaveValue(
    "手动编辑后不能覆盖",
  );
  await page.getByLabel("当前项目", { exact: true }).selectOption("a");
  await expect(page.getByLabel("文献关键词或 DOI")).toHaveValue(
    "saved AI trust",
  );
});

test("Crossref自动关闭不兼容筛选；机械工程同词记录归入不推荐且不进入直接结果", async ({
  page,
}) => {
  await mockAI(page);
  await load(page);
  await page.route("**/api/literature?**", (r) =>
    r.fulfill({
      json: {
        query: "fixture",
        provider: "crossref",
        items: [
          paper,
          {
            ...paper,
            key: "doi:10.5555/mechanical",
            doi: "10.5555/mechanical",
            title: "Mechanical reverse manufacturing",
              openAlexId: null,
            source: "crossref",
            recordUrl: "https://api.crossref.org/works/10.5555%2Fmechanical",
          },
        ],
        total: 2,
        page: 1,
        pageSize: 10,
        notices: [],
        cached: false,
        hasMore: false,
      },
    }),
  );
  await page.goto("/literature");
  await page.getByText("高级筛选", { exact: true }).click();
  await page.getByLabel("仅 CWTS 核心来源").check();
  await page.getByLabel("数据源", { exact: true }).selectOption("crossref");
  await expect(page.getByLabel("仅 CWTS 核心来源")).not.toBeChecked();
  await expect(page.getByLabel("仅 CWTS 核心来源")).toBeDisabled();
  await expect(
    page.getByText("Crossref 不支持该来源筛选，已为你关闭。"),
  ).toBeVisible();
  await page.getByLabel("数据源", { exact: true }).selectOption("openalex");
  await expect(page.getByLabel("仅 CWTS 核心来源")).not.toBeChecked();
  await page
    .getByLabel("文献关键词或 DOI")
    .fill("psychological reactance advertising");
  await page.getByRole("button", { name: "检索", exact: true }).click();
  await expect(page.locator(".assessment-direct")).toHaveCount(1);
  await expect(page.locator(".paper-card")).toHaveCount(1);
  await page.getByRole("button", { name: "查看低相关 / 信息不足记录" }).click();
  await expect(page.locator(".paper-card")).toHaveCount(2);
  await expect(page.locator(".paper-card").last()).toContainText("不推荐");
});

test("真实引用适配器只绘制可核对的边并拒绝任意外部地址", async ({
  request,
}) => {
  const r = await request.get(
    "http://127.0.0.1:3103/api/literature/graph?id=" +
      encodeURIComponent(paper.openAlexId!),
  );
  expect(r.status()).toBe(200);
  const g = await r.json();
  expect(g.papers).toHaveLength(3);
  expect(g.edges).toHaveLength(2);
  expect(g.edges[0].from).toBe(paper.key);
  expect(g.edges[1].to).toBe(paper.key);
  expect(
    g.edges.every((e: { recordUrl: string }) =>
      e.recordUrl.startsWith("https://api.openalex.org/works/W"),
    ),
  ).toBe(true);
  expect(
    (
      await request.get(
        "http://127.0.0.1:3103/api/literature/graph?id=https://example.com/private",
      )
    ).status(),
  ).toBe(400);
});

test("研究辅助接口严格校验来源，实际HTTP适配关键词、相关性、脉络与设计", async ({
  playwright,
}) => {
  const request = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3103",
    extraHTTPHeaders: { Origin: "http://127.0.0.1:3103" },
  });
  const context = {
    observation: "测试观察",
    question: "",
    concepts: ["说服知识"],
    messages: [],
    evidence: [{ id: "source-a", paper }],
  };
  try {
    for (const task of ["keywords", "assess", "context", "design"]) {
      const r = await request.post("/api/research", {
        data: { task, context, path: "qualitative" },
      });
      expect(r.status()).toBe(200);
      const d = await r.json();
      if (task === "design") {
        expect(d.design.path).toBe("qualitative");
        expect(d.design.nodes[0].status).toBe("suggested");
      }
      if (task === "assess") expect(d.assessments[0].id).toBe("source-a");
    }
    const forged = await request.post("/api/research", {
      data: { task: "assess", context, query: "FORGED" },
    });
    expect(forged.status()).toBe(502);
    expect(
      (
        await request.post("/api/research", {
          data: { task: "context", context: { ...context, evidence: [] } },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.post("/api/research", {
          headers: { Origin: "https://evil.invalid" },
          data: { task: "design", context },
        })
      ).status(),
    ).toBe(403);
  } finally {
    await request.dispose();
  }
});

test("星图拖动缩放重置、来源详情、切换中心与加入设计真实共享", async ({
  page,
}) => {
  await load(page);
  await page.route("**/api/literature/graph?**", (r) =>
    r.fulfill({
      json: {
        center: paper.key,
        papers: [paper],
        edges: [],
        notices: ["真实接口形状的隔离夹具"],
        retrievedAt: at,
      },
    }),
  );
  await page.goto("/map");
  await page.getByLabel("选择中心文献").selectOption(paper.openAlexId!);
  await page.getByRole("button", { name: "展开真实引用" }).click();
  const n = page.getByRole("button", { name: paper.title, exact: true });
  await expect(n).toBeVisible();
  await n.focus();
  await page.keyboard.press("ArrowRight");
  await expect(n).toHaveAttribute("transform", /355/);
  await page.getByRole("button", { name: "放大画布" }).click();
  await expect(page.locator(".canvas-controls")).toContainText("120%");
  await page.getByRole("button", { name: "重置视图" }).click();
  await expect(page.locator(".canvas-controls")).toContainText("100%");
  await n.press("Enter");
  await expect(page.locator(".graph-detail")).toContainText(paper.title);
  await page.getByRole("button", { name: "加入研究设计", exact: true }).click();
  await page.goto("/canvas");
  await expect(
    page.getByRole("button", { name: paper.title.slice(0, 160), exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".canvas-node")).toHaveCount(1);
});

test("共享文献选择直接分析脉络、来源一键进入设计，旧笔记保持", async ({
  page,
}) => {
  await mockAI(page);
  await load(page);
  await page.goto("/literature");
  await page.getByRole("tab", { name: /我的文献库/ }).click();
  await page.locator(".shared-evidence>summary").click();
  await page.locator(".evidence-picker input").check();
  await page.getByRole("link", { name: "分析这些文献的研究脉络" }).click();
  await page.getByRole("button", { name: "分析这些文献的研究脉络" }).click();
  await expect(page.locator(".thread-grid")).toContainText("商业意图识别");
  await page.getByRole("button", { name: "线索与来源加入设计" }).click();
  await page.goto("/canvas");
  await expect(page.locator(".canvas-node")).toHaveCount(1);
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    key,
  );
  expect(saved.projects[0].library.items[0].note).toBe("旧版笔记-a");
  expect(saved.projects[0].workbench.designSources[0].recordUrl).toBe(
    paper.recordUrl,
  );
});

test("质化AI草案可拒绝、采纳、编辑、确认、增删关系、保存刷新、导出；跨项目不混入设计", async ({
  page,
}) => {
  await mockAI(page);
  await load(page, [project(), project("b")]);
  await page.goto("/canvas");
  await page.getByLabel("研究路径").selectOption("qualitative");
  await page.getByRole("button", { name: "AI 辅助生成草案" }).click();
  await expect(page.locator(".design-suggestions")).toBeVisible();
  await page.getByRole("button", { name: "拒绝本次草案" }).click();
  await expect(page.locator(".canvas-node")).toHaveCount(0);
  await page.getByRole("button", { name: "AI 辅助生成草案" }).click();
  await page.getByRole("button", { name: "加入画布并继续编辑" }).click();
  await page
    .getByLabel("研究内容", { exact: true })
    .fill("由用户修改的访谈研究问题");
  await page.getByLabel("确认状态").selectOption("confirmed");
  await page.getByRole("button", { name: "保存研究设计" }).click();
  await expect(page.getByText("有未保存修改", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".canvas-node")).toHaveCount(2);
  await page
    .getByRole("button", { name: "如何识别推荐中的商业影响？", exact: true })
    .click();
  await expect(page.getByLabel("研究内容", { exact: true })).toHaveValue(
    "由用户修改的访谈研究问题",
  );
  await expect(page.getByLabel("确认状态")).toHaveValue("confirmed");
  await page.getByRole("button", { name: "添加节点" }).click();
  await page.getByLabel("名称", { exact: true }).fill("人工方法节点");
  await page.getByText("编辑关系 · 1", { exact: true }).click();
  await page
    .getByLabel("起点", { exact: true })
    .selectOption({ label: "半结构访谈" });
  await page
    .getByLabel("终点", { exact: true })
    .selectOption({ label: "人工方法节点" });
  await page.getByRole("button", { name: "添加关系", exact: true }).click();
  await expect(page.locator(".canvas-edge")).toHaveCount(2);
  await page.getByRole("button", { name: "保存研究设计" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 Markdown" }).click();
  expect((await download).suggestedFilename()).toBe("Paperi-研究设计.md");
  await page.getByLabel("当前项目", { exact: true }).selectOption("b");
  await expect(page.locator(".canvas-node")).toHaveCount(0);
  await page.getByLabel("当前项目", { exact: true }).selectOption("a");
  await expect(page.locator(".canvas-node")).toHaveCount(3);
  await page.reload();
  await expect(page.locator(".canvas-node")).toHaveCount(3);
});

test("研究画布保存失败保留本地编辑，不显示假保存；标签页冲突拒绝覆盖", async ({
  page,
  context,
}) => {
  await load(page);
  await page.goto("/canvas");
  await page.getByRole("button", { name: "添加节点" }).click();
  await page.getByLabel("名称", { exact: true }).fill("必须保留的编辑");
  const other = await context.newPage();
  await other.goto("/canvas");
  await other.getByRole("button", { name: "添加节点" }).click();
  await other.getByLabel("名称", { exact: true }).fill("另一个页面已保存");
  await other.getByRole("button", { name: "保存研究设计" }).click();
  await page.getByRole("button", { name: "保存研究设计" }).click();
  await expect(page.locator(".literature-error")).toContainText("尚未保存");
  await expect(page.getByLabel("名称", { exact: true })).toHaveValue(
    "必须保留的编辑",
  );
  expect(
    await page.evaluate(
      (key) =>
        JSON.parse(localStorage.getItem(key)!).projects[0].workbench.design
          .nodes[0].title,
      key,
    ),
  ).toBe("另一个页面已保存");
});

for (const size of [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
])
  test(`核心输入与交互画布可见无横向溢出 ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    await load(page);
    for (const path of ["lab", "literature", "map", "canvas", "proposal"]) {
      await page.goto("/" + path);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (size.width > 900) {
        const locator =
          path === "lab"
            ? page.getByLabel("给 AI 的消息")
            : path === "literature"
              ? page.getByLabel("文献关键词或 DOI")
              : path === "canvas"
                ? page.getByRole("button", { name: "添加节点" })
                : null;
        if (locator) await expect(locator).toBeInViewport();
      }
    }
  });

test('未编辑的旧设计页也不能覆盖其他标签的新设计',async({page,context})=>{
 await load(page);await page.goto('/canvas');const other=await context.newPage();await other.goto('/canvas');await other.getByRole('button',{name:'添加节点'}).click();await other.getByLabel('名称',{exact:true}).fill('另一个页面的新设计');await other.getByRole('button',{name:'保存研究设计'}).click();await expect(page.getByRole('button',{name:'读取已保存版本'})).toBeVisible();await page.getByRole('button',{name:'添加节点'}).click();await expect(page.getByRole('alert').filter({hasText:'先读取已保存版本'})).toBeVisible();expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).projects[0].workbench.design.nodes[0].title,key)).toBe('另一个页面的新设计');
});

test('两组独立查询交替取样，第二组文献不被第一组填满挤掉',async({page})=>{
 await mockAI(page);await load(page);const queries:string[]=[];await page.route('**/api/literature?**',r=>{const q=new URL(r.request().url()).searchParams.get('query')!;queries.push(q);const prefix=q.startsWith('persuasion')?'first':'second';return r.fulfill({json:{query:q,provider:'crossref',items:Array.from({length:10},(_,i)=>({...paper,title:`${prefix} fixture ${i}`,openAlexId:null,key:`doi:10.5555/${prefix}-${i}`,doi:`10.5555/${prefix}-${i}`,source:'crossref',recordUrl:`https://api.crossref.org/works/10.5555%2F${prefix}-${i}`})),total:10,page:1,pageSize:10,notices:[],cached:false,hasMore:false}});});await page.goto('/literature');await page.getByRole('button',{name:'生成中英文检索词'}).click();await page.locator('.keyword-suggestions>summary').click();await page.getByRole('button',{name:'分别检索前两组并去重'}).click();await expect(page.locator('.assessment-direct')).toHaveCount(10);expect(queries).toEqual(['persuasion knowledge advertising','algorithmic trust consumer']);await expect(page.locator('.paper-card').nth(1)).toContainText('second fixture 0');
});
