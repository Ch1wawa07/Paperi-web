"use client";
import {cleanDirection} from "@/lib/workflow";
import Link from "next/link";
import {sourceFingerprint} from "@/lib/workflow";
import {WorkflowSelection} from "./literature-analysis";
import { useEffect, useRef, useState } from "react";
import { useProjects } from "./project-provider";
import {
  WorkspaceToolbar,
  ProfileStrip,
  researchFetch,
  downloadText,
} from "./workspace-common";
import { NodeCanvas } from "./node-canvas";
import {
  emptyWorkbench,
  researchContext,
  exportDesign,
  isDesign,
  type Design,
  type DesignNode,
  type DesignEdge,
} from "@/lib/workbench";
import type { Project } from "@/lib/projects";
export function DesignCanvas({ proposal = false }: { proposal?: boolean }) {
  const { snapshot, ready } = useProjects();
  const p = snapshot.projects.find((p) => p.id === snapshot.activeId);
  return (
    <div className="module-page">
      <WorkspaceToolbar
        title={proposal ? "研究方案" : "研究设计"}
        project={p}
      />
      {ready && p ? (
        <Designer key={p.id + ":" + proposal} project={p} proposal={proposal} />
      ) : (
        <Link href="/">选择或创建研究项目</Link>
      )}
    </div>
  );
}
function Designer({
  project: p,
  proposal,
}: {
  project: Project;
  proposal: boolean;
}) {
  const { saveWorkbench, busy } = useProjects();
  const w = p.workbench ?? emptyWorkbench();
  const [draft, setDraft] = useState<Design>(w.design),
    [revision, setRevision] = useState(w.revision),
    [baseline,setBaseline]=useState(JSON.stringify(w.design)),
    [selected, setSelected] = useState<string | null>(null),
    [pending, setPending] = useState(false),
    [suggestion, setSuggestion] = useState<Design | null>(null),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState(false),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [edgeLabel, setEdgeLabel] = useState("H1 待检验关系"),
    [edgeKind,setEdgeKind]=useState<NonNullable<DesignEdge["kind"]>>("hypothesis");
  const controller = useRef<AbortController | null>(null),
    running = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    const click = (e: MouseEvent) => {
      if (
        dirty &&
        (e.target as Element).closest('a[href^="/"]') &&
        !window.confirm("设计有未保存修改，确定离开？")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const switchProject = (e: Event) => {
      const el = e.target;
      if (
        dirty &&
        el instanceof HTMLSelectElement &&
        el.id === "current-project" &&
        !window.confirm("设计有未保存修改，确定切换项目？")
      ) {
        e.stopPropagation();
        el.value = p.id;
      }
    };
    document.addEventListener("change", switchProject, true);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", click, true);
      document.removeEventListener("change", switchProject, true);
    };
  }, [dirty, p.id]);
  // Reload only via explicit control on a conflict; never replace unsaved edits.
  const node = draft.nodes.find((n) => n.id === selected);
  const sources = [
    ...(p.library?.items ?? []).map((i) => ({ id: i.id, paper: i.paper })),
    ...w.designSources.filter(paper=>p.library?.items.some(i=>i.paper.key===paper.key)).map((paper) => ({ id: paper.key, paper })),
  ];
  function change(next: Design) {
    if(!dirty&&baseline!==JSON.stringify(w.design)){setError("设计已在其他页面更新，请先读取已保存版本再编辑。");return;}
    if (!dirty) setRevision(w.revision);
    setDraft(next);
    setDirty(true);
  }
  function patch(fields: Partial<DesignNode>) {
    if (node)
      change({
        ...draft,
        nodes: draft.nodes.map((n) =>
          n.id === node.id ? { ...n, ...fields } : n,
        ),
      });
  }
  async function save() {
    setError("");
    if(!dirty)return;
    const expected = revision;
    if (await saveWorkbench(p.id, expected, { ...w, design: draft,designFingerprint:sourceFingerprint(p) })) {
      setRevision(expected + 1);
      setBaseline(JSON.stringify(draft));
      setDirty(false);
    } else setError("设计尚未保存，编辑仍保留。请核对上方存储提示。");
  }
  async function generate() {
    if (running.current) return;
    running.current = true;
    setPending(true);
    setError("");
    const c = new AbortController();
    controller.current = c;
    try {
      const context = researchContext(p);
      if((p.library?.items.length??0)>30&&context.evidence.length>=30)throw new Error("本次设计最多使用 30 篇，请先调整文献选择。");
      const extras = (p.workflow?[]:w.designSources).filter(paper=>p.library?.items.some(i=>i.paper.key===paper.key))
        .filter(
          (paper) => !context.evidence.some((e) => e.paper.key === paper.key),
        )
        .slice(0, Math.max(0, 8 - context.evidence.length))
        .map((paper) => ({ id: paper.key, paper }));
      const d = await researchFetch(
        {
          task: "design",
          path: draft.path,
          context: { ...context, evidence: [...context.evidence, ...extras] },
        },
        c.signal,
      );
      if (!isDesign(d.design)) throw new Error("设计格式不完整。");
      setSuggestion(d.design);
    } catch (e) {
      if (!c.signal.aborted)
        setError(e instanceof Error ? e.message : "设计生成失败。");
    } finally {
      running.current = false;
      if (!c.signal.aborted) setPending(false);
    }
  }
  function accept() {
    if (!suggestion) return;
    const ids = new Map(
      suggestion.nodes.map((n) => [n.id, crypto.randomUUID()]),
    );
    const nodes = suggestion.nodes.map((n, i) => ({
      ...n,
      id: ids.get(n.id)!,
      x: 40 + ((i + draft.nodes.length) % 3) * 270,
      y: 50 + Math.floor((i + draft.nodes.length) / 3) * 180,
    }));
    change({
      ...draft,
      nodes: [...draft.nodes, ...nodes],
      edges: [
        ...draft.edges,
        ...suggestion.edges.map((e) => ({
          ...e,
          id: crypto.randomUUID(),
          from: ids.get(e.from)!,
          to: ids.get(e.to)!,
        })),
      ],
    });
    setSelected(nodes[0]?.id ?? null);
    setSuggestion(null);
  }
  return (
    <>
      <ProfileStrip project={p} />
      {!!w.design.nodes.length&&w.designFingerprint!==sourceFingerprint(p)&&<p className="source-notice">研究资料或文献集合已变化（或来自旧版设计），请复核设计依据；已有设计保留。</p>}
      <div className="design-toolbar">
        <label>
          研究路径
          <select
            aria-label="研究路径"
            value={draft.path}
            onChange={(e) =>
              confirm("切换研究路径会保留所有现有节点和连线，请自行复核它们是否适用于新路径。继续？") && change({ ...draft, path: e.target.value as Design["path"] })
            }
          >
            <option value="quantitative">定量研究</option>
            <option value="qualitative">质化研究</option>
          </select>
        </label>
        <button
          className="button secondary"
          disabled={pending || busy}
          onClick={() => void generate()}
        >
          {pending ? "正在构思…" : "AI 辅助生成草案"}
        </button>
        <button
          className="button secondary"
          disabled={draft.nodes.length >= 60}
          onClick={() => {
            const id = crypto.randomUUID();
            change({
              ...draft,
              nodes: [
                ...draft.nodes,
                {
                  id,
                  kind:
                    draft.path === "qualitative" ? "探索主题" : "构念 / 变量",
                  title: "新节点",
                  body: "",
                  x: 40 + (draft.nodes.length % 3) * 270,
                  y: 50 + Math.floor(draft.nodes.length / 3) * 180,
                  status: "suggested",
                  evidenceIds: [],
                  uncertainty: "待核实",
                },
              ],
            });
            setSelected(id);
          }}
        >
          添加节点
        </button>
        <button className="text-button" disabled={!draft.nodes.length} onClick={()=>change({...draft,nodes:draft.nodes.map((n,i)=>({...n,x:40+(i%3)*270,y:50+Math.floor(i/3)*180}))})}>整理节点布局</button>
        <button
          className="button primary"
          disabled={busy || !dirty}
          onClick={() => void save()}
        >
          保存研究设计
        </button>
        <button
          className="text-button"
          disabled={dirty || !draft.nodes.length}
          onClick={() => downloadText("Paperi-研究设计.md", exportDesign(p))}
        >
          导出 Markdown
        </button>
        <span role="status">{dirty ? "有未保存修改" : "已保存内容"}</span>
      </div>
      <WorkflowSelection project={p} /><p className="source-notice">研究问题与方向：{cleanDirection(p.workflow?.direction?.text??p.exploration?.seed?.workingQuestion??p.observation)}。模型连线是待检验假设或设计逻辑。</p><Link href="/review">返回文献综述</Link> · <Link href="/proposal">确认并导出完整研究框架 →</Link>
      {error && (
        <p className="literature-error" role="alert">
          {error}
        </p>
      )}
      {((dirty && revision !== w.revision)||(!dirty&&baseline!==JSON.stringify(w.design))) && (
        <p className="source-notice">
          项目资料已更新。当前编辑保留；可先复制节点内容，再
          <button
            onClick={() => {
              if (confirm("放弃未保存设计编辑，读取已保存内容？")) {
                setDraft(w.design);
                setBaseline(JSON.stringify(w.design));
                setRevision(w.revision);
                setDirty(false);
              }
            }}
          >
            读取已保存版本
          </button>
          。
        </p>
      )}
      {suggestion && (
        <section className="frosted-surface design-suggestions">
          <h2>AI 候选方案 · 尚未采纳</h2>
          <p>
            将作为新节点加入，已有确认内容保持原样。每个节点可继续编辑、确认或拒绝。
          </p>
          <div className="suggestion-preview">
            {suggestion.nodes.map((n) => (
              <details key={n.id}>
                <summary>{n.title}</summary>
                <p>{n.body}</p>
                <p>待核实：{n.uncertainty}</p>
              </details>
            ))}
          </div>
          <button
            className="button primary"
            disabled={
              draft.nodes.length + suggestion.nodes.length > 60 ||
              draft.edges.length + suggestion.edges.length > 100
            }
            onClick={accept}
          >
            加入画布并继续编辑
          </button>
          <button className="text-button" onClick={() => setSuggestion(null)}>
            拒绝本次草案
          </button>
        </section>
      )}
      {proposal ? (
        <section className="frosted-surface proposal-preview">
          <h2>当前已保存方案</h2>
          <p>
            已确认{" "}
            {w.design.nodes.filter((n) => n.status === "confirmed").length} 项 ·
            待确认{" "}
            {w.design.nodes.filter((n) => n.status === "suggested").length} 项 ·
            已拒绝{" "}
            {w.design.nodes.filter((n) => n.status === "rejected").length} 项
          </p>
          <pre>{exportDesign(p)}</pre>
          <Link href="/canvas">返回画布编辑 →</Link>
        </section>
      ) : (
        <div className="design-workspace">
          <div className="frosted-surface graph-surface">
            {!draft.nodes.length && (
              <p className="canvas-empty">
                从已有观察与概念开始。让 AI 提出草案，或添加自己的节点。
              </p>
            )}
            <NodeCanvas
              key={p.id}
              nodes={draft.nodes.map((n) => ({
                ...n,
                subtitle:
                  n.kind +
                  " · " +
                  (n.status === "confirmed"
                    ? "已确认"
                    : n.status === "rejected"
                      ? "已拒绝"
                      : "待确认"),
                selected: n.id === selected,
              }))}
              edges={draft.edges}
              dashed
              onSelect={setSelected}
              onMove={(id, x, y) =>
                change({
                  ...draft,
                  nodes: draft.nodes.map((n) =>
                    n.id === id
                      ? { ...n, x: Math.round(x), y: Math.round(y) }
                      : n,
                  ),
                })
              }
              label="可编辑研究设计画布"
            />
            <p className="muted">
              虚线为候选假设 /
              研究规划，不是已证实因果。切换路径不会删除已有节点。
            </p>
          </div>
          <aside className="frosted-surface design-editor">
            {node ? (
              <>
                <h2>编辑节点</h2>
                <label>
                  名称
                  <input
                    aria-label="名称"
                    maxLength={160}
                    value={node.title}
                    onChange={(e) => patch({ title: e.target.value })}
                  />
                </label>
                <label>
                  类型
                  <input
                    aria-label="类型"
                    maxLength={80}
                    value={node.kind}
                    onChange={(e) => patch({ kind: e.target.value })}
                  />
                </label>
                <label>
                  研究内容
                  <textarea
                    aria-label="研究内容"
                    rows={5}
                    maxLength={2000}
                    value={node.body}
                    onChange={(e) => patch({ body: e.target.value })}
                  />
                </label>
                <label>
                  待核实事项
                  <textarea
                    aria-label="待核实事项"
                    rows={3}
                    maxLength={800}
                    value={node.uncertainty}
                    onChange={(e) => patch({ uncertainty: e.target.value })}
                  />
                </label>
                <label>
                  确认状态
                  <select
                    aria-label="确认状态"
                    value={node.status}
                    onChange={(e) =>
                      patch({ status: e.target.value as DesignNode["status"] })
                    }
                  >
                    <option value="suggested">草案 · 待确认</option>
                    <option value="confirmed">用户已确认</option>
                    <option value="rejected">已拒绝</option>
                  </select>
                </label>
                <details>
                  <summary>关联来源 · {node.evidenceIds.length}</summary>
                  {sources.map((s) => (
                    <label className="source-checkbox" key={s.id}>
                      <input
                        type="checkbox"
                        checked={node.evidenceIds.includes(s.id)}
                        disabled={
                          !node.evidenceIds.includes(s.id) &&
                          node.evidenceIds.length >= 20
                        }
                        onChange={(e) =>
                          patch({
                            evidenceIds: e.target.checked
                              ? [...node.evidenceIds, s.id]
                              : node.evidenceIds.filter((id) => id !== s.id),
                          })
                        }
                      />
                      <a
                        href={s.paper.recordUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {s.paper.title}
                      </a>
                    </label>
                  ))}
                  {node.evidenceIds
                    .filter((id) => !sources.some((s) => s.id === id))
                    .map((id) => (
                      <p key={id}>来源已移出收藏，请重新核对。</p>
                    ))}
                </details>
                <button
                  className="text-button"
                  onClick={() => {
                    if (confirm("删除该设计节点及其连线？")) {
                      change({
                        ...draft,
                        nodes: draft.nodes.filter((n) => n.id !== node.id),
                        edges: draft.edges.filter(
                          (e) => e.from !== node.id && e.to !== node.id,
                        ),
                      });
                      setSelected(null);
                    }
                  }}
                >
                  删除节点
                </button>
              </>
            ) : (
              <>
                <h2>让研究结构逐渐清晰</h2>
                <p>
                  点击节点编辑；拖动或用方向键调整位置。已有文献线索会显示来源。
                </p>
              </>
            )}
            <details className="edge-editor">
              <summary>编辑关系 · {draft.edges.length}</summary>
              <label>
                起点
                <select
                  aria-label="起点"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                >
                  <option value="">选择节点</option>
                  {draft.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                终点
                <select
                  aria-label="终点"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                >
                  <option value="">选择节点</option>
                  {draft.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>关系类型<select aria-label="关系类型" value={edgeKind} onChange={e=>setEdgeKind(e.target.value as NonNullable<DesignEdge["kind"]>)}><option value="hypothesis">直接假设</option><option value="mediation">中介路径</option><option value="moderation">调节关系</option><option value="process">质性研究流程</option></select></label>
              <label>
                关系名称
                <input
                  aria-label="关系名称"
                  value={edgeLabel}
                  maxLength={160}
                  onChange={(e) => setEdgeLabel(e.target.value)}
                />
              </label>
              <button
                className="text-button"
                disabled={
                  !from ||
                  !to ||
                  from === to ||
                  !edgeLabel.trim() ||
                  draft.edges.length >= 100
                }
                onClick={() =>
                  change({
                    ...draft,
                    edges: [
                      ...draft.edges,
                      {
                        id: crypto.randomUUID(),
                        from,
                        to,
                        label: edgeLabel.trim(),
                        kind:edgeKind,
                      },
                    ],
                  })
                }
              >
                添加关系
              </button>
              {draft.edges.map((e) => (
                <div key={e.id}>
                  <span>
                    {draft.nodes.find((n) => n.id === e.from)?.title} →{" "}
                    {draft.nodes.find((n) => n.id === e.to)?.title}
                  </span>
                  <select aria-label="编辑关系类型" value={e.kind??"hypothesis"} onChange={ev=>change({...draft,edges:draft.edges.map(x=>x.id===e.id?{...x,kind:ev.target.value as DesignEdge["kind"]}:x)})}><option value="hypothesis">直接假设</option><option value="mediation">中介路径</option><option value="moderation">调节关系</option><option value="process">质性研究流程</option></select>
                  <input
                    aria-label="编辑关系名称"
                    value={e.label}
                    maxLength={160}
                    onChange={(ev) =>
                      change({
                        ...draft,
                        edges: draft.edges.map((x) =>
                          x.id === e.id ? { ...x, label: ev.target.value } : x,
                        ),
                      })
                    }
                  />
                  <button
                    className="text-button"
                    onClick={() =>
                      change({
                        ...draft,
                        edges: draft.edges.filter((x) => x.id !== e.id),
                      })
                    }
                  >
                    移除连线
                  </button>
                </div>
              ))}
            </details>
          </aside>
        </div>
      )}
    </>
  );
}
