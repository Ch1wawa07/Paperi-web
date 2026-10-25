"use client";
import { useState } from "react";
import { useProjects } from "./project-provider";
import { downloadText } from "./workspace-common";
import { parseSnapshot } from "@/lib/projects";
export function ProjectBackup() {
  const { snapshot, restore, busy, ready } = useProjects();
  const [raw, setRaw] = useState(""),
    [message, setMessage] = useState("");
  return (
    <details className="frosted-surface workflow-panel">
      <summary>项目数据备份与恢复</summary>
      <p>
        JSON 包含全部项目、题录、笔记、分析和模型。PDF 保存在当前浏览器的
        IndexedDB
        中，请在文献编辑处分别下载原文件备份。恢复会新增项目副本，不覆盖现有项目；PDF
        需要重新附加。更换网址、端口、浏览器或清除站点数据前请备份。
      </p>
      <button
        className="button secondary"
        disabled={!ready}
        onClick={() =>
          downloadText(
            "Paperi-projects.json",
            JSON.stringify(snapshot, null, 2),
            "application/json",
          )
        }
      >
        下载全部项目备份
      </button>
      <label>
        选择项目 JSON 备份
        <input
          aria-label="选择项目 JSON 备份"
          type="file"
          accept=".json"
          onChange={async (e) => {
            setRaw("");
            try {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 15 * 1024 * 1024)
                throw new Error("备份超过 15 MB，请拆分。");
              const text = await file.text();
              const parsed = parseSnapshot(text);
              setRaw(text);
              setMessage(
                `已验证 ${parsed.projects.length} 个项目。确认后恢复为新副本。`,
              );
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "备份读取失败");
            }
          }}
        />
      </label>
      <button
        className="button primary"
        disabled={!raw || busy}
        onClick={async () => {
          if (await restore(raw)) {
            setRaw("");
            setMessage("已恢复副本；原项目保留。请重新附加 PDF。");
          }
        }}
      >
        确认恢复为独立副本
      </button>
      <p role="status">{message}</p>
    </details>
  );
}
