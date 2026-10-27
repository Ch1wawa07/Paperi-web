"use client";
import { useState } from "react";
import type { Project } from "@/lib/projects";
import {
  isPaper,
  type Paper,
  type BibliographyOrigin,
  type SavedPaper,
} from "@/lib/literature";
import { importedPaper } from "@/lib/bibliography";
import { getPDF } from "@/lib/local-files";
import { pdfMetadataCandidates } from "@/lib/pdf-metadata";
import {
  pdfDiagnosticRecord,
  serializePDFDiagnostics,
} from "@/lib/pdf-diagnostics";
import { useProjects } from "./project-provider";
import { downloadText } from "./workspace-common";
export const originLabels: Record<BibliographyOrigin, string> = {
  "pdf-body": "PDF 正文",
  "pdf-info": "PDF 属性",
  filename: "文件名",
  user: "用户确认",
};
export function BibliographyReview({
  project: p,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const { saveLibrary, busy } = useProjects();
  const [revision] = useState(p.library!.revision);
  const [rows, setRows] = useState(p.library!.items);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  function update(id: string, patch: Partial<Paper>) {
    setRows((rows) =>
      rows.map((i) =>
        i.id === id
          ? {
              ...i,
              paper: { ...i.paper, ...patch },
              bibliography: {
                fields: {
                  ...i.bibliography?.fields,
                  ...Object.fromEntries(
                    Object.keys(patch).map((k) => [k, "user"]),
                  ),
                },
              },
            }
          : i,
      ),
    );
  }
  async function save() {
    const now = new Date().toISOString();
    const items = rows.map((i) => {
      const original = p.library!.items.find((x) => x.id === i.id)!;
      const changed =
        JSON.stringify(i.paper) !== JSON.stringify(original.paper);
      const paper =
        changed && i.paper.source !== "import"
          ? importedPaper({
              ...i.paper,
              key: `import:${crypto.randomUUID()}`,
              source: "import",
              identity: "imported",
              verification: undefined,
              openAlexId: null,
              citations: null,
            })
          : i.paper;
      return {
        ...i,
        paper,
        updatedAt: now,
        bibliography: {
          fields: {
            title: "user" as const,
            ...(paper.authors.length ? { authors: "user" as const } : {}),
            ...(paper.year ? { year: "user" as const } : {}),
            ...(paper.venue ? { venue: "user" as const } : {}),
          },
          confirmedAt: now,
        },
      };
    });
    if (
      items.some((i) => !isPaper(i.paper) || i.paper.title === "题名待核对")
    ) {
      setError(
        "请为每篇填写原文题名，检查年份和作者；缺失作者、年份或来源可以留空待核对。",
      );
      return;
    }
    if (p.library!.revision !== revision) {
      setError("文献库已变化，当前编辑保留，请关闭后重新核对，未覆盖新资料。");
      return;
    }
    if (await saveLibrary(p.id, revision, { ...p.library!, items })) onClose();
  }
  const rowField = (
    i: SavedPaper,
    key: "title" | "authors" | "year" | "venue",
    label: string,
  ) => (
    <label key={key}>
      {label}{" "}
      <small>
        来自：
        {i.bibliography?.fields[key]
          ? originLabels[i.bibliography.fields[key]!]
          : "待核对（旧记录）"}
      </small>
      <input
        aria-label={`${i.id}-${key}`}
        type={key === "year" ? "number" : "text"}
        min={key === "year" ? 1000 : undefined}
        max={key === "year" ? 2200 : undefined}
        maxLength={key === "title" ? 1200 : key === "authors" ? 3000 : 500}
        value={
          key === "authors" ? i.paper.authors.join("；") : (i.paper[key] ?? "")
        }
        placeholder="待核对"
        onChange={(e) =>
          update(i.id, {
            [key]:
              key === "authors"
                ? e.target.value
                    .split(/[;；]/)
                    .map((x) => x.trim())
                    .filter(Boolean)
                : key === "year"
                  ? e.target.value
                    ? Number(e.target.value)
                    : null
                  : e.target.value || null,
          })
        }
      />
    </label>
  );
  return (
    <section
      className="frosted-surface workflow-panel bibliography-review"
      aria-label="批量校对书目"
    >
      <h2>批量校对书目</h2>
      <p>
        请按原PDF核对后一次保存到当前项目。只修改书目，原PDF、笔记、历史分析保留；受影响的旧分析需重新核验。空字段继续显示待核对。
      </p>
      {rows.map((i) => (
        <article key={i.id} className="import-record">
          <h3>{i.attachment?.name || i.paper.title}</h3>
          <div className="workflow-fields">
            {rowField(i, "title", "题名")}
            {rowField(i, "authors", "作者（分号分隔）")}
            {rowField(i, "year", "年份")}
            {rowField(i, "venue", "期刊 / 学位授予机构 / 会议")}
          </div>
          {i.attachment && (
            <button
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setError("");
                try {
                  const file = await getPDF(p.id, i.attachment!.id);
                  if (!file)
                    throw new Error("当前浏览器找不到原PDF，未改动任何数据。");
                  const c = pdfMetadataCandidates(file.pages, {
                    ...file.metadata,
                    filename: file.name,
                  });
                  setRows((rows) =>
                    rows.map((r) =>
                      r.id === i.id
                        ? {
                            ...r,
                            paper: { ...r.paper, ...c.fields },
                            bibliography: c.audit,
                          }
                        : r,
                    ),
                  );
                } catch (e) {
                  setError(e instanceof Error ? e.message : "候选识别失败");
                } finally {
                  setPending(false);
                }
              }}
            >
              从原 PDF 重新识别候选（不自动保存）
            </button>
          )}
        </article>
      ))}
      {error && <p role="alert">{error}</p>}
      <div className="workspace-actions">
        <button
          className="button primary"
          disabled={busy || pending}
          onClick={() => void save()}
        >
          确认并保存本项目全部书目
        </button>
        <button disabled={busy || pending} onClick={onClose}>
          取消校对
        </button>
      </div>
    </section>
  );
}
export function PDFDiagnostics({ project: p }: { project: Project }) {
  const items = p.library!.items.filter((i) => i.attachment);
  const [ids, setIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <details className="pdf-diagnostics">
      <summary>导入诊断导出（本地、可选）</summary>
      <p>
        只导出所选文件名、候选书目、每页字数和最多5处短节选（每处450字），上限64KB。不含原PDF或全文，不自动上传。邮箱、地址和凭证行会过滤；分享前请自行检查。
      </p>
      {items.map((i) => (
        <label key={i.id}>
          <input
            type="checkbox"
            checked={ids.includes(i.id)}
            onChange={(e) =>
              setIds(
                e.target.checked
                  ? [...ids, i.id]
                  : ids.filter((id) => id !== i.id),
              )
            }
          />
          {i.attachment!.name}
        </label>
      ))}
      <button
        disabled={pending || !ids.length}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            const records = [];
            for (const i of items.filter((i) => ids.includes(i.id))) {
              const file = await getPDF(p.id, i.attachment!.id);
              records.push(pdfDiagnosticRecord(i, file));
            }
            downloadText(
              "Paperi-PDF导入诊断.json",
              serializePDFDiagnostics(records),
              "application/json",
            );
          } catch (e) {
            setError(e instanceof Error ? e.message : "诊断导出失败");
          } finally {
            setPending(false);
          }
        }}
      >
        导出所选文献诊断（不调用 AI）
      </button>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
