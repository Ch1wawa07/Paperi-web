"use client";
import { useEffect, useState } from "react";
import type { Project } from "@/lib/projects";
import type { ReadingSection } from "@/lib/workflow";
import { getPDF } from "@/lib/local-files";
const labels = {
  supported: "支持",
  "not-supported": "未支持 / 无显著性",
  "not-tested": "原文未检验",
  unclear: "信息不足",
};
function PDFPage({
  project: p,
  sourceId,
  page,
}: {
  project: Project;
  sourceId: string;
  page: number | null;
}) {
  const [source, setSource] = useState({ key: "", url: "" });
  const attachment = p.library?.items.find(
    (i) => i.id === sourceId,
  )?.attachment;
  const sourceKey = `${p.id}:${attachment?.id}:${page}`;
  const url = source.key === sourceKey ? source.url : "";
  useEffect(() => {
    let active = true;
    let objectURL = "";
    if (attachment && page)
      void getPDF(p.id, attachment.id)
        .then((file) => {
          if (active && file) {
            objectURL = URL.createObjectURL(file.blob);
            setSource({ key: sourceKey, url: objectURL });
          }
        })
        .catch(() => {});
    return () => {
      active = false;
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [p.id, attachment, page, sourceKey]);
  return page ? (
    url ? (
      <a href={`${url}#page=${page}`} target="_blank" rel="noopener noreferrer">
        打开原 PDF 第 {page} 页 ↗
      </a>
    ) : (
      <span>PDF 第 {page} 页（原文件当前不可读）</span>
    )
  ) : (
    <span>依据：摘要，未核对正文页码</span>
  );
}
export function ReadingDetails({
  section: s,
  project,
  sourceId,
}: {
  section: ReadingSection;
  project: Project;
  sourceId: string;
}) {
  return (
    <div className="reading-details">
      <p className="reading-core">{s.body}</p>
      {s.facts?.length ? (
        <ul className="reading-facts">
          {s.facts.map((f, i) => (
            <li key={i}>
              <p>{f.text}</p>
              <details className="study-evidence">
                <summary>
                  原文依据{f.page ? ` · PDF 第 ${f.page} 页` : " · 摘要"}
                </summary>
                <blockquote>{f.quote}</blockquote>
                <PDFPage project={project} sourceId={sourceId} page={f.page} />
              </details>
            </li>
          ))}
        </ul>
      ) : null}
      {s.title === "关键发现与结论" && (
        <>
          <h4>原文逐项结论（AI解释待人工确认）</h4>
          {s.findings?.length ? (
            <div className="reading-findings">
              {s.findings.map((f, i) => (
                <article key={i}>
                  <strong>{f.question}</strong>
                  <p>{f.conclusion}</p>
                  <span className={`finding-status finding-${f.support}`}>
                    {labels[f.support]}
                  </span>
                  <details className="study-evidence">
                    <summary>
                      核对原文{f.page ? ` · PDF 第 ${f.page} 页` : " · 摘要"}
                    </summary>
                    <blockquote>{f.quote}</blockquote>
                    <PDFPage
                      project={project}
                      sourceId={sourceId}
                      page={f.page}
                    />
                  </details>
                </article>
              ))}
            </div>
          ) : (
            <p className="source-notice">
              暂无逐项可核对的结论；不能据此认为所有假设均获支持。
              {!s.issue && "这是旧版分析，可重新精析以核对逐项结果。"}
            </p>
          )}
        </>
      )}
      {s.suggestion && (
        <aside className="reading-suggestion">
          <strong>对选题的启发 / 差异（AI建议，非原文结论）</strong>
          <p>{s.suggestion}</p>
        </aside>
      )}
      {s.issue && (
        <p role="status" className="source-notice">
          {s.issue.message} <small>诊断：{s.issue.code}</small>
        </p>
      )}
      <details className="study-evidence">
        <summary>
          查看总论依据与信息边界{s.page ? ` · PDF 第 ${s.page} 页` : ""}
        </summary>
        {s.quote && (
          <>
            <blockquote>{s.quote}</blockquote>
            <PDFPage project={project} sourceId={sourceId} page={s.page} />
          </>
        )}
        <p>{s.uncertainty}</p>
        <p>引句匹配只证明这段原文存在，不保证 AI 对全文的理解已正确。</p>
      </details>
    </div>
  );
}
