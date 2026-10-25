"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useProjects } from "./project-provider";
import {
  WorkspaceToolbar,
  ProfileStrip,
  EvidencePicker,
  researchFetch,
} from "./workspace-common";
import { NodeCanvas } from "./node-canvas";
import {
  emptyWorkbench,
  researchContext,
  selectedEvidence,
  profileFingerprint,
  isThreads,
} from "@/lib/workbench";
import { emptyLibrary, samePaper, isPaper, type Paper } from "@/lib/literature";
import type { Project } from "@/lib/projects";
import type { CitationGraph } from "@/lib/graph-server";
export function ResearchMap({
  initialMode = "citations",
}: {
  initialMode?: "citations" | "context";
}) {
  const { snapshot, ready } = useProjects();
  const p = snapshot.projects.find((p) => p.id === snapshot.activeId);
  return (
    <div className="module-page">
      <WorkspaceToolbar title="文献星图" project={p} />
      {ready && p ? (
        <MapWorkspace key={p.id} project={p} initialMode={initialMode} />
      ) : (
        <Link href="/">选择或创建研究项目</Link>
      )}
    </div>
  );
}
function MapWorkspace({
  project: p,
  initialMode,
}: {
  project: Project;
  initialMode: "citations" | "context";
}) {
  const { saveWorkbench, saveLibrary, busy } = useProjects();
  const w = p.workbench ?? emptyWorkbench(),
    selected = selectedEvidence(p),
    library = p.library ?? emptyLibrary();
  const [mode, setMode] = useState<"citations" | "context">(initialMode),
    [graph, setGraph] = useState<CitationGraph | null>(null),
    [detail, setDetail] = useState<Paper | null>(null),
    [center, setCenter] = useState(
      selected[0]?.paper.openAlexId ?? selected[0]?.paper.doi ?? "",
    ),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null),
    running = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  async function load(id: string) {
    if (running.current) return;
    running.current = true;
    setPending(true);
    setError("");
    const c = new AbortController();
    controller.current = c;
    try {
      const r = await fetch(
        "/api/literature/graph?id=" + encodeURIComponent(id),
        { signal: c.signal },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (
        !Array.isArray(d.papers) ||
        !d.papers.every(isPaper) ||
        !Array.isArray(d.edges)
      )
        throw new Error("引用数据格式不完整。");
      setGraph(d);
      setDetail(d.papers.find((x: Paper) => x.key === d.center));
      setCenter(id);
    } catch (e) {
      if (!c.signal.aborted)
        setError(e instanceof Error ? e.message : "星图加载失败。");
    } finally {
      running.current = false;
      if (!c.signal.aborted) setPending(false);
    }
  }
  const fingerprint = JSON.stringify([
    profileFingerprint(p),
    selected.map((s) => [s.id, s.paper.retrievedAt]),
  ]);
  async function analyze() {
    if (running.current) return;
    running.current = true;
    setPending(true);
    setError("");
    const c = new AbortController();
    controller.current = c;
    try {
      const d = await researchFetch(
        { task: "context", context: researchContext(p) },
        c.signal,
      );
      if (!isThreads(d.threads)) throw new Error("研究脉络格式不完整。");
      if (
        !(await saveWorkbench(p.id, w.revision, {
          ...w,
          analysis: d.threads,
          analysisFingerprint: fingerprint,
        }))
      )
        throw new Error("分析未保存，请处理存储提示后重试。");
    } catch (e) {
      if (!c.signal.aborted)
        setError(e instanceof Error ? e.message : "分析失败。");
    } finally {
      running.current = false;
      if (!c.signal.aborted) setPending(false);
    }
  }
  async function savePaper(paper: Paper) {
    if (library.items.some((i) => samePaper(i.paper, paper))) return;
    const now = new Date().toISOString();
    await saveLibrary(p.id, library.revision, {
      ...library,
      items: [
        ...library.items,
        {
          id: crypto.randomUUID(),
          paper,
          categoryIds: library.categories.some((c) => c.id === "reading")
            ? ["reading"]
            : [],
          note: "",
          savedAt: now,
          updatedAt: now,
        },
      ],
    });
  }
  async function addDesign(paper: Paper, body = paper.title) {
    const exists = w.designSources.some((x) => samePaper(x, paper));
    if (
      !(await saveWorkbench(p.id, w.revision, {
        ...w,
        designSources: exists ? w.designSources : [...w.designSources, paper],
        design: {
          ...w.design,
          nodes: [
            ...w.design.nodes,
            {
              id: crypto.randomUUID(),
              kind: "文献线索",
              title: paper.title.slice(0, 160),
              body: body.slice(0, 2000),
              x: 50 + (w.design.nodes.length % 3) * 270,
              y: 50 + Math.floor(w.design.nodes.length / 3) * 180,
              status: "suggested",
              evidenceIds: [paper.key],
              uncertainty: "题录/摘要线索，需阅读原文核实理论适用性。",
            },
          ],
        },
      }))
    )
      setError("未加入设计，请处理存储提示。");
  }
  const outgoing=graph?.papers.filter(p=>p.key!==graph.center&&graph.edges.some(e=>e.from===graph.center&&e.to===p.key))??[];
  const incoming=graph?.papers.filter(p=>p.key!==graph.center&&!outgoing.some(x=>x.key===p.key))??[];
  const rows=Math.max(outgoing.length,incoming.length,1);
  const graphNodes=graph?.papers.map(paper=>({id:paper.key,title:paper.title,subtitle:paper.key===graph.center?'中心文献':`${paper.year??'年份缺失'} · ${outgoing.some(p=>p.key===paper.key)?'它的参考文献':'引用它的文献'}`,x:paper.key===graph.center?340:outgoing.some(p=>p.key===paper.key)?20:660,y:paper.key===graph.center?Math.max(230,(rows-1)*50):20+Math.max(outgoing.findIndex(p=>p.key===paper.key),incoming.findIndex(p=>p.key===paper.key))*100,selected:detail?.key===paper.key}))??[];
  return (
    <>
      <ProfileStrip project={p} />
      <div className="workspace-actions">
        <button
          className="button secondary"
          aria-pressed={mode === "citations"}
          onClick={() => setMode("citations")}
        >
          真实引用网络
        </button>
        <button
          className="button secondary"
          aria-pressed={mode === "context"}
          onClick={() => setMode("context")}
        >
          研究脉络视图
        </button>
        <Link href="/canvas" className="text-button">
          进入研究设计 →
        </Link>
      </div>
      <EvidencePicker project={p} />
      {error && (
        <p role="alert" className="literature-error">
          {error}
        </p>
      )}
      {mode === "citations" ? (
        <>
          <form
            className="graph-search"
            onSubmit={(e) => {
              e.preventDefault();
              void load(center);
            }}
          >
            <label>
              中心文献
              <select
                aria-label="选择中心文献"
                value={center}
                onChange={(e) => setCenter(e.target.value)}
              >
                <option value="">从本研究收藏选择</option>
                {library.items.map((i) => (
                  <option
                    key={i.id}
                    disabled={!i.paper.openAlexId && !i.paper.doi}
                    value={i.paper.openAlexId ?? i.paper.doi ?? ""}
                  >
                    {i.paper.title}{!i.paper.openAlexId && !i.paper.doi ? " · 真实引用关系暂不可用" : ""}
                  </option>
                ))}
              </select>
            </label>
            <button className="button primary" disabled={pending || !center}>
              {pending ? "正在读取…" : "展开真实引用"}
            </button>
          </form>
          <div className="graph-workspace">
            <div className="frosted-surface graph-surface">
              {graph ? (
                <NodeCanvas
                  key={graph.center}
                  initialFit
                  nodes={graphNodes}
                  edges={graph.edges}
                  onSelect={(id) =>
                    setDetail(graph.papers.find((p) => p.key === id) ?? null)
                  }
                  label="真实文献引用网络"
                />
              ) : (
                <div className="canvas-empty">
                  <h2>沿着真实文献，发现研究的联系。</h2>
                  <p>选择一篇收藏作为起点，展开一层参考文献与引用文献。</p>
                </div>
              )}
              {graph?.notices.map((n) => (
                <p className="muted" key={n}>
                  {n}
                </p>
              ))}
            </div>
            <aside className="frosted-surface graph-detail">
              {detail ? (
                <>
                  <span className="eyebrow">SOURCE / OPENALEX</span>
                  <h2>{detail.title}</h2>
                  <p>
                    {detail.authors.join("；")} · {detail.year}
                  </p>
                  <p>
                    {detail.abstract ??
                      "来源未提供摘要；不能据此判断具体研究结论。"}
                  </p>
                  <a
                    href={detail.recordUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    核对原始记录与引用关系 ↗
                  </a>
                  {detail.doi && <p>DOI: {detail.doi}</p>}
                  <div className="workspace-actions">
                    <button
                      className="button secondary"
                      disabled={
                        busy ||
                        library.items.some((i) => samePaper(i.paper, detail))
                      }
                      onClick={() => void savePaper(detail)}
                    >
                      {library.items.some((i) => samePaper(i.paper, detail))
                        ? "已收藏"
                        : "保存到当前研究"}
                    </button>
                    <button
                      className="button secondary"
                      disabled={pending}
                      onClick={() =>
                        void load(detail.openAlexId ?? detail.doi ?? "")
                      }
                    >
                      设为中心
                    </button>
                    <button
                      className="button primary"
                      disabled={
                        busy ||
                        w.design.nodes.length >= 60 ||
                        w.designSources.length >= 40
                      }
                      onClick={() => void addDesign(detail)}
                    >
                      加入研究设计
                    </button>
                  </div>
                </>
              ) : (
                <p>
                  点击节点查看文献；键盘 Tab
                  选中后可用方向键移动，回车打开详情。
                </p>
              )}
            </aside>
          </div>
        </>
      ) : (
        <>
          <div className="workspace-actions">
            <button
              className="button primary"
              disabled={pending || busy || !selected.length}
              onClick={() => void analyze()}
            >
              {pending ? "正在分析…" : "分析这些文献的研究脉络"}
            </button>
            <span className="muted">仅使用已选题录与可用摘要，最多8篇。</span>
          </div>
          {w.analysis.length > 0 && w.analysisFingerprint !== fingerprint && (
            <p className="source-notice">
              概念或文献已变化，以下为历史分析，建议重新核对。
            </p>
          )}
          {w.analysis.length > 0 ? (
            <>
              <NodeCanvas
                key={w.analysisFingerprint}
                dashed
                nodes={w.analysis.map((t, i) => ({
                  id: String(i),
                  title: t.title,
                  subtitle: "AI 归纳 · " + t.kind,
                  x: 40 + (i % 3) * 275,
                  y: 40 + Math.floor(i / 3) * 190,
                }))}
                edges={w.analysis.flatMap((t, i) =>
                  w.analysis
                    .slice(i + 1)
                    .flatMap((other, j) =>
                      t.evidenceIds.some((id) => other.evidenceIds.includes(id))
                        ? [
                            {
                              from: String(i),
                              to: String(i + j + 1),
                              label: "共享文献 · 非引用",
                            },
                          ]
                        : [],
                    ),
                )}
                onSelect={(id) =>
                  document
                    .getElementById("thread-" + id)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" })
                }
                label="AI研究脉络，虚线仅表示共享来源"
              />
              <div className="thread-grid">
                {w.analysis.map((t, i) => (
                  <article
                    className="frosted-surface"
                    id={"thread-" + i}
                    key={i}
                  >
                    <span>{t.kind} · AI 解释</span>
                    <h2>{t.title}</h2>
                    <p>{t.body}</p>
                    <p className="muted">待核实：{t.uncertainty}</p>
                    {t.evidenceIds.map((id) => {
                      const item = library.items.find((s) => s.id === id);
                      return item ? (
                        <div key={id}>
                          <a
                            href={item.paper.recordUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            依据：{item.paper.title}
                          </a>
                          <button
                            className="text-button"
                            disabled={
                              busy ||
                              w.design.nodes.length >= 60 ||
                              w.designSources.length >= 40
                            }
                            onClick={() =>
                              void addDesign(
                                item.paper,
                                `${t.title}\n${t.body}\n限制：${t.uncertainty}`,
                              )
                            }
                          >
                            线索与来源加入设计
                          </button>
                        </div>
                      ) : (
                        <p key={id}>来源已移出收藏，请重新核对。</p>
                      );
                    })}
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="canvas-empty">
              从文献探索中选择真实文献后，在这里整理理论、方法和待查问题。
            </p>
          )}
        </>
      )}
    </>
  );
}
