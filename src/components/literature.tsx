"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useProjects } from "./project-provider";
import { WorkspaceToolbar, downloadText } from "./workspace-common";
import { ResearchPreparation } from "./research-preparation";
import {
  emptyLibrary,
  identityLabel,
  isPaper,
  normalizeDOI,
  safeWebURL,
  type Paper,
  type SavedPaper,
  type Library,
} from "@/lib/literature";
import {
  parseBibliography,
  duplicateOf,
  importedPaper,
  type ImportPreview,
} from "@/lib/bibliography";
import {
  extractPDF,
  savePDF,
  getPDF,
  removePDF,
  type LocalPDF,
} from "@/lib/local-files";
import type { Project } from "@/lib/projects";
import { CitationNetwork } from "./citation-network";
import { LiteratureAnalysis } from "./literature-analysis";
export function Literature({
  requestProject,
  initialMode = "start",
  fromConcepts=false,
}: {
  requestProject?: string;
  initialMode?: string;
  initialQuery?: string;
  fromConcepts?: boolean;
}) {
  const { snapshot, ready } = useProjects();
  const p = snapshot.projects.find((p) => p.id === snapshot.activeId);
  return (
    <div className="module-page">
      <WorkspaceToolbar title="文献工作台" project={p} />
      {requestProject && p && requestProject !== p.id ? (
        <p className="source-notice">
          链接属于另一个项目，请先在顶部切换项目。
        </p>
      ) : ready && p ? (
        <LibraryWorkspace key={p.id} p={p} initialMode={initialMode} prepare={fromConcepts} />
      ) : (
        <Link href="/">选择或创建研究项目</Link>
      )}
    </div>
  );
}
function LibraryWorkspace({
  p,
  initialMode,
  prepare,
}: {
  p: Project;
  initialMode: string;
  prepare:boolean;
}) {
  const { saveLibrary, busy } = useProjects();
  const lib = p.library ?? emptyLibrary();
  const [mode, setMode] = useState(
      initialMode === "start"
        ? lib.items.length
          ? "library"
          : "import"
        : initialMode,
    ),
    [text, setText] = useState(""),
    [preview, setPreview] = useState<ImportPreview | null>(null),
    [decisions, setDecisions] = useState<Record<number, string>>({}),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [editing, setEditing] = useState<SavedPaper | null>(null),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [tag, setTag] = useState(""),
    [pdf, setPDF] = useState<LocalPDF | null>(null),
    [progress, setProgress] = useState(""),
    [pending, setPending] = useState(false),
    [previewRevision, setPreviewRevision] = useState(lib.revision);
  const reading = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      reading.current?.abort(new Error("已取消 PDF 读取。"));
    };
  }, []);
  const filtered = lib.items.filter(
    (i) =>
      (!category || i.categoryIds.includes(category)) &&
      `${i.paper.title} ${i.paper.authors.join(" ")} ${i.note}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  async function readFile(file: File) {
    setError("");
    setPending(true);
    reading.current = new AbortController();
    setProgress("正在读取文件…");
    try {
      if (/\.pdf$/i.test(file.name)) {
        const result = await extractPDF(file, {
          signal: reading.current!.signal,
          onProgress: (p) => setProgress(p.stage),
        });
        if (!mounted.current) return;
        setPDF({
          id: crypto.randomUUID(),
          projectId: p.id,
          blob: file,
          name: file.name,
          pages: result.pages,
          updatedAt: new Date().toISOString(),
        });
        setPreview({
          rows: [
            {
              paper: importedPaper({
                title: result.title || file.name.replace(/\.pdf$/i, ""),
                authors: result.author ? [result.author] : [],
              }),
              warnings: [
                "PDF 属性可能不准确，请逐项确认标题和作者；年份与出版机构需自行补充。",
              ],
              raw: result.pages[0].slice(0, 2000),
            },
          ],
          failures: [],
        });
        setPreviewRevision(lib.revision);
        setDecisions({});
      } else {
        if (file.size > 2_000_000) throw new Error("题录文件最大 2 MB。");
        const bytes = await file.arrayBuffer();
        let content = new TextDecoder("utf-8").decode(bytes);
        if (content.includes("\uFFFD"))
          content = new TextDecoder("gb18030").decode(bytes);
        setText(content);
        parse(content);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "文件读取失败");
    } finally {
      if (mounted.current) setPending(false);
    }
  }
  function parse(content = text) {
    setError("");
    setPDF(null);
    try {
      setPreview(parseBibliography(content));
      setDecisions({});
      setPreviewRevision(lib.revision);
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : "解析失败");
    }
  }
  async function commitImport() {
    if (!preview) return;
    setError("");
    if (lib.revision !== previewRevision) {
      setError("文献库已变化，请重新解析预览以核对重复记录。");
      return;
    }
    let next: Library = { ...lib, items: [...lib.items] };
    let fileSaved = false;
    try {
      for (const [index, row] of preview.rows.entries()) {
        const paper = row.paper;
        if (!isPaper(paper))
          throw new Error(`第 ${index + 1} 条字段不完整，请检查。`);
        const duplicate = duplicateOf(paper, next);
        const action = decisions[index] ?? (duplicate ? "skip" : "keep");
        if (action === "skip") continue;
        const now = new Date().toISOString();
        const attachment = pdf
          ? {
              id: pdf.id,
              name: pdf.name,
              pages: pdf.pages.length,
              characters: pdf.pages.join("").length,
              updatedAt: pdf.updatedAt,
            }
          : undefined;
        if (duplicate && action === "merge") {
          next = {
            ...next,
            items: next.items.map((i) =>
              i.id === duplicate.id
                ? {
                    ...i,
                    paper: {
                      ...i.paper,
                      abstract: i.paper.abstract ?? paper.abstract,
                    },
                    updatedAt: now,
                  }
                : i,
            ),
          };
        } else
          next.items.push({
            id: crypto.randomUUID(),
            paper,
            categoryIds: [],
            note: "",
            savedAt: now,
            updatedAt: now,
            ...(attachment ? { attachment } : {}),
          });
      }
      if (next.items.length > 300)
        throw new Error("每个项目最多 300 篇文献，请分项目管理。");
      if (pdf && next.items.some((i) => i.attachment?.id === pdf.id)) {
        await savePDF(pdf);
        fileSaved = true;
      }
      if (!mounted.current) {
        if (fileSaved && pdf) await removePDF(p.id, pdf.id);
        return;
      }
      if (!(await saveLibrary(p.id, previewRevision, next))) {
        if (fileSaved && pdf) await removePDF(p.id, pdf.id);
        throw new Error("导入尚未保存，请处理上方存储提示。");
      }
      setPreview(null);
      setPDF(null);
      setText("");
      setMode("library");
      setMessage("导入已完成。题录未经外部认证，请核对来源。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  }
  async function remove(item: SavedPaper) {
    if (
      !confirm(
        `从当前研究移除《${item.paper.title}》？关联分析将标记来源失效，其他项目不受影响。`,
      )
    )
      return;
    if (
      await saveLibrary(p.id, lib.revision, {
        ...lib,
        items: lib.items.filter((i) => i.id !== item.id),
      })
    ) {
      setEditing(null);
      setMessage("文献已移除；引用它的分析保留并标记待更新。");
      if (item.attachment)
        try {
          await removePDF(p.id, item.attachment.id);
        } catch {
          setError("文献已移除，但 PDF 清理失败，可重试清理浏览器文件存储。");
        }
    }
  }
  return (
    <>
      <div
        className="workspace-actions workflow-tabs"
        aria-label="文献工作台模块"
      >
        {[
          ["import", "导入文献"],
          ...(lib.items.length ? [["library", "已导入文献"]] : []),
          ["citations", "文献星图"],
          ["context", "研究脉络"],
          ["reading", "文献精析"],
        ].map(([key, label]) => (
          <button
            className={`button ${mode === key ? "primary" : "secondary"}`}
            key={key}
            aria-pressed={mode === key}
            onClick={() => setMode(key)}
          >
            {label}
          </button>
        ))}
        <Link href="/review">研究整合 →</Link>
      </div>
      {error && (
        <p role="alert" className="literature-error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {mode === "library" && (
        <>
          <div className="workspace-actions">
            <input
              aria-label="筛选我的文献"
              placeholder="按标题、作者或笔记筛选"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              aria-label="文献分类"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">全部分类</option>
              {lib.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <span>{lib.items.length} 篇</span>
          </div>
          <details>
            <summary>管理分类标签</summary>
            <div className="workspace-actions">
              <input
                aria-label="新分类名称"
                value={tag}
                maxLength={40}
                onChange={(e) => setTag(e.target.value)}
              />
              <button
                disabled={busy || !tag.trim()}
                onClick={async () => {
                  if (
                    await saveLibrary(p.id, lib.revision, {
                      ...lib,
                      categories: [
                        ...lib.categories,
                        { id: crypto.randomUUID(), name: tag.trim() },
                      ],
                    })
                  )
                    setTag("");
                }}
              >
                新增分类
              </button>
              {lib.categories.map((c) => (
                <button
                  key={"rename-" + c.id}
                  onClick={() => {
                    const name = prompt("修改分类名称", c.name);
                    if (name?.trim())
                      void saveLibrary(p.id, lib.revision, {
                        ...lib,
                        categories: lib.categories.map((x) =>
                          x.id === c.id ? { ...x, name: name.trim() } : x,
                        ),
                      });
                  }}
                >
                  重命名 {c.name}
                </button>
              ))}
              {lib.categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    if (confirm(`删除分类“${c.name}”？文献和笔记保留。`))
                      void saveLibrary(p.id, lib.revision, {
                        ...lib,
                        categories: lib.categories.filter((x) => x.id !== c.id),
                        items: lib.items.map((i) => ({
                          ...i,
                          categoryIds: i.categoryIds.filter((x) => x !== c.id),
                        })),
                      });
                  }}
                >
                  移除 {c.name}
                </button>
              ))}
            </div>
          </details>
          {!lib.items.length ? (
            <section className="literature-empty frosted-surface">
              <h2>还没有研究文献</h2>
              <p>前往学校数据库检索并导入，开始建立你的研究资料库。</p>
              <div className="workspace-actions">
                <a
                  href={p.workflow?.libraryURL ?? "https://www.lib.szu.edu.cn/"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  前往学校图书馆检索 ↗
                </a>
                <button
                  className="button primary"
                  onClick={() => setMode("import")}
                >
                  导入文献
                </button>
              </div>
            </section>
          ) : (
            <div className="paper-list">
              {filtered.map((i) => (
                <article className="paper-card frosted-surface" key={i.id}>
                  <span>{identityLabel(i.paper)}</span>
                  <h2>{i.paper.title}</h2>
                  <p>
                    {i.paper.authors.join("；") || "作者未获取"} ·{" "}
                    {i.paper.year ?? "年份未获取"} ·{" "}
                    {i.paper.venue ?? "出版来源未获取"}
                  </p>
                  <p>
                    {i.paper.citations === null
                      ? "暂无被引数据"
                      : `${i.paper.citations} 次被引（${i.paper.source}）`}{" "}
                    ·{" "}
                    {i.attachment
                      ? "有本地 PDF"
                      : i.paper.abstract
                        ? "有摘要"
                        : "仅有书目"}
                  </p>
                  {i.paper.recordUrl && (
                    <a
                      href={i.paper.recordUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      原始来源记录 ↗
                    </a>
                  )}
                  <p>{i.note}</p>
                  <div className="workspace-actions">
                    <button onClick={() => setEditing(i)}>
                      编辑资料、分类与笔记
                    </button>
                    <button
                      onClick={() => {
                        setMode("reading");
                        setEditing(null);
                        sessionStorage.setItem(`paperi.reading.${p.id}`, i.id);
                      }}
                    >
                      文献精析
                    </button>
                    <button onClick={() => void remove(i)}>删除文献</button>
                  </div>
                </article>
              ))}
            </div>
          )}
          <ResearchPreparation key={p.id + ":prep"} project={p} />
        </>
      )}
      {mode === "import" && (
        <section className="frosted-surface workflow-panel import-surface">
          <div className="import-intro">
            <span className="eyebrow">BRING YOUR RESEARCH IN</span>
            <h2>把找到的论文，带进研究里。</h2>
            <p>
              从一篇 PDF
              或一组书目开始。先核对导入预览，再进入文献理解与研究设计。
            </p>
          </div>
          <p>
            支持 RIS、BibTeX、EndNote 标签题录和逐行参考文献。中文 UTF-8 /
            GB18030；最大 2 MB。也可导入可提取文字的 PDF（20 MB / 150 页以内）。
          </p>
          <label>
            选择题录或 PDF 文件
            <input
              aria-label="选择题录或 PDF 文件"
              type="file"
              accept=".ris,.bib,.txt,.enw,.pdf"
              disabled={pending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void readFile(f);
                e.target.value = "";
              }}
            />
          </label>
          <label>
            粘贴多条参考文献
            <textarea
              aria-label="粘贴多条参考文献"
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="每行一篇：张三；李四. 品牌传播研究[J]. 测试期刊, 2024."
            />
          </label>
          <button
            className="button secondary"
            disabled={pending}
            onClick={() => parse()}
          >
            解析并预览
          </button>
          <details>
            <summary>格式说明与样例</summary>
            <p>
              优先在数据库选择“导出 RIS / BibTeX / EndNote”。EndNote 应以 %0
              开始；知网自定义 RefWorks 格式请改选上述格式。纯文字需有 [J]、[D]
              或 [C] 标识，不能可靠拆分的行会列为失败。
            </p>
            <pre>
              {
                "TY  - JOUR\nTI  - 测试文献（仅格式演示）\nAU  - 张三\nPY  - 2024\nJO  - 测试期刊\nER  -"
              }
            </pre>
            <button
              onClick={() =>
                downloadText(
                  "Paperi-格式演示.ris",
                  "TY  - JOUR\nTI  - 测试文献（仅格式演示）\nAU  - 张三\nPY  - 2024\nJO  - 测试期刊\nER  -",
                  "text/plain",
                )
              }
            >
              下载演示 RIS
            </button>
          </details>
          {pending && (
            <div className="pdf-progress" role="status">
              <span className="spinner" />
              <p>
                {progress}
                <small>
                  本地提取文字，不调用 AI；最长 60 秒。预览确认后才保存。
                </small>
              </p>
              <button
                type="button"
                onClick={() =>
                  reading.current?.abort(
                    new Error("已取消 PDF 读取，可重新选择文件。"),
                  )
                }
              >
                取消读取
              </button>
            </div>
          )}
          {preview && (
            <>
              <h3>
                导入预览：{preview.rows.length} 篇可编辑，
                {preview.failures.length} 条失败
              </h3>
              {preview.failures.map((e, i) => (
                <p role="alert" key={i}>
                  第 {e.record} 条：{e.reason}
                  <br />
                  {e.raw}
                </p>
              ))}
              {preview.rows.map((row, index) => {
                const simulated = {
                  ...lib,
                  items: [
                    ...lib.items,
                    ...preview.rows.slice(0, index).map((r, j) => ({
                      id: `preview-${j}`,
                      paper: r.paper,
                      categoryIds: [],
                      note: "",
                      savedAt: "",
                      updatedAt: "",
                    })),
                  ],
                };
                const dup = duplicateOf(row.paper, simulated);
                return (
                  <details className="import-record" key={row.paper.key} open>
                    <summary>
                      {index + 1}. {row.paper.title || "标题待填写"}{" "}
                      {dup ? "· 可能重复" : ""}
                    </summary>
                    <p>{row.warnings.join("；")}</p>
                    <PaperFields
                      paper={row.paper}
                      onChange={(paper) =>
                        setPreview({
                          ...preview,
                          rows: preview.rows.map((r, i) =>
                            i === index ? { ...r, paper } : r,
                          ),
                        })
                      }
                    />
                    <label>
                      导入方式
                      <select
                        aria-label={`第 ${index + 1} 条导入方式`}
                        value={decisions[index] ?? (dup ? "skip" : "keep")}
                        onChange={(e) =>
                          setDecisions({
                            ...decisions,
                            [index]: e.target.value,
                          })
                        }
                      >
                        <option value="keep">保留为独立记录</option>
                        <option value="skip">跳过</option>
                        {dup && (
                          <option value="merge">
                            合并：保留原记录，补充缺失摘要
                          </option>
                        )}
                      </select>
                    </label>
                    {dup && (
                      <p>
                        匹配：{dup.paper.title}
                        。题名、作者和年份相同仅视为可能重复；合并保留原笔记和分类。
                      </p>
                    )}
                    {pdf && (
                      <details>
                        <summary>PDF 首页可提取文本（用于核对）</summary>
                        <pre>{row.raw}</pre>
                      </details>
                    )}
                  </details>
                );
              })}
              <button
                className="button primary"
                disabled={busy || pending || !preview.rows.length}
                onClick={() => void commitImport()}
              >
                确认批量导入当前项目
              </button>
              <button
                onClick={() => {
                  setPreview(null);
                  setPDF(null);
                }}
              >
                取消预览
              </button>
            </>
          )}
        </section>
      )}
      {mode === "import" && <ResearchPreparation key={p.id+":import-preparation"} project={p} initialOpen={prepare}/>}
      {mode === "citations" && <CitationNetwork project={p} />}
      {(mode === "context" || mode === "reading") && (
        <LiteratureAnalysis key={mode} project={p} mode={mode} />
      )}
      {editing && (
        <PaperEditor
          key={editing.id}
          item={editing}
          project={p}
          onClose={() => setEditing(null)}
          onRemove={() => void remove(editing)}
        />
      )}
    </>
  );
}
function PaperFields({
  paper,
  onChange,
}: {
  paper: Paper;
  onChange: (p: Paper) => void;
}) {
  return (
    <div className="workflow-fields">
      <label>
        论文标题
        <input
          aria-label="论文标题"
          maxLength={1200}
          value={paper.title}
          onChange={(e) => onChange({ ...paper, title: e.target.value })}
        />
      </label>
      <label>
        作者（分号分隔）
        <input
          aria-label="作者"
          value={paper.authors.join("；")}
          onChange={(e) =>
            onChange({
              ...paper,
              authors: e.target.value ? e.target.value.split(/[;；]/) : [],
            })
          }
        />
      </label>
      <label>
        发表年份
        <input
          aria-label="发表年份"
          type="number"
          min={1000}
          max={2200}
          value={paper.year ?? ""}
          onChange={(e) =>
            onChange({
              ...paper,
              year: e.target.value ? Number(e.target.value) : null,
            })
          }
        />
      </label>
      <label>
        期刊 / 学校 / 会议
        <input
          aria-label="出版来源"
          maxLength={500}
          value={paper.venue ?? ""}
          onChange={(e) =>
            onChange({ ...paper, venue: e.target.value || null })
          }
        />
      </label>
      <label>
        DOI（选填）
        <input
          aria-label="DOI"
          defaultValue={paper.doi ?? ""}
          onBlur={(e) => {
            const doi = normalizeDOI(e.target.value);
            e.target.setCustomValidity(
              e.target.value && !doi ? "请输入有效 DOI，或留空" : "",
            );
            if (!e.target.value || doi) onChange({ ...paper, doi });
          }}
        />
      </label>
      <label>
        原始记录链接
        <input
          aria-label="原始记录链接"
          value={paper.recordUrl}
          onChange={(e) =>
            onChange({
              ...paper,
              recordUrl: e.target.value,
              landingUrl: safeWebURL(e.target.value),
            })
          }
        />
      </label>
      <label>
        文献类型
        <select
          aria-label="文献类型"
          value={paper.kind}
          onChange={(e) => onChange({ ...paper, kind: e.target.value })}
        >
          <option value="journal-article">期刊论文</option>
          <option value="dissertation">学位论文</option>
          <option value="proceedings-article">会议论文</option>
          <option value="book-chapter">学术专著章节</option>
        </select>
      </label>
      <label>
        真实摘要（请从原文补充）
        <textarea
          aria-label="真实摘要"
          maxLength={6000}
          rows={5}
          value={paper.abstract ?? ""}
          onChange={(e) =>
            onChange({ ...paper, abstract: e.target.value || null })
          }
        />
      </label>
    </div>
  );
}
function PaperEditor({
  item,
  project: p,
  onClose,
  onRemove,
}: {
  item: SavedPaper;
  project: Project;
  onClose: () => void;
  onRemove: () => void;
}) {
  const { saveLibrary, busy } = useProjects();
  const lib = p.library ?? emptyLibrary();
  const [paper, setPaper] = useState(item.paper),
    [note, setNote] = useState(item.note),
    [categories, setCategories] = useState(item.categoryIds),
    [revision] = useState(lib.revision),
    [pdf, setPDF] = useState<LocalPDF | null>(null),
    [detach, setDetach] = useState(false),
    [verified, setVerified] = useState<Paper | null>(null),
    [progress, setProgress] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const reading = useRef<AbortController | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => reading.current?.abort(new Error("已取消 PDF 读取。"));
  }, []);
  async function save() {
    setError("");
    if (lib.revision !== revision) {
      setError("文献库已变化，请取消并重新打开编辑。");
      return;
    }
    const changed = JSON.stringify(paper) !== JSON.stringify(item.paper);
    const edited =
      changed &&
      paper.source !== "import" &&
      JSON.stringify(paper) !== JSON.stringify(verified)
        ? importedPaper({
            ...paper,
            key: `import:${crypto.randomUUID()}`,
            source: "import",
            identity: "imported",
            verification: undefined,
            openAlexId: null,
            citations: null,
          })
        : paper;
    if (!isPaper(edited)) {
      setError("字段格式无效，请检查标题、年份和链接。");
      return;
    }
    try {
      if (pdf) await savePDF(pdf);
      const next = {
        ...item,
        paper: edited,
        ...(detach ? { attachment: undefined } : {}),
        note,
        categoryIds: categories,
        updatedAt: new Date().toISOString(),
        ...(pdf
          ? {
              attachment: {
                id: pdf.id,
                name: pdf.name,
                pages: pdf.pages.length,
                characters: pdf.pages.join("").length,
                updatedAt: pdf.updatedAt,
              },
            }
          : {}),
      };
      if (
        await saveLibrary(p.id, revision, {
          ...lib,
          items: lib.items.map((i) => (i.id === item.id ? next : i)),
        })
      ) {
        if ((pdf || detach) && item.attachment)
          await removePDF(p.id, item.attachment.id);
        onClose();
      } else {
        if (pdf) await removePDF(p.id, pdf.id);
        setError("保存未完成，编辑内容保留。");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  }
  return (
    <dialog
      ref={dialog}
      className="project-dialog literature-dialog frosted-surface"
      onCancel={(e) => {
        if (pending || busy) e.preventDefault();
        else onClose();
      }}
    >
      <h2>编辑文献资料</h2>
      <p>修改外部认证字段后将标记为用户编辑题录；不再冒充外部核验。</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <PaperFields paper={paper} onChange={setPaper} />
        <button
          type="button"
          disabled={!paper.doi || pending}
          onClick={async () => {
            setPending(true);
            setError("");
            try {
              const r = await fetch(
                "/api/literature/verify?doi=" + encodeURIComponent(paper.doi!),
              );
              const data = await r.json();
              if (!r.ok || !isPaper(data.paper))
                throw new Error(data.error ?? "未取得完整登记记录");
              setVerified(data.paper);
            } catch (e) {
              setError(e instanceof Error ? e.message : "核对失败");
            } finally {
              setPending(false);
            }
          }}
        >
          按 DOI 核对登记元数据
        </button>
        {verified && (
          <section>
            <h3>登记记录（请比较后决定是否采用）</h3>
            <p>
              {verified.title} · {verified.authors.join("；")} · {verified.year}{" "}
              · {verified.venue}
            </p>
            <a
              href={verified.recordUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              查看登记来源
            </a>
            <button type="button" onClick={() => setPaper(verified)}>
              采用登记记录，保留笔记与分类
            </button>
          </section>
        )}
        {item.attachment && (
          <label>
            <input
              type="checkbox"
              checked={detach}
              onChange={(e) => setDetach(e.target.checked)}
            />
            保存时移除 PDF 关联，保留书目和摘要
          </label>
        )}
        <label>
          阅读笔记
          <textarea
            aria-label="阅读笔记"
            maxLength={4000}
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <fieldset>
          <legend>分类标签</legend>
          {lib.categories.map((c) => (
            <label key={c.id}>
              <input
                type="checkbox"
                checked={categories.includes(c.id)}
                onChange={(e) =>
                  setCategories(
                    e.target.checked
                      ? [...categories, c.id]
                      : categories.filter((x) => x !== c.id),
                  )
                }
              />
              {c.name}
            </label>
          ))}
        </fieldset>
        <label>
          补充 / 替换 PDF
          <input
            aria-label="补充 PDF"
            type="file"
            accept=".pdf"
            disabled={pending}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setPending(true);
              setError("");
              try {
                reading.current = new AbortController();
                const result = await extractPDF(file, {
                  signal: reading.current.signal,
                  onProgress: (p) => setProgress(p.stage),
                });
                setPDF({
                  id: crypto.randomUUID(),
                  projectId: p.id,
                  blob: file,
                  name: file.name,
                  pages: result.pages,
                  updatedAt: new Date().toISOString(),
                });
              } catch (e) {
                setError(e instanceof Error ? e.message : "PDF 读取失败");
              } finally {
                setPending(false);
              }
            }}
          />
        </label>
        <p>
          {pdf
            ? `待保存 PDF：${pdf.name}，${pdf.pages.length} 页`
            : item.attachment
              ? `已关联 PDF：${item.attachment.name}`
              : "尚无 PDF"}
        </p>
        {item.attachment && (
          <button
            type="button"
            onClick={async () => {
              try {
                const file = await getPDF(p.id, item.attachment!.id);
                if (!file)
                  throw new Error("本浏览器找不到此 PDF，请重新附加。");
                const url = URL.createObjectURL(file.blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = file.name;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              } catch (e) {
                setError(e instanceof Error ? e.message : "读取失败");
              }
            }}
          >
            下载 PDF 原文件备份
          </button>
        )}
        {pending && (
          <p role="status">
            {progress || "正在读取登记记录…"}
            <button
              type="button"
              onClick={() =>
                reading.current?.abort(new Error("已取消 PDF 读取。"))
              }
            >
              取消 PDF 读取
            </button>
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" disabled={pending || busy} onClick={onClose}>
            取消
          </button>
          <button type="button" disabled={pending || busy} onClick={onRemove}>
            删除文献
          </button>
          <button className="button primary" disabled={pending || busy}>
            保存文献资料
          </button>
        </div>
      </form>
    </dialog>
  );
}
