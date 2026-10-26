"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/projects";
import {
  emptyWorkflow,
  cleanDirection,
  sourceFingerprint,
  frameworkFingerprint,
  exportFramework,
  workflowEvidence,
  type ReviewNode,
} from "@/lib/workflow";
import { exportDesign } from "@/lib/workbench";
import { useProjects } from "./project-provider";
import { WorkspaceToolbar, downloadText } from "./workspace-common";
import {
  Sources,
  WorkflowSelection,
  requestWorkflow,
} from "./literature-analysis";
import { NodeCanvas } from "./node-canvas";
export function ResearchIntegration({ final = false }: { final?: boolean }) {
  const { snapshot, ready } = useProjects();
  const p = snapshot.projects.find((p) => p.id === snapshot.activeId);
  return (
    <div className="module-page">
      <WorkspaceToolbar title={final ? "研究框架" : "研究整合"} project={p} />
      {ready && p ? (
        <Integration key={p.id} project={p} final={final} />
      ) : (
        <Link href="/">先创建或选择研究项目</Link>
      )}
    </div>
  );
}
function Integration({
  project: p,
  final,
}: {
  project: Project;
  final: boolean;
}) {
  const { saveWorkflow, busy } = useProjects();
  const f = p.workflow ?? emptyWorkflow();
  const [draft, setDraft] = useState(f.review),
    [revision, setRevision] = useState(f.revision),
    [baseline, setBaseline] = useState(JSON.stringify(f.review)),
    [selected, setSelected] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [suggestions, setSuggestions] = useState<ReviewNode[] | null>(null);
  const controller = useRef<AbortController | null>(null);
  const dirty = JSON.stringify(draft) !== baseline;
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    const click = (e: MouseEvent) => {
      if (
        dirty &&
        (e.target as Element).closest('a[href^="/"]') &&
        !confirm("综述有未保存修改，确定离开？")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
  const node = draft.find((n) => n.id === selected);
  const stale =
    !!f.review.length && f.reviewFingerprint !== sourceFingerprint(p);
  async function generate() {
    setPending(true);
    setError("");
    controller.current = new AbortController();
    try {
      const analysis = await requestWorkflow(
        p,
        "review",
        workflowEvidence(p).map((i) => i.id),
        "",
        controller.current.signal,
      );
      if (controller.current.signal.aborted) return;
      setSuggestions(
        analysis.sections.map((s, i) => ({
          ...s,
          id: crypto.randomUUID(),
          x: 40 + (i % 3) * 270,
          y: 40 + Math.floor(i / 3) * 170,
        })),
      );
      if (
        !(await saveWorkflow(p.id, f.revision, {
          ...f,
          analyses: [...f.analyses, analysis],
        }))
      )
        setError("候选返回，但历史记录未保存。请处理存储冲突。");
      else if (!dirty) setRevision(f.revision + 1);
    } catch (e) {
      if (!controller.current.signal.aborted)
        setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      if (!controller.current.signal.aborted) setPending(false);
    }
  }
  function patch(fields: Partial<ReviewNode>) {
    setDraft(draft.map((n) => (n.id === selected ? { ...n, ...fields } : n)));
  }
  async function save() {
    if (
      await saveWorkflow(p.id, revision, {
        ...f,
        review: draft,
        reviewFingerprint: sourceFingerprint(p),
        confirmedFingerprint: null,
      })
    ) {
      setBaseline(JSON.stringify(draft));
      setRevision(revision + 1);
    } else setError("综述尚未保存。编辑保留，请处理存储冲突。");
  }
  return (
    <>
      <div className="profile-strip">
        研究方向：
        {cleanDirection(f.direction?.text ?? "") || "尚未确认，可返回研究脉络选择或自行输入。"}
      </div>
      <div className="workspace-actions">
        <Link href="/literature">返回文献工作台</Link>
        <Link href="/canvas">进入研究设计 →</Link>
        <Link href="/proposal">确认与导出框架 →</Link>
      </div>
      <WorkflowSelection project={p} />
      {stale && (
        <p className="source-notice">
          文献库、研究方向或输入资料已变化，当前综述基于之前的资料。请核对来源并更新；原编辑保留。
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {final ? (
        <section className="workflow-panel frosted-surface">
          <h2>由你确认的研究框架</h2>
          <p>
            {f.confirmedFingerprint === frameworkFingerprint(p)
              ? "已确认 · 确认仅代表你的研究计划，不代表结论已证实。"
              : "草案 / 内容变化后待重新确认"}
          </p>
          <button
            className="button primary"
            disabled={busy}
            onClick={() =>
              void saveWorkflow(p.id, f.revision, {
                ...f,
                confirmedFingerprint: frameworkFingerprint(p),
              })
            }
          >
            确认当前研究框架
          </button>
          <button
            className="button secondary"
            onClick={() =>
              downloadText(
                "Paperi-研究框架.md",
                exportFramework(p) + "\n" + exportDesign(p),
              )
            }
          >
            导出完整研究框架 Markdown
          </button>
          <pre className="framework-preview">
            {exportFramework(p) + "\n" + exportDesign(p)}
          </pre>
          <Link href="/canvas">编辑研究模型并导出 SVG →</Link>
        </section>
      ) : (
        <>
          <div className="workspace-actions">
            <button
              className="button primary"
              disabled={pending || busy || !workflowEvidence(p).length}
              onClick={() => void generate()}
            >
              {pending ? "正在组织…" : "生成综述结构候选"}
            </button>
            <button disabled={pending || !workflowEvidence(p).length || draft.length >= 56} onClick={()=>{
              const items=workflowEvidence(p);
              const topics=["概念界定与研究对象","理论与研究路径候选","已有研究的联系与分歧","当前项目切入点与缺失证据"];
              setRevision(f.revision);
              setDraft([...draft,...topics.map((title,i)=>({id:crypto.randomUUID(),title,body:`结构草案，尚未归纳论文结论。围绕“${cleanDirection(f.direction?.text ?? "") || p.observation || p.name}”整理本节。待核对文献：${items.map(x=>x.paper.title).join("；")}。`,evidenceIds:items.map(x=>x.id),uncertainty:"本地结构骨架，未调用 AI，不代表已完成文献分析。请据摘要或原文补充观点和关系。",x:40+(i%3)*270,y:40+Math.floor(i/3)*170}))]);
            }}>生成可编辑结构草案（不调用 AI）</button>
            <button
              disabled={draft.length >= 60}
              onClick={() => {
                const id = crypto.randomUUID();
                if (!dirty) setRevision(f.revision);
                setDraft([
                  ...draft,
                  {
                    id,
                    title: "新综述节点",
                    body: "",
                    evidenceIds: [],
                    uncertainty: "待补充证据",
                    x: 40 + (draft.length % 3) * 270,
                    y: 40 + Math.floor(draft.length / 3) * 170,
                  },
                ]);
                setSelected(id);
              }}
            >
              添加综述节点
            </button>
            <button disabled={!dirty || busy} onClick={() => void save()}>
              保存综述编辑
            </button>
            <button
              onClick={() =>
                downloadText("Paperi-综述提纲.md", exportFramework(p))
              }
            >
              导出已保存提纲 Markdown
            </button>
          </div>
          {dirty && <p role="status">综述有未保存修改</p>}
          {revision !== f.revision && (
            <p className="source-notice">
              项目已更新。
              <button
                onClick={() => {
                  if (
                    !dirty ||
                    confirm("放弃当前未保存编辑，读取已保存综述？")
                  ) {
                    setDraft(f.review);
                    setBaseline(JSON.stringify(f.review));
                    setRevision(f.revision);
                  }
                }}
              >
                读取已保存版本
              </button>
            </p>
          )}
          {suggestions && (
            <section className="workflow-panel frosted-surface">
              <h3>AI 综述候选 · 尚未采纳</h3>
              {suggestions.map((n) => (
                <details key={n.id}>
                  <summary>{n.title}</summary>
                  <p>{n.body}</p>
                  <Sources ids={n.evidenceIds} project={p} />
                </details>
              ))}
              <button
                disabled={draft.length + suggestions.length > 60}
                onClick={() => {
                  if (!dirty) setRevision(f.revision);
                  setDraft([...draft, ...suggestions]);
                  setSuggestions(null);
                }}
              >
                追加候选，保留已有编辑
              </button>
              <button onClick={() => setSuggestions(null)}>拒绝候选</button>
            </section>
          )}
          <div className="design-workspace">
            <section className="frosted-surface graph-surface">
              <NodeCanvas
                key={p.id + ":review"}
                label="可编辑文献综述地图"
                dashed
                nodes={draft.map((n) => ({
                  ...n,
                  selected: n.id === selected,
                  subtitle: "论证结构 · 非引用关系",
                }))}
                edges={draft
                  .slice(1)
                  .map((n, i) => ({
                    from: draft[i].id,
                    to: n.id,
                    label: "论证顺序",
                  }))}
                onSelect={setSelected}
                onMove={(id, x, y) => {
                  if (!dirty) setRevision(f.revision);
                  setDraft(
                    draft.map((n) => (n.id === id ? { ...n, x, y } : n)),
                  );
                }}
              />
              {!draft.length && (
                <p>添加自己的综述节点，或让 AI 根据选中文献提出结构候选。</p>
              )}
            </section>
            <aside className="frosted-surface design-editor">
              {node ? (
                <>
                  <h3>编辑综述节点</h3>
                  <label>
                    标题
                    <input
                      aria-label="综述节点标题"
                      maxLength={160}
                      value={node.title}
                      onChange={(e) => patch({ title: e.target.value })}
                    />
                  </label>
                  <label>
                    问题、讨论主题与联系
                    <textarea
                      aria-label="综述节点内容"
                      rows={6}
                      maxLength={4000}
                      value={node.body}
                      onChange={(e) => patch({ body: e.target.value })}
                    />
                  </label>
                  <label>
                    待核实事项
                    <textarea
                      aria-label="综述待核实事项"
                      maxLength={1500}
                      value={node.uncertainty}
                      onChange={(e) => patch({ uncertainty: e.target.value })}
                    />
                  </label>
                  <details>
                    <summary>关联具体文献</summary>
                    {p.library?.items.map((i) => (
                      <label key={i.id}>
                        <input
                          type="checkbox"
                          checked={node.evidenceIds.includes(i.id)}
                          onChange={(e) =>
                            patch({
                              evidenceIds: e.target.checked
                                ? [...node.evidenceIds, i.id]
                                : node.evidenceIds.filter((id) => id !== i.id),
                            })
                          }
                        />
                        {i.paper.title}
                      </label>
                    ))}
                  </details>
                  <Sources ids={node.evidenceIds} project={p} />
                  <button
                    onClick={() => {
                      const i = draft.indexOf(node);
                      if (i > 0) {
                        const next = [...draft];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        setDraft(next);
                      }
                    }}
                  >
                    上移章节顺序
                  </button>
                  <button
                    onClick={() => {
                      const i = draft.indexOf(node);
                      if (i < draft.length - 1) {
                        const next = [...draft];
                        [next[i + 1], next[i]] = [next[i], next[i + 1]];
                        setDraft(next);
                      }
                    }}
                  >
                    下移章节顺序
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("删除此综述节点？"))
                        setDraft(draft.filter((n) => n.id !== node.id));
                    }}
                  >
                    删除综述节点
                  </button>
                </>
              ) : (
                <p>
                  点击地图节点编辑，拖动节点保存布局；章节顺序与提纲保持一致。
                </p>
              )}
            </aside>
          </div>
          <ol>
            {draft.map((n) => (
              <li key={n.id}>
                <button onClick={() => setSelected(n.id)}>{n.title}</button>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}
