import { isRecord } from "./exploration";
import type { Paper } from "./literature";
import type { ReadingSection, ReadingFinding, ReadingFact } from "./workflow";
export const readingDimensions = [
  "30 秒读懂",
  "研究问题与动机",
  "理论与核心概念",
  "研究方法与过程",
  "关键发现与结论",
  "局限与研究启发",
  "对当前项目的价值",
];
export type ReadingInput = {
  id: string;
  paper: Paper;
  pages: { page: number; text: string }[];
};
const norm = (s: string) => s.normalize("NFKC").replace(/\s+/gu, "");
const numbersSupported = (claim: string, quote: string) =>
  (norm(claim).match(/\d+(?:\.\d+)?%?/g) ?? []).every((n) =>
    new Set<string>(norm(quote).match(/\d+(?:\.\d+)?%?/g) ?? []).has(n),
  );
const text = (v: unknown, n: number) =>
  typeof v === "string" && !!v.trim() && v.length <= n;
export function quoteMatches(
  e: ReadingInput,
  quote: string,
  page: number | null,
) {
  if (norm(quote).length < 8 || quote.includes("[节选间省略]")) return false;
  return page !== null
    ? e.pages.some((p) => p.page === page && norm(p.text).includes(norm(quote)))
    : !!e.paper.abstract && norm(e.paper.abstract).includes(norm(quote));
}
const aliases: Record<string, string> = {
  "30秒读懂": "30 秒读懂",
  理论与概念: "理论与核心概念",
  研究方法: "研究方法与过程",
  关键发现: "关键发现与结论",
  研究结论: "关键发现与结论",
  局限与启发: "局限与研究启发",
  项目价值: "对当前项目的价值",
};
function titleOf(s: unknown) {
  if (typeof s !== "string") return "";
  const t = s.trim();
  return aliases[t] ?? t;
}
export function unavailableSection(
  title: string,
  id: string,
  code: string,
  message: string,
): ReadingSection {
  return {
    title,
    body: "暂无可靠依据，待核实。",
    evidenceIds: [id],
    quote: "",
    page: null,
    uncertainty: message,
    evidenceStatus: "insufficient",
    issue: { code, message },
  };
}
/** Each claim keeps its own literal source. Invalid claims never poison verified siblings. */
export function normalizeReading(
  value: unknown,
  e: ReadingInput,
  targets = readingDimensions,
): ReadingSection[] {
  const rows =
    isRecord(value) && Array.isArray(value.sections)
      ? value.sections.slice(0, 12)
      : [];
  return targets.map((title) => {
    const matches = rows.filter(
      (s) => isRecord(s) && titleOf(s.title) === title,
    );
    const raw = matches[0];
    if (!isRecord(raw))
      return unavailableSection(
        title,
        e.id,
        "MISSING_SECTION",
        "AI未返回此板块，其他有效板块已保留。可只重试本节。",
      );
    if (matches.length > 1)
      return unavailableSection(
        title,
        e.id,
        "INVALID_SECTION",
        "AI重复返回此板块，无法确定采用哪一项。其他有效板块已保留。",
      );
    if (
      !Array.isArray(raw.evidenceIds) ||
      raw.evidenceIds.length !== 1 ||
      raw.evidenceIds[0] !== e.id
    )
      return unavailableSection(
        title,
        e.id,
        "UNKNOWN_SOURCE",
        "此板块使用了未知或缺失的来源，未采纳其判断。",
      );
    const page =
      raw.page === null
        ? null
        : Number.isSafeInteger(raw.page) && Number(raw.page) > 0
          ? Number(raw.page)
          : undefined;
    const quote =
      typeof raw.quote === "string" && raw.quote.length <= 1200
        ? raw.quote
        : "";
    const matched = page !== undefined && quoteMatches(e, quote, page);
    const bodyValid =
      text(raw.body, 4000) &&
      matched &&
      numbersSupported(String(raw.body), quote);
    let invalidFacts = 0;
    const facts: ReadingFact[] = [];
    if (Array.isArray(raw.facts))
      for (const f of raw.facts.slice(0, 5)) {
        if (
          !isRecord(f) ||
          !text(f.text, 500) ||
          !text(f.quote, 1200) ||
          !(
            f.page === null ||
            (Number.isSafeInteger(f.page) && Number(f.page) > 0)
          )
        ) {
          invalidFacts++;
          continue;
        }
        if (
          quoteMatches(e, String(f.quote), f.page as number | null) &&
          numbersSupported(String(f.text), String(f.quote))
        )
          facts.push({
            text: String(f.text),
            quote: String(f.quote),
            page: f.page as number | null,
          });
        else invalidFacts++;
      }
    const findings: ReadingFinding[] = [];
    if (title === "关键发现与结论" && Array.isArray(raw.findings))
      for (const f of raw.findings.slice(0, 4)) {
        if (
          !isRecord(f) ||
          !text(f.question, 250) ||
          !text(f.conclusion, 500) ||
          !["supported", "not-supported", "not-tested", "unclear"].includes(
            String(f.support),
          ) ||
          !text(f.quote, 1200) ||
          !(
            f.page === null ||
            (Number.isSafeInteger(f.page) && Number(f.page) > 0)
          )
        ) {
          invalidFacts++;
          continue;
        }
        if (
          quoteMatches(e, String(f.quote), f.page as number | null) &&
          numbersSupported(String(f.conclusion), String(f.quote)) &&
          (f.support !== "not-supported" ||
            /不显著|未获支持|未支持|没有显著|无显著|不具有.{0,5}显著|未达到.{0,5}显著|not significant|not supported/i.test(
              String(f.quote),
            )) &&
          (f.support !== "not-tested" ||
            /未检验|未考察|未测试|not tested|not examined/i.test(
              String(f.quote),
            )) &&
          !(
            f.support === "supported" &&
            /不显著|未获支持|未支持|没有显著|无显著|不具有.{0,5}显著|not significant|not supported/i.test(
              String(f.quote),
            )
          )
        )
          findings.push({
            question: String(f.question),
            conclusion: String(f.conclusion),
            support: f.support as ReadingFinding["support"],
            quote: String(f.quote),
            page: f.page as number | null,
          });
        else invalidFacts++;
      }
    if (!bodyValid && !facts.length && !findings.length)
      return unavailableSection(
        title,
        e.id,
        page === undefined ? "INVALID_SECTION" : "EVIDENCE_MISMATCH",
        page === undefined
          ? "页码或结构字段无效，无法核对该板块。"
          : "引句与指定页码的原文未匹配，未采纳此板块的事实判断。请检查节选覆盖后只重试本节。",
      );
    const incomplete =
      !bodyValid ||
      invalidFacts > 0 ||
      (title === "关键发现与结论" && !findings.length);
    const issue = incomplete
      ? {
          code: invalidFacts
            ? "PARTIAL_EVIDENCE"
            : !bodyValid
              ? "EVIDENCE_MISMATCH"
              : "MISSING_FINDINGS",
          message: invalidFacts
            ? "部分条目的引句或字段未通过核对，已排除；保留其余可核对内容。"
            : "总论或逐项结论不完整，暂无可靠依据。可只重试本节，其他板块保留。",
        }
      : undefined;
    return {
      title,
      body: bodyValid
        ? String(raw.body)
        : "总论暂无可靠依据；以下仅保留有原文引句的条目。",
      evidenceIds: [e.id],
      quote: bodyValid ? quote : "",
      page: bodyValid ? page! : null,
      uncertainty: `仅核对本次节选的引句，AI解释仍需人工核实，不代表全文覆盖。${typeof raw.uncertainty === "string" ? raw.uncertainty.slice(0, 900) : ""}`,
      evidenceStatus: "verified",
      ...(facts.length ? { facts } : {}),
      ...(findings.length ? { findings } : {}),
      ...(issue ? { issue } : {}),
      ...([
        readingDimensions[1],
        readingDimensions[5],
        readingDimensions[6],
      ].includes(title) && text(raw.suggestion, 1200)
        ? { suggestion: String(raw.suggestion) }
        : {}),
    };
  });
}
