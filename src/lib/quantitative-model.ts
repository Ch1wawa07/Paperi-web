import {
  hypothesisTarget,
  isModerationHypothesis,
  type QuantitativeDesign,
  type ResearchHypothesis,
  type ResearchVariable,
} from "./research-workspace";

export type ModelPoint = { x: number; y: number };
export type ModelNode = ModelPoint & {
  id: string;
  width: number;
  height: number;
  variable: ResearchVariable;
  column: number;
};
export type ModelTrace = {
  path: string;
  points: ModelPoint[];
  anchor: ModelPoint;
  labelPoint: ModelPoint;
};
export type ModelEdge = ModelTrace & {
  hypothesisId: string;
  from: string;
  to: string;
  kind: "direct" | "moderation";
  moderatesId?: string;
  label: string;
  confirmed: boolean;
  legacy: boolean;
  hypothesis: ResearchHypothesis;
  moderation?: ModelTrace;
};
export type QuantitativeModelLayout = {
  width: number;
  height: number;
  nodes: ModelNode[];
  edges: ModelEdge[];
  warnings: string[];
};
const WIDTH = 760,
  NODE_WIDTH = 156,
  NODE_HEIGHT = 64;
const columnX = [20, 302, 584];
const roleColumn: Record<ResearchVariable["role"], number> = {
  X: 0,
  control: 0,
  M: 1,
  W: 1,
  Y: 2,
};
const point = (x: number, y: number): ModelPoint => ({ x, y });
const round = (n: number) => Math.round(n * 10) / 10;

/** Rounded orthogonal paths stay in the gutters between nodes, rather than crossing a mediator. */
function roundedPath(input: ModelPoint[]) {
  const points = input.filter(
    (p, i) => !i || p.x !== input[i - 1].x || p.y !== input[i - 1].y,
  );
  if (points.length < 2) return "";
  let path = `M${round(points[0].x)},${round(points[0].y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const previous = points[i - 1],
      current = points[i],
      next = points[i + 1];
    const before = Math.hypot(current.x - previous.x, current.y - previous.y);
    const after = Math.hypot(next.x - current.x, next.y - current.y);
    const radius = Math.min(10, before / 2, after / 2);
    if (!before || !after) continue;
    const a = point(
      current.x + ((previous.x - current.x) / before) * radius,
      current.y + ((previous.y - current.y) / before) * radius,
    );
    const b = point(
      current.x + ((next.x - current.x) / after) * radius,
      current.y + ((next.y - current.y) / after) * radius,
    );
    path += ` L${round(a.x)},${round(a.y)} Q${round(current.x)},${round(current.y)} ${round(b.x)},${round(b.y)}`;
  }
  const last = points.at(-1)!;
  return `${path} L${round(last.x)},${round(last.y)}`;
}
const offset = (index: number, count: number) =>
  count < 2
    ? 0
    : ((index / (count - 1)) * 2 - 1) * Math.min(22, 6 * (count - 1));

/** Roles affect placement only. Every trace below requires an explicit, valid hypothesis. */
export function buildQuantitativeModel(
  design: QuantitativeDesign,
): QuantitativeModelLayout {
  const warnings: string[] = [],
    duplicates = new Set<string>();
  const seen = new Set<string>();
  const variables = design.variables.filter((v) => {
    if (seen.has(v.id)) {
      duplicates.add(v.id);
      warnings.push(`变量「${v.name}」的标识重复，相关关系需要核对。`);
      return false;
    }
    seen.add(v.id);
    return true;
  });
  const main = variables.filter((v) => v.role !== "W"),
    moderators = variables.filter((v) => v.role === "W");
  const columns = [0, 1, 2].map((col) =>
    main.filter((v) => roleColumn[v.role] === col),
  );
  const rows = Math.max(1, ...columns.map((col) => col.length));
  const moderatorRows = moderators.length;
  const top = moderatorRows ? moderatorRows * 64 + 14 : 20;
  const mainBottom = top + (rows - 1) * 96 + NODE_HEIGHT;
  const nodes: ModelNode[] = columns.flatMap((col, column) =>
    col.map((variable, i) => ({
      id: variable.id,
      x: columnX[column],
      y: top + ((rows - col.length) / 2 + i) * 96,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      variable,
      column,
    })),
  );
  for (const [index, variable] of moderators.entries()) {
    nodes.push({
      id: variable.id,
      x: 302,
      y: 6 + index * 64,
      width: NODE_WIDTH,
      height: 54,
      variable,
      column: 1,
    });
  }
  const positions = new Map(nodes.map((n) => [n.id, n]));
  const hypothesisCounts = new Map<string, number>();
  design.hypotheses.forEach((h) =>
    hypothesisCounts.set(h.id, (hypothesisCounts.get(h.id) ?? 0) + 1),
  );
  const candidates = design.hypotheses.filter((h) => {
    if (hypothesisCounts.get(h.id)! > 1) {
      warnings.push("假设标识重复，未绘制无法唯一对应的关系。");
      return false;
    }
    if (
      !positions.has(h.from) ||
      !positions.has(h.to) ||
      h.from === h.to ||
      duplicates.has(h.from) ||
      duplicates.has(h.to)
    ) {
      warnings.push(`假设「${h.text || h.id}」的起点或终点无效，未补画关系。`);
      return false;
    }
    return true;
  });
  const direct = candidates.filter((h) => !isModerationHypothesis(h));
  const indexOf = (h: ResearchHypothesis) =>
    design.hypotheses.findIndex((item) => item.id === h.id);
  const siblings = (h: ResearchHypothesis, end: "from" | "to") =>
    direct.filter((item) => item[end] === h[end]);
  const portOffset = (h: ResearchHypothesis, end: "from" | "to") => {
    const group = siblings(h, end);
    return offset(group.indexOf(h), group.length);
  };
  const gapLane = (gap: number, h: ResearchHypothesis) => {
    const group = direct.filter((item) => {
      const a = positions.get(item.from)!,
        b = positions.get(item.to)!;
      return (
        Math.min(a.column, b.column) <= gap &&
        Math.max(a.column, b.column) > gap
      );
    });
    return (gap ? 521 : 239) + offset(group.indexOf(h), group.length);
  };
  let outerCount = 0;
  const edges: ModelEdge[] = [];
  for (const h of direct) {
    const a = positions.get(h.from)!,
      b = positions.get(h.to)!;
    const forward = b.column > a.column;
    const same = a.column === b.column;
    const sx = same || forward ? a.x + a.width : a.x;
    const tx = same ? b.x + b.width : forward ? b.x : b.x + b.width;
    const sy = a.y + a.height / 2 + portOffset(h, "from"),
      ty = b.y + b.height / 2 + portOffset(h, "to");
    let points: ModelPoint[], anchor: ModelPoint, labelPoint: ModelPoint;
    if (Math.abs(a.column - b.column) === 2) {
      const left = gapLane(0, h),
        right = gapLane(1, h),
        lane = mainBottom + 26 + outerCount++ * 16;
      const first = forward ? left : right,
        last = forward ? right : left;
      points = [
        point(sx, sy),
        point(first, sy),
        point(first, lane),
        point(last, lane),
        point(last, ty),
        point(tx, ty),
      ];
      anchor = point((sx + first) / 2, sy);
      labelPoint = point((first + last) / 2, lane - 9);
    } else if (same) {
      const gutter =
        a.column === 2
          ? WIDTH - 7
          : columnX[a.column] + NODE_WIDTH + 35 + (indexOf(h) % 3) * 12;
      points = [
        point(sx, sy),
        point(gutter, sy),
        point(gutter, ty),
        point(tx, ty),
      ];
      anchor = point(gutter, (sy + ty) / 2);
      labelPoint = point(gutter - 5, (sy + ty) / 2 - 9);
    } else {
      const bridge = gapLane(Math.min(a.column, b.column), h);
      points = [
        point(sx, sy),
        point(bridge, sy),
        point(bridge, ty),
        point(tx, ty),
      ];
      anchor = point(bridge, (sy + ty) / 2);
      labelPoint = point(bridge, (sy + ty) / 2 - 10);
    }
    const legacy = !!h.moderatorId;
    const hasModeration =
      legacy || candidates.some((candidate) => candidate.moderatesId === h.id);
    if (hasModeration && Math.abs(a.column - b.column) === 1) {
      labelPoint = point((points[0].x + points[1].x) / 2, points[0].y - 12);
    }
    edges.push({
      hypothesisId: h.id,
      from: h.from,
      to: h.to,
      kind: "direct",
      label: `H${indexOf(h) + 1}`,
      confirmed: h.confirmed && !legacy,
      legacy,
      hypothesis: h,
      points,
      path: roundedPath(points),
      anchor,
      labelPoint,
    });
  }
  function moderationTrace(
    variableId: string,
    target: ModelEdge,
  ): ModelTrace | null {
    const w = positions.get(variableId);
    if (!w || duplicates.has(variableId)) return null;
    const anchor = target.anchor;
    // Select a side port facing the target gutter; never draw W as a direct effect on the outcome.
    const targetRight = anchor.x >= w.x + w.width / 2;
    const sx = targetRight ? w.x + w.width : w.x;
    const sy = w.y + w.height / 2;
    const points = [point(sx, sy), point(anchor.x, sy), anchor];
    return {
      points,
      path: roundedPath(points),
      anchor,
      labelPoint: point((sx + anchor.x) / 2, sy - 10),
    };
  }
  for (const edge of edges)
    if (edge.legacy) {
      edge.moderation =
        moderationTrace(edge.hypothesis.moderatorId!, edge) ?? undefined;
      warnings.push(
        `${edge.label} 是旧版关系与调节标记，需核对其直接关系和调节依据。`,
      );
      if (!edge.moderation)
        warnings.push(`${edge.label} 的调节变量无效，未补画调节标记。`);
    }
  for (const h of candidates.filter(isModerationHypothesis)) {
    const target = hypothesisTarget(design, h);
    const targetEdge =
      target && edges.find((edge) => edge.hypothesisId === target.id);
    const trace =
      targetEdge && h.moderatorId
        ? moderationTrace(h.moderatorId, targetEdge)
        : null;
    if (!trace || !targetEdge) {
      warnings.push(
        `H${indexOf(h) + 1} 缺少有效的被调节路径或调节变量，未补画关系。`,
      );
      continue;
    }
    // A moderation arrow ends on the target trace; place that trace's number beside it.
    // This changes the label only, preserving the exact hypothesis geometry and target.
    if (Math.abs(targetEdge.labelPoint.x - trace.anchor.x) < 14) {
      const gap = trace.anchor.x < WIDTH / 2 ? 0 : 1;
      const leftSpace = trace.anchor.x - (columnX[gap] + NODE_WIDTH);
      const rightSpace = columnX[gap + 1] - trace.anchor.x;
      const shift = targetEdge.confirmed ? 20 : 28;
      targetEdge.labelPoint = {
        ...targetEdge.labelPoint,
        x: targetEdge.labelPoint.x + (rightSpace >= leftSpace ? shift : -shift),
      };
    }
    edges.push({
      ...trace,
      hypothesisId: h.id,
      from: h.from,
      to: h.to,
      kind: "moderation",
      moderatesId: targetEdge.hypothesisId,
      label: `H${indexOf(h) + 1}`,
      confirmed: h.confirmed,
      legacy: false,
      hypothesis: h,
    });
  }
  const height = Math.max(
    164,
    mainBottom + (outerCount ? 48 + (outerCount - 1) * 16 : 20),
  );
  return {
    width: WIDTH,
    height,
    nodes,
    edges,
    warnings: [...new Set(warnings)],
  };
}

/** Wrap labels without hiding the full original name from the accessible title/editor. */
export function modelLabelLines(name: string, maxUnits = 12, maxLines = 2) {
  const lines: string[] = [];
  let line = "",
    width = 0;
  for (const char of name) {
    const units = /[\x00-\x7F]/.test(char) ? 0.55 : 1;
    if (width + units > maxUnits && line) {
      lines.push(line);
      line = "";
      width = 0;
    }
    line += char;
    width += units;
  }
  if (line || !lines.length) lines.push(line);
  return lines.length > maxLines
    ? [...lines.slice(0, maxLines - 1), `${lines[maxLines - 1]}…`]
    : lines;
}
