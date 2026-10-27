import { test, expect, type Page } from '@playwright/test';
import { emptyExploration, isExploration, readAIReply } from '../src/lib/exploration';
import { emptyNavigation, mergeConcepts } from '../src/lib/research-navigation';
import { mapCrossref } from '../src/lib/literature-mapping';
import records from './fixtures/metadata-records.json';

const at='2026-10-21T08:00:00Z',key='paperi.projects.v1';
const concept={term:'测试概念',explanation:'测试候选解释，不是真实定义',everyday:'测试区别',uncertainty:'待文献核实'};
function reply(stage='phenomenon',evidenceIds:string[]=[]) {
  return {reply:'测试夹具：先理解观察，不急着定题。',guide:{stage,understanding:'测试现象梳理',concepts:[concept],keywords:{zh:['测试概念 消费情境'],en:['fixture trust consumer']},threads:stage==='context'?[{title:'测试脉络',description:'基于测试摘要的有限讨论',evidenceIds,uncertainty:'尚未读取全文'}]:[]},directions:stage==='questions'?[{title:'测试单一候选',description:'测试可行性',concepts:['测试概念'],rationale:'只以已提供元数据为依据',question:'测试候选问题？',uncertainties:['有限检索不能证明研究空白'],evidenceIds}]:[]};
}
async function mock(page:Page,onPost?:(body:Record<string,unknown>)=>void) {
  await page.route('**/api/lab',r=>{if(r.request().method()==='GET')return r.fulfill({json:{configured:true,message:'测试接口，非真实 AI'}});const body=r.request().postDataJSON();onPost?.(body);return r.fulfill({json:reply(body.stage,body.evidence.map((e:{id:string})=>e.id))});});
}
async function start(page:Page,text='测试生活观察：我为什么会反感被广告劝说？') {await page.goto('/');await page.getByLabel('写下你的日常观察').fill(text);await page.getByRole('button',{name:'开始探索',exact:true}).click();await expect(page).toHaveURL('/lab');}

test('旧版探索、种子、方向兼容；用户选择/排除的概念不会被 AI 覆盖',()=>{
 const old={...emptyExploration(),directions:[{id:'old-direction',title:'旧视角',description:'旧描述',concepts:[],rationale:'旧待查',question:'旧问题？',uncertainties:[],status:'suggested'}],seed:{angle:'旧视角',workingQuestion:'旧问题？',concepts:['旧概念'],rawObservation:'旧观察',version:1,confirmedAt:at,sourceDirectionId:null}};
 expect(isExploration(old)).toBe(true);
 const valid=reply();const nested={reply:valid.reply,guide:{...valid.guide,directions:valid.directions}};expect(readAIReply(nested)?.directions).toEqual([]);expect(readAIReply({...nested,guide:{...nested.guide,stage:'invented-stage'}})).toBeNull();
 const existing=[{...concept,id:'c',origin:'user' as const,status:'selected' as const,explanation:'用户亲自修改的解释'}];
 const merged=mergeConcepts(existing,[{...concept,explanation:'模型试图改写'}]);expect(merged).toEqual(existing);expect(isExploration({...old,navigation:emptyNavigation()})).toBe(true);
 expect(isExploration({...old,launch:{messageId:'not-existing',attempted:false}})).toBe(false);
});

test('首页直接开始一次真实适配流程，共用历史；双击、刷新与返回不重复首次请求',async({page})=>{
 let calls=0;await mock(page,()=>calls++);await page.goto('/');const text='测试观察：购买前先问 AI，又担心失去自己的判断。';await page.getByLabel('写下你的日常观察').fill(text);
 await page.locator('.idea-input').evaluate(el=>{(el as HTMLFormElement).requestSubmit();(el as HTMLFormElement).requestSubmit();});
 await expect(page).toHaveURL('/lab');await expect(page.locator('.chat-assistant')).toHaveCount(1);await expect(page.locator('.chat-user')).toHaveCount(1);await expect(page.locator('.direction-card')).toHaveCount(0);expect(calls).toBe(1);
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key);expect(saved.projects).toHaveLength(1);expect(saved.projects[0].observation).toBe(text);expect(saved.projects[0].name).not.toBe(text);
 await page.reload();await expect(page.locator('.chat-assistant')).toHaveCount(1);await page.goto('/');await page.getByRole('button',{name:'继续项目'}).click();await expect(page.locator('.chat-user')).toHaveCount(1);expect(calls).toBe(1);
});

test('首页首次调用失败后保留原话；刷新不自动扣调用，重试复用同一项目和消息',async({page})=>{
 let calls=0;await page.route('**/api/lab',r=>{if(r.request().method()==='GET')return r.fulfill({json:{configured:true,message:'测试接口'}});return ++calls===1?r.fulfill({status:429,json:{error:'测试额度限制'}}):r.fulfill({json:reply()});});
 await start(page);await expect(page.locator('.lab-error')).toContainText('测试额度限制');await expect(page.locator('.chat-user')).toHaveCount(1);await page.reload();await expect(page.getByRole('button',{name:'重试 AI 回复'})).toBeEnabled();expect(calls).toBe(1);
 await page.getByRole('button',{name:'重试 AI 回复'}).click();await expect(page.locator('.chat-assistant')).toHaveCount(1);expect(calls).toBe(2);expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).projects.length,key)).toBe(1);await expect(page.locator('.chat-user')).toHaveCount(1);
});

test('首页本地保存失败不发 AI、不丢输入或创建假项目',async({page})=>{
 let calls=0;await mock(page,()=>calls++);await page.goto('/');await expect(page.getByRole('button',{name:'新建项目',exact:true})).toBeEnabled();await page.getByLabel('写下你的日常观察').fill('必须保留的测试原话');await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('full','QuotaExceededError');};});await page.getByRole('button',{name:'开始探索',exact:true}).click();await expect(page.getByRole('main').getByRole('alert')).toContainText('保存失败');await expect(page.getByLabel('写下你的日常观察')).toHaveValue('必须保留的测试原话');expect(calls).toBe(0);
});

test('概念编辑排除后跨页检索，不强制种子；确认问题不被继续对话覆盖',async({page})=>{
 let calls=0;await mock(page,()=>calls++);await page.route('**/api/research',r=>r.fulfill({json:{zh:['测试概念 消费'],en:['fixture trust consumer']}}));await start(page);await page.getByRole('link',{name:'进入概念锚定'}).click();await expect(page).toHaveURL('/concepts');await expect(page.locator('.concept-card')).toHaveCount(1);
 await page.getByRole('button',{name:'选择概念',exact:true}).click();await expect(page.locator('.selected-concepts-bar')).toContainText('测试概念');await page.getByRole('button',{name:'修改',exact:true}).click();await page.getByLabel('候选解释',{exact:true}).fill('用户修改并保留的解释');await page.getByRole('button',{name:'保存概念',exact:true}).click();await page.getByRole('button',{name:'排除',exact:true}).click();
 await page.goto('/lab');await page.getByRole('button',{name:'继续探索',exact:true}).click();await expect(page.locator('.chat-assistant')).toHaveCount(2);await page.goto('/concepts');await expect(page.locator('.concept-card')).toContainText('已排除');await page.reload();await expect(page.locator('.concept-card')).toContainText('用户修改并保留的解释');await page.getByRole('button',{name:'选择概念',exact:true}).click();
 let searches=0;await page.route('**/api/literature/discover',r=>{searches++;return r.abort();});await expect(page.locator('.selected-concepts-bar').getByRole('link',{name:'前往深圳大学图书馆'})).toHaveAttribute('target','_blank');await page.getByText('高级检索词（可选）',{exact:true}).click();await expect(page.getByLabel('已有检索词')).toContainText('fixture trust consumer');expect(searches).toBe(0);await page.goto('/lab');
 await page.locator('.seed-advanced>summary').click();await page.getByRole('button',{name:'手动写研究种子'}).click();await page.getByLabel('研究视角',{exact:true}).fill('用户决定的视角');await page.getByLabel('研究问题',{exact:true}).fill('用户确认的问题不会被覆盖？');await page.getByRole('button',{name:'保存研究种子',exact:true}).click();await page.getByRole('button',{name:'继续探索',exact:true}).click();await expect(page.locator('.chat-assistant')).toHaveCount(3);await expect(page.locator('.lab-seed')).toContainText('用户确认的问题不会被覆盖？');expect(calls).toBe(3);
});

test('390px 研究导航、自动首轮与可收起辅助面板不溢出；桌面入口在首屏',async({page})=>{
 await mock(page);await page.setViewportSize({width:1280,height:900});await page.goto('/');expect(await page.locator('.journey-grid').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight)).toBe(true);await expect(page.getByRole('navigation',{name:'主要导航'})).toBeVisible();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'展开导航'}).click();await expect(page.getByRole('navigation',{name:'主要导航'})).toBeVisible();await page.getByRole('button',{name:'收起导航'}).click();await start(page);await expect(page.locator('.chat-assistant')).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('link',{name:'进入概念锚定'}).click();await page.getByRole('button',{name:'修改',exact:true}).click();await expect(page.getByLabel('概念名称')).toBeFocused();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'修改',exact:true})).toBeFocused();await expect(page.locator('.library-entry').getByRole('link',{name:'前往深圳大学图书馆'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});


test('实际 HTTP 适配器允许单个有依据的问题，兼容实测嵌套格式并拒绝捏造依据',async({playwright})=>{
 const request=await playwright.request.newContext({baseURL:'http://127.0.0.1:3102',extraHTTPHeaders:{Origin:'http://127.0.0.1:3102'}});
 try {
  const paper=mapCrossref(records.crossref,at)!,concepts=[{...concept,id:'c',origin:'user',status:'selected'}],evidence=[{id:'real-source-fixture',paper}];
  const payload=(text:string,stage:string)=>({observation:'测试观察',seed:null,messages:[{role:'user',content:text}],stage,concepts,evidence});
  const question=await request.post('/api/lab',{data:payload('测试问题阶段','questions')});expect(question.status()).toBe(200);const d=await question.json();expect(d.directions).toHaveLength(1);expect(d.directions[0].evidenceIds).toEqual(['real-source-fixture']);
  const keywords=await request.post('/api/lab',{data:payload('请生成短检索组合','literature')});expect(keywords.status()).toBe(200);expect((await keywords.json()).guide.keywords.en).toHaveLength(2);
  const nested=await request.post('/api/lab',{data:payload('UPSTREAM_NESTED','concepts')});expect(nested.status()).toBe(200);expect((await nested.json()).directions).toEqual([]);
  const empty=await request.post('/api/lab',{data:payload('UPSTREAM_EMPTY','concepts')});expect(empty.status()).toBe(502);expect((await empty.json()).error).toContain('空内容');
  const forged=await request.post('/api/lab',{data:payload('UPSTREAM_BADREF','context')});expect(forged.status()).toBe(502);expect((await forged.json()).error).toContain('未提供的文献标识');
 } finally {await request.dispose();}
});


test('首次观察已落盘但请求登记保存失败时，不循环自动重试或调用 AI',async({page})=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let calls=0;
 await page.route('**/api/lab',async r=>{if(r.request().method()==='GET'){await gate;return r.fulfill({json:{configured:true,message:'测试接口'}});}calls++;return r.fulfill({json:reply()});});
 await page.goto('/');await page.getByLabel('写下你的日常观察').fill('测试原话，首次落盘成功');await page.getByRole('button',{name:'开始探索',exact:true}).click();await expect(page).toHaveURL('/lab');
 await page.evaluate(()=>{const target=window as typeof window&{testWrites?:number};target.testWrites=0;Storage.prototype.setItem=()=>{target.testWrites!++;throw new DOMException('full','QuotaExceededError');};});release();
 await expect(page.locator('.lab-error')).toContainText('首次请求尚未确认保存');await expect(page.getByRole('button',{name:'重试 AI 回复'})).toBeEnabled();expect(calls).toBe(0);expect(await page.evaluate(()=>(window as typeof window&{testWrites:number}).testWrites)).toBe(1);
 await page.getByRole('button',{name:'重试 AI 回复'}).click();await expect(page.locator('.lab-error')).toContainText('首次请求尚未确认保存');expect(calls).toBe(0);expect(await page.evaluate(()=>(window as typeof window&{testWrites:number}).testWrites)).toBe(2);
});
