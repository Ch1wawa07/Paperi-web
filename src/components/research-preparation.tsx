"use client";
import { useState } from "react";
import Link from "next/link";
import type { Project } from "@/lib/projects";
import { emptyWorkflow } from "@/lib/workflow";
import { profileFingerprint, researchContext } from "@/lib/workbench";
import { useProjects } from "./project-provider";
import { researchFetch } from "./workspace-common";
export function ResearchPreparation({ project: p, initialOpen=true }: { project: Project;initialOpen?:boolean }) {
  const { saveWorkflow, busy } = useProjects();
  const f = p.workflow ?? emptyWorkflow();
  const [draft, setDraft] = useState(f.keywords),
    [url, setURL] = useState(f.libraryURL),
    [revision, setRevision] = useState(f.revision),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  async function save() {
    const ok = await saveWorkflow(p.id, revision, {
      ...f,
      keywords: { ...draft, fingerprint: profileFingerprint(p) },
      libraryURL: url,
    });
    if (ok) {
      setRevision(revision + 1);
      setMessage("检索准备已保存。");
    }
    return ok;
  }
  async function generate() {
    setPending(true);
    setMessage("");
    try {
      const d = await researchFetch({
        task: "keywords",
        context: researchContext(p),
      });
      if (!Array.isArray(d.zh) || !Array.isArray(d.en))
        throw new Error("关键词格式不完整");
      setDraft({
        ...draft,
        zh: d.zh.join("\n"),
        en: d.en.join("\n"),
        synonyms: Array.isArray(d.synonyms)
          ? d.synonyms.join("\n")
          : draft.synonyms,
        expressions: (Array.isArray(d.expressions)
          ? d.expressions
          : [...d.zh, ...d.en]
        ).join("\n"),
      });
      setMessage(
        "候选关键词已生成，请编辑、删除不需要的词后保存。扩展同义词可自行补充。",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "生成失败");
    } finally {
      setPending(false);
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("已复制。请到学校数据库自行检索。");
    } catch {
      setMessage("浏览器未允许复制，请选中关键词手动复制。");
    }
  }
  return (
    <details className="frosted-surface workflow-panel" open={initialOpen}>
      <summary>
        <strong>检索准备</strong> · 带着问题去找文献
      </summary>
      <p>选择要使用的词，编辑或删除不需要的行；保存后会随项目保留。</p>
      {f.keywords.fingerprint &&
        f.keywords.fingerprint !== profileFingerprint(p) && (
          <p className="source-notice">研究问题或概念已变化，请复核检索词。</p>
        )}
      <div className="workflow-fields">
        {(
          [
            ["zh", "中文核心关键词"],
            ["synonyms", "中文扩展词与同义概念"],
            ["en", "英文核心关键词"],
            ["expressions", "推荐检索组合"],
          ] as const
        ).map(([key, title]) => (
          <label key={key}>
            {title}
            <textarea
              aria-label={title}
              disabled={pending}
              rows={3}
              maxLength={6000}
              value={draft[key]}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            />
            <div className="workspace-actions">
              {draft[key]
                .split("\n")
                .filter(Boolean)
                .map((s, i) => (
                  <button
                    className="small-button"
                    key={i}
                    onClick={() => void copy(s)}
                  >
                    复制 {s.slice(0, 32)}
                  </button>
                ))}
            </div>
          </label>
        ))}
      </div>
      <label>
        学校图书馆地址
        <input
          aria-label="学校图书馆地址"
          type="url"
          value={url}
          onChange={(e) => setURL(e.target.value)}
        />
      </label>
      <div className="workspace-actions">
        <button
          className="button secondary"
          disabled={pending || busy}
          onClick={() => void generate()}
        >
          {pending ? "正在生成…" : "生成 / 重新生成检索词"}
        </button>
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void save()}
        >
          保存检索准备
        </button>
        <button
          className="text-button"
          onClick={() => void copy(draft.expressions || draft.zh)}
        >
          复制检索关键词
        </button>
        <a
          className="button secondary"
          href={f.libraryURL}
          target="_blank"
          rel="noopener noreferrer"
        >
          前往学校图书馆检索 ↗
        </a>
        <Link href="/literature">返回后导入文献 →</Link>
      </div>
      <p role="status">{message}</p>
    </details>
  );
}
