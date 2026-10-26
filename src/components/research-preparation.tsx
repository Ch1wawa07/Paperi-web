"use client";
import { useState,useEffect,useEffectEvent } from "react";
import Link from "next/link";
import type { Project } from "@/lib/projects";
import { emptyWorkflow } from "@/lib/workflow";
import { profileFingerprint, researchContext, selectedConcepts } from "@/lib/workbench";
import { useProjects } from "./project-provider";
import { researchFetch } from "./workspace-common";
export function ResearchPreparation({ project: p, initialOpen=true,automatic=false }: { project: Project;initialOpen?:boolean;automatic?:boolean }) {
  const { saveWorkflow, busy } = useProjects();
  const f = p.workflow ?? emptyWorkflow();
  const concepts=selectedConcepts(p);
  const guide=p.exploration?.navigation?.guides?.literature?.keywords ?? p.exploration?.navigation?.guide?.keywords;
  const defaults={...f.keywords,zh:concepts.join("\n"),expressions:guide?.zh?.join("\n") || concepts.join(" "),en:guide?.en?.join("\n") || ""};
  const [edited, setDraft] = useState<typeof f.keywords | null>(null),
    [url, setURL] = useState(f.libraryURL),
    [revision, setRevision] = useState(f.revision),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const draft=edited ?? (f.keywords.fingerprint ? f.keywords : defaults);
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
  async function generate(signal?:AbortSignal) {
    setPending(true);
    setMessage("");
    try {
      const d = await researchFetch({
        task: "keywords",
        context: researchContext(p),
      },signal);
      if(signal?.aborted)return;
      if (!Array.isArray(d.zh) || !Array.isArray(d.en))
        throw new Error("关键词格式不完整");
      const next = {
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
      };
      setDraft(next);
      if(await saveWorkflow(p.id, revision,{...f,keywords:{...next,fingerprint:profileFingerprint(p)},libraryURL:url})) setRevision(revision+1);
      else throw new Error("关键词已返回但尚未保存，请处理存储冲突后保存。");
      setMessage(
        "候选关键词已生成，请编辑、删除不需要的词后保存。扩展同义词可自行补充。",
      );
    } catch (e) {
      if(!signal?.aborted)setMessage(e instanceof Error ? e.message : "生成失败");
    } finally {
      if(!signal?.aborted)setPending(false);
    }
  }
  const fingerprint=profileFingerprint(p);
  const autoGenerate=useEffectEvent(async(state:{configured?:boolean;message?:string},signal:AbortSignal)=>{
    if(edited!==null||!concepts.length||f.keywords.fingerprint===fingerprint)return;
    const marker=`paperi.keywords.attempt.${p.id}.${fingerprint}`;
    if(sessionStorage.getItem(marker))return;
    try{if(signal.aborted)return;
      if(!state.configured){setMessage(state.message||'AI 尚未配置，已选概念仍可复制使用。');return;}
      sessionStorage.setItem(marker,'1');await generate(signal);
    }catch{if(!signal.aborted)setMessage('连接检查失败，已选概念仍可复制；可手动生成重试。');}
  });
  useEffect(()=>{if(!automatic)return;const c=new AbortController();void fetch('/api/lab',{signal:c.signal}).then(r=>r.json()).then(state=>autoGenerate(state,c.signal)).catch(()=>{});return()=>c.abort();},[automatic,fingerprint]);
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
      <p>已选概念自动带入；已有 AI 检索建议直接复用。点击生成可补充双语词和同义词，无需重新填写。</p>
      <div className="concept-tags" aria-label="检索使用的已选概念">{concepts.map(c=><span key={c}>{c}</span>)}</div>
      <div className="library-entry"><a className="button primary" href={f.libraryURL} target="_blank" rel="noopener noreferrer">前往深圳大学图书馆 ↗</a><button onClick={()=>void copy(draft.expressions || draft.zh)}>复制检索关键词</button><Link href="/literature">返回后导入文献 →</Link></div>
      {!draft.en && <p className="source-notice">当前显示已选概念，英文和扩展词尚未由 AI 生成。点击下方生成；失败时会保留这些概念。</p>}
      <div className="keyword-preview">{([['zh','中文核心词'],['synonyms','扩展词'],['en','英文词'],['expressions','检索组合']] as const).map(([key,title])=><section key={key}><h3>{title}</h3>{draft[key].split("\n").filter(Boolean).map((term,i)=><button key={i} onClick={()=>void copy(term)}>{term} · 复制</button>)}{!draft[key]&&<p>待生成</p>}</section>)}</div>
      {f.keywords.fingerprint &&
        f.keywords.fingerprint !== profileFingerprint(p) && (
          <p className="source-notice">研究问题或概念已变化，请复核检索词。</p>
        )}
      <details><summary>编辑检索词与学校地址（可选）</summary><div className="workflow-fields">
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
      </details><div className="workspace-actions">
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
          前往深圳大学图书馆 ↗
        </a>
        <Link href="/literature">返回后导入文献 →</Link>
      </div>
      <p role="status">{message}</p>
    </details>
  );
}
