"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/projects";
import {
  emptyWorkflow,
  isSections,
  sourceFingerprint,
  workflowEvidence,
  type Analysis,
  type ReadingSection,
} from "@/lib/workflow";
import { selectedConcepts, emptyWorkbench } from "@/lib/workbench";
import { getPDF, removePDF } from "@/lib/local-files";
import { useProjects } from "./project-provider";
export function WorkflowSelection({ project: p }: { project: Project }) {
  const { saveWorkflow, busy } = useProjects();
  const f = p.workflow ?? emptyWorkflow();
  const selected = workflowEvidence(p);
  return (
    <details className="shared-evidence">
      <summary>
        本次使用文献 · {selected.length} 篇（默认全部，点击调整）
      </summary>
      <p>取消选择不会删除文献。AI 每次最多 30 篇，超过时请分组。</p>
      <div className="evidence-picker">
        {p.library?.items.map((i) => (
          <label key={i.id}>
            <input
              type="checkbox"
              disabled={busy}
              checked={selected.some((x) => x.id === i.id)}
              onChange={(e) =>
                void saveWorkflow(p.id, f.revision, {
                  ...f,
                  selection: e.target.checked
                    ? [...selected.map((x) => x.id), i.id]
                    : selected.filter((x) => x.id !== i.id).map((x) => x.id),
                })
              }
            />
            {i.paper.title}
          </label>
        ))}
      </div>
      <button
        onClick={() =>
          void saveWorkflow(p.id, f.revision, { ...f, selection: null })
        }
      >
        使用全部当前文献
      </button>
      <p>所选集合随项目保存；新增或删除后会提示旧分析需要更新。</p>
    </details>
  );
}
export function Sources({
  ids,
  project: p,
}: {
  ids: string[];
  project: Project;
}) {
  return (
    <ul>
      {ids.map((id) => {
        const i = p.library?.items.find((i) => i.id === id);
        return (
          <li key={id}>
            {i ? (
              <details>
                <summary>{i.paper.title}</summary>
                <p>
                  {i.paper.authors.join("；")} · {i.paper.year ?? "年份未获取"}{" "}
                  · {i.paper.venue ?? "出版来源未获取"}
                </p>
                <p>{i.paper.abstract ?? "尚无摘要，不能推断研究结论。"}</p>
                {i.paper.recordUrl && (
                  <a
                    href={i.paper.recordUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    核对来源 ↗
                  </a>
                )}
              </details>
            ) : (
              <strong className="paper-warning">来源已移除，需要更新</strong>
            )}
          </li>
        );
      })}
    </ul>
  );
}
export async function requestWorkflow(
  p: Project,
  task: Analysis["kind"],
  sourceIds: string[],
  question: string,
  signal: AbortSignal,
): Promise<Analysis> {
  const items = (p.library?.items ?? []).filter((i) =>
    sourceIds.includes(i.id),
  );
  if (items.length > 30)
    throw new Error("每次最多 30 篇，请取消部分选择后分组分析。");
  const evidence = [];
  let remaining = 60000;
  for (const i of items) {
    const pages: { page: number; text: string }[] = [];
    if (i.attachment) {
      const file = await getPDF(p.id, i.attachment.id);
      if (!file)
        throw new Error(
          `《${i.paper.title}》的 PDF 在当前浏览器不可读，请重新附加，或移除 PDF 关联后使用摘要。`,
        );
      let budget = Math.min(24000, Math.floor(60000 / items.length), remaining);
      for (const [index, text] of file.pages.entries()) {
        if (budget <= 0) break;
        const excerpt = text.slice(0, budget);
        pages.push({ page: index + 1, text: excerpt });
        budget -= excerpt.length;
        remaining -= excerpt.length;
      }
    }
    evidence.push({ id: i.id, paper: i.paper, pages });
  }
  const r = await fetch("/api/workflow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task,
      observation: p.observation,
      concepts: selectedConcepts(p),
      direction: p.workflow?.direction?.text ?? "",
      question,
      evidence,
    }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(100000)]),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "分析失败，请重试。");
  if (
    !isSections(data.sections) ||
    data.sections.some((s: ReadingSection) =>
      s.evidenceIds.some((id) => !sourceIds.includes(id)),
    )
  )
    throw new Error("分析格式或来源不完整，未保存。");
  return {
    id: crypto.randomUUID(),
    kind: task,
    fingerprint: sourceFingerprint(p),
    sourceIds,
    createdAt: new Date().toISOString(),
    sections: data.sections,
    inputSnapshot: JSON.stringify({
      observation: p.observation,
      concepts: selectedConcepts(p),
      direction: p.workflow?.direction?.text ?? "",
      question,
      evidence,
    }),
  } satisfies Analysis;
}
export function LiteratureAnalysis({
  project: p,
  mode,
}: {
  project: Project;
  mode: "context" | "reading";
}) {
  const { saveWorkflow, saveLibrary, saveWorkbench, busy } = useProjects();
  const f = p.workflow ?? emptyWorkflow();
  const [selected, setSelected] = useState(() =>
      typeof window === "undefined"
        ? ""
        : sessionStorage.getItem(`paperi.reading.${p.id}`) ||
          p.library?.items[0]?.id ||
          "",
    ),
    [question, setQuestion] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [direction, setDirection] = useState(f.direction?.text ?? ""),
    [result, setResult] = useState<Analysis | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const kind = mode === "reading" ? "reading" : "directions";
  const saved = f.analyses.filter(
    (a) =>
      a.kind === kind && (kind !== "reading" || a.sourceIds.includes(selected)),
  );
  const analysis = result ?? saved.at(-1);
  const stale = !!analysis && analysis.fingerprint !== sourceFingerprint(p);
  async function generate() {
    setError("");
    setPending(true);
    controller.current = new AbortController();
    try {
      const a = await requestWorkflow(
        p,
        kind,
        kind === "reading" ? [selected] : workflowEvidence(p).map((i) => i.id),
        question,
        controller.current.signal,
      );
      if (controller.current.signal.aborted) return;
      setResult(a);
      if (
        !(await saveWorkflow(p.id, f.revision, {
          ...f,
          analyses: [...f.analyses, a],
        }))
      )
        setError("分析已返回但未保存，请复制内容或解决存储冲突后重试。");
    } catch (e) {
      if (!controller.current.signal.aborted)
        setError(e instanceof Error ? e.message : "分析失败");
    } finally {
      if (!controller.current.signal.aborted) setPending(false);
    }
  }
  async function keep(
    section: ReadingSection,
    target: "note" | "concept" | "design",
  ) {
    const item = p.library?.items.find((i) => i.id === selected);
    if (target === "note" && item && p.library) {
      const note = [
        item.note,
        section.title,
        section.body,
        `待核实：${section.uncertainty}`,
      ]
        .filter(Boolean)
        .join("\n");
      if (note.length > 4000) {
        setError("笔记超过 4000 字，请先整理原笔记。");
        return;
      }
      await saveLibrary(p.id, p.library.revision, {
        ...p.library,
        items: p.library.items.map((i) =>
          i.id === item.id
            ? { ...i, note, updatedAt: new Date().toISOString() }
            : i,
        ),
      });
    } else {
      const w = p.workbench ?? emptyWorkbench();
      await saveWorkbench(p.id, w.revision, {
        ...w,
        design: {
          ...w.design,
          nodes: [
            ...w.design.nodes,
            {
              id: crypto.randomUUID(),
              kind: target === "concept" ? "理论 / 概念候选" : "文献精析参考",
              title: section.title,
              body: section.body.slice(0, 2000),
              evidenceIds: section.evidenceIds,
              uncertainty: section.uncertainty.slice(0, 800),
              status: "suggested",
              x: 40 + (w.design.nodes.length % 3) * 270,
              y: 40 + Math.floor(w.design.nodes.length / 3) * 180,
            },
          ],
        },
      });
    }
  }
  return (
    <section className="workflow-panel frosted-surface">
      <h2>{mode === "reading" ? "文献精析" : "从文献集合中选择研究方向"}</h2>
      {mode === "context" ? (
        <WorkflowSelection project={p} />
      ) : (
        <label>
          选择精析文献
          <select
            aria-label="选择精析文献"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setResult(null);
            }}
          >
            {p.library?.items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.paper.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <p>
        只有书目时不分析具体方法与结论；摘要支持有限分析；PDF
        仅发送限量可提取文字节选并保留页码。点击分析才发送所选资料给已配置的
        AI。
      </p>
      <label>
        追问或本次关注点
        <input
          aria-label="追问或本次关注点"
          maxLength={1200}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="例如：这些研究适合本科生怎样继续？"
        />
      </label>
      <button
        className="button primary"
        disabled={pending || busy || !p.library?.items.length}
        onClick={() => void generate()}
      >
        {pending
          ? "正在分析…"
          : mode === "reading"
            ? "分析 / 追问这篇文献"
            : "生成 / 追问候选研究方向"}
      </button>
      {error && (
        <p role="alert" className="literature-error">
          {error} 可修正后再次点击重试。
        </p>
      )}
      {stale && (
        <p className="source-notice">
          文献库或研究上下文已变化，当前分析基于之前的文献集合。历史内容保留，请重新分析。
        </p>
      )}
      {analysis && (
        <>
          <p>
            生成于 {new Date(analysis.createdAt).toLocaleString()} · AI
            候选解释，用户尚需核实
          </p>
          {analysis.sections.map((s, index) => (
            <details key={index} className="analysis-card" open>
              <summary>{s.title}</summary>
              <p>{s.body}</p>
              {s.quote && (
                <blockquote>
                  {s.quote}
                  {s.page && `（PDF 第 ${s.page} 页）`}
                </blockquote>
              )}
              <p>待核实：{s.uncertainty}</p>
              <Sources project={p} ids={s.evidenceIds} />
              <div className="workspace-actions">
                {mode === "context" ? (
                  <>
                    <button
                      disabled={busy || stale}
                      onClick={() => {
                        setDirection(`${s.title}\n${s.body}`);
                        void saveWorkflow(p.id, f.revision, {
                          ...f,
                          direction: {
                            text: `${s.title}\n${s.body}`,
                            evidenceIds: s.evidenceIds,
                            fingerprint: sourceFingerprint(p),
                          },
                        });
                      }}
                    >
                      选择这个研究方向
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        const next = {
                          ...analysis,
                          sections: analysis.sections.filter(
                            (_, i) => i !== index,
                          ),
                        };
                        setResult(next);
                        void saveWorkflow(p.id, f.revision, {
                          ...f,
                          analyses: f.analyses.map((a) =>
                            a.id === analysis.id ? next : a,
                          ),
                        });
                      }}
                    >
                      拒绝此方向
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      disabled={busy || stale}
                      onClick={() => void keep(s, "note")}
                    >
                      保存为研究笔记
                    </button>
                    <button
                      disabled={busy || stale}
                      onClick={() => void keep(s, "concept")}
                    >
                      加入理论 / 概念候选
                    </button>
                    <button
                      disabled={busy || stale}
                      onClick={() => void keep(s, "design")}
                    >
                      加入研究设计参考
                    </button>
                    <button
                      disabled={busy || stale}
                      onClick={() =>
                        void saveWorkflow(p.id, f.revision, {
                          ...f,
                          review: [
                            ...f.review,
                            {
                              id: crypto.randomUUID(),
                              title: s.title,
                              body: s.body,
                              evidenceIds: s.evidenceIds,
                              uncertainty: s.uncertainty,
                              x: 40,
                              y: 40 + f.review.length * 160,
                            },
                          ],
                          reviewFingerprint: sourceFingerprint(p),
                        })
                      }
                    >
                      作为综述依据
                    </button>
                  </>
                )}
              </div>
            </details>
          ))}
        </>
      )}
      {mode === "context" && (
        <>
          <h3>我的研究方向</h3>
          <textarea
            aria-label="我的研究方向"
            rows={5}
            maxLength={4000}
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            placeholder="可以自行输入，不必接受 AI 方案"
          />
          <button
            className="button secondary"
            disabled={busy || !direction.trim()}
            onClick={() =>
              void saveWorkflow(p.id, f.revision, {
                ...f,
                direction: {
                  text: direction,
                  evidenceIds:
                    f.direction?.evidenceIds ??
                    workflowEvidence(p).map((i) => i.id),
                  fingerprint: sourceFingerprint(p),
                },
              })
            }
          >
            保存我编辑的方向
          </button>
          <Link className="button primary" href="/review">
            进入文献综述与研究整合 →
          </Link>
        </>
      )}
      {mode === "reading" &&
        p.library?.items.some((i) => i.id === selected) && (
          <button
            disabled={busy || pending}
            onClick={async () => {
              const item = p.library!.items.find((i) => i.id === selected)!;
              if (
                !confirm(
                  `从当前项目移除《${item.paper.title}》？关联分析会标记来源失效。`,
                )
              )
                return;
              if (
                await saveLibrary(p.id, p.library!.revision, {
                  ...p.library!,
                  items: p.library!.items.filter((i) => i.id !== selected),
                })
              ) {
                setSelected(
                  p.library!.items.find((i) => i.id !== selected)?.id ?? "",
                );
                setResult(null);
                if (item.attachment)
                  try {
                    await removePDF(p.id, item.attachment.id);
                  } catch {
                    setError("题录已移除，但 PDF 清理失败。");
                  }
              }
            }}
          >
            从当前研究移除此文献
          </button>
        )}
      <details>
        <summary>历史分析 · {saved.length} 次</summary>
        {saved.map((a) => (
          <button key={a.id} onClick={() => setResult(a)}>
            {new Date(a.createdAt).toLocaleString()}
          </button>
        ))}
      </details>
    </section>
  );
}
