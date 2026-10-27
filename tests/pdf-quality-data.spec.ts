import { test, expect } from "@playwright/test";
import {
  pdfMetadataCandidates,
  plausibleTitle,
  literalAuthors,
} from "../src/lib/pdf-metadata";
import { pdfTitleLines } from "../src/lib/pdf-text";
import {
  pdfDiagnosticRecord,
  serializePDFDiagnostics,
} from "../src/lib/pdf-diagnostics";
import { importedPaper } from "../src/lib/bibliography";
import { emptyLibrary, isLibrary } from "../src/lib/literature";
for (const bad of [
  "摘要：越来越多的企业开始重视营销空间",
  "2022 年 8 月",
  "2 0 2 5 年 4 月",
  "一、引言",
  "短视频广告与消费者购买意愿：",
]) {
  test(`不把错误题名当成功候选：${bad}`, () => {
    expect(plausibleTitle(bad)).toBe(false);
    expect(
      pdfMetadataCandidates([bad], { title: bad }).fields.title,
    ).toBeUndefined();
  });
}
test("有结构/字体证据才取题名，连接换行副题，PDF属性需正文佐证；作者不含地址", () => {
  const c = pdfMetadataCandidates(
    [
      "2022 年 8 月\n测试内容特点与购买意愿：\n一项合成样本研究\n作者：张三、李四；某某大学，地址：测试街道\n摘要：这是合成的元数据反例，不是真实论文。",
    ],
    {
      title: "Word文档",
      author: "CNKI",
      lines: [
        { page: 1, y: 700, size: 22, text: "测试内容特点与购买意愿：" },
        { page: 1, y: 670, size: 22, text: "一项合成样本研究" },
        { page: 1, y: 630, size: 10, text: "张三、李四" },
      ],
    },
  );
  expect(c.fields.title).toBe("测试内容特点与购买意愿:一项合成样本研究");
  expect(c.fields.authors).toEqual(["张三", "李四"]);
  expect(c.audit.fields.title).toBe("pdf-body");
  expect(
    pdfMetadataCandidates(["没有可核对标题的普通段落。"], {
      title: "猜测出来的测试标题",
    }).fields.title,
  ).toBeUndefined();
  expect(
    pdfMetadataCandidates(["封面不可判断"], {
      filename: "可供人工核对的测试论文标题.pdf",
    }).audit.fields.title,
  ).toBe("filename");
  expect(
    literalAuthors(
      "张三；李四；南京大学商学院，地址：某路；邮箱：private@example.invalid",
    ),
  ).toEqual(["张三", "李四"]);
  expect(literalAuthors("CNKI")).toEqual([]);
});
test("PDF位置行按基线与横向排序，字体证据可用，不改原页文本", () => {
  const items = [
    { str: "题名后半", transform: [18, 0, 0, 18, 150, 600], height: 18 },
    { str: "题名前半", transform: [18, 0, 0, 18, 20, 600], height: 18 },
  ];
  expect(pdfTitleLines(items, 1)[0]).toMatchObject({
    page: 1,
    text: "题名前半 题名后半",
    size: 18,
  });
});
test("本地诊断不含全文、Blob、联系信息/凭证；字段有限、大小有界", () => {
  const paper = importedPaper({
    title: "测试诊断题名",
    authors: ["测试作者"],
    year: 2024,
  });
  const item = {
    id: "i",
    paper,
    categoryIds: [],
    note: "私人笔记不能导出",
    savedAt: "2026-10-27T00:00:00Z",
    updatedAt: "2026-10-27T00:00:00Z",
    attachment: {
      id: "pdf",
      name: "测试文件.pdf",
      pages: 2,
      characters: 900,
      updatedAt: "2026-10-27T00:00:00Z",
    },
  };
  const file = {
    id: "pdf",
    projectId: "p",
    blob: new Blob(["original"]),
    name: "测试文件.pdf",
    pages: [
      "摘要：合成样本\n邮箱：private@example.invalid\n地址：不应分享的路\nAPI_KEY=sk-test-only-not-real\n正常短节选。" +
        "正文".repeat(500),
      "结论：仅用于测试。",
    ],
    updatedAt: item.updatedAt,
  };
  const out = serializePDFDiagnostics([pdfDiagnosticRecord(item, file)]);
  for (const forbidden of [
    "private@",
    "不应分享",
    "sk-test",
    "私人笔记",
    "original",
    "blob",
  ]) {
    expect(out).not.toContain(forbidden);
  }
  expect(JSON.parse(out).records[0].pageTextLengths).toHaveLength(2);
  expect(out.length).toBeLessThan(65536);
  expect(() =>
    serializePDFDiagnostics(Array(21).fill(pdfDiagnosticRecord(item, file))),
  ).toThrow("20篇");
  expect(
    isLibrary({
      ...emptyLibrary(),
      items: [
        {
          ...item,
          bibliography: {
            fields: { title: "user" },
            confirmedAt: item.updatedAt,
          },
        },
      ],
    }),
  ).toBe(true);
});
