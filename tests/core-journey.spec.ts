import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {emptyWorkflow} from '../src/lib/workflow';
const key='paperi.projects.v1';
async function begin(page:Page){
 await page.route('**/api/lab',r=>{if(r.request().method()==='GET')return r.fulfill({json:{configured:true,message:'模拟模型连接，不是真实 AI'}});const b=r.request().postDataJSON();return r.fulfill({json:{reply:'这是测试夹具中的解释，非真实学术建议。',directions:[],guide:{stage:b.stage,understanding:'仅交互测试',concepts:Array.from({length:10},(_,i)=>({term:`测试视角${i+1}`,explanation:'用大白话解释测试视角',everyday:'相近概念边界待核对',uncertainty:'候选待查',group:i<5?'心理':'传播',relevance:'与测试观察有关'})),keywords:{zh:[],en:[]},threads:[]}}});});
 await page.route('**/api/research',r=>r.fulfill({json:{zh:['测试视角'],en:['fixture perspective'],synonyms:['测试扩展'],expressions:['测试视角 消费','fixture perspective consumer']}}));
 await page.goto('/');await page.getByLabel('写下你的日常观察').fill('为什么有些品牌联名反而让消费者反感？');await page.getByRole('button',{name:'开始探索',exact:true}).click();await expect(page.locator('.concept-card')).toHaveCount(10);
}
test('核心路径（AI明确模拟）：原话、十概念、自动关键词、混合导入、七维精析、脉络到可编辑方向卡',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);await begin(page);
 await page.getByRole('button',{name:'选择概念',exact:true}).nth(0).click();await page.getByRole('button',{name:'选择概念',exact:true}).nth(0).click();
 await page.getByRole('link',{name:'根据已选概念准备检索'}).click();await expect(page.getByLabel('英文核心关键词')).toHaveValue('fixture perspective');
 const library=page.getByRole('link',{name:'前往深圳大学图书馆'}).first();await expect(library).toHaveAttribute('href','https://www.lib.szu.edu.cn/');await expect(library).toHaveAttribute('target','_blank');
 await page.getByLabel('选择题录或 PDF 文件').setInputFiles(['tests/fixtures/workflow/publisher-records.ris','tests/fixtures/workflow/readable.pdf']);
 await expect(page.getByText('导入预览：4 篇可编辑，0 条失败')).toBeVisible();await page.getByRole('button',{name:'导入这 4 篇'}).click();await expect(page.locator('.paper-card')).toHaveCount(4);
 let receivedPDF=false;
 await page.route('**/api/workflow',r=>{const b=r.request().postDataJSON(),id=b.evidence[0].id;receivedPDF ||= b.evidence.some((e:{pages:unknown[]})=>e.pages.length>0);const section=(title:string)=>({title,body:'本地模拟分析，非真实论文结论。',evidenceIds:[id],quote:b.evidence[0].pages[0]?.text||b.evidence[0].paper.abstract||'',page:b.evidence[0].pages[0]?.page??null,uncertainty:'明确模拟，仅验证数据流'});return r.fulfill({json:b.task==='reading'?{sections:['30 秒读懂','研究问题与动机','理论与核心概念','研究方法与过程','关键发现与结论','局限与研究启发','对当前项目的价值'].map(section)}:{sections:[section('测试方向')],synthesis:['总体概览','理论和方法对比','发现与分歧','尚缺证据'].map(section),cards:[1,2,3].map(i=>({title:`测试方向${i}`,question:`拟比较不同情境${i}`,value:'这是研究建议',method:i===1?'拟访谈，需核实可行性':'拟实验，需核实可行性',limitations:'需要更多证据',evidenceIds:[id]}))}})});
 await page.getByRole('button',{name:'文献精析',exact:true}).first().click();await page.getByLabel('选择精析文献').selectOption({index:3});await page.getByRole('button',{name:'一键精析',exact:true}).click();await expect(page.locator('.study-section')).toHaveCount(7);expect(receivedPDF).toBe(true);
 await page.getByRole('button',{name:'研究脉络',exact:true}).click();await page.getByRole('button',{name:'梳理研究脉络',exact:true}).click();await expect(page.locator('.study-section')).toHaveCount(4);await expect(page.locator('.direction-choice')).toHaveCount(3);
 await page.getByRole('button',{name:'选择这个方向',exact:true}).nth(1).click();await expect(page.getByLabel('方向名称')).toHaveValue('测试方向2');await page.getByLabel('我想研究什么').fill('用户修订的问题');await page.getByRole('button',{name:'保存研究方向卡',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:'研究脉络',exact:true}).click();await expect(page.getByLabel('我想研究什么')).toHaveValue('用户修订的问题');await page.getByRole('button',{name:'复制研究方向卡文字'}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('用户修订的问题');
 const id=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).activeId,key);await page.goto('/lab');await expect(page.locator('.chat-user').first()).toContainText('为什么有些品牌联名反而让消费者反感？');expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).activeId,key)).toBe(id);
});
test('多个PDF可选并保存；旧页面重定向，旧研究数据/PDF副本删除保护仍在',async({page})=>{
 await begin(page);await page.goto('/literature');const buffer=readFileSync('tests/fixtures/workflow/readable.pdf');await page.getByLabel('选择题录或 PDF 文件').setInputFiles([1,2,3].map(i=>({name:`synthetic-${i}.pdf`,mimeType:'application/pdf',buffer})));
 await expect(page.getByText('导入预览：3 篇可编辑，0 条失败')).toBeVisible();for(let i=1;i<=3;i++)await page.getByLabel(`第 ${i} 条导入方式`).selectOption('keep');await page.getByRole('button',{name:'导入这 3 篇'}).click();await expect(page.locator('.paper-card')).toHaveCount(3);
 await page.evaluate(({key,f})=>{const s=JSON.parse(localStorage.getItem(key)!);s.projects[0].workflow={...f,review:[{id:'old',title:'原有综述',body:'用户旧成果应保留',evidenceIds:[],uncertainty:'待查',x:0,y:0}]};localStorage.setItem(key,JSON.stringify(s));},{key,f:emptyWorkflow()});
 for(const path of ['map','review','canvas','proposal']){await page.goto('/'+path);await expect(page).toHaveURL(/literature\?mode=context/);}
 await expect(page.locator('.legacy-history')).toContainText('用户旧成果应保留');await expect(page.getByRole('navigation',{name:'主要导航'}).getByRole('link')).toHaveCount(3);await expect(page.getByRole('button',{name:'文献星图',exact:true})).toHaveCount(0);
});
test('AI失败保留已确认卡、项目切换隔离、删除来源提示更新',async({page})=>{
 await begin(page);await page.goto('/literature');await page.getByLabel('选择题录或 PDF 文件').setInputFiles('tests/fixtures/workflow/publisher-records.ris');await page.getByRole('button',{name:'导入这 3 篇'}).click();
 await page.getByRole('button',{name:'研究脉络',exact:true}).click();await page.getByLabel('方向名称').fill('自己确认的方向');await page.getByLabel('我想研究什么').fill('拟研究品牌反应');await page.getByRole('button',{name:'保存研究方向卡'}).click();
 await page.route('**/api/workflow',r=>r.fulfill({status:502,json:{error:'模拟上游输出截断，未保存'}}));await page.getByRole('button',{name:'梳理研究脉络',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'模拟上游输出截断'})).toBeVisible();await expect(page.getByLabel('方向名称')).toHaveValue('自己确认的方向');
 await page.getByRole('button',{name:'已导入文献',exact:true}).click();page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'删除文献',exact:true}).first().click();await page.getByRole('button',{name:'研究脉络',exact:true}).click();await expect(page.locator('.my-direction-card')).toContainText('方向依据已变化');
 await page.goto('/');await page.getByRole('button',{name:'新建项目',exact:true}).click();await page.getByLabel('项目名称').fill('另一个项目');await page.getByRole('button',{name:'创建项目',exact:true}).click();await page.goto('/literature?mode=context');await expect(page.getByLabel('方向名称')).toHaveValue('');
});
