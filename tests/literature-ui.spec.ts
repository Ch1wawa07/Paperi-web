import { test, expect, type Page } from '@playwright/test';
import records from './fixtures/metadata-records.json';
import { mapCrossref, mapOpenAlex } from '../src/lib/literature-mapping';
const at='2026-10-21T08:00:00.000Z';
const a=mapCrossref(records.crossref,at)!,b=mapCrossref(records.missing,at)!;
async function mock(page: Page){
  await page.route('**/api/literature**',route=>{
    const u=new URL(route.request().url());
    if(u.pathname.endsWith('/verify'))return route.fulfill({json:{paper:{...a,title:'登记记录题名不同（测试夹具）',year:2025},resolves:true,checkedAt:at}});
    const q=route.request().method()==='POST'?route.request().postDataJSON().query:u.searchParams.get('query')??'';
    if(q==='failed')return route.fulfill({status:503,json:{error:'测试数据源不可达，没有结果'}});
    return route.fulfill({json:{query:q,provider:q==='same-doi'?'openalex':'crossref',items:q==='empty'?[]:q==='same-doi'?[mapOpenAlex(records.openalex,at)!]:[a,b],total:q==='empty'?0:24,page:Number(u.searchParams.get('page')??1),pageSize:10,notices:['测试夹具，仅测试界面流程'],cached:false,hasMore:q!=='empty'}});
  });
}
async function create(page: Page,name='研究 A'){
  await page.goto('/');await page.getByRole('button',{name:'新建项目',exact:true}).click();await page.getByLabel('项目名称').fill(name);await page.getByRole('button',{name:'创建项目',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await page.goto('/literature');
}
async function search(page: Page,q='fixture'){await page.getByLabel('文献关键词或 DOI').fill(q);await page.getByRole('button',{name:'检索',exact:true}).click();await expect(page.locator('.paper-card').first()).toBeVisible();}
async function saved(page: Page){await page.getByRole('tab',{name:/我的文献库/}).click();}

test('按研究与多分类收藏、笔记、跨源去重、分类改名删除保留文献及独立移除',async({page})=>{
  test.setTimeout(60000);await mock(page);await create(page);await saved(page);
  await page.getByRole('button',{name:'新建分类',exact:true}).click();await page.getByLabel('分类名称').fill('课程资料');await page.getByRole('button',{name:'保存分类',exact:true}).click();
  await page.getByRole('tab',{name:'检索文献',exact:true}).click();await search(page);
  const card=page.locator('.paper-card').first();await card.getByRole('button',{name:'收藏文献',exact:true}).click();
  await page.getByRole('dialog').getByLabel('待读',{exact:true}).uncheck();await page.getByRole('dialog').getByLabel('核心文献',{exact:true}).check();await page.getByRole('dialog').getByLabel('课程资料',{exact:true}).check();
  await page.getByLabel('我的阅读笔记').fill('研究 A 的私有阅读笔记');await page.getByRole('button',{name:'确认收藏',exact:true}).click();
  await expect(card.getByRole('button',{name:'已收藏 · 管理'})).toBeVisible();
  await search(page,'same-doi');await expect(page.locator('.paper-card')).toHaveCount(1);await expect(page.getByRole('button',{name:'已收藏 · 管理'})).toBeVisible();
  await saved(page);await expect(page.locator('.paper-card')).toHaveCount(1);await expect(page.locator('.paper-note')).toContainText('研究 A 的私有阅读笔记');
  await page.getByRole('button',{name:'重命名分类 课程资料',exact:true}).click();await page.getByLabel('分类名称').fill('课程核心');await page.getByRole('button',{name:'保存分类',exact:true}).click();await expect(page.locator('.paper-saved-info')).toContainText('课程核心');
  await page.reload();await saved(page);await expect(page.locator('.paper-note')).toContainText('研究 A 的私有阅读笔记');
  await page.getByRole('button',{name:'删除分类 课程核心',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('文献和笔记都会保留');await page.getByRole('button',{name:'确认删除分类',exact:true}).click();
  await page.getByRole('button',{name:'删除分类 核心文献',exact:true}).click();await page.getByRole('button',{name:'确认删除分类',exact:true}).click();await expect(page.locator('.paper-card')).toHaveCount(1);await expect(page.locator('.paper-saved-info')).toContainText('未分类');await expect(page.locator('.paper-note')).toContainText('研究 A 的私有阅读笔记');
  await create(page,'研究 B');await saved(page);await expect(page.locator('.paper-card')).toHaveCount(0);
  await page.getByRole('tab',{name:'检索文献',exact:true}).click();await search(page);await page.locator('.paper-card').first().getByRole('button',{name:'收藏文献',exact:true}).click();await page.getByLabel('我的阅读笔记').fill('研究 B 的另一份笔记');await page.getByRole('button',{name:'确认收藏',exact:true}).click();
  await page.getByLabel('当前项目',{exact:true}).selectOption({label:'研究 A'});await saved(page);await expect(page.locator('.paper-note')).toContainText('研究 A 的私有阅读笔记');
  await page.getByRole('button',{name:'移出收藏',exact:true}).click();await expect(page.getByRole('button',{name:'取消',exact:true})).toBeFocused();await page.getByRole('button',{name:'取消',exact:true}).click();await expect(page.locator('.paper-card')).toHaveCount(1);
  await page.getByRole('button',{name:'移出收藏',exact:true}).click();await page.getByRole('button',{name:'确认移出收藏',exact:true}).click();await expect(page.locator('.paper-card')).toHaveCount(0);
  await page.getByLabel('当前项目',{exact:true}).selectOption({label:'研究 B'});await saved(page);await expect(page.locator('.paper-note')).toContainText('研究 B 的另一份笔记');
});

test('缺失信息、来源记录、题名核查不一致、空结果和失败不会变成假论文',async({page})=>{
  await mock(page);await page.goto('/literature');await search(page);
  await expect(page.locator('.paper-card')).toHaveCount(1);await expect(page.locator('.paper-card')).not.toContainText(b.title);
  const first=page.locator('.paper-card').first();await expect(first.getByRole('link',{name:'查看来源记录'})).toHaveAttribute('href',a.recordUrl);await first.getByRole('button',{name:'核查 DOI 登记',exact:true}).click();await expect(first.locator('.paper-verification')).toContainText('题名与 Crossref 记录不同');await expect(first.locator('.paper-verification')).toContainText('年份记录不同');await expect(first.getByRole('heading')).toHaveText(a.title);
  await page.getByLabel('文献关键词或 DOI').fill('empty');await page.getByRole('button',{name:'检索',exact:true}).click();await expect(page.getByRole('heading',{name:'本次搜索尚未找到可核实的学术文献。'})).toBeVisible();await expect(page.locator('.paper-card')).toHaveCount(0);
  await page.getByLabel('文献关键词或 DOI').fill('failed');await page.getByRole('button',{name:'检索',exact:true}).click();await expect(page.locator('.literature-error')).toContainText('数据源不可达');await expect(page.locator('.paper-card')).toHaveCount(0);
});

test('收藏写入失败不显示已收藏，编辑窗口保留笔记',async({page})=>{
  await mock(page);await create(page);await search(page);await page.locator('.paper-card').first().getByRole('button',{name:'收藏文献',exact:true}).click();await page.getByLabel('我的阅读笔记').fill('不能丢失的编辑');
  await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Quota exceeded','QuotaExceededError');};});
  await page.getByRole('button',{name:'确认收藏',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('还没有保存成功');await expect(page.getByLabel('我的阅读笔记')).toHaveValue('不能丢失的编辑');
  await page.getByRole('button',{name:'取消',exact:true}).click();await saved(page);await expect(page.locator('.paper-card')).toHaveCount(0);await page.reload();await saved(page);await expect(page.locator('.paper-card')).toHaveCount(0);
});

test('其他标签改分类时，旧编辑窗口不能覆盖新内容',async({page,context})=>{
  await mock(page);await create(page);await search(page);await page.locator('.paper-card').first().getByRole('button',{name:'收藏文献',exact:true}).click();await page.getByRole('button',{name:'确认收藏',exact:true}).click();await saved(page);
  await page.getByRole('button',{name:'已收藏 · 管理'}).click();await page.getByLabel('我的阅读笔记').fill('旧页面编辑中');
  const other=await context.newPage();await mock(other);await other.goto('/literature');await saved(other);await other.getByRole('button',{name:'重命名分类 待读',exact:true}).click();await other.getByLabel('分类名称').fill('其他标签改名');await other.getByRole('button',{name:'保存分类',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('其他标签改名');await page.getByRole('button',{name:'保存分类与笔记',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('还没有保存成功');await page.getByRole('button',{name:'取消',exact:true}).click();await page.reload();await saved(page);await expect(page.locator('.paper-saved-info')).toContainText('其他标签改名');await expect(page.locator('.paper-note')).toHaveCount(0);
});

test('390px 收藏、分类、笔记搜索与键盘可用，无横向溢出',async({page})=>{
  await page.setViewportSize({width:390,height:844});await mock(page);await create(page);await search(page);await page.locator('.paper-card').first().getByRole('button',{name:'收藏文献',exact:true}).click();await page.getByLabel('我的阅读笔记').fill('手机阅读：与算法信任有关');await page.getByRole('button',{name:'确认收藏',exact:true}).click();await saved(page);await page.getByRole('textbox',{name:'搜索当前收藏'}).fill('算法信任');await expect(page.locator('.paper-card')).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'新建分类',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByLabel('分类名称')).toBeFocused();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'新建分类',exact:true})).toBeFocused();
});
