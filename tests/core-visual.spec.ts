import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { emptyExploration } from "../src/lib/exploration";
import { emptyNavigation } from "../src/lib/research-navigation";
import {
  emptyWorkflow,
  sourceFingerprint,
  type ReadingSection,
} from "../src/lib/workflow";
import { emptyLibrary } from "../src/lib/literature";
import { importedPaper } from "../src/lib/bibliography";
import type { Project } from "../src/lib/projects";
for (const {width,height} of [{width:1440,height:950},{width:390,height:950},{width:1366,height:768}])
  test(`深色聊天、分组概念与精析阅读布局 ${width}px（布局夹具，非AI验收）`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    const heroPaint=await page.locator(".hero").evaluate(el=>getComputedStyle(el).backgroundImage);
    mkdirSync("docs/screenshots/core", { recursive: true });
    await page.screenshot({
      path: `docs/screenshots/core/hero-${width}.png`,
      fullPage: true,
    });
    const at = "2026-10-26T10:00:00Z",
      p: Project = {
        id: "visual",
        name: "布局验收 · 非实际 AI 分析",
        observation: "为什么有些品牌联名反而让消费者反感？",
        discipline: "广告传播",
        status: "starting",
        createdAt: at,
        updatedAt: at,
        exploration: {
          ...emptyExploration(),
          navigation: {
            ...emptyNavigation(),
            concepts: Array.from({ length: 10 }, (_, i) => ({
              id: `c${i}`,
              term: `测试视角 ${i + 1}`,
              explanation:
                "这段解释仅用来检查卡片的阅读密度，不代表已核实学术概念。",
              relevance: "用于展示与观察的联系。",
              group: i < 5 ? "心理视角" : "传播视角",
              everyday: "相近概念的差异需查证",
              uncertainty: "候选待文献核对",
              origin: "ai",
              status: i < 2 ? "selected" : "suggested",
            })),
          },
          messages: [
            {
              id: "u",
              role: "user",
              content: "为什么有些品牌联名反而让消费者反感？",
              createdAt: at,
            },
            {
              id: "a",
              role: "assistant",
              content:
                "【明确模拟 · 仅布局验收】\n\n" +
                Array.from(
                  { length: 12 },
                  (_, i) =>
                    `第 ${i + 1} 段：把观察拆成不同问题，再比较每个学术视角能解释什么。这里的文字只检查连续阅读和滚动，并非真实模型对研究问题的判断。`,
                ).join("\n\n"),
              createdAt: at,
            },
          ],
        },
        library: {
          ...emptyLibrary(),
          items: [
            {
              id: "paper",
              paper: importedPaper({
                title: "版式测试论文（非真实学术记录）",
                authors: ["布局测试作者"],
                year: 2024,
                venue: "测试来源",
                abstract: "仅用于版式检查，不作为论文事实。",
              }),
              categoryIds: [],
              note: "",
              savedAt: at,
              updatedAt: at,
            },
          ],
        },
        workflow: emptyWorkflow(),
      };
    const section = (title: string): ReadingSection => ({
      title,
      body:
        "【布局夹具，非真实 AI 结论】\n\n" +
        "这里展示清楚的段落和解释。研究方法、发现和局限只允许来自实际可用资料，不能用猜测补全。本段仅用于验证字号、留白、长内容和证据折叠。".repeat(
          3,
        ),
      evidenceIds: ["paper"],
      quote: "仅用于版式检查，不作为论文事实。",
      page: null,
      uncertainty: "模拟资料，不能证明精析能力",
      evidenceStatus: "verified",
    });
    p.workflow!.direction = {
      text: "模拟方向卡",
      card: {
        title: "品牌联名反感从何而来（模拟卡）",
        question: "拟比较不同联名情境中的消费者反应。",
        value: "这是版式示例，价值判断尚未真实评估。",
        method: "方法建议需要依据实际文献核对。",
        limitations: "未执行真实 AI 联调，不代表研究结论。",
        evidenceIds: ["paper"],
      },
      evidenceIds: ["paper"],
      fingerprint: sourceFingerprint(p, false),
    };
    p.workflow!.analyses = [
      {
        id: "r",
        kind: "reading",
        fingerprint: sourceFingerprint(p),
        sourceIds: ["paper"],
        createdAt: at,
        sections: [
          "30 秒读懂",
          "研究问题与动机",
          "理论与核心概念",
          "研究方法与过程",
          "关键发现与结论",
          "局限与研究启发",
          "对当前项目的价值",
        ].map(section),
      },
    ];
    p.workflow!.analyses.push({
      id:"context",kind:"directions",fingerprint:sourceFingerprint(p,false),sourceIds:["paper"],createdAt:at,
      sections:[section("候选方向")],
      synthesis:["总体研究了什么","理论与方法对比","发现与分歧","还需要哪些证据"].map(section),
      cards:[1,2,3].map(i=>({title:`模拟候选方向 ${i}`,question:"拟比较不同情境中的消费者反应；仅用于版式检查。",value:"研究价值尚待真实文献核对。",method:"初步方法需要核实可行性，未执行真实研究。",limitations:"布局测试，不能证明 AI 分析质量。",evidenceIds:["paper"]}))
    });
    await page.evaluate(
      (p) =>
        localStorage.setItem(
          "paperi.projects.v1",
          JSON.stringify({
            version: 1,
            revision: 0,
            activeId: p.id,
            projects: [p],
          }),
        ),
      p,
    );
    await page.goto("/lab");
    await expect(page.locator(".concept-card")).toHaveCount(10);
    await expect(page.locator(".concept-group")).toHaveCount(2);
    const chat = page.locator(".lab-chat");
    expect(
      await chat.evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe("rgb(35, 54, 71)");
    expect(await chat.evaluate(el=>getComputedStyle(el).backgroundImage)).toBe(heroPaint);
    expect((await chat.boundingBox())!.height).toBeGreaterThanOrEqual(width>700?760:740);
    const transcript = await page.locator(".lab-transcript").boundingBox(),
      composer = await page.locator(".lab-composer").boundingBox();
    expect(transcript!.height).toBeGreaterThan(composer!.height * 2);
    expect(transcript!.y + transcript!.height).toBeLessThanOrEqual(
      composer!.y + 1,
    );
    await page.screenshot({
      path: `docs/screenshots/core/lab-${width}.png`,
      fullPage: true,
    });
    await page.goto("/literature?mode=reading");
    await expect(page.locator(".study-section")).toHaveCount(7);
    // Compact reading density: keep every section while avoiding oversized paragraphs.
    const type=await page.locator(".study-section>p").nth(1).evaluate(el=>({size:parseFloat(getComputedStyle(el).fontSize),leading:parseFloat(getComputedStyle(el).lineHeight)}));
    expect(type.size).toBeGreaterThanOrEqual(15);
    expect(type.size).toBeLessThanOrEqual(16);
    expect(type.leading/type.size).toBeGreaterThanOrEqual(1.6);
    expect(type.leading/type.size).toBeLessThanOrEqual(1.8);
    await page.screenshot({
      path: `docs/screenshots/core/reading-${width}.png`,
      fullPage: true,
    });
    await page.goto("/literature?mode=context");
    await expect(page.locator(".study-section")).toHaveCount(4);
    await expect(page.locator(".direction-choice")).toHaveCount(3);
    await expect(page.locator(".direction-readable")).toContainText(
      "品牌联名反感从何而来",
    );
    await expect(page.getByLabel("方向名称")).toHaveCount(0);
    await page.screenshot({
      path: `docs/screenshots/core/direction-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.emulateMedia({ media: "print", reducedMotion: "reduce" });
    await expect(page.locator(".direction-print")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "编辑方向卡" }),
    ).not.toBeVisible();
  });
