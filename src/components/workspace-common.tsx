"use client";
import Link from "next/link";
import { useProjects } from "./project-provider";
import {
  emptyWorkbench,
  selectedConcepts,
  selectedEvidence,
  type Workbench,
} from "@/lib/workbench";
import type { Project } from "@/lib/projects";
export function WorkspaceToolbar({
  title,
  project,
  children,
}: {
  title: string;
  project?: Project;
  children?: React.ReactNode;
}) {
  return (
    <div className="workspace-toolbar">
      <div>
        <h1>{title}</h1>
        <span>{project?.name ?? "尚未选择研究"}</span>
      </div>
      <div className="workspace-actions">
        {children}
        <Link className="text-button" href="/">
          管理研究
        </Link>
      </div>
    </div>
  );
}
export function EvidencePicker({ project }: { project: Project }) {
  const { busy, saveWorkbench } = useProjects();
  const w = project.workbench ?? emptyWorkbench(),
    selected = selectedEvidence(project);
  return (
    <details className="shared-evidence">
      <summary>本研究已选文献 · {selected.length} 篇（点击调整）</summary>
      <div className="evidence-picker">
        {!project.library?.items.length && (
          <Link href="/literature">先检索并收藏文献</Link>
        )}
        {project.library?.items.map((i) => (
          <label key={i.id}>
            <input
              type="checkbox"
              checked={selected.some((s) => s.id === i.id)}
              disabled={
                busy ||
                (!selected.some((s) => s.id === i.id) && selected.length >= 8)
              }
              onChange={(e) =>
                void saveWorkbench(project.id, w.revision, {
                  ...w,
                  evidenceIds: e.target.checked
                    ? [...selected.map((s) => s.id), i.id]
                    : selected.filter((s) => s.id !== i.id).map((s) => s.id),
                })
              }
            />
            <span>{i.paper.title}</span>
          </label>
        ))}
      </div>
    </details>
  );
}
export function ProfileStrip({ project }: { project: Project }) {
  return (
    <div className="profile-strip">
      <span>
        {project.exploration?.seed
          ? "已确认问题 · 继续探索"
          : "探索中 · 无需先确定问题"}
      </span>
      {selectedConcepts(project).map((c) => (
        <span className="concept-chip" key={c}>
          {c}
        </span>
      ))}
    </div>
  );
}
export function downloadText(
  name: string,
  text: string,
  type = "text/markdown;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function researchFetch(body: unknown, signal?: AbortSignal) {
  const r = await fetch("/api/research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "研究辅助暂未完成。");
  return data;
}
export const nextWorkbench = (project: Project): Workbench =>
  project.workbench ?? emptyWorkbench();
