"use client";
import { useId } from "react";
import {
  hypothesisPathText,
  type QuantitativeDesign,
  type ResearchVariable,
} from "@/lib/research-workspace";
import {
  buildQuantitativeModel,
  modelLabelLines,
} from "@/lib/quantitative-model";
import "@/app/quantitative-model.css";
const roles: Record<ResearchVariable["role"], string> = {
  X: "自变量 X",
  Y: "因变量 Y",
  M: "中介候选 M",
  W: "调节候选 W",
  control: "控制变量",
};

export function QuantitativeModel({
  design,
  onVariable,
  onHypothesis,
  onCreateHypotheses,
}: {
  design: QuantitativeDesign;
  onVariable: (id: string) => void;
  onHypothesis: (id: string) => void;
  onCreateHypotheses?: () => void;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const model = buildQuantitativeModel(design);
  return (
    <figure className="rd-model-wrap rd-compact-model">
      <figcaption>
        拟检验研究模型{" "}
        <small>
          {model.nodes.length} 个变量 · {design.hypotheses.length}{" "}
          条假设；点击节点或编号查看、编辑依据。方向不代表因果已证实。
        </small>
      </figcaption>
      {!design.hypotheses.length && (
        <div className="rd-model-empty" role="status">
          <p>当前只有变量，尚未确认变量间的假设关系，因此不显示连线。</p>
          {onCreateHypotheses && (
            <button className="button secondary" onClick={onCreateHypotheses}>
              梳理变量间的假设关系
            </button>
          )}
        </div>
      )}
      {!!model.warnings.length && (
        <details className="rd-model-warnings">
          <summary>有 {model.warnings.length} 项关系需要核对</summary>
          <ul>
            {model.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="rd-model-legend" id={`${id}legend`}>
        <span>实线：用户已确认的拟检验关系</span>
        <span>虚线：候选关系</span>
        <span>紫色指向连线：调节指定路径</span>
      </div>
      <p className="rd-model-mobile-hint">
        模型可左右滚动查看全部变量与路径；点击编号可核对假设。
      </p>
      <div
        className="rd-model-scroll"
        role="region"
        tabIndex={0}
        aria-label="研究模型，可左右滚动查看"
        aria-describedby={`${id}legend`}
      >
        <svg
          className="rd-model"
          role="img"
          aria-label="根据变量和假设同步更新的拟检验研究模型"
          viewBox={`0 0 ${model.width} ${model.height}`}
          style={{ minWidth: 680, height: model.height }}
        >
          <defs>
            <marker
              id={`${id}arrow`}
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0 0L8 4L0 8z" fill="#4c677e" />
            </marker>
            <marker
              id={`${id}moderation`}
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0 0L8 4L0 8z" fill="#88629b" />
            </marker>
          </defs>
          {model.edges.map((edge) => (
            <g
              key={edge.hypothesisId}
              data-hypothesis-id={edge.hypothesisId}
              data-from={edge.from}
              data-to={edge.to}
              data-kind={edge.kind}
              data-moderates-id={edge.moderatesId}
              data-moderator-id={edge.hypothesis.moderatorId}
              data-legacy={edge.legacy || undefined}
              className={`rd-model-edge ${edge.confirmed ? "confirmed" : "candidate"} ${edge.kind === "moderation" ? "rd-model-moderation" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`编辑假设 ${edge.label}：${edge.hypothesis.text}`}
              onClick={() => onHypothesis(edge.hypothesisId)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onHypothesis(edge.hypothesisId);
                }
              }}
            >
              <title>
                {edge.label}：{edge.hypothesis.text}。
                {hypothesisPathText(design, edge.hypothesis)}
                {edge.legacy ? "。旧版关系与调节标记，需核对。" : ""}
              </title>
              <path
                className={`rd-model-link ${edge.kind === "moderation" ? "rd-moderation" : ""}`}
                d={edge.path}
                markerEnd={`url(#${id}${edge.kind === "moderation" ? "moderation" : "arrow"})`}
              />
              <path className="rd-model-hit" d={edge.path} />
              <text
                x={edge.labelPoint.x}
                y={edge.labelPoint.y}
                textAnchor="middle"
              >
                {edge.label}
                {edge.legacy
                  ? " · 旧版待核对"
                  : edge.confirmed
                    ? ""
                    : " · 候选"}
              </text>
              {edge.moderation && (
                <>
                  <path
                    className="rd-moderation rd-model-legacy-tag"
                    data-moderates-id={edge.hypothesisId}
                    d={edge.moderation.path}
                    markerEnd={`url(#${id}moderation)`}
                  />
                  <text
                    className="rd-model-legacy-label"
                    textAnchor="middle"
                    x={edge.moderation.labelPoint.x}
                    y={edge.moderation.labelPoint.y}
                  >
                    {edge.label} 调节标记
                  </text>
                </>
              )}
            </g>
          ))}
          {model.nodes.map((node) => {
            const lines = modelLabelLines(node.variable.name);
            return (
              <g
                key={node.id}
                data-variable-id={node.id}
                className={`rd-model-node ${node.variable.confirmed ? "confirmed" : "candidate"}`}
                role="button"
                tabIndex={0}
                aria-label={`编辑变量 ${node.variable.name}，${roles[node.variable.role]}`}
                transform={`translate(${node.x},${node.y})`}
                onClick={() => onVariable(node.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onVariable(node.id);
                  }
                }}
              >
                <title>
                  {node.variable.name} · {roles[node.variable.role]} ·{" "}
                  {node.variable.explanation || "定义待补充"}
                </title>
                <rect width={node.width} height={node.height} rx="13" />
                <text
                  className="rd-model-role"
                  x={node.width / 2}
                  y="17"
                  textAnchor="middle"
                >
                  {roles[node.variable.role]}
                </text>
                <text
                  className="rd-model-variable-name"
                  x={node.width / 2}
                  y={lines.length > 1 ? 35 : 42}
                  textAnchor="middle"
                >
                  {lines.map((line, i) => (
                    <tspan key={i} x={node.width / 2} dy={i ? 16 : 0}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
          {!model.nodes.length && (
            <text
              className="rd-model-placeholder"
              x={model.width / 2}
              y={model.height / 2}
              textAnchor="middle"
            >
              确认变量后，模型将在这里同步显示
            </text>
          )}
        </svg>
      </div>
    </figure>
  );
}
