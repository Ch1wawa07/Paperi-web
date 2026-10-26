"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/projects";
import {
  emptyWorkflow,
  workflowEvidence,
  directionPlainText,
  type DirectionCard,
} from "@/lib/workflow";
import { selectedConcepts } from "@/lib/workbench";
import {
  currentResearchDirection,
  researchState,
  researchFingerprint,
  isResearchWorkspace,
  type ResearchWorkspace,
  type ResearchStage,
  type DirectionCandidate,
  type ConfirmedDirection,
} from "@/lib/research-workspace";
import {
  requestResearchJourney,
  type JourneyTask,
} from "@/lib/research-journey-client";
import { useProjects } from "./project-provider";
import { WorkspaceToolbar } from "./workspace-common";
import { Sources, WorkflowSelection } from "./literature-analysis";
import { ProjectHistory } from "./project-history";
import { ResearchDesign } from "./research-design";
import "@/app/research-journey.css";

const stages: { id: ResearchStage; label: string }[] = [
  { id: "context", label: "看懂已有研究" },
  { id: "discussion", label: "继续研究什么" },
  { id: "directions", label: "我的研究方向" },
  { id: "design", label: "我的研究设计" },
];
const isStage = (s: unknown): s is ResearchStage =>
  stages.some((x) => x.id === s);
const date = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const blankCard = (): DirectionCard => ({
  title: "",
  question: "",
  value: "",
  method: "",
  limitations: "",
  evidenceIds: [],
});
const cardLabels = {
  title: "方向名称",
  question: "具体研究问题",
  value: "为什么值得研究",
  method: "初步方法与难度",
  limitations: "待补充的证据",
} as const;

type InputKey = "discussionDraft" | "preferences" | "directionDraft";
const recoveryKey = (id: string) => `paperi.research.inputs.${id}`;
function recoveredState(p: Project) {
  const saved = researchState(p);
  try {
    const raw = JSON.parse(localStorage.getItem(recoveryKey(p.id)) ?? "{}");
    const next = { ...saved };
    for (const key of [
      "discussionDraft",
      "preferences",
      "directionDraft",
    ] as InputKey[]) {
      const field = raw[key];
      if (field && JSON.stringify(field.base) === JSON.stringify(saved[key])) {
        Object.assign(next, { [key]: field.value });
      }
    }
    return isResearchWorkspace(next) ? next : saved;
  } catch {
    return saved;
  }
}

export function ResearchJourney({
  initialStage,
  requestProject,
  showHistory = false,
}: {
  initialStage?: string;
  requestProject?: string;
  showHistory?: boolean;
}) {
  const { snapshot, ready } = useProjects();
  const project = snapshot.projects.find((p) => p.id === snapshot.activeId);
  return (
    <div className="module-page research-journey">
      <WorkspaceToolbar title="研究脉络" project={project} />
      {requestProject && project && project.id !== requestProject ? (
        <p className="source-notice">
          链接属于另一个项目，请先在顶部切换项目。
        </p>
      ) : ready && project ? (
        <Journey
          key={project.id}
          project={project}
          initialStage={initialStage}
          showHistory={showHistory}
        />
      ) : (
        <Link href="/">选择或创建研究项目</Link>
      )}
    </div>
  );
}

function Journey({
  project: p,
  initialStage,
  showHistory,
}: {
  project: Project;
  initialStage?: string;
  showHistory: boolean;
}) {
  const { saveWorkflow, busy } = useProjects();
  const r = researchState(p),
    f = p.workflow ?? emptyWorkflow(),
    fingerprint = researchFingerprint(p);
  const [stage, setStage] = useState<ResearchStage>(
    isStage(initialStage) ? initialStage : r.stage,
  );
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [recovery] = useState(() => recoveredState(p));
  const [draft, setDraft] = useState(recovery.discussionDraft),
    [preferences, setPreferences] = useState(recovery.preferences);
  const [selectedContext, setSelectedContext] = useState(""),
    [selectedBatch, setSelectedBatch] = useState("");
  const [cardDraft, setCardDraft] = useState(
    recovery.directionDraft?.card ??
      currentResearchDirection(r)?.card ??
      blankCard(),
  );
  const [editing, setEditing] = useState(!!recovery.directionDraft),
    [candidateId, setCandidateId] = useState<string | null>(
      recovery.directionDraft?.candidateId ?? null,
    );
  const [unsavedResult, setUnsavedResult] = useState<{
    value: ResearchWorkspace;
    base: ResearchWorkspace;
  } | null>(null);
  const [lastFailed, setLastFailed] = useState<{
    task: JourneyTask;
    options?: Record<string, unknown>;
  } | null>(null);
  const projectRef = useRef(p),
    stateRef = useRef(r),
    queue = useRef(Promise.resolve(true)),
    controller = useRef<AbortController | null>(null);
  const transcript = useRef<HTMLDivElement>(null);
  // Event handlers and queued saves always use the most recently rendered project revision.
  useEffect(() => {
    projectRef.current = p;
    stateRef.current = researchState(p);
  }, [p]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    transcript.current?.scrollTo({
      top: transcript.current.scrollHeight,
      behavior: "smooth",
    });
  }, [r.messages.length, pending]);
  const active = currentResearchDirection(r),
    evidence = workflowEvidence(p),
    concepts = selectedConcepts(p);
  const context =
    r.contexts.find((c) => c.id === selectedContext) ?? r.contexts.at(-1);
  const batch =
    r.candidateBatches.find((b) => b.id === selectedBatch) ??
    r.candidateBatches.at(-1);
  const stale = !!context && context.fingerprint !== fingerprint;
  const directionStale =
    !!active &&
    (active.fingerprint !== fingerprint ||
      active.card.evidenceIds.some(
        (id) => !p.library?.items.some((i) => i.id === id),
      ));

  function rememberInput(key: InputKey, value: ResearchWorkspace[InputKey]) {
    try {
      const raw = JSON.parse(localStorage.getItem(recoveryKey(p.id)) ?? "{}");
      localStorage.setItem(
        recoveryKey(p.id),
        JSON.stringify({
          ...raw,
          [key]: { base: stateRef.current[key], value },
        }),
      );
    } catch {
      setNotice("浏览器无法临时保留输入，请保存后再离开页面。");
    }
  }

  function save(
    next: ResearchWorkspace,
    base: ResearchWorkspace = stateRef.current,
    force: (keyof ResearchWorkspace)[] = [],
  ): Promise<boolean> {
    const patch = Object.fromEntries(
      Object.entries(next).filter(
        ([key, value]) =>
          force.includes(key as keyof ResearchWorkspace) ||
          JSON.stringify(value) !==
            JSON.stringify(base[key as keyof ResearchWorkspace]),
      ),
    );
    const job = async () => {
      next = { ...stateRef.current, ...patch };
      if (!isResearchWorkspace(next)) {
        setError(
          "内容不完整或历史已达容量上限，未覆盖原有成果。请备份后检查输入。",
        );
        return false;
      }
      const project = projectRef.current,
        workflow = project.workflow ?? emptyWorkflow();
      const direction = currentResearchDirection(next);
      const updated = {
        ...workflow,
        research: next,
        ...(direction
          ? {
              direction: {
                card: direction.card,
                text: directionPlainText(
                  direction.card,
                  direction.card.evidenceIds.map(
                    (id) =>
                      project.library?.items.find((i) => i.id === id)?.paper
                        .title ?? "来源已移除，待核对",
                  ),
                ).slice(0, 4000),
                evidenceIds: direction.card.evidenceIds,
                fingerprint: direction.fingerprint,
              },
            }
          : {}),
      };
      const ok = await saveWorkflow(project.id, workflow.revision, updated);
      if (ok) {
        stateRef.current = next;
        projectRef.current = {
          ...project,
          workflow: { ...updated, revision: workflow.revision + 1 },
        };
        try {
          const raw = JSON.parse(
            localStorage.getItem(recoveryKey(p.id)) ?? "{}",
          );
          for (const key of [
            "discussionDraft",
            "preferences",
            "directionDraft",
          ] as InputKey[]) {
            if (
              raw[key] &&
              JSON.stringify(raw[key].value) === JSON.stringify(next[key])
            )
              delete raw[key];
          }
          if (Object.keys(raw).length)
            localStorage.setItem(recoveryKey(p.id), JSON.stringify(raw));
          else localStorage.removeItem(recoveryKey(p.id));
        } catch {
          /* The project save succeeded; recoverable input never replaces newer saved data. */
        }
      }
      return ok;
    };
    const result = queue.current.then(job, job);
    queue.current = result;
    return result;
  }
  async function changeStage(next: ResearchStage) {
    setStage(next);
    setNotice("");
    await save({
      ...stateRef.current,
      stage: next,
      discussionDraft: draft,
      preferences,
      ...(editing ? { directionDraft: { card: cardDraft, candidateId } } : {}),
    });
  }
  async function run(
    task: JourneyTask,
    options?: Record<string, unknown>,
    retry = false,
  ): Promise<unknown> {
    if (pending) return;
    setError("");
    setNotice("");
    setPending(true);
    setLastFailed(null);
    const c = new AbortController();
    controller.current = c;
    try {
      let state = stateRef.current;
      if (
        (task === "context" && state.contexts.length >= 100) ||
        (task === "directions" && state.candidateBatches.length >= 100) ||
        (task === "discussion" &&
          state.messages.length > (retry ? 199 : 198)) ||
        (task === "quantitative" && state.quantitativeHistory.length >= 100) ||
        (task === "qualitative" && state.qualitativeHistory.length >= 100)
      ) {
        throw new Error(
          "本阶段历史已达保存容量，请先备份并分项目继续；尚未调用 AI，旧成果保留。",
        );
      }
      if (task === "context" && !options?.regenerate) {
        const cached = state.contexts.findLast(
          (x) => x.fingerprint === researchFingerprint(projectRef.current),
        );
        if (cached) {
          setSelectedContext(cached.id);
          setNotice(
            "已显示相同资料的已保存脉络，无需再次调用 AI。需要新分析时可点击重新梳理。",
          );
          return;
        }
      }
      if (task === "discussion" && !retry) {
        const text =
          typeof options?.message === "string" ? options.message : draft;
        if (!text.trim())
          throw new Error("请写下想继续讨论的问题，或选择一个追问。");
        state = {
          ...state,
          discussionDraft: "",
          preferences,
          messages: [
            ...state.messages,
            {
              id: uid(),
              role: "user",
              content: text.trim(),
              createdAt: date(),
              sourceIds: evidence.map((i) => i.id),
              quickQuestions: [],
            },
          ],
        };
        if (!(await save(state, stateRef.current, ["discussionDraft"])))
          throw new Error("提问尚未保存，请先处理存储提示，尚未调用 AI。");
        setDraft("");
        options = {
          ...options,
          message: text.trim(),
          ...(state.discussionCandidateId
            ? { candidateId: state.discussionCandidateId }
            : {}),
        };
      }
      const requestProject = projectRef.current;
      const requestFingerprint = researchFingerprint(requestProject);
      const requestIds = workflowEvidence(requestProject).map((i) => i.id);
      const requestConcepts = selectedConcepts(requestProject);
      const answer = await requestResearchJourney(
        requestProject,
        state,
        task,
        c.signal,
        options,
      );
      if (c.signal.aborted) return;
      if (answer.notices?.length) setNotice(answer.notices.join(" "));
      state = stateRef.current;
      const stamp = date(),
        fp = requestFingerprint,
        ids = requestIds;
      let next: ResearchWorkspace = state;
      if (answer.sections) {
        next = {
          ...state,
          contexts: [
            ...state.contexts,
            {
              id: uid(),
              createdAt: stamp,
              fingerprint: fp,
              sourceIds: ids,
              sections: answer.sections,
            },
          ],
        };
        setSelectedContext("");
      }
      if (answer.reply)
        next = {
          ...state,
          messages: [
            ...state.messages,
            {
              id: uid(),
              role: "assistant",
              content: answer.reply,
              fingerprint: fp,
              createdAt: stamp,
              sourceIds: ids,
              quickQuestions: answer.quickQuestions ?? [],
            },
          ],
        };
      if (answer.cards) {
        next = {
          ...state,
          stage: "directions",
          candidateBatches: [
            ...state.candidateBatches,
            {
              id: uid(),
              createdAt: stamp,
              fingerprint: fp,
              cards: answer.cards.map((card) => ({
                ...card,
                id: uid(),
                createdAt: stamp,
                fingerprint: fp,
                status: "candidate" as const,
                concepts:
                  card.concepts?.filter((c) => requestConcepts.includes(c)) ??
                  requestConcepts,
              })),
            },
          ],
        };
        setStage("directions");
        setSelectedBatch("");
      }
      if (answer.advice) next = { ...state, methodAdvice: answer.advice };
      if (answer.design) {
        if (task === "quantitative")
          next = {
            ...state,
            quantitative: answer.design as ResearchWorkspace["quantitative"],
            quantitativeHistory: state.quantitative
              ? [...state.quantitativeHistory, state.quantitative]
              : state.quantitativeHistory,
          };
        if (task === "qualitative")
          next = {
            ...state,
            qualitative: answer.design as ResearchWorkspace["qualitative"],
            qualitativeHistory: state.qualitative
              ? [...state.qualitativeHistory, state.qualitative]
              : state.qualitativeHistory,
          };
      }
      if (!(await save(next))) {
        setUnsavedResult({ value: next, base: state });
        setError(
          "AI 已返回，但浏览器尚未保存。结果保留在当前页面，请只重试保存，不要重复调用 AI。",
        );
      }
      return answer;
    } catch (e) {
      if (!c.signal.aborted) {
        setError(
          e instanceof Error ? e.message : "本次请求未完成，原有内容保留。",
        );
        setLastFailed({ task, options });
      }
    } finally {
      setPending(false);
    }
  }
  async function preserveMessage(
    content: string,
    kind: "preference" | "reject" | "candidate",
  ) {
    let next = stateRef.current;
    if (kind === "preference") {
      const text = [next.preferences, content]
        .filter(Boolean)
        .join("\n")
        .slice(0, 6000);
      setPreferences(text);
      next = { ...next, preferences: text };
    } else if (kind === "reject")
      next = {
        ...next,
        rejectedAngles: [...next.rejectedAngles, content.slice(0, 2000)],
      };
    else {
      const card: DirectionCandidate = {
        ...blankCard(),
        id: uid(),
        title: content.slice(0, 80),
        question: content.slice(0, 1200),
        value: "从讨论中保留的研究角度，尚待完善和文献核查。",
        limitations: "这是讨论提议，不是已验证的论文结论。",
        evidenceIds: evidence.map((i) => i.id),
        createdAt: date(),
        fingerprint,
        status: "candidate",
        concepts,
      };
      next = {
        ...next,
        candidateBatches: [
          ...next.candidateBatches,
          { id: uid(), createdAt: date(), fingerprint, cards: [card] },
        ],
      };
    }
    if (await save(next))
      setNotice(
        kind === "preference"
          ? "已更新项目偏好。"
          : kind === "reject"
            ? "已标记为不考虑，后续推荐会参考。"
            : "已加入方向候选，可到下一环节完善。",
      );
  }
  function editCard(card: DirectionCard, id: string | null) {
    setCardDraft(card);
    setCandidateId(id);
    setEditing(true);
    void save({
      ...stateRef.current,
      directionDraft: { card, candidateId: id },
    });
  }
  async function confirmDirection() {
    if (!cardDraft.title.trim() || !cardDraft.question.trim()) {
      setError("请填写方向名称和具体研究问题。");
      return;
    }
    const d: ConfirmedDirection = {
      id: uid(),
      createdAt: date(),
      fingerprint,
      candidateId,
      card: cardDraft,
      concepts,
    };
    if (
      await save(
        {
          ...stateRef.current,
          directions: [...stateRef.current.directions, d],
          activeDirectionId: d.id,
          directionDraft: null,
        },
        stateRef.current,
        ["directionDraft"],
      )
    ) {
      setEditing(false);
      setNotice("研究方向已由你确认；之前版本和设计草稿仍保留。");
    }
  }

  return (
    <>
      <details className="rj-summary frosted-surface">
        <summary>
          <strong>{p.name}</strong>
          <span>
            {evidence.length} 篇文献 · {concepts.length} 个概念
          </span>
          <span>
            {active ? "方向已确认" : "方向待确认"} ·{" "}
            {r.method === "quantitative"
              ? "定量"
              : r.method === "qualitative"
                ? "质性"
                : "方法待选择"}
          </span>
        </summary>
        <p>原始问题：{p.observation || "尚未记录"}</p>
        <p>
          已选概念：{concepts.join("、") || "尚未选择"}{" "}
          <Link href="/concepts">查看概念</Link>
        </p>
        <p>当前方向：{active?.card.question || "尚未确认"}</p>
      </details>
      <nav className="rj-stages" aria-label="研究脉络阶段">
        {stages.map((s, i) => (
          <button
            key={s.id}
            aria-label={s.label}
            aria-current={stage === s.id ? "step" : undefined}
            onClick={() => void changeStage(s.id)}
          >
            <span>0{i + 1}</span>
            {s.label}
          </button>
        ))}
      </nav>
      {pending && (
        <p className="pdf-progress" role="status">
          <span className="spinner" />
          正在整理资料并等待 AI…{" "}
          <button
            onClick={() => {
              controller.current?.abort();
              setNotice(
                "已取消等待，已保存成果仍保留。服务商可能已处理此次请求。",
              );
            }}
          >
            取消本次请求
          </button>
        </p>
      )}
      {error && (
        <div role="alert" className="literature-error">
          {error}
          {lastFailed && (
            <button
              disabled={pending}
              onClick={() => {
                const failed = lastFailed;
                if (failed) void run(failed.task, failed.options, true);
              }}
            >
              重试本次请求
            </button>
          )}
        </div>
      )}
      {unsavedResult && (
        <button
          className="button secondary"
          disabled={busy || pending}
          onClick={async () => {
            if (await save(unsavedResult.value, unsavedResult.base)) {
              setUnsavedResult(null);
              setError("");
              setNotice("结果已保存，未重复调用 AI。");
            }
          }}
        >
          保存已返回结果（不调用 AI）
        </button>
      )}
      {notice && (
        <p role="status" className="source-notice">
          {notice}
        </p>
      )}
      {(stale || directionStale) && (
        <p className="source-notice">
          资料来源已变，已有分析、方向或设计待复核。历史成果全部保留；由你决定是否更新。
        </p>
      )}
      {stage === "context" && (
        <section className="rj-context">
          <header className="rj-heading">
            <span className="eyebrow">READ THE RESEARCH TOGETHER</span>
            <h2>看懂已有研究</h2>
            <p>先理解论文之间的联系，再讨论你想继续研究什么。</p>
          </header>
          <WorkflowSelection project={p} />
          <ul className="rj-evidence-status">
            {evidence.map((i) => (
              <li key={i.id}>
                <span>{i.paper.title}</span>
                <small>
                  {i.attachment
                    ? `PDF ${i.attachment.pages} 页 · 有限节选`
                    : i.paper.abstract
                      ? "已有摘要"
                      : "仅题录，资料不足"}{" "}
                  ·{" "}
                  {f.analyses.some(
                    (a) => a.kind === "reading" && a.sourceIds.includes(i.id),
                  )
                    ? "已有精析"
                    : "尚未精析，可继续"}
                </small>
              </li>
            ))}
          </ul>
          {!evidence.length && (
            <p className="source-notice">
              请先<Link href="/literature?mode=import">导入文献</Link>
              ，或在上方选择本次资料。
            </p>
          )}
          <div className="workspace-actions">
            <button
              className="button primary"
              disabled={pending || busy || !evidence.length}
              onClick={() => void run("context")}
            >
              梳理这些文献
            </button>
            {context && (
              <button
                disabled={pending || busy}
                onClick={() => {
                  if (
                    confirm(
                      "重新梳理会发起一次付费模型请求，旧版本保留。继续吗？",
                    )
                  )
                    void run("context", { regenerate: true });
                }}
              >
                重新梳理
              </button>
            )}
          </div>
          <p className="rj-cost-note">
            点击 AI
            操作才发起单次模型请求，可能计费；失败不自动重试。题录不能替代正文证据。
          </p>
          {context && (
            <>
              <div className="rj-section-grid">
                {context.sections.map((s, i) => (
                  <article key={i} className="study-section">
                    <span className="study-section-number">0{i + 1}</span>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                    <span className="soft-badge">
                      {s.evidenceStatus === "proposal"
                        ? "AI 研究提议"
                        : s.evidenceStatus === "verified"
                          ? "有可核对引句 · 归纳仍待核查"
                          : "资料不足 / 待核查"}
                    </span>
                    <details className="study-evidence">
                      <summary>
                        查看依据{s.page ? ` · PDF 第 ${s.page} 页` : ""}
                      </summary>
                      {s.quote && <blockquote>{s.quote}</blockquote>}
                      <p>{s.uncertainty}</p>
                      <Sources project={p} ids={s.evidenceIds} />
                    </details>
                  </article>
                ))}
              </div>
              <p>这些研究已经讨论了什么。接下来，你最想继续追问哪一个问题？</p>
            </>
          )}
          <button
            className="button primary"
            onClick={() => void changeStage("discussion")}
          >
            进入 AI 研究对话
          </button>
          <details className="study-history">
            <summary>脉络历史 · {r.contexts.length} 次</summary>
            {r.contexts.map((c) => (
              <button key={c.id} onClick={() => setSelectedContext(c.id)}>
                {new Date(c.createdAt).toLocaleString()} ·{" "}
                {c.fingerprint === fingerprint ? "当前资料" : "旧资料"}
              </button>
            ))}
          </details>
        </section>
      )}
      {stage === "discussion" && (
        <section className="rj-discussion">
          <div className="lab-chat rj-chat">
            <header className="lab-chat-heading">
              <div>
                <span className="eyebrow">YOUR RESEARCH, CONTINUED</span>
                <h2>继续研究什么</h2>
              </div>
              <span>AI 建议需核查</span>
            </header>
            <div
              className="lab-transcript"
              ref={transcript}
              role="log"
              aria-label="项目研究对话"
            >
              <article className="message message-assistant">
                <div className="message-body">
                  <p>
                    你从“{p.observation || p.name}”出发
                    {concepts.length
                      ? `，已选择${concepts.slice(0, 4).join("、")}`
                      : ""}
                    ，本次有 {evidence.length} 篇资料
                    {context
                      ? "和已保存的跨文献梳理"
                      : "，还可以先梳理它们的联系"}
                    。接下来想聚焦哪类对象，或更适合怎样的作业条件？
                  </p>
                  <small>这是项目状态摘要，尚未声称完整读过论文。</small>
                </div>
              </article>
              {r.messages.map((m) => (
                <article key={m.id} className={`message message-${m.role}`}>
                  <div className="message-body">
                    <p>{m.content}</p>
                    {m.fingerprint && m.fingerprint !== fingerprint && (
                      <small>这轮讨论基于旧资料，待复核。</small>
                    )}
                  </div>
                  {m.role === "assistant" && (
                    <details className="rj-chat-sources">
                      <summary>本轮讨论资料与证据边界</summary>
                      <p>
                        下列是讨论材料，不代表回复中的研究提议已被文献证明；只使用提供的摘要、精析与有限节选。
                      </p>
                      <Sources project={p} ids={m.sourceIds} />
                    </details>
                  )}
                  <div className="rj-message-actions">
                    {m.role === "user" ? (
                      <button
                        disabled={pending || busy}
                        onClick={() =>
                          void preserveMessage(m.content, "preference")
                        }
                      >
                        更新我的偏好
                      </button>
                    ) : (
                      <>
                        <button
                          disabled={pending || busy}
                          onClick={() =>
                            void preserveMessage(m.content, "candidate")
                          }
                        >
                          加入方向候选
                        </button>
                        <button
                          disabled={pending || busy}
                          onClick={() =>
                            void preserveMessage(m.content, "reject")
                          }
                        >
                          标记为不考虑
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <form
              className="lab-composer"
              onSubmit={(e) => {
                e.preventDefault();
                void run("discussion", { message: draft });
              }}
            >
              <label className="sr-only" htmlFor="research-message">
                继续讨论研究方向
              </label>
              <textarea
                id="research-message"
                rows={2}
                maxLength={2000}
                placeholder="例如：我想研究大学生，偏问卷，不做复杂实验。"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  rememberInput("discussionDraft", e.target.value);
                }}
                onBlur={() =>
                  void save({ ...stateRef.current, discussionDraft: draft })
                }
              />
              <div>
                <span>{draft.length} / 2000</span>
                <button
                  className="button primary"
                  disabled={pending || busy || !draft.trim()}
                >
                  发送研究想法
                </button>
              </div>
            </form>
          </div>
          <div className="rj-followups" aria-label="继续探索问题">
            {(r.messages.filter((m) => m.role === "assistant").at(-1)
              ?.quickQuestions.length
              ? r.messages.filter((m) => m.role === "assistant").at(-1)!
                  .quickQuestions
              : [
                  `围绕${concepts[0] ?? "当前主题"}，还缺什么证据？`,
                  `这 ${evidence.length} 篇资料有哪些解释值得比较？`,
                  "我只会做问卷，可以怎样缩小研究问题？",
                  "聚焦大学生是否可行？",
                ]
            ).map((q) => (
              <button
                key={q}
                disabled={pending || busy}
                onClick={() => void run("discussion", { message: q })}
              >
                {q}
              </button>
            ))}
          </div>
          <details className="rj-preferences frosted-surface">
            <summary>我的研究偏好与不考虑的角度</summary>
            <label>
              已保存的研究偏好
              <textarea
                aria-label="研究偏好"
                rows={3}
                maxLength={6000}
                value={preferences}
                onChange={(e) => {
                  setPreferences(e.target.value);
                  rememberInput("preferences", e.target.value);
                }}
                onBlur={() => void save({ ...stateRef.current, preferences })}
              />
            </label>
            <button
              disabled={busy || pending}
              onClick={() => void save({ ...stateRef.current, preferences })}
            >
              保存研究偏好
            </button>
            {r.rejectedAngles.map((a, i) => (
              <p key={i}>
                不考虑：{a}{" "}
                <button
                  onClick={() =>
                    void save({
                      ...stateRef.current,
                      rejectedAngles: stateRef.current.rejectedAngles.filter(
                        (_, j) => j !== i,
                      ),
                    })
                  }
                >
                  撤销
                </button>
              </p>
            ))}
          </details>
          <div className="workspace-actions">
            <button
              className="button primary"
              disabled={pending || busy || !evidence.length}
              onClick={() => void run("directions")}
            >
              根据我们的讨论推荐方向
            </button>
            <button onClick={() => void changeStage("directions")}>
              查看已保存方向
            </button>
          </div>
          <p className="rj-cost-note">
            推荐会参考当前资料、对话和明确保存的偏好；单次调用，不覆盖已确认方向。
          </p>
        </section>
      )}
      {stage === "directions" && (
        <section className="rj-directions">
          <header className="rj-heading">
            <span className="eyebrow">CHOOSE YOUR OWN QUESTION</span>
            <h2>我的研究方向</h2>
            <p>比较候选，修改具体问题，再由你确认。</p>
          </header>
          {!batch && (
            <p className="source-notice">
              先结合文献与 AI 讨论，再生成候选；也可以记录自己的方向。
            </p>
          )}
          <div className="rj-candidate-grid">
            {batch?.cards.map((card, i) => (
              <article
                key={card.id}
                className="direction-choice frosted-surface"
              >
                <span>
                  方向 {i + 1} ·{" "}
                  {card.status === "rejected" ? "暂不考虑" : "AI 提议"}
                </span>
                <h3>{card.title}</h3>
                <p>{card.question}</p>
                <h4>为什么值得研究</h4>
                <p>{card.value}</p>
                <h4>初步方法与难度</h4>
                <p>{card.method || "待讨论"}</p>
                <div className="concept-tags">
                  {card.concepts.map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
                <details>
                  <summary>关联文献与待确认事项</summary>
                  <Sources project={p} ids={card.evidenceIds} />
                  <p>{card.limitations}</p>
                </details>
                <div className="workspace-actions">
                  <button
                    className="button primary"
                    disabled={busy || pending}
                    onClick={() => editCard(card, card.id)}
                  >
                    选择这个方向
                  </button>
                  <button onClick={() => editCard(card, card.id)}>
                    修改方向
                  </button>
                  <button
                    onClick={async () => {
                      const text = `关于候选方向「${card.title}」：${card.question}。我想进一步调整：`;
                      setDraft(text);
                      setStage("discussion");
                      await save({
                        ...stateRef.current,
                        stage: "discussion",
                        discussionDraft: text,
                        discussionCandidateId: card.id,
                      });
                    }}
                  >
                    和 AI 进一步讨论
                  </button>
                  <button
                    onClick={() =>
                      void save({
                        ...stateRef.current,
                        candidateBatches: stateRef.current.candidateBatches.map(
                          (b) =>
                            b.id === batch.id
                              ? {
                                  ...b,
                                  cards: b.cards.map((c) =>
                                    c.id === card.id
                                      ? {
                                          ...c,
                                          status:
                                            c.status === "rejected"
                                              ? "candidate"
                                              : "rejected",
                                        }
                                      : c,
                                  ),
                                }
                              : b,
                        ),
                        rejectedAngles:
                          card.status === "rejected"
                            ? stateRef.current.rejectedAngles.filter(
                                (a) => a !== card.question,
                              )
                            : [
                                ...stateRef.current.rejectedAngles,
                                card.question,
                              ],
                      })
                    }
                  >
                    {card.status === "rejected" ? "重新考虑" : "暂不选择"}
                  </button>
                </div>
              </article>
            ))}
          </div>
          <div className="workspace-actions">
            <button onClick={() => void changeStage("discussion")}>
              返回研究对话
            </button>
            <button onClick={() => editCard(blankCard(), null)}>
              自己记录研究方向
            </button>
          </div>
          <section
            className="my-direction-card frosted-surface rj-confirmed"
            aria-label="当前研究方向"
          >
            <h3>{editing ? "完善并确认方向" : "当前已确认方向"}</h3>
            {!editing && active ? (
              <>
                <h4>{active.card.title}</h4>
                {(
                  Object.entries(cardLabels) as [
                    keyof typeof cardLabels,
                    string,
                  ][]
                )
                  .filter(([k]) => k !== "title")
                  .map(([k, label]) => (
                    <section key={k}>
                      <h5>{label}</h5>
                      <p>{active.card[k] || "待补充"}</p>
                    </section>
                  ))}
                <Sources project={p} ids={active.card.evidenceIds} />
                <button
                  onClick={() => editCard(active.card, active.candidateId)}
                >
                  编辑已确认方向
                </button>
                <button
                  className="button primary"
                  onClick={() => void changeStage("design")}
                >
                  开始研究设计
                </button>
              </>
            ) : !editing ? (
              <p>尚未确认方向，选择候选或记录自己的研究问题。</p>
            ) : null}
            {editing && (
              <>
                <div className="direction-fields">
                  {(
                    Object.entries(cardLabels) as [
                      keyof typeof cardLabels,
                      string,
                    ][]
                  ).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <textarea
                        aria-label={label}
                        rows={key === "title" ? 1 : 2}
                        maxLength={key === "title" ? 160 : 1000}
                        value={cardDraft[key]}
                        onChange={(e) => {
                          const card = { ...cardDraft, [key]: e.target.value };
                          setCardDraft(card);
                          rememberInput("directionDraft", {
                            candidateId,
                            card,
                          });
                        }}
                        onBlur={() =>
                          void save({
                            ...stateRef.current,
                            directionDraft: { candidateId, card: cardDraft },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <details>
                  <summary>调整关联文献</summary>
                  {(p.library?.items ?? []).map((i) => (
                    <label className="rj-evidence-check" key={i.id}>
                      <input
                        type="checkbox"
                        checked={cardDraft.evidenceIds.includes(i.id)}
                        onChange={(e) => {
                          const card = {
                            ...cardDraft,
                            evidenceIds: e.target.checked
                              ? [...cardDraft.evidenceIds, i.id]
                              : cardDraft.evidenceIds.filter(
                                  (id) => id !== i.id,
                                ),
                          };
                          setCardDraft(card);
                          void save({
                            ...stateRef.current,
                            directionDraft: { candidateId, card },
                          });
                        }}
                      />
                      {i.paper.title}
                    </label>
                  ))}
                </details>
                <button
                  className="button primary"
                  disabled={busy || pending}
                  onClick={() => void confirmDirection()}
                >
                  确认并保存研究方向
                </button>
              </>
            )}
          </section>
          <details className="study-history">
            <summary>候选方向历史 · {r.candidateBatches.length} 批</summary>
            {r.candidateBatches.map((b) => (
              <button key={b.id} onClick={() => setSelectedBatch(b.id)}>
                {new Date(b.createdAt).toLocaleString()} · {b.cards.length}{" "}
                个候选
              </button>
            ))}
          </details>
          <details className="study-history">
            <summary>已确认方向版本 · {r.directions.length} 版</summary>
            {r.directions.map((d) => (
              <article key={d.id}>
                <h4>{d.card.title}</h4>
                <p>{d.card.question}</p>
                <button
                  onClick={() =>
                    void save({ ...stateRef.current, activeDirectionId: d.id })
                  }
                >
                  恢复此版本为当前方向
                </button>
              </article>
            ))}
          </details>
        </section>
      )}
      {stage === "design" && (
        <ResearchDesign
          project={p}
          research={r}
          onChange={async (next) => {
            if (next.stage !== stage) setStage(next.stage);
            return save(next, r);
          }}
          onRequest={(task, payload) =>
            run(task, payload as Record<string, unknown> | undefined)
          }
          busy={busy || pending}
        />
      )}
      <ProjectHistory project={p} initiallyOpen={showHistory} />
    </>
  );
}
