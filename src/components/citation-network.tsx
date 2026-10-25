"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "@/lib/projects";
import type { CitationGraph } from "@/lib/graph-server";
import {
  combineNetwork,
  isCitationGraph,
  networkLayout,
} from "@/lib/citation-network";
import { emptyWorkflow } from "@/lib/workflow";
import { emptyLibrary, type Paper } from "@/lib/literature";
import { useProjects } from "./project-provider";
import { NodeCanvas } from "./node-canvas";
export function CitationNetwork({ project: p }: { project: Project }) {
  const { saveLibrary, saveWorkflow, busy } = useProjects();
  const lib = p.library ?? emptyLibrary(),
    f = p.workflow ?? emptyWorkflow();
  const [graphs, setGraphs] = useState<Record<string, CitationGraph>>({}),
    [selected, setSelected] = useState(""),
    [mode, setMode] = useState(f.graphView?.mode ?? "all"),
    [expanded, setExpanded] = useState(f.graphView?.expanded ?? true),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [notices, setNotices] = useState<Record<string, string>>({});
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const primary = lib.items.map((i) => i.paper);
  const validGraphs = Object.entries(graphs)
    .filter(([id]) => lib.items.some((i) => i.id === id))
    .map(([, g]) => g);
  const network = combineNetwork(primary, validGraphs);
  const primaryKeys = new Set(primary.map((p) => p.key));
  const edges = network.edges.filter((e) =>
    mode === "references"
      ? primaryKeys.has(e.from)
      : mode === "citing"
        ? primaryKeys.has(e.to)
        : true,
  );
  const secondary=network.papers.filter(p=>!primaryKeys.has(p.key)&&edges.some(e=>e.from===p.key||e.to===p.key));
  const visible = [...network.papers.filter(p=>primaryKeys.has(p.key)),...(expanded?secondary.slice(0,80):[])];
  const visibleEdges = edges.filter(
    (e) =>
      visible.some((p) => p.key === e.from) &&
      visible.some((p) => p.key === e.to),
  );
  const signature = JSON.stringify([visible.map((p) => p.key), visibleEdges]);
  const layout = useMemo(() => {
    const [ids, e] = JSON.parse(signature);
    return networkLayout(ids, e);
  }, [signature]);
  const detail = visible.find((p) => p.key === selected);
  async function load() {
    setPending(true);
    setError("");
    controller.current = new AbortController();
    const todo = lib.items
      .filter((i) => (i.paper.doi || i.paper.openAlexId) && !graphs[i.id])
      .slice(0, 3);
    if (!todo.length) {
      setError(
        "未找到尚未展开且有 DOI / OpenAlex 标识的文献。可先补充标识，或重试已失败的记录。",
      );
      setPending(false);
      return;
    }
    for (const i of todo) {
      try {
        const r = await fetch(
          "/api/literature/graph?id=" +
            encodeURIComponent(i.paper.openAlexId ?? i.paper.doi!),
          { signal: controller.current.signal },
        );
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "引用数据读取失败");
        if (!isCitationGraph(data))
          throw new Error("引用数据格式不完整，未绘制。");
        const center = data.papers.find((x) => x.key === data.center)!;
        const norm = (s: string) =>
          s
            .normalize("NFKC")
            .toLowerCase()
            .replace(/[\s\p{P}]/gu, "");
        if (
          i.paper.source === "import" &&
          norm(center.title) !== norm(i.paper.title)
        )
          throw new Error(
            "DOI 对应的登记题名与导入题名不同，未绘制关系。请在文献编辑中核对并采用正确登记记录。",
          );
        setGraphs((g) => ({ ...g, [i.id]: data }));
        setNotices((n) => ({ ...n, [i.id]: data.notices.join(" ") }));
      } catch (e) {
        if (controller.current.signal.aborted) return;
        setNotices((n) => ({
          ...n,
          [i.id]: e instanceof Error ? e.message : "引用数据读取失败",
        }));
      }
    }
    setPending(false);
  }
  async function add(paper: Paper) {
    const now = new Date().toISOString();
    await saveLibrary(p.id, lib.revision, {
      ...lib,
      items: [
        ...lib.items,
        {
          id: crypto.randomUUID(),
          paper,
          categoryIds: [],
          note: "从真实引用网络加入。",
          savedAt: now,
          updatedAt: now,
        },
      ],
    });
  }
  return (
    <section className="workflow-panel">
      <h2>多中心文献星图</h2>
      <p>
        一级节点来自当前文献库；二级节点来自 OpenAlex
        返回的参考文献或施引文献。箭头从引用方指向被引用方。数据库未提供关系，不等于论文没有参考文献。
      </p>
      <div className="workspace-actions">
        <button
          className="button primary"
          disabled={pending || busy || !lib.items.length}
          onClick={() => void load()}
        >
          {pending ? "正在读取…" : "按需加载引用（每次最多 3 篇）"}
        </button>
        <button
          onClick={() => {
            setExpanded(!expanded);
            void saveWorkflow(p.id, f.revision, {
              ...f,
              graphView: { mode, expanded: !expanded },
            });
          }}
        >
          {expanded ? "收起二级文献" : "展开二级文献"}
        </button>
        <select
          aria-label="引用方向"
          value={mode}
          onChange={(e) => {
            setMode(e.target.value);
            void saveWorkflow(p.id, f.revision, {
              ...f,
              graphView: { mode: e.target.value, expanded },
            });
          }}
        >
          <option value="all">全部引用方向</option>
          <option value="references">一级文献的参考文献</option>
          <option value="citing">引用一级文献的论文</option>
        </select>
      </div>
      {error && <p role="alert">{error}</p>}
      {secondary.length>80&&<p>为保持画布可读，本次最多显示 80 个二级节点；可切换引用方向查看。</p>}
      <div className="graph-workspace">
        <div className="frosted-surface graph-surface">
          <NodeCanvas
            key={signature}
            initialFit
            label="多中心真实引用网络"
            nodes={visible.map((paper) => ({
              id: paper.key,
              title: paper.title,
              subtitle: primaryKeys.has(paper.key)
                ? "一级 · 我的文献"
                : "二级 · 引用记录",
              ...(layout.find((x) => x.id === paper.key) ?? { x: 0, y: 0 }),
              ...f.positions[paper.key],
              selected: paper.key === selected,
              secondary: !primaryKeys.has(paper.key),
            }))}
            edges={visibleEdges.map((e) => ({
              ...e,
              label:
                selected && (e.from === selected || e.to === selected)
                  ? "引用 →"
                  : "",
              highlight:
                !!selected && (e.from === selected || e.to === selected),
            }))}
            onSelect={setSelected}
            onMove={(id, x, y) =>
              void saveWorkflow(p.id, f.revision, {
                ...f,
                positions: { ...f.positions, [id]: { x, y } },
              })
            }
          />
        </div>
        <aside className="graph-detail frosted-surface">
          {detail ? (
            <>
              <h3>{detail.title}</h3>
              <p>
                {detail.authors.join("；") || "作者未获取"} ·{" "}
                {detail.year ?? "年份未获取"} ·{" "}
                {detail.venue ?? "出版来源未获取"}
              </p>
              <p>{detail.abstract ?? "暂无摘要"}</p>
              {detail.recordUrl && (
                <a
                  href={detail.recordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  原始记录 ↗
                </a>
              )}
              {!primaryKeys.has(detail.key) && (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void add(detail)}
                >
                  加入当前文献库
                </button>
              )}
              <h4>相邻引用关系及依据</h4>
              {network.edges
                .filter((e) => e.from === detail.key || e.to === detail.key)
                .map((e, i) => (
                  <p key={i}>
                    {network.papers.find((p) => p.key === e.from)?.title} →{" "}
                    {network.papers.find((p) => p.key === e.to)?.title}
                    <br />
                    <a
                      href={e.recordUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      OpenAlex 引用方记录
                    </a>
                  </p>
                ))}
            </>
          ) : (
            <p>点击节点查看文献和引用依据；拖动节点保存布局。</p>
          )}
        </aside>
      </div>
      <details>
        <summary>各篇文献的数据状态</summary>
        {lib.items.map((i) => (
          <p key={i.id}>
            <strong>{i.paper.title}</strong>：
            {notices[i.id] ??
              "暂未取得引用关系。可补充 DOI 或学术记录后再次匹配。"}
          </p>
        ))}
      </details>
    </section>
  );
}
