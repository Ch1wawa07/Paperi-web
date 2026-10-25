import {test,expect} from '@playwright/test';
import {isPaper,isLibrary,emptyLibrary,webKey} from '../src/lib/literature';
const base='http://127.0.0.1:3103';
const input=(query:string,language='auto')=>({query,language,concepts:['fixture concept'],question:'fixture question'});
test('未配置联网密钥时明确失败，不回退为元数据发现',async({request})=>{
 const r=await request.post('/api/literature/discover',{headers:{Origin:'http://127.0.0.1:3100'},data:input('自然语言研究问题')});expect(r.status()).toBe(503);expect(await r.text()).toContain('尚未配置');
});
test('请求约束和同源检查发生于调用前',async({request})=>{
 expect((await request.post(base+'/api/literature/discover',{data:input('fixture')})).status()).toBe(403);
 for(const data of [input('x'),input('a'.repeat(201)),input('fixture','invalid'),{...input('fixture'),concepts:['a'.repeat(81)]}])expect((await request.post(base+'/api/literature/discover',{headers:{Origin:base},data})).status()).toBe(400);
});
test('官方协议夹具：中英交替、被引缺失、身份保守、缓存与旧存储兼容',async({request})=>{
 const run=()=>request.post(base+'/api/literature/discover',{headers:{Origin:base},data:input('fixture-discovery')});
 const r=await run();expect(r.status()).toBe(200);const d=await r.json();expect(d.provider).toBe('deepseek');expect(d.items).toHaveLength(10);expect(d.items.every(isPaper)).toBe(true);expect(d.items[0].identity).toBe('verified');expect(d.items[0].discoveryUrl).toContain('doi.org');
 expect(d.items.some((p:{title:string})=>p.title.startsWith('en'))).toBe(true);
 const leads=d.items.filter((p:{source:string})=>p.source==='deepseek');expect(leads.length).toBeGreaterThan(0);
 for(const p of leads){expect(p.citations).toBeNull();expect(p.year).toBeNull();expect(p.abstract).toBeNull();expect(p.authors).toEqual([]);expect(p.identity).toBe('lead');expect(isPaper({...p,identity:'verified'})).toBe(false);}
 const at=new Date().toISOString();expect(isLibrary({...emptyLibrary(),items:leads.map((paper:unknown,i:number)=>({id:String(i),paper,categoryIds:['reading'],note:'',savedAt:at,updatedAt:at}))})).toBe(true);
 const cached=await(await run()).json();expect(cached.cached).toBe(true);expect(cached.items).toEqual(d.items);expect(JSON.stringify(d)).not.toContain('test-only-search-key');
});
test('网页身份不能借 DOI、来源权威度或引用次数伪装为已核实论文',()=>{
 const url='https://example.org/news';const p={key:webKey(url),title:'测试网页',authors:[],authorsTruncated:false,year:null,venue:null,sourceIsCore:null,kind:'参考网页',doi:null,openAlexId:null,abstract:null,abstractTruncated:false,citations:null,retracted:null,oaUrl:null,landingUrl:url,source:'deepseek',recordUrl:url,retrievedAt:new Date().toISOString(),identity:'webpage'};
 expect(isPaper(p)).toBe(true);for(const patch of [{citations:3},{doi:'10.5555/example'},{abstract:'伪摘要'},{year:2025},{authors:['伪作者']}])expect(isPaper({...p,...patch})).toBe(false);
});
test('401/402/403/429/504 分别返回且不伪造成功',async({request})=>{
 // Separate server has a 6-search/minute guard; this test is serial within one request budget.
 for(const code of [401,402,403,429,504]){const r=await request.post(base+'/api/literature/discover',{headers:{Origin:base},data:input('fixture-status-'+code,'zh')});expect(r.status()).toBe(code);const d=await r.json();expect(d.items).toBeUndefined();expect(d.error).toBeTruthy();}
});
test('无 DOI 新线索收藏刷新后仍可读取，星图明确禁用无真实标识的记录',async({page})=>{
 const url='https://example.org/fixture-new-lead';
 const paper={key:webKey(url),title:'测试中文论文线索（非真实论文）',authors:[],authorsTruncated:false,year:null,venue:null,sourceIsCore:null,kind:'论文线索',doi:null,openAlexId:null,abstract:null,abstractTruncated:false,citations:null,retracted:null,oaUrl:null,landingUrl:url,source:'deepseek',recordUrl:url,retrievedAt:new Date().toISOString(),identity:'lead',webSummary:'夹具网页简介，身份尚未核实'};
 await page.route('**/api/literature/discover',r=>r.fulfill({json:{query:'fixture',provider:'deepseek',items:[paper],total:1,page:1,pageSize:10,notices:[],cached:false,hasMore:false}}));
 await page.goto('/');await page.getByRole('button',{name:'新建项目',exact:true}).click();await page.getByLabel('项目名称').fill('新来源项目');await page.getByRole('button',{name:'创建项目',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await page.goto('/literature');
 await page.getByLabel('文献关键词或 DOI').fill('fixture question');await page.getByRole('button',{name:'检索',exact:true}).click();await expect(page.locator('.paper-card')).toContainText('暂无被引数据');await expect(page.locator('.paper-card')).toContainText('论文线索 · 待核实');
 await page.getByRole('button',{name:'收藏文献',exact:true}).click();await page.getByRole('button',{name:'确认收藏',exact:true}).click();await page.reload();await page.getByRole('tab',{name:/我的文献库/}).click();await expect(page.locator('.paper-card')).toContainText(paper.title);
 await page.goto('/map');await expect(page.getByLabel('选择中心文献').locator('option').filter({hasText:paper.title})).toHaveAttribute('disabled','');await expect(page.getByLabel('选择中心文献')).toContainText('真实引用关系暂不可用');await expect(page.getByRole('button',{name:'展开真实引用'})).toBeDisabled();
});
