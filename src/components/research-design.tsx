"use client";

import { useId, useRef, useState } from "react";
import type { Project } from "@/lib/projects";
import { isRecord } from "@/lib/exploration";
import {
  currentResearchDirection,
  isQualitativeDesign,
  isQuantitativeDesign,
  removeHypothesis,
  removeQualitativeTheme,
  removeVariable,
  renameVariable,
  researchDesignPlainText,
  researchFingerprint,
  updateQualitativeTheme,
  type QualitativeDesign,
  type QuantitativeDesign,
  type ResearchHypothesis,
  type ResearchMethod,
  type ResearchVariable,
  type ResearchWorkspace,
} from "@/lib/research-workspace";
import "@/app/research-design.css";

type Design = QuantitativeDesign | QualitativeDesign;
type DesignRequest = (
  task: "method" | "quantitative" | "qualitative",
  payload?: unknown,
) => Promise<unknown>;
type Props = {
  project: Project;
  research: ResearchWorkspace;
  onChange: (next: ResearchWorkspace) => Promise<boolean>;
  onRequest: DesignRequest;
  busy: boolean;
};
const methodName = (m: ResearchMethod) =>
  m === "quantitative" ? "定量研究" : "质性研究";
const roleNames: Record<ResearchVariable["role"], string> = {
  X: "自变量 X",
  Y: "因变量 Y",
  M: "中介 M",
  W: "调节 W",
  control: "控制变量",
};
const stepNames = {
  quantitative: ["研究问题", "核心变量", "假设与模型", "实施建议"],
  qualitative: ["研究问题", "对象与主题", "访谈提纲", "实施建议"],
};
const stepTasks = {
  quantitative: ["question", "variables", "hypotheses", "method"],
  qualitative: ["question", "themes", "questions", "method"],
};
const isQuant = (d: Design): d is QuantitativeDesign => "variables" in d;
const validate = (d: unknown): d is Design =>
  isQuantitativeDesign(d) || isQualitativeDesign(d);
// An empty variable name is a recoverable in-progress edit, never a valid project save.
function isRecoverableDesign(d: unknown, method: ResearchMethod): d is Design {
  if (method === "qualitative") return isQualitativeDesign(d);
  if (!isRecord(d) || !Array.isArray(d.variables)) return false;
  return isQuantitativeDesign({
    ...d,
    variables: d.variables.map((v) =>
      isRecord(v) && v.name === "" ? { ...v, name: "未填写" } : v,
    ),
  });
}
const draftKey = (p: string, m: ResearchMethod) =>
  `paperi.design.draft.${p}.${m}`;

function blankDesign(
  p: Project,
  r: ResearchWorkspace,
  method: ResearchMethod,
): Design {
  const direction = currentResearchDirection(r)!;
  const now = new Date().toISOString();
  const base = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    fingerprint: researchFingerprint(p),
    directionId: direction.id,
    sourceIds: direction.card.evidenceIds,
    confirmed: false,
    question: direction.card.question,
    value: direction.card.value,
    evidenceGap: direction.card.limitations,
    method: "",
    target: "",
    sampling: "",
    analysis: "",
    limitations: "",
  };
  return method === "quantitative"
    ? { ...base, variables: [], hypotheses: [], operationalization: "" }
    : {
        ...base,
        setting: "",
        themes: [],
        questions: [],
        ethics: "",
        outlineNeedsReview: false,
      };
}

/** The two methods remain independent documents; switching never converts their content. */
export function ResearchDesign({
  project,
  research,
  onChange,
  onRequest,
  busy,
}: Props) {
  const direction = currentResearchDirection(research);
  const [switchTo, setSwitchTo] = useState<ResearchMethod | null>(null);
  const [step, setStep] = useState(0);
  const [notice, setNotice] = useState("");
  const method = research.method;
  const draft = method ? research[method] : null;
  async function choose(next: ResearchMethod) {
    if (method && method !== next) {
      setSwitchTo(next);
      return;
    }
    if (await onChange({ ...research, method: next })) setStep(0);
  }
  async function switchMethod() {
    if (!switchTo) return;
    if (await onChange({ ...research, method: switchTo })) {
      setNotice(`已切换为${methodName(switchTo)}，另一种方法的草稿仍保留。`);
      setSwitchTo(null);
      setStep(0);
    }
  }
  if (!direction)
    return (
      <section className="rd-empty frosted-surface">
        <span className="eyebrow">先确定自己的问题</span>
        <h3>研究设计从你确认的方向开始</h3>
        <p>
          请先到“我的研究方向”选择或完善一个方向。之后可以分别探索问卷、小实验，或访谈与观察的初步方案。
        </p>
        <p className="muted">
          这里不会在没有研究方向时自动生成设计，也不会调用 AI。
        </p>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void onChange({ ...research, stage: "directions" })}
        >
          去确认研究方向
        </button>
      </section>
    );
  return (
    <section className="rd-workspace" aria-label="我的研究设计">
      <div className="rd-intro">
        <div>
          <span className="eyebrow">从问题出发，选择方法</span>
          <h3>我的研究设计</h3>
        </div>
        <p>
          当前方向：{direction.card.title}
          。先形成可执行的初步方案，再逐项核对文献与可行性。
        </p>
      </div>
      <div className="rd-methods" aria-label="研究路径">
        <button
          className={
            method === "quantitative" ? "rd-method selected" : "rd-method"
          }
          aria-pressed={method === "quantitative"}
          disabled={busy}
          onClick={() => void choose("quantitative")}
        >
          <strong>定量研究</strong>
          <span>用问卷或小实验测量概念之间的关系</span>
          {research.quantitative && <small>已有独立草稿</small>}
        </button>
        <button
          className={
            method === "qualitative" ? "rd-method selected" : "rd-method"
          }
          aria-pressed={method === "qualitative"}
          disabled={busy}
          onClick={() => void choose("qualitative")}
        >
          <strong>质性研究</strong>
          <span>用访谈或观察理解经验、意义与过程</span>
          {research.qualitative && <small>已有独立草稿</small>}
        </button>
        <button
          className="rd-method"
          disabled={busy}
          onClick={() => void onRequest("method")}
        >
          <strong>我还不确定</strong>
          <span>请 AI 结合当前问题比较两种方法</span>
          <small>单次模型调用，最终由你选择</small>
        </button>
      </div>
      {switchTo && (
        <div className="rd-switch" role="status">
          <p>
            将切换到{methodName(switchTo)}。原有
            {method ? methodName(method) : "另一种方法"}
            草稿和历史都保留，不会套用到新路径；未保存的编辑也会留在当前浏览器。
          </p>
          <div className="workspace-actions">
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void switchMethod()}
            >
              保留草稿并切换
            </button>
            <button
              className="button secondary"
              onClick={() => setSwitchTo(null)}
            >
              暂不切换
            </button>
          </div>
        </div>
      )}
      {!!research.methodAdvice && (
        <details className="rd-method-advice" open>
          <summary>AI 的方法比较 · 建议，待你决定</summary>
          <p>{research.methodAdvice}</p>
        </details>
      )}
      {notice && (
        <p className="rd-notice" role="status">
          {notice}
        </p>
      )}
      {method && (
        <>
          <nav
            className="rd-step-nav"
            aria-label={`${methodName(method)}设计步骤`}
          >
            {stepNames[method].map((name, i) => (
              <button
                key={name}
                aria-current={step === i ? "step" : undefined}
                className={step === i ? "active" : ""}
                disabled={busy || (!draft && i > 0)}
                onClick={() => setStep(i)}
              >
                <span>{i + 1}</span>
                {name}
              </button>
            ))}
          </nav>
          {!draft ? (
            <div className="rd-empty frosted-surface">
              <h3>先说清楚我研究什么</h3>
              <p>
                从已确认方向出发，明确一个适合{methodName(method)}
                的研究问题。每次只处理当前环节，不一次塞满整份设计。
              </p>
              <div className="workspace-actions">
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    void onRequest(method, { designStep: "question" })
                  }
                >
                  AI 帮我明确研究问题
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    void onChange({
                      ...research,
                      [method]: blankDesign(project, research, method),
                    })
                  }
                >
                  先自己写研究问题
                </button>
              </div>
              <p className="muted">
                AI 按钮会发起一次模型调用；切换步骤和手动编辑不产生 API 费用。
              </p>
            </div>
          ) : (
            <DesignEditor
              key={`${project.id}:${method}:${draft.id}:${draft.updatedAt}`}
              {...{
                project,
                research,
                onChange,
                onRequest,
                busy,
                method,
                step,
                setStep,
                saved: draft,
              }}
            />
          )}
          <DesignHistory {...{ research, onChange, busy, method }} />
        </>
      )}
    </section>
  );
}

function DesignHistory({
  research,
  onChange,
  busy,
  method,
}: Pick<Props, "research" | "onChange" | "busy"> & { method: ResearchMethod }) {
  const history =
    method === "quantitative"
      ? research.quantitativeHistory
      : research.qualitativeHistory;
  const [index, setIndex] = useState("");
  if (!history.length) return null;
  const chosen = history[Number(index)];
  async function restore() {
    if (!chosen) return;
    const field =
      method === "quantitative" ? "quantitativeHistory" : "qualitativeHistory";
    const current = research[method];
    const next = {
      ...research,
      [method]: { ...chosen, updatedAt: new Date().toISOString() },
      [field]: current ? [...history, current] : history,
    };
    await onChange(next);
  }
  return (
    <details className="rd-history">
      <summary>
        {methodName(method)}保存历史 · {history.length} 个版本
      </summary>
      <p>旧版本始终可回看。恢复时，当前版本也会保留。</p>
      <label>
        选择历史版本
        <select aria-label="选择历史版本" value={index} onChange={(e) => setIndex(e.target.value)}>
          <option value="">选择一个版本</option>
          {history.map((d, i) => (
            <option value={i} key={`${d.id}-${d.updatedAt}-${i}`}>
              {new Date(d.updatedAt).toLocaleString("zh-CN")} ·{" "}
              {d.question.slice(0, 40)}
            </option>
          ))}
        </select>
      </label>
      {index !== "" && chosen && (
        <>
          <pre>{researchDesignPlainText(chosen)}</pre>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void restore()}
          >
            恢复这个版本并保留当前草稿
          </button>
        </>
      )}
    </details>
  );
}

function DesignEditor({
  project,
  research,
  onChange,
  onRequest,
  busy,
  saved,
  method,
  step,
  setStep,
}: Props & {
  saved: Design;
  method: ResearchMethod;
  step: number;
  setStep: (step: number) => void;
}) {
  const recoveryKey = draftKey(project.id, method);
  const [recovery] = useState<Design | null>(() => {
    try {
      const raw = localStorage.getItem(recoveryKey);
      if (!raw) return null;
      const d: unknown = JSON.parse(raw);
      return isRecoverableDesign(d, method) &&
        isQuant(d) === (method === "quantitative") &&
        d.directionId === saved.directionId
        ? d
        : null;
    } catch {
      return null;
    }
  });
  const [draft, setDraft] = useState<Design>(() =>
    recovery && recovery.updatedAt === saved.updatedAt ? recovery : saved,
  );
  const [dirty, setDirty] = useState(
    () =>
      !!recovery &&
      recovery.updatedAt === saved.updatedAt &&
      JSON.stringify(recovery) !== JSON.stringify(saved),
  );
  const [message, setMessage] = useState("");
  const draftRef = useRef(draft);
  const saving = useRef(false);
  const stale = draft.fingerprint !== researchFingerprint(project);
  const current = currentResearchDirection(research);
  const directionChanged = current?.id !== draft.directionId;
  const readyToConfirm =
    !!draft.question.trim() &&
    !!draft.method.trim() &&
    !!draft.analysis.trim() &&
    (isQuant(draft)
      ? draft.variables.length >= 2 && draft.hypotheses.length > 0
      : draft.themes.length > 0 &&
        draft.questions.length > 0 &&
        !draft.outlineNeedsReview);
  function edit(next: Design) {
    const d = { ...next, confirmed: false };
    draftRef.current = d;
    setDraft(d);
    setDirty(true);
    setMessage("");
    try {
      localStorage.setItem(recoveryKey, JSON.stringify(d));
    } catch {
      setMessage("浏览器无法临时保留编辑，请点击保存当前设计后再换页。");
    }
  }
  async function save(confirm = false) {
    if (saving.current) return false;
    let candidate: Design = {
      ...draftRef.current,
      confirmed: confirm || draftRef.current.confirmed,
      updatedAt: new Date().toISOString(),
    };
    if (confirm && isQuant(candidate))
      candidate = {
        ...candidate,
        variables: candidate.variables.map((v) => ({ ...v, confirmed: true })),
        hypotheses: candidate.hypotheses.map((h) => ({
          ...h,
          confirmed: true,
        })),
      };
    if (!validate(candidate)) {
      setMessage(
        "请检查变量名称、假设关联或主题信息，当前编辑尚未保存，旧设计保留。",
      );
      return false;
    }
    const historyKey =
      method === "quantitative" ? "quantitativeHistory" : "qualitativeHistory";
    if (research[historyKey].length >= 100) {
      setMessage("设计历史已达上限，请先备份并分项目继续；原有版本保留。");
      return false;
    }
    saving.current = true;
    try {
      const ok = await onChange({
        ...research,
        [method]: candidate,
        [historyKey]: [...research[historyKey], saved],
      });
      if (ok) {
        try {
          localStorage.removeItem(recoveryKey);
        } catch {
          /* The project save already succeeded. */
        }
        setDirty(false);
        setMessage(
          confirm
            ? "初步方案已由你确认，仍需核对证据并实际检验。"
            : "当前设计已保存。",
        );
      } else
        setMessage(
          "保存未完成。编辑已临时保留，请处理页面存储提示后仅重试保存，无需重新调用 AI。",
        );
      return ok;
    } finally {
      saving.current = false;
    }
  }
  async function generate() {
    if (dirty && !(await save())) return;
    await onRequest(method, { designStep: stepTasks[method][step] });
  }
  async function advance() {
    if (dirty && !(await save())) return;
    setStep(Math.min(step + 1, 3));
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(plainText());
      setMessage("已复制普通中文研究设计。");
    } catch {
      setMessage("浏览器未允许复制，可展开完整方案后选择文字复制。");
    }
  }
  function plainText() {
    return researchDesignPlainText(
      draft,
      draft.sourceIds.map(
        (id) =>
          project.library?.items.find((i) => i.id === id)?.paper.title ??
          "文献已移除，待核查",
      ),
    );
  }
  const patch = (key: string, value: string) =>
    edit({ ...draft, [key]: value });
  const saveOnBlur = () => {
    if (dirty) void save();
  };
  return (
    <div className="rd-editor">
      <div className="rd-editor-status">
        <span className="soft-badge">
          {draft.confirmed ? "用户已确认 · 初步方案" : "AI 建议 / 用户编辑草稿"}
        </span>
        <span>
          {dirty ? "有待保存的编辑（已临时保留）" : "已保存在当前项目"}
        </span>
      </div>
      {(stale || directionChanged) && (
        <div className="rd-warning" role="status">
          <p>
            {directionChanged
              ? "当前确认的研究方向已改变；这份设计保留原方向版本，请决定是否继续编辑或基于新方向重新建议。"
              : "资料来源已变，需要核对；已有设计未被清空。"}
          </p>
          {directionChanged && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void onRequest(method, { designStep: "question" })}
            >
              基于当前方向新建设计，保留旧稿
            </button>
          )}
        </div>
      )}
      {recovery && recovery.updatedAt !== saved.updatedAt && (
        <details className="rd-warning">
          <summary>发现另一份未保存的编辑</summary>
          <p>
            当前显示较新的已保存版本。可以检查并恢复浏览器临时保留的编辑，恢复不会立即覆盖项目。
          </p>
          <pre>{researchDesignPlainText(recovery)}</pre>
          <button
            className="button secondary"
            onClick={() => edit({ ...recovery, updatedAt: saved.updatedAt })}
          >
            恢复未保存的编辑
          </button>
        </details>
      )}
      <div className="rd-step-heading">
        <div>
          <span className="eyebrow">
            {methodName(method)} · {step + 1} / 4
          </span>
          <h3>{stepNames[method][step]}</h3>
        </div>
        <button
          className="button secondary"
          disabled={busy || directionChanged}
          onClick={() => void generate()}
        >
          AI 帮我梳理这一环节
        </button>
      </div>
      <p className="rd-step-note">
        只为当前环节请求一次 AI
        建议。已有内容将保留为历史；建议不等于原论文结论，确认也不代表已经验证。
      </p>
      <div
        className="rd-fields"
        onBlur={(e) => {
          if (
            !e.currentTarget.contains(e.relatedTarget) &&
            !(
              e.relatedTarget instanceof HTMLElement &&
              e.relatedTarget.closest(".rd-workspace button")
            )
          )
            saveOnBlur();
        }}
      >
        {step === 0 && (
          <>
            <TextField
              label="我的研究问题"
              value={draft.question}
              onChange={(v) => patch("question", v)}
              rows={3}
            />
            <TextField
              label="为什么值得研究"
              value={draft.value}
              onChange={(v) => patch("value", v)}
              rows={3}
            />
            <TextField
              label="文献依据还缺什么"
              value={draft.evidenceGap}
              onChange={(v) => patch("evidenceGap", v)}
              rows={3}
            />
            <EvidenceList
              ids={draft.sourceIds}
              project={project}
              onRemoveMissing={() => {
                const valid = (id: string) =>
                  !!project.library?.items.some((item) => item.id === id);
                const updated = {
                  ...draft,
                  sourceIds: draft.sourceIds.filter(valid),
                };
                edit(
                  isQuant(updated)
                    ? {
                        ...updated,
                        variables: updated.variables.map((v) => ({
                          ...v,
                          evidenceIds: v.evidenceIds.filter(valid),
                        })),
                        hypotheses: updated.hypotheses.map((h) => ({
                          ...h,
                          evidenceIds: h.evidenceIds.filter(valid),
                        })),
                      }
                    : updated,
                );
              }}
            />
          </>
        )}
        {isQuant(draft) ? (
          <>
            {step === 1 && (
              <QuantVariables draft={draft} edit={edit} project={project} />
            )}
            {step === 2 && (
              <QuantHypotheses draft={draft} edit={edit} project={project} />
            )}
            {step === 3 && (
              <>
                <p className="rd-warning">
                  横截面问卷通常只能探讨关系；不能直接证明因果。量表来源、样本量和分析前提需进一步核查。
                </p>
                <TextField
                  label="问卷或小实验建议"
                  value={draft.method}
                  onChange={(v) => patch("method", v)}
                />
                <TextField
                  label="研究对象"
                  value={draft.target}
                  onChange={(v) => patch("target", v)}
                />
                <TextField
                  label="样本如何获取"
                  value={draft.sampling}
                  onChange={(v) => patch("sampling", v)}
                />
                <TextField
                  label="变量如何操作化"
                  value={draft.operationalization}
                  onChange={(v) => patch("operationalization", v)}
                />
                <TextField
                  label="初步分析方法与条件"
                  value={draft.analysis}
                  onChange={(v) => patch("analysis", v)}
                />
                <TextField
                  label="本科生实施难度与方法限制"
                  value={draft.limitations}
                  onChange={(v) => patch("limitations", v)}
                />
              </>
            )}
          </>
        ) : (
          <>
            {step === 1 && <QualThemes draft={draft} edit={edit} />}
            {step === 2 && <QualQuestions draft={draft} edit={edit} />}
            {step === 3 && (
              <>
                <TextField
                  label="访谈、焦点小组或观察建议"
                  value={draft.method}
                  onChange={(v) => patch("method", v)}
                />
                <TextField
                  label="招募与样本考虑"
                  value={draft.sampling}
                  onChange={(v) => patch("sampling", v)}
                />
                <TextField
                  label="记录、编码与主题分析路径"
                  value={draft.analysis}
                  onChange={(v) => patch("analysis", v)}
                />
                <TextField
                  label="伦理、知情同意与隐私"
                  value={draft.ethics}
                  onChange={(v) => patch("ethics", v)}
                />
                <TextField
                  label="本科生可行性与限制"
                  value={draft.limitations}
                  onChange={(v) => patch("limitations", v)}
                />
                <div className="rd-qual-flow" aria-label="质性研究逻辑结构">
                  <div>
                    <small>理解什么</small>
                    <p>{draft.question || "研究问题待补充"}</p>
                  </div>
                  <span aria-hidden="true">→</span>
                  <div>
                    <small>探索主题</small>
                    <p>
                      {draft.themes.map((t) => t.title).join("；") || "待补充"}
                    </p>
                  </div>
                  <span aria-hidden="true">→</span>
                  <div>
                    <small>收集与分析</small>
                    <p>{draft.method || "方法待确认"}</p>
                    <p>{draft.analysis || "分析思路待确认"}</p>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
      {message && (
        <p className="rd-notice" role="status">
          {message}
        </p>
      )}
      <div className="rd-save-actions">
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void save()}
        >
          保存当前设计
        </button>
        {step < 3 && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void advance()}
          >
            确认这一环节，继续
          </button>
        )}
        <button
          className="text-button"
          disabled={busy}
          onClick={() => void copy()}
        >
          复制普通文字
        </button>
        <button className="text-button" onClick={() => window.print()}>
          打印研究设计
        </button>
      </div>
      <details className="rd-report">
        <summary>阅读完整研究设计</summary>
        <pre>{plainText()}</pre>
        {!draft.confirmed && (
          <button
            className="button secondary"
            disabled={busy || !readyToConfirm}
            onClick={() => void save(true)}
          >
            确认这份初步方案
          </button>
        )}
        {!draft.confirmed && !readyToConfirm && (
          <p className="muted">
            请先补全研究问题、
            {isQuant(draft) ? "变量与拟检验假设" : "探索主题与提纲"}
            、方法和分析思路，再确认完整初步方案。未完成时仍可随时保存草稿。
          </p>
        )}
      </details>
      <article className="rd-print">
        <h2>我的研究设计</h2>
        <pre>{plainText()}</pre>
      </article>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  rows = 3,
  maxLength = 4000,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <label className="rd-field" htmlFor={id}>
      <span>{label}</span>
      <textarea
        id={id}
        aria-label={label}
        rows={rows}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function EvidenceList({
  ids,
  project,
  onRemoveMissing,
}: {
  ids: string[];
  project: Project;
  onRemoveMissing: () => void;
}) {
  return (
    <details className="rd-evidence">
      <summary>查看文献依据 · {ids.length} 篇（关联不代表已证明）</summary>
      {ids.length ? (
        <ul>
          {ids.map((id) => {
            const item = project.library?.items.find((i) => i.id === id);
            return (
              <li key={id}>
                {item ? (
                  <>
                    <strong>{item.paper.title}</strong>
                    <span>
                      {item.attachment
                        ? "提供 PDF 节选，不保证全文覆盖"
                        : item.paper.abstract
                          ? "只有可用摘要"
                          : "仅题录，不能核实研究发现"}
                    </span>
                    {item.paper.recordUrl && (
                      <a
                        href={item.paper.recordUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        原始来源
                      </a>
                    )}
                  </>
                ) : (
                  "来源已移除，需要核对"
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>尚无直接文献依据，这里是待核实的研究建议。</p>
      )}
      {ids.some(
        (id) => !project.library?.items.some((item) => item.id === id),
      ) && (
        <button className="text-button" onClick={onRemoveMissing}>
          解除已移除文献的关联（保存后保留旧版本）
        </button>
      )}
    </details>
  );
}

function QuantVariables({
  draft,
  edit,
  project,
}: {
  draft: QuantitativeDesign;
  edit: (d: Design) => void;
  project: Project;
}) {
  function patch(
    id: string,
    field: keyof ResearchVariable,
    value: string | boolean | string[],
  ) {
    if (field === "name") {
      const name = String(value);
      if (name.trim()) edit(renameVariable(draft, id, name));
      else
        edit({
          ...draft,
          variables: draft.variables.map((v) =>
            v.id === id ? { ...v, name, confirmed: false } : v,
          ),
        });
    } else
      edit({
        ...draft,
        variables: draft.variables.map((v) =>
          v.id === id
            ? {
                ...v,
                [field]: value,
                confirmed: field === "confirmed" ? Boolean(value) : false,
              }
            : v,
        ),
      });
  }
  return (
    <>
      <p>
        先保留真正需要研究的构念。中介、调节和控制变量都可以不设，不为画图凑变量。
      </p>
      <div className="rd-card-grid">
        {draft.variables.map((v) => (
          <article
            className="rd-variable"
            data-variable-id={v.id}
            id={`rd-variable-${v.id}`}
            key={v.id}
          >
            <div className="rd-card-top">
              <span className="soft-badge">
                {v.confirmed ? "用户已确认" : "候选变量"}
              </span>
              <button
                className="text-button"
                onClick={() => edit(removeVariable(draft, v.id))}
              >
                删除变量
              </button>
            </div>
            <label className="rd-field">
              变量名称
              <input
                aria-label="变量名称"
                maxLength={120}
                value={v.name}
                onChange={(e) => patch(v.id, "name", e.target.value)}
              />
            </label>
            <label className="rd-field">
              变量角色
              <select
                aria-label="变量角色"
                value={v.role}
                onChange={(e) => patch(v.id, "role", e.target.value)}
              >
                {Object.entries(roleNames).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label="通俗解释"
              value={v.explanation}
              onChange={(value) => patch(v.id, "explanation", value)}
              maxLength={1600}
            />
            <TextField
              label="为什么选择它"
              value={v.rationale}
              onChange={(value) => patch(v.id, "rationale", value)}
              maxLength={1600}
            />
            <TextField
              label="待核实事项"
              value={v.uncertainty}
              onChange={(value) => patch(v.id, "uncertainty", value)}
              maxLength={1600}
            />
            <EvidenceEditor
              ids={v.evidenceIds}
              project={project}
              onChange={(ids) => patch(v.id, "evidenceIds", ids)}
            />
            <label className="rd-check">
              <input
                type="checkbox"
                checked={v.confirmed}
                onChange={(e) => patch(v.id, "confirmed", e.target.checked)}
              />
              我已确认这个变量的含义与角色
            </label>
          </article>
        ))}
      </div>
      {!draft.variables.length && (
        <p className="rd-empty-inline">
          还没有变量。可让 AI 依据方向建议，或手动添加。
        </p>
      )}
      <button
        className="button secondary"
        disabled={draft.variables.length >= 12}
        onClick={() =>
          edit({
            ...draft,
            variables: [
              ...draft.variables,
              {
                id: crypto.randomUUID(),
                name: "新变量",
                role: draft.variables.some((v) => v.role === "X") ? "Y" : "X",
                explanation: "",
                rationale: "",
                evidenceIds: [],
                uncertainty: "待结合文献核实",
                confirmed: false,
              },
            ],
          })
        }
      >
        添加变量
      </button>
      <p className="muted">删除变量会同步移除引用它的假设和连线。</p>
    </>
  );
}

function QuantHypotheses({
  draft,
  edit,
  project,
}: {
  draft: QuantitativeDesign;
  edit: (d: Design) => void;
  project: Project;
}) {
  const [editingVariable, setEditingVariable] = useState<string | null>(null);
  const selected = draft.variables.find((v) => v.id === editingVariable);
  function patch(id: string, value: Partial<ResearchHypothesis>) {
    edit({
      ...draft,
      hypotheses: draft.hypotheses.map((h) =>
        h.id === id
          ? { ...h, ...value, confirmed: value.confirmed ?? false }
          : h,
      ),
    });
  }
  function changeEndpoint(
    h: ResearchHypothesis,
    endpoint: "from" | "to",
    id: string,
  ) {
    const before = draft.variables.find((v) => v.id === h[endpoint])?.name;
    const after = draft.variables.find((v) => v.id === id)?.name;
    patch(h.id, {
      [endpoint]: id,
      text: before && after ? h.text.split(before).join(after) : h.text,
    });
  }
  function add() {
    const [from, to] = draft.variables;
    if (!from || !to) return;
    edit({
      ...draft,
      hypotheses: [
        ...draft.hypotheses,
        {
          id: crypto.randomUUID(),
          from: from.id,
          to: to.id,
          text: `拟检验${from.name}与${to.name}的关系（方向待论证）`,
          rationale: "待结合文献提出理由；尚未验证。",
          evidenceIds: [],
          confirmed: false,
        },
      ],
    });
  }
  return (
    <>
      <p>
        先用普通中文说明关系，再提出少量完整假设。通常 H1–H3
        就够，也可以少于三条。所有连线都是拟检验关系。
      </p>
      <QuantitativeModel
        design={draft}
        onVariable={(id) => setEditingVariable(id)}
        onHypothesis={(id) =>
          document
            .getElementById(`rd-hypothesis-${id}`)
            ?.querySelector<HTMLTextAreaElement>("textarea")
            ?.focus()
        }
      />
      {selected && (
        <div className="rd-model-edit">
          <label className="rd-field">
            模型中的变量名称
            <input
              aria-label="模型中的变量名称"
              maxLength={120}
              value={selected.name}
              onChange={(e) =>
                edit(renameVariable(draft, selected.id, e.target.value))
              }
            />
          </label>
          <label className="rd-field">
            模型中的变量角色
            <select
              aria-label="模型中的变量角色"
              value={selected.role}
              onChange={(e) =>
                edit({
                  ...draft,
                  variables: draft.variables.map((v) =>
                    v.id === selected.id
                      ? {
                          ...v,
                          role: e.target.value as ResearchVariable["role"],
                          confirmed: false,
                        }
                      : v,
                  ),
                })
              }
            >
              {Object.entries(roleNames).map(([key, label]) => (
                <option value={key} key={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="text-button"
            onClick={() => setEditingVariable(null)}
          >
            收起变量编辑
          </button>
        </div>
      )}
      {draft.hypotheses.map((h, i) => (
        <article
          className="rd-hypothesis"
          data-hypothesis-id={h.id}
          id={`rd-hypothesis-${h.id}`}
          key={h.id}
        >
          <div className="rd-card-top">
            <strong>H{i + 1} · 待检验</strong>
            <button
              className="text-button"
              onClick={() => edit(removeHypothesis(draft, h.id))}
            >
              删除假设
            </button>
          </div>
          <div className="rd-relation-fields">
            <label className="rd-field">
              关系起点
              <select
                aria-label="关系起点"
                value={h.from}
                onChange={(e) => changeEndpoint(h, "from", e.target.value)}
              >
                {draft.variables
                  .filter((v) => v.id !== h.to && v.id !== h.moderatorId)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
              </select>
            </label>
            <span>与</span>
            <label className="rd-field">
              关系终点
              <select
                aria-label="关系终点"
                value={h.to}
                onChange={(e) => changeEndpoint(h, "to", e.target.value)}
              >
                {draft.variables
                  .filter((v) => v.id !== h.from && v.id !== h.moderatorId)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="rd-field">
              调节变量（可不设）
              <select
                aria-label="调节变量（可不设）"
                value={h.moderatorId ?? ""}
                onChange={(e) => {
                  const next = { ...h, confirmed: false };
                  if (e.target.value) next.moderatorId = e.target.value;
                  else delete next.moderatorId;
                  edit({
                    ...draft,
                    hypotheses: draft.hypotheses.map((item) =>
                      item.id === h.id ? next : item,
                    ),
                  });
                }}
              >
                {<option value="">不设置</option>}
                {draft.variables
                  .filter((v) => v.id !== h.from && v.id !== h.to)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <TextField
            label={`H${i + 1} 假设表述`}
            value={h.text}
            onChange={(text) => patch(h.id, { text })}
            maxLength={1600}
          />
          <TextField
            label={`H${i + 1} 逻辑理由与方法限制`}
            value={h.rationale}
            onChange={(rationale) => patch(h.id, { rationale })}
            maxLength={1600}
          />
          <EvidenceEditor
            ids={h.evidenceIds}
            project={project}
            onChange={(evidenceIds) => patch(h.id, { evidenceIds })}
          />
          <label className="rd-check">
            <input
              type="checkbox"
              checked={h.confirmed}
              onChange={(e) => patch(h.id, { confirmed: e.target.checked })}
            />
            我确认将此关系列为待检验假设
          </label>
        </article>
      ))}
      {!draft.hypotheses.length && (
        <p className="rd-empty-inline">尚未提出假设，模型不会自动补连线。</p>
      )}
      <button
        className="button secondary"
        disabled={draft.variables.length < 2 || draft.hypotheses.length >= 12}
        onClick={add}
      >
        添加待检验假设
      </button>
      {draft.variables.length < 2 && (
        <p className="muted">先在“核心变量”确认至少两个不同变量。</p>
      )}
    </>
  );
}

/** Only actual variable IDs and hypotheses determine this SVG. No model call or generated picture. */
export function QuantitativeModel({
  design,
  onVariable,
  onHypothesis,
}: {
  design: QuantitativeDesign;
  onVariable: (id: string) => void;
  onHypothesis: (id: string) => void;
}) {
  const arrowId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const roleColumn = { X: 0, M: 1, Y: 2, W: 1, control: 0 };
  const roleCounts = [0, 0, 0];
  const positions = new Map(
    design.variables.map((v) => {
      const col = roleColumn[v.role];
      const row = roleCounts[col]++;
      return [v.id, { x: 35 + col * 270, y: 120 + row * 145 }];
    }),
  );
  const height = Math.max(280, Math.max(...roleCounts) * 145 + 130);
  const nodeWidth = 190,
    nodeHeight = 68;
  return (
    <figure className="rd-model-wrap">
      <figcaption>
        拟检验研究模型{" "}
        <small>
          点击变量或假设可以编辑 · 虚线表示调节关系 · 未确认项为候选
        </small>
      </figcaption>
      <div className="rd-model-scroll">
        <svg
          className="rd-model"
          role="img"
          aria-label="根据变量和假设同步更新的拟检验研究模型"
          viewBox={`0 0 800 ${height}`}
          style={{ minWidth: 680 }}
        >
          <defs>
            <marker
              id={arrowId}
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0 0L8 4L0 8z" fill="#627a8c" />
            </marker>
          </defs>
          {design.hypotheses.map((h, i) => {
            const a = positions.get(h.from),
              b = positions.get(h.to);
            if (!a || !b) return null;
            const same = a.x === b.x,
              forward = b.x >= a.x;
            const sx = same ? a.x + nodeWidth : forward ? a.x + nodeWidth : a.x;
            const tx = same ? b.x + nodeWidth : forward ? b.x : b.x + nodeWidth;
            const sy = a.y + nodeHeight / 2,
              ty = b.y + nodeHeight / 2;
            const bend = same ? sx + 45 + i * 16 : (sx + tx) / 2;
            // A direct X–Y edge arches above the middle column rather than crossing its mediator node.
            const skipsMiddle = Math.abs(a.x - b.x) > 400;
            const lane = Math.min(sy, ty) - 105 - (i % 3) * 16;
            const path = skipsMiddle
              ? `M${sx},${sy} C${sx + (forward ? 90 : -90)},${lane} ${tx + (forward ? -90 : 90)},${lane} ${tx},${ty}`
              : `M${sx},${sy} C${bend},${sy + (same ? 18 : 0)} ${bend},${ty - (same ? 18 : 0)} ${tx},${ty}`;
            const lx = same ? bend : (sx + tx) / 2,
              ly = skipsMiddle
                ? (sy + ty) / 2 - 87 - (i % 3) * 12
                : (sy + ty) / 2 - 8 - (i % 2) * 12;
            const w = h.moderatorId ? positions.get(h.moderatorId) : undefined;
            return (
              <g
                key={h.id}
                data-hypothesis-id={h.id}
                className={
                  h.confirmed
                    ? "rd-model-edge confirmed"
                    : "rd-model-edge candidate"
                }
                role="button"
                tabIndex={0}
                aria-label={`编辑假设 H${i + 1}：${h.text}`}
                onClick={() => onHypothesis(h.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onHypothesis(h.id);
                  }
                }}
              >
                <path d={path} markerEnd={`url(#${arrowId})`} />
                <path d={path} className="rd-model-hit" />
                <text x={lx} y={ly} textAnchor="middle">
                  H{i + 1}
                  {h.confirmed ? "" : " · 候选"}
                </text>
                {w && (
                  <path
                    className="rd-moderation"
                    d={`M${w.x + nodeWidth / 2},${w.y + nodeHeight} L${lx},${ly + 20}`}
                  />
                )}
              </g>
            );
          })}
          {design.variables.map((v) => {
            const p = positions.get(v.id)!;
            return (
              <g
                key={v.id}
                data-variable-id={v.id}
                className={
                  v.confirmed
                    ? "rd-model-node confirmed"
                    : "rd-model-node candidate"
                }
                role="button"
                tabIndex={0}
                aria-label={`编辑变量 ${v.name}，${roleNames[v.role]}`}
                transform={`translate(${p.x},${p.y})`}
                onClick={() => onVariable(v.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onVariable(v.id);
                  }
                }}
              >
                <rect width={nodeWidth} height={nodeHeight} rx="16" />
                <text
                  x={nodeWidth / 2}
                  y="24"
                  textAnchor="middle"
                  className="rd-model-role"
                >
                  {roleNames[v.role]}
                </text>
                <text x={nodeWidth / 2} y="49" textAnchor="middle">
                  {v.name.length > 13 ? `${v.name.slice(0, 12)}…` : v.name}
                </text>
                <title>{v.name}</title>
              </g>
            );
          })}
          {!design.variables.length && (
            <text x="400" y="130" textAnchor="middle">
              确认变量后，模型将在这里同步显示
            </text>
          )}
        </svg>
      </div>
    </figure>
  );
}

function EvidenceEditor({
  ids,
  project,
  onChange,
}: {
  ids: string[];
  project: Project;
  onChange: (ids: string[]) => void;
}) {
  return (
    <details className="rd-evidence">
      <summary>关联文献 · {ids.length} 篇</summary>
      {project.library?.items.map((item) => (
        <label className="rd-check" key={item.id}>
          <input
            type="checkbox"
            checked={ids.includes(item.id)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...ids, item.id]
                  : ids.filter((id) => id !== item.id),
              )
            }
          />
          {item.paper.title}
        </label>
      ))}
      {ids.some(
        (id) => !project.library?.items.some((item) => item.id === id),
      ) && (
        <>
          <p>部分原始文献已移除，原关联保留供核对。</p>
          <button
            className="text-button"
            onClick={() =>
              onChange(
                ids.filter((id) =>
                  project.library?.items.some((item) => item.id === id),
                ),
              )
            }
          >
            解除已移除文献的关联
          </button>
        </>
      )}
    </details>
  );
}

function QualThemes({
  draft,
  edit,
}: {
  draft: QualitativeDesign;
  edit: (d: Design) => void;
}) {
  return (
    <>
      <TextField
        label="研究谁"
        value={draft.target}
        onChange={(target) => edit({ ...draft, target })}
      />
      <TextField
        label="情境与研究边界"
        value={draft.setting}
        onChange={(setting) => edit({ ...draft, setting })}
      />
      <p>
        建议先设 3–5
        个探索主题，理解经验、解释与过程；主题不是预先认定的研究结论。
      </p>
      <div className="rd-card-grid">
        {draft.themes.map((t) => (
          <article className="rd-theme" data-theme-id={t.id} key={t.id}>
            <div className="rd-card-top">
              <span className="soft-badge">探索主题</span>
              <button
                className="text-button"
                onClick={() => edit(removeQualitativeTheme(draft, t.id))}
              >
                删除主题
              </button>
            </div>
            <label className="rd-field">
              主题名称
              <input
                aria-label="主题名称"
                maxLength={160}
                value={t.title}
                onChange={(e) =>
                  edit(
                    updateQualitativeTheme(draft, t.id, {
                      title: e.target.value,
                    }),
                  )
                }
              />
            </label>
            <TextField
              label="如何关联研究问题"
              value={t.explanation}
              onChange={(explanation) =>
                edit(updateQualitativeTheme(draft, t.id, { explanation }))
              }
              maxLength={1600}
            />
          </article>
        ))}
      </div>
      <button
        className="button secondary"
        disabled={draft.themes.length >= 12}
        onClick={() =>
          edit({
            ...draft,
            outlineNeedsReview: true,
            themes: [
              ...draft.themes,
              {
                id: crypto.randomUUID(),
                title: "新的探索主题",
                explanation: "待说明与研究问题的关联",
              },
            ],
          })
        }
      >
        添加探索主题
      </button>
      {draft.outlineNeedsReview && (
        <p className="rd-warning" role="status">
          主题已修改，相关提纲需要核对；原有问题保留。删除主题时，其关联问题会同步移除。
        </p>
      )}
    </>
  );
}

function QualQuestions({
  draft,
  edit,
}: {
  draft: QualitativeDesign;
  edit: (d: Design) => void;
}) {
  return (
    <>
      <p>
        以 5–8
        个开放式问题为起点，避免暗示答案或要求受访者同意预设结论。这是初步提纲，尚未执行访谈。
      </p>
      {draft.outlineNeedsReview && (
        <p className="rd-warning" role="status">
          探索主题有变化，请逐项核对问题是否仍然合适。
        </p>
      )}
      {draft.questions.map((q, i) => (
        <article className="rd-interview-question" key={q.id}>
          <div className="rd-card-top">
            <strong>问题 {i + 1}</strong>
            <button
              className="text-button"
              onClick={() =>
                edit({
                  ...draft,
                  questions: draft.questions.filter((item) => item.id !== q.id),
                })
              }
            >
              删除问题
            </button>
          </div>
          <label className="rd-field">
            关联探索主题
            <select
              aria-label="关联探索主题"
              value={q.themeId}
              onChange={(e) =>
                edit({
                  ...draft,
                  questions: draft.questions.map((item) =>
                    item.id === q.id
                      ? { ...item, themeId: e.target.value }
                      : item,
                  ),
                })
              }
            >
              {draft.themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label={`开放式问题 ${i + 1}`}
            value={q.text}
            onChange={(text) =>
              edit({
                ...draft,
                questions: draft.questions.map((item) =>
                  item.id === q.id ? { ...item, text } : item,
                ),
              })
            }
            maxLength={1600}
          />
        </article>
      ))}
      {!draft.questions.length && (
        <p className="rd-empty-inline">
          还没有访谈 / 观察问题。先明确探索主题，再逐步提出问题。
        </p>
      )}
      <div className="workspace-actions">
        <button
          className="button secondary"
          disabled={!draft.themes.length || draft.questions.length >= 20}
          onClick={() =>
            edit({
              ...draft,
              questions: [
                ...draft.questions,
                {
                  id: crypto.randomUUID(),
                  themeId: draft.themes[0].id,
                  text: "能否讲讲你的一次相关经历？",
                },
              ],
            })
          }
        >
          添加开放式问题
        </button>
        {draft.outlineNeedsReview && (
          <button
            className="button secondary"
            onClick={() => edit({ ...draft, outlineNeedsReview: false })}
          >
            我已核对主题与提纲
          </button>
        )}
      </div>
    </>
  );
}
