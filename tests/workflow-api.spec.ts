import { test, expect } from "@playwright/test";
import { importedPaper } from "../src/lib/bibliography";
test("真实HTTP工作流适配：书目不调用AI、摘要quote核对、未知来源拒绝、同源与尺寸限制", async ({
  playwright,
}) => {
  const base = "http://127.0.0.1:3104";
  const r = await playwright.request.newContext({
    baseURL: base,
    extraHTTPHeaders: { Origin: base },
  });
  const paper = importedPaper({
    title: "测试题录",
    authors: ["测试作者"],
    year: 2024,
    venue: "测试期刊",
  });
  const body = {
    task: "reading",
    observation: "测试问题",
    direction: "",
    question: "",
    concepts: [],
    evidence: [{ id: "a", paper, pages: [] }],
  };
  try {
    const bibliographic = await r.post("/api/workflow", { data: body });
    expect(bibliographic.status()).toBe(200);
    const d = await bibliographic.json();
    expect(d.sections).toHaveLength(7);
    expect(d.sections[3].body).toContain("暂无可靠依据");
    expect(d.sections[3].issue.code).toBe("PDF_INSUFFICIENT");
    const withAbstract = {
      ...body,
      evidence: [
        {
          id: "a",
          paper: {
            ...paper,
            abstract: "这是明确标注的模拟摘要，仅用于接口测试。",
          },
          pages: [],
        },
      ],
    };
    const response = await r.post("/api/workflow", { data: withAbstract });
    expect(response.status()).toBe(200);
    expect((await response.json()).sections[0].quote).toBe(
      withAbstract.evidence[0].paper.abstract,
    );
    const forged = await r.post("/api/workflow", {
      data: { ...withAbstract, task: "directions", question: "FORGED" },
    });
    expect(forged.status()).toBe(502);
    const badquote = await r.post("/api/workflow", {
      data: { ...withAbstract, task: "review", question: "BADQUOTE" },
    });
    expect(badquote.status()).toBe(200);
    expect((await badquote.json()).sections[0].body).toContain("结构草案");
    expect(
      (
        await r.post("/api/workflow", {
          headers: { Origin: "https://evil.invalid" },
          data: body,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await r.post("/api/workflow", { data: { ...body, evidence: [] } })
      ).status(),
    ).toBe(400);
  } finally {
    await r.dispose();
  }
});
