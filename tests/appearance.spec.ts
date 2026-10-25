import { test, expect } from "@playwright/test";
import { emptyExploration } from "../src/lib/exploration";
for (const width of [1440, 390])
  test(`对话以阅读为主、输入区紧凑、彩色导入首页 ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto("/");
    const at = new Date().toISOString();
    await page.evaluate(
      ({ at, exploration }) =>
        localStorage.setItem(
          "paperi.projects.v1",
          JSON.stringify({
            version: 1,
            revision: 0,
            activeId: "appearance",
            projects: [
              {
                id: "appearance",
                name: "品牌联名研究 · 界面测试",
                discipline: "广告学",
                observation: "品牌联名为什么吸引消费者",
                status: "starting",
                createdAt: at,
                updatedAt: at,
                exploration,
              },
            ],
          }),
        ),
      {
        at,
        exploration: {
          ...emptyExploration(),
          messages: [
            {
              id: "u",
              role: "user",
              content: "我对品牌联名感兴趣，想先理解品牌契合度。",
              createdAt: at,
            },
            {
              id: "a",
              role: "assistant",
              content:
                "这是一段界面测试内容，不是真实研究结论。\n\n可以先区分消费者对两个品牌是否合适的判断，以及对联名产品本身的评价。\n\n从你观察到的现象开始，再决定需要查阅哪些文献。".repeat(
                  5,
                ),
              createdAt: at,
            },
          ],
        },
      },
    );
    await page.goto("/lab");
    const transcript = await page.locator(".lab-transcript").boundingBox(),
      composer = await page.locator(".lab-composer").boundingBox();
    expect(transcript!.height).toBeGreaterThan(composer!.height * 2);
    expect(
      await page.locator(".lab-transcript").evaluate((el) => el.scrollTop),
    ).toBeLessThan(250);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/screenshots/refinement/lab-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.goto("/literature");
    await expect(
      page.getByRole("heading", { name: "把找到的论文，带进研究里。" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "已导入文献", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "导入文献", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({
      path: `docs/screenshots/refinement/import-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
