import { test, expect } from "@playwright/test";
import { importedPaper } from "../src/lib/bibliography";
test("本地HTTP精析质量：缺节保留、截断恢复、JSON错误原因、错误页码、未支持结果及单节请求；非真实AI", async ({
  playwright,
}) => {
  const base = "http://127.0.0.1:3107",
    r = await playwright.request.newContext({
      baseURL: base,
      extraHTTPHeaders: { Origin: base },
    });
  const body = {
    task: "reading",
    observation: "合成主题",
    direction: "",
    question: "",
    concepts: [],
    evidence: [
      {
        id: "a",
        paper: importedPaper({ title: "合成学术记录，仅用于回归" }),
        pages: [
          {
            page: 1,
            text: "合成摘要：这是一份为接口测试编写的样本，不是真实研究。",
          },
          {
            page: 5,
            text: "合成结果：测试关系未获支持，无显著性，不能据此判断真实研究结论。",
          },
        ],
      },
    ],
  };
  try {
    const noPDF = await r.post("/api/workflow", {
      data: { ...body, evidence: [{ ...body.evidence[0], pages: [] }] },
    });
    expect(noPDF.status()).toBe(200);
    expect((await noPDF.json()).notices.join()).toContain("未调用AI");
    const missing = await r.post("/api/workflow", {
      data: { ...body, question: "PDF_MISSING" },
    });
    expect(missing.status()).toBe(200);
    const d = await missing.json();
    expect(d.sections).toHaveLength(7);
    expect(d.sections[0].evidenceStatus).toBe("verified");
    expect(d.sections[2].issue.code).toBe("MISSING_SECTION");
    const truncated = await r.post("/api/workflow", {
      data: { ...body, question: "PDF_PARTIAL_TRUNCATED" },
    });
    expect(truncated.status()).toBe(200);
    const t = await truncated.json();
    expect(t.sections[0].evidenceStatus).toBe("verified");
    expect(t.sections[3].evidenceStatus).toBe("insufficient");
    expect(t.notices.join()).toContain("输出截断");
    const invalid = await r.post("/api/workflow", {
      data: { ...body, question: "INVALID_JSON" },
    });
    expect(invalid.status()).toBe(502);
    expect(await invalid.json()).toMatchObject({ code: "JSON_INVALID" });
    const wrong = await r.post("/api/workflow", {
      data: { ...body, question: "PDF_WRONG_PAGE" },
    });
    const w = await wrong.json();
    expect(w.sections[3].issue.code).toBe("EVIDENCE_MISMATCH");
    expect(w.sections[0].evidenceStatus).toBe("verified");
    const good = await r.post("/api/workflow", { data: body });
    expect(good.status()).toBe(200);
    const g = await good.json();
    expect(g.sections[4].findings[0]).toMatchObject({
      support: "not-supported",
      page: 5,
    });
    const retry = await r.post("/api/workflow", {
      data: { ...body, readingTargets: ["研究方法与过程"] },
    });
    expect(retry.status()).toBe(200);
    expect((await retry.json()).sections).toHaveLength(1);
  } finally {
    await r.dispose();
  }
});
