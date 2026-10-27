import { normalizeDOI, type Paper, type BibliographyAudit } from "./literature";

export type PDFLine = { page: number; text: string; size: number; y: number };
export type PDFMetadata = {
  title?: string;
  author?: string;
  lines?: PDFLine[];
  filename?: string;
};
const compact = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/(?<=[\u3400-\u9fff\d])\s+(?=[\u3400-\u9fff\d])/gu, "")
    .trim();
/** Validation is deliberately conservative; a missing title is better than a date or paragraph. */
export function plausibleTitle(raw: string) {
  const s = compact(raw);
  return (
    s.length >= 6 &&
    s.length <= 160 &&
    !/摘要|abstract|关键词|引言|绪论|结论|参考文献|目录|致谢|版权|学位论文原创|独创性声明|授权|通讯|通信|地址|邮箱|邮编|https?:|www\.|@|DOI\s*[:：]|ISSN|CNKI|知网|Microsoft|Word|WPS|untitled|document|扫描|^CN\s*\d/i.test(
      s,
    ) &&
    !/^[\d\s年月日.\-/]+$/.test(s) &&
    !/^(?:[一二三四五六七八九十]+[、.．]|第[一二三四五六七八九十\d]+[章节]|\d+[.、．\s])/.test(
      s,
    ) &&
    !/^(?:本文|本研究|越来越多|随着|近年来|收稿|基金|中图|文章编号|分类号|学校代码|学号)/.test(
      s,
    ) &&
    !/[。！？!?；;]|[:：]$/.test(s) &&
    !/^(?:\d{4}年第?\d+期|.*(?:大学|学院|研究所)|.*(?:硕士|博士)学位论文)$/.test(
      s,
    ) &&
    /[\u3400-\u9fffA-Za-z]{2}/.test(s)
  );
}
export function literalAuthors(raw: string) {
  // Keep only an explicitly delimited name prefix, never affiliations or biographies.
  const prefix = raw
    .normalize("NFKC")
    .trim()
    .split(
      /(?:[,，;；]?\s*(?:\(|（|地址|通讯|通信|邮箱|邮编|E-?mail|讲师|教授|研究方向|博士|硕士|[\u3400-\u9fff]{2,12}大学))/i,
    )[0];
  if (
    /CNKI|知网|Microsoft|WPS|admin|user|author|university|college|institute|department|未知|待核对|未获取|学院|研究所|@|https?:/i.test(
      prefix,
    )
  )
    return [];
  return prefix
    .split(
      /[，,；;、]|\s+and\s+|(?<=[\u3400-\u9fff]{2})\s+(?=[\u3400-\u9fff]{2})|\s{2,}/i,
    )
    .map((s) => s.replace(/[\d*†‡]+$/g, "").trim())
    .filter(
      (s) =>
        /^[\u3400-\u9fff·]{2,8}$/.test(s) ||
        /^(?:[A-Z][a-zA-Z.'-]+\s+){1,4}[A-Z][a-zA-Z.'-]+$/.test(s),
    )
    .slice(0, 20);
}
export function pdfMetadataCandidates(pages: string[], info: PDFMetadata = {}) {
  const text = pages
    .slice(0, 3)
    .map((p, i) => `[第 ${i + 1} 页]\n${p}`)
    .join("\n");
  const lines = pages
    .slice(0, 3)
    .flatMap((p, i) =>
      p
        .split(/\n/)
        .map((t) => ({ page: i + 1, text: compact(t), size: 0, y: 0 })),
    )
    .filter((l) => l.text);
  const layout = info.lines?.length
    ? info.lines.map((l) => ({ ...l, text: compact(l.text) }))
    : lines;
  const fields: Partial<Paper> = {};
  const audit: BibliographyAudit = { fields: {} };
  const explicit = lines.find((l) =>
    /^(?:论文题目|题名|题目)\s*[:：]/.test(l.text),
  );
  let title = explicit?.text.replace(/^(?:论文题目|题名|题目)\s*[:：]\s*/, "");
  if (title && plausibleTitle(title)) {
    fields.title = title;
    audit.fields.title = "pdf-body";
  }
  if (!fields.title) {
    // Typography is corroborating evidence: use a prominent block before abstract/body,
    // and join wrapped title lines of the same size. Never take the first arbitrary line.
    const front = layout.filter((l) => l.page <= 2);
    const sizes = front
      .filter((l) => l.size > 0)
      .map((l) => l.size)
      .sort((a, b) => a - b);
    const median = sizes[Math.floor(sizes.length / 4)] ?? 0;
    const candidates = front
      .flatMap((l, i) => {
        if (l.size < Math.max(12, median * 1.18)) return [];
        let combined = l.text;
        const next = front[i + 1];
        if (
          next &&
          next.page === l.page &&
          Math.abs(next.size - l.size) < 1 &&
          Math.abs(next.y - l.y) < l.size * 2.6 &&
          plausibleTitle(next.text)
        )
          combined += next.text;
        return plausibleTitle(combined) ? [{ ...l, text: combined }] : [];
      })
      .sort((a, b) => b.size - a.size || a.page - b.page || b.y - a.y);
    if (candidates[0]) {
      fields.title = candidates[0].text;
      audit.fields.title = "pdf-body";
    }
  }
  if (!fields.title && info.title && plausibleTitle(info.title)) {
    title = compact(info.title);
    // PDF properties may be producer junk: require the literal title in the first pages.
    if (compact(text).replace(/\s/g, "").includes(title.replace(/\s/g, ""))) {
      fields.title = title;
      audit.fields.title = "pdf-info";
    }
  }
  if (!fields.title && info.filename) {
    const name = compact(info.filename.replace(/\.pdf$/i, ""));
    if (
      plausibleTitle(name) &&
      !/^(?:download|file|paper|document|\d{6,}|[a-f\d]{12,})$/i.test(name)
    ) {
      fields.title = name;
      audit.fields.title = "filename";
    }
  }
  const authorLine = pages
    .slice(0, 3)
    .flatMap((p) => p.split(/\n/))
    .map((t) => ({ text: t.trim() }))
    .find((l) => /^(?:作\s*者|研究生姓名|姓\s*名)\s*[:：]/.test(l.text));
  const authors = literalAuthors(
    authorLine?.text.replace(
      /^(?:作\s*者|研究生姓名|姓\s*名)\s*[:：]\s*/,
      "",
    ) ||
      info.author ||
      "",
  );
  if (authors.length) {
    fields.authors = authors;
    audit.fields.authors = authorLine ? "pdf-body" : "pdf-info";
  }
  // A name-only line immediately after the title can be used, but no institutional line.
  if (!fields.authors && fields.title) {
    let at = layout.findIndex((l) => fields.title!.startsWith(l.text));
    let titleBlock = at >= 0 ? layout[at].text : "";
    const titleSize = at >= 0 ? layout[at].size : 0;
    while (
      at >= 0 &&
      layout[at + 1]?.page === layout[at].page &&
      fields.title.startsWith(titleBlock + layout[at + 1].text)
    ) {
      at++;
      titleBlock += layout[at].text;
    }
    const next = layout[at + 1];
    if (
      at >= 0 &&
      next &&
      next.page === layout[at].page &&
      next.text.length < 70 &&
      (titleSize === 0 || next.size < titleSize * 0.9)
    ) {
      const names = literalAuthors(info.lines?.[at + 1]?.text ?? next.text);
      if (names.length) {
        fields.authors = names;
        audit.fields.authors = "pdf-body";
      }
    }
  }
  const doi = text.match(/\bdoi\s*[:：]?\s*(10\.\d{4,9}\/[^\s<>]+)/i)?.[1];
  if (doi) fields.doi = normalizeDOI(doi);
  const normalized = lines.map((l) => l.text).join("\n");
  const year =
    normalized.match(
      /(?:出版年|发表时间|学位授予时间|答辩日期|出版日期|(?:19|20)\d{2}年第\d+期[^\n]*)\s*[:：]?\s*((?:19|20)\d{2})/,
    )?.[1] ||
    normalized.match(/^((?:19|20)\d{2})年\d{1,2}月(?:\d{1,2}日)?$/m)?.[1];
  if (year) {
    fields.year = Number(year);
    audit.fields.year = "pdf-body";
  }
  const venue = normalized.match(
    /(?:刊名|来源期刊|学位授予单位)\s*[:：]\s*([^\n]{2,100})/,
  )?.[1];
  if (venue && !/@|地址|邮箱/.test(venue)) {
    fields.venue = venue.trim();
    audit.fields.venue = "pdf-body";
  }
  const abstract = normalized
    .match(
      /(?:摘要)\s*[:：]?\s*([\s\S]{30,3000}?)(?=关键词|\bkeywords\b|\[第|$)/i,
    )?.[1]
    ?.trim();
  if (abstract) fields.abstract = abstract;
  return { fields, audit, evidence: text.slice(0, 14000) };
}
