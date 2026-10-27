import {
  normalizeDOI,
  safeWebURL,
  isPaper,
  type Paper,
  type Library,
  type BibliographyAudit,
} from "./literature";
export type ImportRow = { bibliography?: BibliographyAudit; paper: Paper; warnings: string[]; raw: string };
export type ImportPreview = {
  rows: ImportRow[];
  failures: { record: number; reason: string; raw: string }[];
};
export function importedPaper(fields: Partial<Paper> = {}): Paper {
  return {
    key: `import:${crypto.randomUUID()}`,
    title: "",
    authors: [],
    authorsTruncated: false,
    year: null,
    venue: null,
    sourceIsCore: null,
    kind: "journal-article",
    doi: null,
    openAlexId: null,
    abstract: null,
    abstractTruncated: false,
    citations: null,
    retracted: null,
    oaUrl: null,
    landingUrl: null,
    source: "import",
    identity: "imported",
    recordUrl: "",
    retrievedAt: new Date().toISOString(),
    ...fields,
  };
}
const authors = (s: string) =>
  s
    .split(/\s+and\s+|[;；、]|,(?=[\u3400-\u9fff])/i)
    .map((x) => x.trim())
    .filter(Boolean);
const clean = (s: string) => s.replace(/[{}]/g, "").replace(/\\&/g, "&").trim();
function fieldsToPaper(f: Record<string, string[]>): Paper {
  const get = (...keys: string[]) =>
    keys.map((k) => f[k]?.join(" ")).find(Boolean) ?? "";
  const rawYear = get("PY", "Y1", "%D", "year", "date");
  const year = Number(rawYear.match(/\b(?:19|20)\d{2}\b/)?.[0]) || null;
  const type = get("TY", "%0", "type").toLowerCase();
  const url = safeWebURL(get("UR", "%U", "url"));
  return importedPaper({
    title: clean(get("TI", "T1", "%T", "title")),
    authors: (f.AU ?? f.A1 ?? f["%A"] ?? [get("author")])
      .flatMap(authors)
      .map(clean),
    year,
    venue:
      clean(
        get(
          "JO",
          "JF",
          "T2",
          "%J",
          "%B",
          "%I",
          "journal",
          "booktitle",
          "school",
          "publisher",
        ),
      ) || null,
    doi: normalizeDOI(get("DO", "%R", "doi")),
    abstract: get("AB", "N2", "%X", "abstract").slice(0, 6000) || null,
    recordUrl: url ?? "",
    landingUrl: url,
    kind: /thes|diss|学位/.test(type)
      ? "dissertation"
      : /conf|proc|会议/.test(type)
        ? "proceedings-article"
        : "journal-article",
  });
}
function bibEntries(text: string) {
  const entries: { type: string; body: string }[] = [];
  const re = /@([a-z]+)\s*[{(]/gi;
  let m;
  while ((m = re.exec(text))) {
    const opening = text[re.lastIndex - 1],
      closing = opening === "{" ? "}" : ")";
    let depth = 1,
      quoted = false,
      i = re.lastIndex;
    for (; i < text.length; i++) {
      const c = text[i];
      if (text[i - 1] === "\\") continue;
      if (c === '"') quoted = !quoted;
      if (!quoted) {
        if (c === opening) depth++;
        if (c === closing && !--depth) break;
      }
    }
    if (depth) throw new Error("BibTeX 花括号或引号未闭合，请检查文件。");
    entries.push({ type: m[1], body: text.slice(re.lastIndex, i) });
    re.lastIndex = i + 1;
  }
  return entries;
}
export function parseBibliography(input: string): ImportPreview {
  if (input.length > 2_000_000)
    throw new Error("题录文件超过 2 MB，请分批导入。");
  const text = input
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (!text) throw new Error("请先选择题录文件或粘贴参考文献。");
  const result: ImportPreview = { rows: [], failures: [] };
  const add = (p: Paper, raw: string, index: number) => {
    if (!isPaper(p)) {
      result.failures.push({
        record: index + 1,
        reason: "缺少有效标题或字段超过容量，请检查原记录。",
        raw: raw.slice(0, 2000),
      });
      return;
    }
    result.rows.push({
      paper: p,
      raw: raw.slice(0, 4000),
      warnings: [
        !p.authors.length ? "作者未获取" : "",
        !p.year ? "年份未获取" : "",
        !p.venue ? "期刊 / 学校未获取" : "",
        !p.doi ? "未提供 DOI（不影响导入）" : "",
      ].filter(Boolean),
    });
  };
  if (/^@\w+\s*[{(]/m.test(text)) {
    bibEntries(text).forEach((e, i) => {
      if (/^(comment|preamble|string)$/i.test(e.type)) {
        result.failures.push({
          record: i + 1,
          reason: "BibTeX 宏或注释未解析，请导出展开后的字段。",
          raw: e.body.slice(0, 300),
        });
        return;
      }
      const f: Record<string, string[]> = { type: [e.type] };
      const body = e.body.slice(e.body.indexOf(",") + 1);
      let at = 0;
      while (at < body.length) {
        const m = /^\s*,?\s*([\w-]+)\s*=\s*/.exec(body.slice(at));
        if (!m) break;
        at += m[0].length;
        let val = "";
        const start = body[at];
        if (start === "{" || start === '"') {
          at++;
          let depth = 1;
          for (; at < body.length; at++) {
            const c = body[at];
            if (start === "{" && c === "{") depth++;
            if (
              (start === "{" && c === "}" && !--depth) ||
              (start === '"' && c === '"' && body[at - 1] !== "\\")
            ) {
              at++;
              break;
            }
            val += c;
          }
        } else {
          while (at < body.length && body[at] !== ",") val += body[at++];
        }
        f[m[1].toLowerCase()] = [val.trim()];
      }
      add(fieldsToPaper(f), e.body, i);
    });
  } else if (/^TY\s+-/m.test(text) || /^%0 /m.test(text)) {
    const ris = /^TY\s+-/m.test(text);
    const blocks = text
      .split(ris ? /(?=^TY\s+-)/m : /(?=^%0 )/m)
      .filter((x) => x.trim());
    blocks.forEach((block, i) => {
      const f: Record<string, string[]> = {};
      let tag = "";
      for (const line of block.split("\n")) {
        const m = (
          ris ? /^([A-Z0-9]{2})\s+-\s?(.*)$/ : /^(%[A-Za-z0-9])\s+(.*)$/
        ).exec(line);
        if (m) {
          tag = m[1];
          (f[tag] ??= []).push(m[2].trim());
        } else if (line.trim() && tag && f[tag]?.length)
          f[tag][f[tag].length - 1] += " " + line.trim();
      }
      add(fieldsToPaper(f), block, i);
    });
  } else {
    const lines = text.split(/\n+/).filter((x) => x.trim());
    lines.forEach((line, i) => {
      const raw = line.replace(/^\s*\[\d+\]\s*/, "");
      const m =
        /^(.+?)[.．]\s*(.+?)\s*\[([JDC])(?:\/OL)?\]\s*[.．]?\s*(.*)$/i.exec(
          raw,
        );
      if (!m) {
        result.failures.push({
          record: i + 1,
          reason:
            "无法可靠拆分此行。请使用“作者. 标题[J]. 期刊, 年份”格式，或导出 RIS / BibTeX。",
          raw: line.slice(0, 2000),
        });
        return;
      }
      const tail = m[4];
      add(
        importedPaper({
          title: m[2].trim(),
          authors: authors(m[1]),
          kind:
            m[3].toUpperCase() === "D"
              ? "dissertation"
              : m[3].toUpperCase() === "C"
                ? "proceedings-article"
                : "journal-article",
          year: Number(tail.match(/\b(?:19|20)\d{2}\b/)?.[0]) || null,
          venue: tail.split(/[,，]/)[0].trim() || null,
          doi: normalizeDOI(
            tail.match(/10\.\d{4,9}\/[^\s]+/)?.[0]?.replace(/[.。]$/, ""),
          ),
        }),
        line,
        i,
      );
    });
  }
  if (result.rows.length > 300)
    throw new Error("每批最多 300 篇，请拆分文件。");
  if (!result.rows.length && !result.failures.length)
    throw new Error("没有识别到书目记录。");
  return result;
}
const norm = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}]/gu, "");
export function duplicateOf(p: Paper, library: Library) {
  return library.items.find(
    (i) =>
      (p.doi && i.paper.doi === p.doi) ||
      (p.openAlexId && i.paper.openAlexId === p.openAlexId) ||
      (norm(p.title) === norm(i.paper.title) &&
        p.year !== null &&
        p.year === i.paper.year &&
        p.authors.length > 0 &&
        i.paper.authors.some((a) =>
          p.authors.some((b) => norm(a) === norm(b)),
        )),
  );
}
