import { test, expect, type Page } from '@playwright/test';
const key = 'paperi.projects.v1';
async function createProject(page: Page, name: string) {
  await page.getByRole('button', { name: '新建项目', exact: true }).click();
  await page.getByLabel('项目名称').fill(name);
  await page.getByRole('button', { name: '创建项目', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

test('项目完整流程：创建、改名、切换、跨页、刷新、关闭重开、取消删除和确认删除', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByText('这里，留给你的第一个研究')).toBeVisible();
  await createProject(page, '我的 AI 消费研究');
  await page.getByRole('button', { name: '重命名项目 我的 AI 消费研究' }).click();
  await page.getByLabel('项目名称').fill('AI 与消费者信任');
  await page.getByRole('button', { name: '保存名称', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'AI 与消费者信任', exact: true })).toBeVisible();
  await createProject(page, '短视频里的日常生活');
  const picker = page.getByLabel('当前项目', { exact: true });
  await picker.selectOption({ label: 'AI 与消费者信任' });
  await page.getByRole('navigation', { name: '主要导航' }).getByRole('link', { name: '文献探索' }).click();
  await expect(page.getByRole('heading', { name: '文献探索', exact: true })).toBeVisible();
  await expect(picker.locator('option:checked')).toHaveText('AI 与消费者信任');
  await page.reload();
  await expect(picker.locator('option:checked')).toHaveText('AI 与消费者信任');
  const reopened = await context.newPage();
  await page.close();
  await reopened.goto('/');
  await expect(reopened.getByRole('heading', { name: 'AI 与消费者信任', exact: true })).toBeVisible();
  await expect(reopened.getByRole('heading', { name: '短视频里的日常生活', exact: true })).toBeVisible();
  await expect(reopened.getByLabel('当前项目', { exact: true }).locator('option:checked')).toHaveText('AI 与消费者信任');
  await reopened.getByRole('button', { name: '删除项目 AI 与消费者信任' }).click();
  await reopened.getByRole('button', { name: '取消', exact: true }).click();
  await expect(reopened.getByRole('heading', { name: 'AI 与消费者信任', exact: true })).toBeVisible();
  await reopened.getByRole('button', { name: '删除项目 AI 与消费者信任' }).click();
  await reopened.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(reopened.getByRole('heading', { name: 'AI 与消费者信任', exact: true })).not.toBeVisible();
  await expect(reopened.getByLabel('当前项目', { exact: true }).locator('option:checked')).toHaveText('短视频里的日常生活');
  await reopened.reload();
  await expect(reopened.getByRole('heading', { name: 'AI 与消费者信任', exact: true })).not.toBeVisible();
  await expect(reopened.getByRole('heading', { name: '短视频里的日常生活', exact: true })).toBeVisible();
  await reopened.getByRole('button', { name: '删除项目 短视频里的日常生活' }).click();
  await reopened.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(reopened.getByText('这里，留给你的第一个研究')).toBeVisible();
  await expect(reopened.getByLabel('当前项目', { exact: true })).toBeDisabled();
});

test('日常观察真实保存到项目；无 AI 回答，空白名称不可保存', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  const observation = '我开始先问 AI 再买东西，这能成为研究问题吗？';
  await page.getByLabel('写下你的日常观察').fill(observation);
  await page.getByRole('button', { name: '保存想法，开始探索' }).click();
  await page.getByLabel('项目名称').fill('   ');
  await expect(page.getByRole('button', { name: '创建项目', exact: true })).toBeDisabled();
  await page.getByLabel('项目名称').fill('我的第一个想法');
  await page.getByRole('button', { name: '创建项目', exact: true }).click();
  await page.getByRole('button', { name: '继续项目' }).click();
  await expect(page).toHaveURL('/lab');
  await expect(page.getByText(observation, { exact: true })).toBeVisible();
  await expect(page.getByText('功能将在后续阶段接入', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(observation, { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('损坏的数据受到保护，不被新数据覆盖', async ({ page }) => {
  await page.addInitScript(({ key }) => localStorage.setItem(key, '{broken data'), { key });
  await page.goto('/');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('为保护原有内容，已暂停保存');
  await expect(page.getByRole('button', { name: '新建项目', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '重新读取' }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe('{broken data');
});

test('保存失败显示错误，不伪造创建成功，恢复后可以重试', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '新建项目', exact: true })).toBeEnabled();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: '新建项目', exact: true }).click();
  await page.getByLabel('项目名称').fill('不应该保存成功');
  await page.getByRole('button', { name: '创建项目', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('操作未完成');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('保存失败');
  await expect(page.getByRole('heading', { name: '不应该保存成功', exact: true })).not.toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBeNull();
  await page.reload();
  await createProject(page, '恢复后保存成功');
});

test('浏览器禁用读取时给出可理解错误', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.getItem = () => { throw new DOMException('Denied', 'SecurityError'); }; });
  await page.goto('/');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('无法读取浏览器存储');
  await expect(page.getByRole('button', { name: '新建项目', exact: true })).toBeDisabled();
});

test('两个标签页同步创建、改名和删除', async ({ page, context }) => {
  await page.goto('/');
  const other = await context.newPage();
  await other.goto('/');
  await createProject(page, '跨页项目');
  await expect(other.getByRole('heading', { name: '跨页项目', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重命名项目 跨页项目' }).click();
  await page.getByLabel('项目名称').fill('跨页改名');
  await page.getByRole('button', { name: '保存名称', exact: true }).click();
  await expect(other.getByRole('heading', { name: '跨页改名', exact: true })).toBeVisible();
  await other.getByRole('button', { name: '删除项目 跨页改名' }).click();
  await other.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.getByText('这里，留给你的第一个研究')).toBeVisible();
});

for (const width of [1440, 1280, 768, 390]) {
  test(`${width}px 布局、六路由导航与返回`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /今天，你对什么\s*感到好奇\s*？/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/home-${width}.png`, fullPage: true });
    for (const [route, title] of [['lab', '灵感实验室'], ['literature', '文献探索'], ['map', '文献星图'], ['canvas', '研究设计画布'], ['proposal', '研究方案']]) {
      if (width <= 640) await page.getByRole('button', { name: '展开导航' }).click();
      await page.getByRole('navigation', { name: '主要导航' }).getByRole('link', { name: title }).click();
      await expect(page).toHaveURL(`/${route}`);
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await expect(page.getByText('功能将在后续阶段接入', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.getByRole('link', { name: /← 返回/ }).click();
      if (route === 'lab') await expect(page).toHaveURL('/');
    }
    if (width <= 640) await page.getByRole('button', { name: '展开导航' }).click();
    await page.getByRole('navigation', { name: '主要导航' }).getByRole('link', { name: '首页' }).click();
    await expect(page).toHaveURL('/');
    expect(errors).toEqual([]);
  });
}

test('键盘可以打开和退出创建窗口，减少动画设置受尊重', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const create = page.getByRole('button', { name: '新建项目', exact: true });
  await expect(create).toBeEnabled();
  await create.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('项目名称')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(create).toBeFocused();
  expect(await page.locator('.page-enter').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});

test('手机端可创建、改名与确认删除，长名称不会撑破页面', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const longName = '一个需要慢慢探索的人文社科研究问题'.repeat(4).slice(0, 80);
  await createProject(page, longName);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: `重命名项目 ${longName}` }).click();
  await expect(page.getByRole('dialog')).toBeInViewport();
  await page.getByLabel('项目名称').fill('手机里的想法');
  await page.getByRole('button', { name: '保存名称', exact: true }).click();
  await page.getByRole('button', { name: '删除项目 手机里的想法' }).click();
  await expect(page.getByRole('button', { name: '取消', exact: true })).toBeFocused();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.getByText('这里，留给你的第一个研究')).toBeVisible();
});

test('其他标签页删除了正在改名的项目时，不伪造保存成功', async ({ page, context }) => {
  await page.goto('/');
  await createProject(page, '需要同步的项目');
  const other = await context.newPage();
  await other.goto('/');
  await page.getByRole('button', { name: '重命名项目 需要同步的项目' }).click();
  await other.getByRole('button', { name: '删除项目 需要同步的项目' }).click();
  await other.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.getByLabel('当前项目', { exact: true })).toBeDisabled();
  await page.getByLabel('项目名称').fill('已经不存在');
  await page.getByRole('button', { name: '保存名称', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('操作未完成');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('这个项目已经不存在');
});
