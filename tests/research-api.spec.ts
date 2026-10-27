import { test as base, expect, type APIRequestContext } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { emptyResearchWorkspace } from "../src/lib/research-workspace";
import {
  buildResearchJourneyInput,
  type JourneyInput,
} from "../src/lib/research-journey-client";
import type { Project } from "../src/lib/projects";
import { emptyWorkflow } from "../src/lib/workflow";
import { importedPaper } from "../src/lib/bibliography";

// Each test has its own production process and quota. No production limiter is disabled or reset.
const test = base.extend<{ journeyAPI: APIRequestContext }>({
  journeyAPI: async ({ playwright }, run) => {
    const listener = createServer();
    listener.listen(0, "127.0.0.1");
    await once(listener, "listening");
    const address = listener.address();
    if (!address || typeof address === "string")
      throw new Error("No isolated API test port");
    const port = address.port;
    await new Promise<void>((resolve) => listener.close(() => resolve()));
    const child: ChildProcess = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          DEEPSEEK_API_KEY: "",
          AI_API_KEY: "test-only-not-a-real-key",
          AI_MODEL: "fixture-model",
          AI_BASE_URL: "http://127.0.0.1:3110/v1",
        },
      },
    );
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output = (output + String(chunk)).slice(-6000);
    });
    child.stderr?.on("data", (chunk) => {
      output = (output + String(chunk)).slice(-6000);
    });
    const url = `http://127.0.0.1:${port}`;
    const api = await playwright.request.newContext({
      baseURL: url,
      extraHTTPHeaders: { Origin: url },
    });
    try {
      await expect
        .poll(
          async () => {
            if (child.exitCode !== null) throw new Error(output);
            return (
              await api.get("/api/research-journey").catch(() => null)
            )?.status();
          },
          { timeout: 20000 },
        )
        .toBe(200);
      await run(api);
    } finally {
      await api.dispose();
      if (child.exitCode === null) {
        const exited = once(child, "exit");
        const timeout = setTimeout(() => child.kill("SIGKILL"), 4000);
        child.kill("SIGTERM");
        await exited;
        clearTimeout(timeout);
      }
    }
  },
});
const date = "2026-10-26T00:00:00.000Z";
function project(): Project {
  return {
    id: "fixture-project",
    name: "明确标记的研究API模拟测试",
    discipline: "测试",
    status: "starting",
    observation: "为什么广告越劝越不想买？（夹具）",
    createdAt: date,
    updatedAt: date,
    workflow: emptyWorkflow(),
    library: {
      revision: 0,
      categories: [],
      items: [
        {
          id: "paper-a",
          paper: {
            ...importedPaper({
              title: "模拟中文题录，非真实文献",
              authors: ["测试作者"],
              year: 2024,
              venue: "测试期刊",
            }),
            abstract:
              "这是明确标记的模拟摘要，仅验证程序能核对收到的文字，不是学术成果。",
          },
          categoryIds: [],
          note: "",
          savedAt: date,
          updatedAt: date,
        },
      ],
    },
  };
}
async function input(
  task: JourneyInput["task"],
  message = "",
  designStep?: string,
) {
  const research = emptyResearchWorkspace();
  research.preferences = "主要研究大学生，偏问卷，不做复杂实验";
  research.directions = [
    {
      id: "direction-a",
      createdAt: date,
      fingerprint: "fixture",
      candidateId: null,
      concepts: ["心理逆反"],
      card: {
        title: "测试已确认方向",
        question: "测试大学生品牌态度？",
        value: "模拟研究价值",
        method: "模拟问卷",
        limitations: "待真实资料验证",
        evidenceIds: ["paper-a"],
      },
    },
  ];
  research.activeDirectionId = "direction-a";
  return buildResearchJourneyInput(project(), research, task, {
    message,
    ...(designStep ? { designStep } : {}),
  });
}
async function post(api: APIRequestContext, body: JourneyInput) {
  const response = await api.post("/api/research-journey", { data: body });
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}

test("隔离HTTP：脉络分离方向、逐字核验引句、未知文献拒绝、偏好继承及429明确反馈（模拟）", async ({
  journeyAPI: api,
}) => {
  const c = await input("context");
  const synthesis = await post(api, c);
  expect(synthesis.sections).toHaveLength(4);
  expect(synthesis.cards).toBeUndefined();
  expect(synthesis.sections[0].evidenceStatus).toBe("verified");
  expect(synthesis.sections[3].evidenceStatus).toBe("proposal");
  const bad = await post(api, { ...c, message: "BADQUOTE" });
  expect(bad.sections[0].evidenceStatus).toBe("insufficient");
  expect(bad.sections[0].body).toContain("不足");
  const forged = await api.post("/api/research-journey", {
    data: { ...c, message: "FORGED" },
  });
  expect(forged.status()).toBe(502);
  const discussion = await post(
    api,
    await input("discussion", "我只想研究大学生"),
  );
  expect(discussion.reply).toContain("偏问卷");
  expect(discussion.quickQuestions).toHaveLength(3);
  const forgedDirection = await api.post("/api/research-journey", {
    data: await input("directions", "FORGED"),
  });
  expect(forgedDirection.status()).toBe(502);
  const limited = await api.post("/api/research-journey", {
    data: await input("discussion", "UPSTREAM_LIMIT"),
  });
  expect(limited.status()).toBe(429);
  expect((await limited.json()).error).toContain("额度");
});

test("隔离HTTP：定量按步骤生成、合法变量关系、其他草稿字段保留、格式和余额失败不冒充成果（模拟）", async ({
  journeyAPI: api,
}) => {
  const request = await input("quantitative", "", "question");
  let result = await post(api, request);
  expect(result.design.variables).toHaveLength(0);
  expect(result.design.question).toContain("模拟");
  result.design.question = "用户改过的具体问题？";
  request.context.quantitative = result.design;
  result = await post(api, { ...request, designStep: "variables" });
  expect(result.design.variables).toHaveLength(3);
  expect(result.design.hypotheses).toHaveLength(0);
  expect(result.design.question).toBe("用户改过的具体问题？");
  request.context.quantitative = result.design;
  result = await post(api, { ...request, designStep: "hypotheses" });
  expect(result.design.hypotheses).toHaveLength(2);
  const ids = result.design.variables.map((v: { id: string }) => v.id);
  expect(
    result.design.hypotheses.every(
      (h: { from: string; to: string }) =>
        ids.includes(h.from) && ids.includes(h.to),
    ),
  ).toBe(true);
  request.context.quantitative = result.design;
  // Removing a source must retain old references and allow editing another phase.
  request.context.evidence = request.context.evidence.map((e) => ({
    ...e,
    id: "paper-b",
  }));
  request.context.fingerprint = "changed-source-fixture";
  result = await post(api, { ...request, designStep: "method" });
  expect(result.design.hypotheses).toHaveLength(2);
  expect(result.design.variables[0].evidenceIds).toEqual(["paper-a"]);
  expect(result.design.fingerprint).not.toBe(request.context.fingerprint);
  expect(result.design.limitations).toContain("因果");
  expect(result.design.confirmed).toBe(false);
  const malformed = await api.post("/api/research-journey", {
    data: await input("discussion", "BAD_SHAPE"),
  });
  expect(malformed.status()).toBe(502);
  const balance = await api.post("/api/research-journey", {
    data: await input("discussion", "UPSTREAM_BALANCE"),
  });
  expect(balance.status()).toBe(402);
  expect((await balance.json()).error).toContain("余额");
});

test("隔离HTTP：质性独立结构、主题提纲绑定、方法建议与无效JSON明确失败（模拟）", async ({
  journeyAPI: api,
}) => {
  const request = await input("qualitative", "", "question");
  let result = await post(api, request);
  expect(result.design.variables).toBeUndefined();
  expect(result.design.hypotheses).toBeUndefined();
  expect(result.design.target).toBe("大学生");
  request.context.qualitative = result.design;
  result = await post(api, { ...request, designStep: "themes" });
  expect(result.design.themes).toHaveLength(3);
  expect(result.design.questions).toHaveLength(0);
  request.context.qualitative = result.design;
  result = await post(api, { ...request, designStep: "questions" });
  expect(result.design.questions).toHaveLength(5);
  expect(result.design.outlineNeedsReview).toBe(false);
  request.context.qualitative = result.design;
  result = await post(api, { ...request, designStep: "method" });
  expect(result.design.ethics).toContain("匿名");
  expect(result.design.questions).toHaveLength(5);
  expect((await post(api, await input("method"))).advice).toContain(
    "用户自己选择",
  );
  const malformed = await api.post("/api/research-journey", {
    data: await input("discussion", "INVALID_JSON"),
  });
  expect(malformed.status()).toBe(502);
  expect((await malformed.json()).error).toContain("JSON");
});

test("无密钥/无确认方向/跨站/超量输入在调用前失败（无付费模型）", async ({
  playwright,
}) => {
  const api = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
    extraHTTPHeaders: { Origin: "http://127.0.0.1:3100" },
  });
  try {
    const request = await input("context");
    const noKey = await api.post("/api/research-journey", { data: request });
    expect(noKey.status()).toBe(503);
    expect((await noKey.json()).error).toContain("尚未配置");
    const design = await input("quantitative");
    design.context.confirmed = null;
    const noDirection = await api.post("/api/research-journey", {
      data: design,
    });
    expect(noDirection.status()).toBe(400);
    expect(
      (
        await api.post("/api/research-journey", {
          headers: { Origin: "https://example.invalid" },
          data: request,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await api.post("/api/research-journey", {
          data: {
            ...request,
            context: {
              ...request.context,
              evidence: Array(31).fill(request.context.evidence[0]),
            },
          },
        })
      ).status(),
    ).toBe(400);
  } finally {
    await api.dispose();
  }
});

test("隔离HTTP：双中介四段与指定路径调节完整返回；未知调节目标和含糊新关系拒绝（模拟）", async ({
  journeyAPI: api,
}) => {
  const request = await input("quantitative", "", "question");
  const initial = await post(api, request);
  request.context.quantitative = {
    ...initial.design,
    variables: [
      ["x", "模拟X", "X"],
      ["m1", "模拟中介1", "M"],
      ["m2", "模拟中介2", "M"],
      ["y", "模拟Y", "Y"],
      ["w", "模拟调节因素", "W"],
    ].map(([id, name, role]) => ({
      id,
      name,
      role,
      explanation: "只验证数据链路",
      rationale: "明确模拟",
      evidenceIds: ["paper-a"],
      uncertainty: "不代表真实论文",
      confirmed: false,
    })),
  };
  const before = JSON.stringify(request.context.quantitative);
  const result = await post(api, {
    ...request,
    designStep: "hypotheses",
    message: "PARALLEL_PATHS",
  });
  expect(result.design.hypotheses).toHaveLength(5);
  expect(
    result.design.hypotheses
      .slice(0, 4)
      .map((h: { from: string; to: string }) => [h.from, h.to]),
  ).toEqual([
    ["x", "m1"],
    ["m1", "y"],
    ["x", "m2"],
    ["m2", "y"],
  ]);
  expect(result.design.hypotheses[4]).toMatchObject({
    kind: "moderation",
    moderatesId: "h2",
    moderatorId: "w",
    from: "m1",
    to: "y",
    confirmed: false,
  });
  expect(JSON.stringify(request.context.quantitative)).toBe(before);
  request.context.quantitative = result.design;
  const method = await post(api, { ...request, designStep: "method" });
  expect(method.design.hypotheses).toEqual(result.design.hypotheses);
  for (const message of ["FORGED_MODERATION", "MISSING_MODERATION_KIND"]) {
    const failed = await api.post("/api/research-journey", {
      data: { ...request, designStep: "hypotheses", message },
    });
    expect(failed.status()).toBe(502);
  }
  expect(request.context.quantitative!.hypotheses).toEqual(
    result.design.hypotheses,
  );
});

test("隔离HTTP：逐篇对照观点各核验自己的文献与引句，错误归属剔除，切口保留提议身份（模拟）",async({journeyAPI:api})=>{
 const c=await input("context","PDF_COMPARE");
 c.context.evidence.push({...c.context.evidence[0],id:"paper-b",title:"第二篇合成文献",abstract:"这是完全不同的第二段合成摘要，只验证逐篇来源归属，不是学术结论。"});
 const response=await post(api,c);
 expect(response.sections[0].facts).toHaveLength(2);
 expect(response.sections[0].facts.map((f:{evidenceId:string})=>f.evidenceId)).toEqual(["paper-a","paper-b"]);
 expect(response.sections[0].body).toContain("逐篇核对");expect(response.sections[3].evidenceStatus).toBe("proposal");expect(response.sections[3].facts).toEqual([]);
});
