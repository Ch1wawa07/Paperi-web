"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  emptyExploration,
  isAIReply,
  isRecord,
  type AIReply,
  type Exploration,
} from "@/lib/exploration";
import type { Project } from "@/lib/projects";
import { emptyNavigation, mergeConcepts } from "@/lib/research-navigation";
import { useProjects } from "./project-provider";
import { ResearchGuidePanel } from "./research-guide";
import { WorkspaceToolbar } from "./workspace-common";
import { LoadingState } from "./ui";

export function ConceptWorkspace() {
  const { snapshot, ready, error } = useProjects();
  const project = snapshot.projects.find((p) => p.id === snapshot.activeId);
  return (
    <div className="module-page module-concepts">
      <WorkspaceToolbar title="概念锚定" project={project}>
        <Link className="text-button" href="/lab">
          回到灵感对话
        </Link>
      </WorkspaceToolbar>
      {!ready ? (
        error ? (
          <p>请先处理存储提示，原有数据仍保留。</p>
        ) : (
          <LoadingState />
        )
      ) : project ? (
        <ConceptProject key={project.id} project={project} />
      ) : (
        <section className="workflow-panel frosted-surface">
          <p>先为你的想法创建一个研究项目。</p>
          <Link className="button primary" href="/">
            回到首页
          </Link>
        </section>
      )}
    </div>
  );
}

function ConceptProject({ project }: { project: Project }) {
  const { busy, saveExploration } = useProjects();
  const exploration = project.exploration ?? emptyExploration();
  const nav = exploration.navigation ?? {
    ...emptyNavigation(),
    concepts: (exploration.seed?.concepts ?? []).map((term, i) => ({
      id: `legacy-seed-${i}`,
      term,
      explanation: "沿用旧项目由用户确认的概念，解释待补充。",
      everyday: "",
      uncertainty: "请结合已导入文献核实概念边界。",
      origin: "user" as const,
      status: "selected" as const,
    })),
  };
  const [status, setStatus] = useState<{
    configured: boolean;
    message: string;
  } | null>(null);
  const [error, setError] = useState("");
  const savedKeywords = project.workflow?.keywords;
  const guideKeywords = nav.guides?.literature?.keywords ?? nav.guide?.keywords;
  const searchKeywords =
    savedKeywords &&
    [
      savedKeywords.zh,
      savedKeywords.en,
      savedKeywords.synonyms,
      savedKeywords.expressions,
    ].some((value) => value.trim())
      ? [
          ...new Set(
            [
              savedKeywords.zh,
              savedKeywords.en,
              savedKeywords.synonyms,
              savedKeywords.expressions,
            ].filter((value) => value.trim()),
          ),
        ].join("\n")
      : [...(guideKeywords?.zh ?? []), ...(guideKeywords?.en ?? [])].join("\n");
  const [pending, setPending] = useState(false);
  const [unsaved, setUnsaved] = useState<AIReply | null>(null);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const sending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const c = new AbortController();
    void fetch("/api/lab", {
      cache: "no-store",
      signal: AbortSignal.any([c.signal, AbortSignal.timeout(8000)]),
    })
      .then(async (r) => {
        const d: unknown = await r.json();
        if (
          !r.ok ||
          !isRecord(d) ||
          typeof d.configured !== "boolean" ||
          typeof d.message !== "string"
        )
          throw new Error("无法检查 AI 配置。");
        if (!c.signal.aborted)
          setStatus({ configured: d.configured, message: d.message });
      })
      .catch(() => {
        if (!c.signal.aborted)
          setStatus({
            configured: false,
            message:
              "AI 配置检查失败；仍可手动添加、修改概念。刷新页面可重试检查。",
          });
      });
    return () => {
      mounted.current = false;
      c.abort();
      controller.current?.abort();
    };
  }, []);
  async function persistReply(data: AIReply, base: Exploration = exploration) {
    const currentNav = base.navigation ?? nav;
    const next: Exploration = {
      ...base,
      navigation: {
        ...currentNav,
        guide: data.guide,
        guides: { ...currentNav.guides, concepts: data.guide },
        concepts: mergeConcepts(currentNav.concepts, data.guide.concepts),
      },
      messages: [
        ...base.messages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply,
          createdAt: new Date().toISOString(),
        },
      ],
    };
    const ok = await saveExploration(project.id, base.revision, next);
    if (mounted.current) {
      if (ok) setError("");
      setUnsaved(ok ? null : data);
      if (!ok)
        setError(
          "概念建议已返回，但尚未保存。请处理上方存储提示，然后仅重试保存，不会再次调用 AI。",
        );
    }
    return ok;
  }
  async function generate(message: string) {
    if (sending.current || busy) return;
    if (unsaved) {
      setError(
        "请先保存已返回的建议，避免重复调用。你也可以继续手动编辑概念。",
      );
      return;
    }
    if (!status?.configured) {
      setError(
        status?.message ?? "AI 配置检查尚未完成；可以先手动添加、修改概念。",
      );
      return;
    }
    if (exploration.messages.length > 118) {
      setError(
        "本项目的灵感记录已达到保存上限。原有概念和历史保留，请先备份；不会发起 AI 调用。",
      );
      return;
    }
    sending.current = true;
    setPending(true);
    setError("");
    setUnsaved(null);
    const c = new AbortController();
    controller.current = c;
    try {
      const next: Exploration = {
        ...exploration,
        revision: exploration.revision + 1,
        messages: [
          ...exploration.messages,
          {
            id: crypto.randomUUID(),
            role: "user",
            content: message,
            createdAt: new Date().toISOString(),
          },
        ],
      };
      if (!(await saveExploration(project.id, exploration.revision, next)))
        throw new Error("请求尚未保存，未调用 AI。请处理存储提示后再试。");
      if (!mounted.current) return;
      const messages = next.messages
        .slice(-12)
        .map(({ role, content }) => ({ role, content }));
      while (
        messages.length > 1 &&
        messages.reduce((n, m) => n + m.content.length, 0) > 12000
      )
        messages.shift();
      const response = await fetch("/api/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.any([c.signal, AbortSignal.timeout(80000)]),
        body: JSON.stringify({
          observation: project.observation,
          seed: next.seed,
          messages,
          stage: "concepts",
          concepts: nav.concepts,
          evidence: (project.library?.items ?? [])
            .filter((p) => nav.evidenceIds.includes(p.id))
            .slice(0, 5)
            .map(({ id, paper }) => ({
              id,
              paper: {
                ...paper,
                abstract: paper.abstract?.slice(0, 1500) ?? null,
                abstractTruncated:
                  paper.abstractTruncated ||
                  !!(paper.abstract && paper.abstract.length > 1500),
              },
            })),
        }),
      });
      const data: unknown = await response.json();
      if (!response.ok)
        throw new Error(
          isRecord(data) && typeof data.error === "string"
            ? data.error
            : "概念建议未完成，请重试。",
        );
      if (
        !isAIReply(data) ||
        data.guide.stage !== "concepts" ||
        data.directions.length
      )
        throw new Error("AI 返回的概念结构不完整；已有选择未改变。");
      if (!mounted.current) return;
      await persistReply(data, { ...next, revision: next.revision });
    } catch (e) {
      if (mounted.current)
        setError(
          c.signal.aborted
            ? "已取消。本项目已有概念和输入记录保留。"
            : e instanceof DOMException && e.name === "TimeoutError"
              ? "AI 等待超时；旧概念保留，可手动重试。"
              : e instanceof Error
                ? e.message
                : "概念建议未完成。",
        );
    } finally {
      sending.current = false;
      if (mounted.current) setPending(false);
    }
  }
  return (
    <>
      <section className="concept-context frosted-surface">
        <p>
          <span>从你的原始观察出发</span>
          {project.observation ||
            "可先到灵感实验室聊聊，也可以直接手动添加概念。"}
        </p>
        <div className="workspace-actions">
          <button
            className="button primary"
            disabled={
              busy ||
              pending ||
              !!unsaved ||
              !status?.configured ||
              nav.concepts.length >= 24
            }
            onClick={() =>
              void generate(
                "请基于我的原始观察、已有灵感对话、已选与已排除概念，推荐 8–12 个有差异的学术候选概念（证据不足可少给），按研究角度分组，解释与观察的联系和边界。保留我修改的概念，避开已排除项，不替我确定方向。提供与已选概念相关的简短中英文检索组合。",
              )
            }
          >
            {pending
              ? "正在整理概念…"
              : nav.concepts.length
                ? "补充不同角度的概念"
                : "根据已有探索推荐概念"}
          </button>
          {pending && (
            <button
              className="button secondary"
              onClick={() => controller.current?.abort()}
            >
              取消
            </button>
          )}
        </div>
        <p className="guide-footnote" role="status">
          {status?.message ?? "正在检查 AI 配置…"}{" "}
          点击推荐会发起一次模型调用；手动选择与编辑不调用 AI。
        </p>
        {error && (
          <p className="guide-error" role="alert">
            {error}
          </p>
        )}
        {unsaved && (
          <button
            className="button secondary"
            disabled={busy || pending}
            onClick={() => void persistReply(unsaved)}
          >
            仅保存已返回的概念建议
          </button>
        )}
      </section>
      <ResearchGuidePanel
        projectId={project.id}
        navigation={{ ...nav, stage: "concepts" }}
        papers={project.library?.items ?? []}
        seed={exploration.seed}
        revision={exploration.revision}
        disabled={busy || pending}
        conceptsOnly
        libraryURL={project.workflow?.libraryURL}
        searchKeywords={searchKeywords}
        onChange={(next) =>
          saveExploration(project.id, exploration.revision, {
            ...exploration,
            navigation: next,
          })
        }
        onAsk={(message) => void generate(message)}
      />
    </>
  );
}
