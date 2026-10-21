import { test, expect, type Page } from '@playwright/test';
import records from './fixtures/metadata-records.json';
import { mapCrossref } from '../src/lib/literature-mapping';
import { emptyLibrary } from '../src/lib/literature';

// All generated replies here are explicitly labelled fixtures, isolated to browser request interception.
const fixture = (tag = '第一轮',stage='phenomenon',evidenceIds:string[]=[]) => ({guide:{stage,understanding:'测试现象梳理',concepts:[{term:'测试概念',explanation:'测试解释，非真实定义',everyday:'测试日常区别',uncertainty:'待核实'}],keywords:{zh:[],en:[]},threads:[]}, reply: `测试夹具 ${tag}：从不同角度讨论这个观察。`, directions: (stage==='questions'?[1,2]:[]).map(i => ({
  title: `测试夹具 ${tag}方向${i}`, description: '仅用于功能验证，不是真实 AI 建议。', concepts: ['测试概念'],
  evidenceIds, rationale: '测试采纳和保存流程。', question: `${tag}的候选问题${i}？`, uncertainties: ['需要真实研究进一步核实'],
})) });
async function create(page: Page, name = '实验室测试项目') {
  await page.goto('/');
  await page.getByRole('button', { name: '新建项目', exact: true }).click();
  await page.getByLabel('项目名称').fill(name);
  await page.getByRole('button', { name: '创建项目', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.goto('/lab');
}
async function mockAI(page: Page) {
  let turn = 0;
  await page.route('**/api/lab', route => {const body=route.request().method()==='POST'?route.request().postDataJSON():null;return route.fulfill({json:!body?{configured:true,message:'测试夹具接口，非真实 AI'}:fixture(++turn===1?'第一轮':'第二轮',body.stage,body.evidence.map((e:{id:string})=>e.id))});});
}

test('无密钥仍可手动确认种子、编辑并刷新恢复；旧阶段项目兼容', async ({ page }) => {
  await create(page);
  await expect(page.getByRole('status').filter({ hasText: '尚未配置' })).toBeVisible();
  await page.getByLabel('给 AI 的消息').fill('我的观察');
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '手动写研究种子' }).click();
  await expect(page.getByLabel('研究视角', { exact: true })).toBeFocused();
  await page.getByLabel('研究视角', { exact: true }).fill('人工确认的视角');
  await page.getByLabel('研究问题', { exact: true }).fill('社区活动为什么难以吸引新居民？');
  await page.getByLabel('候选概念').fill('社区参与，归属感');
  await page.getByRole('button', { name: '保存研究种子', exact: true }).click();
  await expect(page.locator('.lab-seed')).toContainText('用户已确认');
  await page.reload();
  await expect(page.locator('.lab-seed')).toContainText('社区活动为什么难以吸引新居民？');
  await page.getByRole('button', { name: '编辑研究种子' }).click();
  await page.getByLabel('研究问题', { exact: true }).fill('哪些因素影响新居民参与社区活动？');
  await page.getByRole('button', { name: '保存研究种子', exact: true }).click();
  await expect(page.locator('.lab-seed')).toContainText('第 2 版');
  await page.reload();
  await expect(page.locator('.lab-seed')).toContainText('哪些因素影响新居民参与社区活动？');
});

test('候选编辑采纳、取消与确认替换、继续聊天不覆盖、丢弃及项目隔离', async ({ page }) => {
  await mockAI(page); await create(page);
  const paper=mapCrossref(records.crossref,'2026-10-21T08:00:00Z')!;
  await page.evaluate(({paper,library})=>{const s=JSON.parse(localStorage.getItem('paperi.projects.v1')!);const p=s.projects.find((p:{id:string})=>p.id===s.activeId);p.library={...library,items:[{id:'fixture-evidence',paper,categoryIds:[],note:'测试笔记',savedAt:paper.retrievedAt,updatedAt:paper.retrievedAt}]};p.exploration={revision:0,messages:[],directions:[],seed:null,navigation:{stage:'questions',concepts:[{id:'fixture-concept',term:'测试概念',explanation:'测试解释',everyday:'',uncertainty:'待核实',status:'selected',origin:'user'}],evidenceIds:['fixture-evidence'],guide:null}};localStorage.setItem('paperi.projects.v1',JSON.stringify(s));},{paper,library:emptyLibrary()});await page.reload();
  await page.getByLabel('给 AI 的消息').fill('测试观察：买东西先问 AI');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.locator('.direction-card')).toHaveCount(2);
  const first = page.locator('.direction-card').first();
  await first.getByRole('button', { name: '编辑并采纳' }).click();
  await page.getByLabel('研究问题', { exact: true }).fill('我亲自编辑并确认的研究问题');
  await page.getByRole('button', { name: '保存研究种子', exact: true }).click();
  await expect(page.locator('.lab-seed')).toContainText('我亲自编辑并确认的研究问题');
  await page.getByLabel('给 AI 的消息').fill('再换一个角度讨论');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.locator('.chat-assistant')).toHaveCount(2);
  await expect(page.locator('.lab-seed')).toContainText('我亲自编辑并确认的研究问题');
  await page.reload();
  await expect(page.locator('.chat-assistant')).toHaveCount(2);
  await expect(page.locator('.lab-seed')).toContainText('我亲自编辑并确认的研究问题');
  await page.locator('.direction-card').first().getByRole('button', { name: '编辑并采纳' }).click();
  await expect(page.getByRole('heading', { name: '替换已确认的研究种子？' })).toBeVisible();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.locator('.lab-seed')).toContainText('我亲自编辑并确认的研究问题');
  await page.locator('.direction-card').first().getByRole('button', { name: '编辑并采纳' }).click();
  await page.getByRole('button', { name: '确认替换研究种子' }).click();
  await expect(page.locator('.lab-seed')).toContainText('第 2 版');
  const count = await page.locator('.direction-card').count();
  await page.locator('.direction-card').first().getByRole('button', { name: '丢弃', exact: true }).click();
  await expect(page.locator('.direction-card')).toHaveCount(count - 1);
  await page.reload();await expect(page.locator('.direction-card')).toHaveCount(count - 1);
  await create(page, '另一个独立项目');
  await expect(page.locator('.chat-message')).toHaveCount(0);
  await expect(page.locator('.lab-seed')).toContainText('尚未确认');
  await page.getByLabel('当前项目', { exact: true }).selectOption({ label: '实验室测试项目' });
  await expect(page.locator('.chat-assistant')).toHaveCount(2);
});

test('调用失败不造回复，重试不重复提问，AI 文本不会作为 HTML 执行', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/lab', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { configured: true, message: '测试接口' } });
    if (++calls === 1) return route.fulfill({ status: 429, json: { error: '测试额度不足' } });
    return route.fulfill({ json: { ...fixture(), reply: '<img src=x onerror="window.paperiUnsafe=true">测试夹具文字' } });
  });
  await create(page);
  await page.getByLabel('给 AI 的消息').fill('请讨论测试观察');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('测试额度不足');
  await expect(page.locator('.chat-assistant')).toHaveCount(0);
  await page.reload();await expect(page.locator('.chat-user')).toHaveCount(1);
  await page.getByRole('button', { name: '重试 AI 回复' }).click();
  await expect(page.locator('.chat-assistant')).toHaveCount(1);
  await expect(page.locator('.chat-user')).toHaveCount(1);
  await expect(page.locator('.chat-assistant img')).toHaveCount(0);
  await expect(page.locator('.chat-assistant')).toContainText('<img src=x');
});

test('回复保存失败时保留用户消息并显示未保存内容，不报告假成功', async ({ page }) => {
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/lab', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { configured: true, message: '测试接口' } });
    await wait; await route.fulfill({ json: fixture() });
  });
  await create(page);
  await page.getByLabel('给 AI 的消息').fill('要保留的提问');
  const arrived = page.waitForRequest(r => r.url().endsWith('/api/lab') && r.method() === 'POST');
  await page.getByRole('button', { name: '发送', exact: true }).click();await arrived;
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; });
  release();
  await expect(page.locator('.lab-error')).toContainText('没有写入历史');
  await expect(page.locator('.chat-assistant')).toHaveCount(0);
  await page.getByText('未保存的 AI 回复', { exact: true }).click();
  await expect(page.locator('.lab-unsaved')).toContainText('测试夹具');
  await page.reload();await expect(page.locator('.chat-user')).toHaveCount(1);
});

test('手机种子编辑与跨标签冲突不会静默覆盖', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });await create(page);
  await page.getByRole('button', { name: '手动写研究种子' }).click();
  await page.getByLabel('研究视角', { exact: true }).fill('初始视角');
  await page.getByLabel('研究问题', { exact: true }).fill('初始问题');
  await page.getByRole('button', { name: '保存研究种子', exact: true }).click();
  const other = await context.newPage();await other.goto('/lab');
  await page.getByRole('button', { name: '编辑研究种子' }).click();
  await page.getByLabel('研究问题', { exact: true }).fill('过期窗口中的修改');
  await other.getByRole('button', { name: '编辑研究种子' }).click();
  await other.getByLabel('研究问题', { exact: true }).fill('其他标签页已保存的问题');
  await other.getByRole('button', { name: '保存研究种子', exact: true }).click();
  await expect(page.locator('.lab-seed')).toContainText('其他标签页已保存的问题');
  await page.getByRole('button', { name: '保存研究种子', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('未完成保存');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.reload();await expect(page.locator('.lab-seed')).toContainText('其他标签页已保存的问题');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
