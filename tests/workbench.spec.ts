import { test, expect } from "@playwright/test";
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
const at = "2026-10-22T06:00:00Z";
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

