import { test,expect,type Page } from '@playwright/test';
import {emptyWorkflow} from '../../src/lib/workflow';
import {emptyExploration} from '../../src/lib/exploration';
import {emptyNavigation} from '../../src/lib/research-navigation';
import {readFileSync,mkdirSync} from 'node:fs';
async function setup(page:Page){
 await page.goto('/');
 await page.evaluate(({flow,exploration,navigation})=>{
  const at=new Date().toISOString();
  navigation.concepts=[{id:'c1',term:'心理逆反',explanation:'概念候选',everyday:'待查',uncertainty:'待查',status:'selected',origin:'user'},{id:'c2',term:'消费者态度',explanation:'概念候选',everyday:'待查',uncertainty:'待查',status:'selected',origin:'user'}];
  localStorage.setItem('paperi.projects.v1',JSON.stringify({version:1,revision:0,activeId:'acceptance',projects:[{id:'acceptance',name:'八项验收路径',observation:'反向营销为什么影响消费者态度',discipline:'广告学',status:'starting',createdAt:at,updatedAt:at,workflow:flow,exploration:{...exploration,navigation}}]}));
 },{flow:emptyWorkflow(),exploration:emptyExploration(),navigation:emptyNavigation()});
 await page.goto('/literature?concepts=1');
}
test('多选混合文件/坏文件独立失败；概念自动带入，精析零追问，失败后仍能保存结构并导出（AI模拟明确标注）',async({page})=>{
 await setup(page);
 await expect(page.getByLabel('检索使用的已选概念')).toContainText('心理逆反');
 await expect(page.getByRole('link',{name:'前往学校图书馆检索'}).first()).toHaveAttribute('href','https://www.lib.szu.edu.cn/');
 const input=page.getByLabel('选择题录或 PDF 文件');await expect(input).toHaveAttribute('multiple','');
 const ris=Buffer.from('TY  - JOUR\nTI  - 测试题录一\nAU  - 测试作者\nPY  - 2024\nJO  - 测试期刊\nER  -');
 await input.setInputFiles([{name:'test.ris',mimeType:'text/plain',buffer:ris},{name:'readable.pdf',mimeType:'application/pdf',buffer:readFileSync('tests/fixtures/workflow/readable.pdf')},{name:'unsupported.csv',mimeType:'text/csv',buffer:Buffer.from('bad format')}]);
 await expect(page.getByText('导入预览：2 篇可编辑，1 条失败')).toBeVisible();
 await expect(page.getByText(/unsupported.csv：不支持/)).toBeVisible();
 await page.getByRole('button',{name:'导入这 2 篇'}).click();
 await expect(page.locator('.paper-card')).toHaveCount(2);
 await page.getByRole('button',{name:'文献精析',exact:true}).first().click();
 await expect(page.getByLabel('追问或本次关注点')).not.toBeVisible();
 await page.getByLabel('选择精析文献').selectOption({index:1});
 let receivedPDF=false;
 await page.route('**/api/workflow',r=>{receivedPDF ||= r.request().postDataJSON().evidence.some((e:{pages:unknown[]})=>e.pages.length>0);return r.fulfill({status:502,json:{error:'本地测试夹具：AI 输出达到 token 上限，被截断，未保存。'}})});
 await page.getByRole('button',{name:'一键精析',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'被截断'})).toBeVisible();
 expect(receivedPDF).toBe(true);
 await page.goto('/review');await page.getByRole('button',{name:'生成综述结构候选'}).click();await expect(page.getByRole('alert').filter({hasText:'被截断'})).toBeVisible();
 await page.getByRole('button',{name:'生成可编辑结构草案（不调用 AI）'}).click();
 await expect(page.locator('.canvas-node')).toHaveCount(4);
 await page.getByRole('button',{name:'保存综述编辑'}).click();
 await page.reload();await expect(page.locator('.canvas-node')).toHaveCount(4);
 await page.getByRole('link',{name:'进入研究设计',exact:false}).click();
 await page.getByRole('button',{name:'添加节点',exact:true}).click();await page.getByLabel('名称',{exact:true}).fill('心理逆反');await page.getByRole('button',{name:'保存研究设计'}).click();
 await page.goto('/proposal');const dl=page.waitForEvent('download');await page.getByRole('button',{name:'导出完整研究框架 Markdown'}).click();expect((await dl).suggestedFilename()).toContain('研究框架');
});
test('拖入三份文件、缺标识星图明确缺数、方向保存刷新后保持纯净（模拟建议）',async({page})=>{
 await setup(page);
 await page.locator('.import-surface').evaluate(el=>{
  const data=new DataTransfer();for(let i=1;i<=3;i++)data.items.add(new File([`TY  - JOUR\nTI  - 中文无标识测试 ${i}\nAU  - 测试作者\nPY  - 2024\nJO  - 测试期刊\nER  -`],`test${i}.ris`,{type:'text/plain'}));
  el.dispatchEvent(new DragEvent('drop',{dataTransfer:data,bubbles:true,cancelable:true}));
 });
 await expect(page.getByText('导入预览：3 篇可编辑，0 条失败')).toBeVisible();await page.getByRole('button',{name:'导入这 3 篇'}).click();
 await page.getByRole('button',{name:'文献星图',exact:true}).click();
 await expect(page.locator('.citation-empty')).toContainText('3 篇缺少');await expect(page.locator('.canvas-edge')).toHaveCount(0);
 await expect(page.getByRole('link',{name:'核对并编辑文献元数据'})).toBeVisible();
 mkdirSync('docs/screenshots/acceptance',{recursive:true});await page.screenshot({path:'docs/screenshots/acceptance/citations-missing.png',fullPage:true});
 await page.route('**/api/workflow',r=>{const b=r.request().postDataJSON();return r.fulfill({json:{sections:[{title:'测试候选A',body:'拟研究消费者反应，尚待验证。',evidenceIds:[b.evidence[0].id],quote:'',page:null,uncertainty:'没有可核对引句，这是研究提议',evidenceStatus:'proposal'}]}})});
 await page.getByRole('button',{name:'研究脉络',exact:true}).click();await page.getByRole('button',{name:'一键生成研究方向'}).click();await page.getByRole('button',{name:'选择这个研究方向'}).click();
 await expect(page.getByLabel('我的研究方向')).toHaveValue('测试候选A\n拟研究消费者反应，尚待验证。');
 await page.reload();await page.getByRole('button',{name:'研究脉络',exact:true}).click();await expect(page.getByLabel('我的研究方向')).toHaveValue('测试候选A\n拟研究消费者反应，尚待验证。');
 await page.getByRole('link',{name:'进入文献综述与研究整合'}).click();await expect(page.locator('.profile-strip')).toContainText('测试候选A');await expect(page.locator('.profile-strip')).not.toContainText('无法从');
});
test('真实期刊社书目三篇导入至本地结构草案再导出，不宣称AI或外部引文成功',async({page})=>{
 await setup(page);
 await page.getByLabel('选择题录或 PDF 文件').setInputFiles('tests/fixtures/workflow/publisher-records.ris');
 await expect(page.getByText('导入预览：3 篇可编辑，0 条失败')).toBeVisible();
 await page.getByRole('button',{name:'导入这 3 篇'}).click();await expect(page.locator('.paper-card')).toHaveCount(3);
 await expect(page.locator('.paper-card')).toContainText(['人工智能营销：研究述评与展望','消费者心理逆反研究现状与展望','人工智能时代的个性化推荐']);
 await page.goto('/review');await page.getByRole('button',{name:'生成可编辑结构草案（不调用 AI）'}).click();await page.getByRole('button',{name:'保存综述编辑'}).click();await page.reload();await expect(page.locator('.canvas-node')).toHaveCount(4);
 await page.goto('/proposal');await expect(page.locator('.framework-preview')).toContainText('本地结构骨架，未调用 AI');await expect(page.locator('.framework-preview')).toContainText('人工智能时代的个性化推荐');
});
