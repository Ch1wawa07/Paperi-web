"use client";
import type { Project } from "@/lib/projects";
export function ProjectHistory({
  project: p,
  initiallyOpen = false,
}: {
  project: Project;
  initiallyOpen?: boolean;
}) {
  if (!p.workflow?.review.length && !p.workbench?.design.nodes.length)
    return null;
  return (
    <details
      className="legacy-history frosted-surface workflow-panel"
      open={initiallyOpen}
    >
      <summary>旧版本研究资料 · 只读保留</summary>
      <p>
        这些资料仍在项目备份中。新版研究设计可继续编辑，旧版资料只读保留，没有删除。
      </p>
      {p.workflow?.review.map((n) => (
        <article key={n.id}>
          <h3>{n.title}</h3>
          <p>{n.body}</p>
          {n.evidenceIds.some(
            (id) => !p.library?.items.some((i) => i.id === id),
          ) && <p className="source-notice">部分依据已移除，需要核对。</p>}
        </article>
      ))}
      {p.workbench?.design.nodes.map((n) => (
        <article key={n.id}>
          <h3>{n.title}</h3>
          <p>{n.body}</p>
        </article>
      ))}
    </details>
  );
}
