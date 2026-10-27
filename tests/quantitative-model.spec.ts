import { test, expect } from "@playwright/test";
import {
  buildQuantitativeModel,
  modelLabelLines,
  type ModelPoint,
  type ModelNode,
} from "../src/lib/quantitative-model";
import type {
  QuantitativeDesign,
  ResearchHypothesis,
} from "../src/lib/research-workspace";
const at = "2026-10-27T00:00:00Z";
const hypothesis = (
  id: string,
  from: string,
  to: string,
): ResearchHypothesis => ({
  id,
  from,
  to,
  kind: "direct",
  text: `明确绘图测试：${from}与${to}的拟检验路径`,
  rationale: "仅验证模型绘制，不是论文结论",
  evidenceIds: [],
  confirmed: true,
});
const fixture = (): QuantitativeDesign => ({
  id: "model-fixture",
  createdAt: at,
  updatedAt: at,
  fingerprint: "fixture",
  directionId: "fixture-direction",
  sourceIds: [],
  confirmed: false,
  question: "明确模拟的模型绘图测试",
  value: "不是实际研究成果",
  evidenceGap: "无真实学术证据",
  method: "",
  target: "",
  sampling: "",
  operationalization: "",
  analysis: "",
  limitations: "",
  variables: [
    { id: "x", name: "反向广告暴露类型", role: "X" },
    { id: "m1", name: "感知独特", role: "M" },
    { id: "m2", name: "感知操纵意图", role: "M" },
    { id: "y", name: "状态逆反", role: "Y" },
    { id: "w", name: "品牌熟悉度", role: "W" },
  ].map((v) => ({
    ...v,
    role: v.role as "X" | "M" | "Y" | "W",
    explanation: "模拟变量",
    rationale: "测试",
    uncertainty: "不是实际学术证据",
    evidenceIds: [],
    confirmed: true,
  })),
  hypotheses: [
    hypothesis("h1", "x", "m1"),
    hypothesis("h2", "m1", "y"),
    hypothesis("h3", "x", "m2"),
    hypothesis("h4", "m2", "y"),
    {
      ...hypothesis("h5", "m1", "y"),
      kind: "moderation",
      moderatorId: "w",
      moderatesId: "h2",
    },
  ],
});
function intersects(a: ModelPoint, b: ModelPoint, n: ModelNode) {
  const left = n.x + 0.01,
    right = n.x + n.width - 0.01,
    top = n.y + 0.01,
    bottom = n.y + n.height - 0.01;
  return a.x === b.x
    ? a.x > left &&
        a.x < right &&
        Math.max(a.y, b.y) > top &&
        Math.min(a.y, b.y) < bottom
    : a.y === b.y &&
        a.y > top &&
        a.y < bottom &&
        Math.max(a.x, b.x) > left &&
        Math.min(a.x, b.x) < right;
}
test("显式双中介四条路径与指定调节关系一一对应，不从角色增补关系", () => {
  const model = buildQuantitativeModel(fixture());
  expect(
    model.edges.map((e) => [
      e.hypothesisId,
      e.kind,
      e.from,
      e.to,
      e.moderatesId,
    ]),
  ).toEqual([
    ["h1", "direct", "x", "m1", undefined],
    ["h2", "direct", "m1", "y", undefined],
    ["h3", "direct", "x", "m2", undefined],
    ["h4", "direct", "m2", "y", undefined],
    ["h5", "moderation", "m1", "y", "h2"],
  ]);
  expect(
    model.edges.filter((e) => e.from === "w" && e.to === "y"),
  ).toHaveLength(0);
  expect(
    model.edges.filter((e) => e.from === "x" && e.to === "y"),
  ).toHaveLength(0);
  expect(model.edges.at(-1)!.points.at(-1)).toEqual(model.edges[1].anchor);
  expect(
    Math.abs(model.edges[1].labelPoint.x - model.edges.at(-1)!.anchor.x),
  ).toBeGreaterThanOrEqual(20);
  expect(model.warnings).toEqual([]);
});
test("五变量模型紧凑，路径和节点均在视图内，双中介与调节路径不穿过其他节点", () => {
  const model = buildQuantitativeModel(fixture());
  expect(model.height).toBeLessThanOrEqual(320);
  for (const node of model.nodes) {
    expect(node.x).toBeGreaterThanOrEqual(0);
    expect(node.y).toBeGreaterThanOrEqual(0);
    expect(node.x + node.width).toBeLessThanOrEqual(model.width);
    expect(node.y + node.height).toBeLessThanOrEqual(model.height);
  }
  for (const edge of model.edges) {
    for (const p of edge.points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(model.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(model.height);
    }
    for (let i = 1; i < edge.points.length; i++)
      for (const node of model.nodes) {
        if ([edge.from, edge.to, edge.hypothesis.moderatorId].includes(node.id))
          continue;
        expect(
          intersects(edge.points[i - 1], edge.points[i], node),
          `${edge.hypothesisId}不能穿过${node.id}`,
        ).toBe(false);
      }
  }
});
test("只有变量不产生任何路径，无效端点或调节目标明确报待核对", () => {
  const design = fixture();
  design.hypotheses = [];
  expect(buildQuantitativeModel(design).edges).toEqual([]);
  design.hypotheses = [
    hypothesis("bad", "x", "missing"),
    {
      ...hypothesis("mod", "x", "y"),
      kind: "moderation",
      moderatorId: "w",
      moderatesId: "missing",
    },
  ];
  const model = buildQuantitativeModel(design);
  expect(model.edges).toEqual([]);
  expect(model.warnings).toHaveLength(2);
});
test("改名与角色变动只更新节点，端点及删除按实际假设刷新，不留残线", () => {
  const design = fixture();
  design.variables[0] = {
    ...design.variables[0],
    name: "用户修改的长变量名称及其全部含义不能被藏起来",
    role: "control",
  };
  design.hypotheses[0] = { ...design.hypotheses[0], to: "m2" };
  design.hypotheses = design.hypotheses.filter((h) => h.id !== "h3");
  const model = buildQuantitativeModel(design);
  expect(model.nodes.find((n) => n.id === "x")!.variable.name).toContain(
    "全部含义",
  );
  expect(model.edges.find((e) => e.hypothesisId === "h1")!.to).toBe("m2");
  expect(model.edges.some((e) => e.hypothesisId === "h3")).toBe(false);
  expect(modelLabelLines(design.variables[0].name)).toHaveLength(2);
});
test("旧版复合调节标记只读保留并明确待核对，不变成新的已确认直接效应", () => {
  const design = fixture();
  design.hypotheses = [
    { ...hypothesis("legacy", "x", "y"), kind: undefined, moderatorId: "w" },
  ];
  const model = buildQuantitativeModel(design);
  expect(model.edges).toHaveLength(1);
  expect(model.edges[0].legacy).toBe(true);
  expect(model.edges[0].confirmed).toBe(false);
  expect(model.edges[0].moderation).toBeDefined();
  expect(model.warnings.join(" ")).toContain("旧版关系与调节标记");
});
