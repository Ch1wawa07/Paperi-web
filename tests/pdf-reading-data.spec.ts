import { test, expect } from "@playwright/test";
import {
  normalizeReading,
  readingDimensions,
  quoteMatches,
} from "../src/lib/reading-quality";
import { completeSectionObjects } from "../src/lib/structured-sections";
import { importedPaper } from "../src/lib/bibliography";
import {
  selectPDFExcerpts,
  isSections,
  isWorkflow,
  emptyWorkflow,
  readingFingerprint,
  isReadingCurrent,
  qualityReadingIds,
} from "../src/lib/workflow";
import { emptyLibrary } from "../src/lib/literature";
const quote =
  "合成结果：测试中这条关系未获支持，无显著性；这不是实际论文结果，不能证明没有效应。";
const input = {
  id: "a",
  paper: importedPaper({ title: "合成书目仅用于测试", abstract: null }),
  pages: [
    { page: 5, text: quote },
    {
      page: 2,
      text: "合成研究方法：有效样本100份，仅用于测试，没有实际受访者。",
    },
  ],
};
const s = (title: string) => ({
  title,
  body: "这份合成样本中的关系未获支持，不代表真实论文。",
  evidenceIds: ["a"],
  quote,
  page: 5,
  uncertainty: "仅合成测试",
});
test("缺板块/字段/未知ID按节隔离，有效板块保留，不编造缺省内容", () => {
  const data = {
    sections: [
      s(readingDimensions[0]),
      { ...s(readingDimensions[1]), evidenceIds: ["forged"] },
      { title: readingDimensions[2] },
    ],
  };
  const rows = normalizeReading(data, input);
  expect(rows).toHaveLength(7);
  expect(rows[0].body).toBe(s(readingDimensions[0]).body);
  expect(rows[0].evidenceStatus).toBe("verified");
  expect(rows[1].issue?.code).toBe("UNKNOWN_SOURCE");
  expect(rows[3].issue?.code).toBe("MISSING_SECTION");
  expect(rows[3].body).toContain("暂无可靠依据");
  expect(isSections(rows)).toBe(true);
});
test("严格指定原页核对；引句不匹配不能当事实，事实条目可独立保留", () => {
  const row = {
    ...s(readingDimensions[3]),
    quote: "不存在的原文句子，不应采用。",
    facts: [
      {
        text: "原文方法使用100份合成问卷。",
        quote: input.pages[1].text,
        page: 2,
      },
      { text: "原文样本999份。", quote: input.pages[1].text, page: 2 },
    ],
  };
  const [r] = normalizeReading({ sections: [row] }, input, [
    readingDimensions[3],
  ]);
  expect(r.body).not.toContain("关系未获支持");
  expect(r.facts).toHaveLength(1);
  expect(r.facts![0].text).toContain("100");
  expect(r.issue?.code).toBe("PARTIAL_EVIDENCE");
  expect(
    normalizeReading(
      { sections: [{ ...s(readingDimensions[0]), page: 1 }] },
      input,
    )[0].issue?.code,
  ).toBe("EVIDENCE_MISMATCH");
});
test("未支持与无显著性保留；错误支持/虚构数字剔除；建议不进入原文发现", () => {
  const f = {
    question: "合成关系是否成立？",
    conclusion: "该关系未获支持，不能证明没有效应。",
    support: "not-supported",
    quote,
    page: 5,
  };
  const rows = normalizeReading(
    {
      sections: [
        {
          ...s(readingDimensions[4]),
          findings: [
            f,
            { ...f, support: "supported" },
            { ...f, conclusion: "p值是0.001" },
          ],
          suggestion: "不要把建议混入关键发现",
        },
      ],
    },
    input,
  );
  const r = rows[4];
  expect(r.findings).toHaveLength(1);
  expect(r.findings![0].support).toBe("not-supported");
  expect(r.suggestion).toBeUndefined();
  expect(r.issue?.code).toBe("PARTIAL_EVIDENCE");
});
test("JSON截断只恢复完整对象，支持嵌套与引号转义，不给未结束项补内容", () => {
  const first = {
    ...s(readingDimensions[0]),
    body: '引号"与嵌套',
    facts: [{ text: "测试", quote, page: 5 }],
  };
  const content =
    '{"sections":[' + JSON.stringify(first) + ',{"title":"断掉的板块';
  expect(completeSectionObjects(content)).toEqual([first]);
  expect(completeSectionObjects('{"other":[{"title":"不应恢复"}]')).toEqual([]);
});
test("节选取到页中/页末结论；标记局部窗口和缺页，不超预算；所有短页完整保留", () => {
  const pages = Array.from({ length: 20 }, (_, i) =>
    i === 16
      ? "页眉" +
        "背景".repeat(4000) +
        "研究结论\n合成负向结果未支持，仅测试。" +
        "正文".repeat(1000)
      : "普通背景".repeat(1300),
  );
  const result = selectPDFExcerpts(pages, 12000, "a");
  expect(
    result.pages.some(
      (p) => p.page === 17 && p.text.includes("合成负向结果未支持"),
    ),
  ).toBe(true);
  expect(result.coverage.characters).toBeLessThanOrEqual(12000);
  expect(result.coverage.omittedPages.length).toBeGreaterThan(0);
  expect(result.coverage.pages.some((p) => !p.full)).toBe(true);
  expect(selectPDFExcerpts(["摘要内容", "结论内容"], 200, "a").pages).toEqual([
    { page: 1, text: "摘要内容" },
    { page: 2, text: "结论内容" },
  ]);
  expect(selectPDFExcerpts(pages, 0).pages).toEqual([]);
});
test("修改书目只让该篇精析待核验；质量集合可先3后5，旧快照/附件保留", () => {
  const at = "2026-10-27T00:00:00Z";
  const p = {
    id: "p",
    name: "测试",
    discipline: "广告学",
    status: "starting" as const,
    observation: "测试",
    createdAt: at,
    updatedAt: at,
    library: {
      ...emptyLibrary(),
      items: Array.from({ length: 5 }, (_, i) => ({
        id: `p${i}`,
        paper: importedPaper({ title: `合成测试标题${i}` }),
        bibliography: { fields: { title: "user" as const }, confirmedAt: at },
        categoryIds: [],
        note: "保留",
        savedAt: at,
        updatedAt: at,
        attachment: {
          id: `pdf${i}`,
          name: `p${i}.pdf`,
          pages: 5,
          characters: 900,
          updatedAt: at,
        },
      })),
    },
    workflow: emptyWorkflow(),
  };
  p.workflow.analyses = p.library.items.slice(0, 3).map((item) => ({
    id: item.id,
    kind: "reading",
    fingerprint: readingFingerprint(p, [item.id]),
    sourceIds: [item.id],
    createdAt: at,
    sections: normalizeReading(
      {
        sections: readingDimensions.map((t) => ({
          ...s(t),
          evidenceIds: [item.id],
          ...(t === readingDimensions[4]
            ? {
                findings: [
                  {
                    question: "测试",
                    conclusion: "合成关系未获支持",
                    support: "not-supported",
                    quote,
                    page: 5,
                  },
                ],
              }
            : {}),
        })),
      },
      { ...input, id: item.id },
    ),
  }));
  expect(qualityReadingIds(p)).toHaveLength(3);
  const changed = {
    ...p,
    library: {
      ...p.library,
      items: p.library.items.map((i, j) =>
        j === 0
          ? { ...i, paper: { ...i.paper, title: "人工修改后的题名" } }
          : i,
      ),
    },
  };
  expect(isReadingCurrent(changed, p.workflow.analyses[0])).toBe(false);
  expect(isReadingCurrent(changed, p.workflow.analyses[1])).toBe(true);
  expect(qualityReadingIds(changed)).toHaveLength(2);
  expect(isWorkflow(p.workflow)).toBe(true);
  expect(changed.library.items[0].attachment.id).toBe("pdf0");
});

test("节选省略分隔符不是论文原文，不能被当作连续证据", () => {
  expect(
    quoteMatches(
      { ...input, pages: [{ page: 1, text: "前半原文[节选间省略]后半原文" }] },
      "前半原文[节选间省略]后半原文",
      1,
    ),
  ).toBe(false);
});
