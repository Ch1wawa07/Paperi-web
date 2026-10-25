import {test,expect} from '@playwright/test';
import records from './fixtures/metadata-records.json';
import {mapCrossref} from '../src/lib/literature-mapping';
import {isPaper,isScholarlyPaper,isLibrary,emptyLibrary,webKey} from '../src/lib/literature';
const base='http://127.0.0.1:3103';
const input=(query:string,language='auto')=>({query,language,concepts:['fixture concept'],question:'fixture question'});
test('未配置联网密钥时明确失败，不回退为元数据发现',async({request})=>{
 const r=await request.post('/api/literature/discover',{headers:{Origin:'http://127.0.0.1:3100'},data:input('自然语言研究问题')});expect(r.status()).toBe(503);expect(await r.text()).toContain('尚未配置');
});
test('请求约束和同源检查发生于调用前',async({request})=>{
 expect((await request.post(base+'/api/literature/discover',{data:input('fixture')})).status()).toBe(403);
 for(const data of [input('x'),input('a'.repeat(201)),input('fixture','invalid'),{...input('fixture'),concepts:['a'.repeat(81)]}])expect((await request.post(base+'/api/literature/discover',{headers:{Origin:base},data})).status()).toBe(400);
});
test('真实题录转录夹具：身份筛选剔除新闻，支持无DOI出版记录且缓存不丢来源',async({request})=>{
 const run=()=>request.post(base+'/api/literature/discover',{headers:{Origin:base},data:input('fixture-discovery')});
 const r=await run();expect(r.status()).toBe(200);const d=await r.json();expect(d.provider).toBe('deepseek');expect(d.items).toHaveLength(2);expect(d.items.every(isScholarlyPaper)).toBe(true);
 expect(d.items.some((p:{doi:string|null})=>p.doi===null)).toBe(true);
 for(const p of d.items){expect(p.citations).toBeNull();expect(p.abstract).toBeNull();expect(p.authors.length).toBeGreaterThan(0);expect(p.year).toBeTruthy();expect(p.venue).toBeTruthy();expect(p.identity).toBe('verified');}
 const at=new Date().toISOString();expect(isLibrary({...emptyLibrary(),items:d.items.map((paper:unknown,i:number)=>({id:String(i),paper,categoryIds:['reading'],note:'自己的笔记',savedAt:at,updatedAt:at}))})).toBe(true);
 const cached=await(await run()).json();expect(cached.cached).toBe(true);expect(cached.items).toEqual(d.items);expect(JSON.stringify(d)).not.toContain('test-only-search-key');
});
test('全是新闻/学术域名非论文页时，HTTP接口返回空结果且不凑数',async({request})=>{
 const r=await request.post(base+'/api/literature/discover',{headers:{Origin:base},data:input('fixture-news-only')});expect(r.status()).toBe(200);const d=await r.json();expect(d.items).toEqual([]);expect(d.total).toBe(0);expect(d.notices.join('')).toContain('本次搜索尚未找到可核实的学术文献');
});
test('网页身份不能借 DOI、来源权威度或引用次数伪装为已核实论文',()=>{
 const url='https://example.org/news';const p={key:webKey(url),title:'测试网页',authors:[],authorsTruncated:false,year:null,venue:null,sourceIsCore:null,kind:'参考网页',doi:null,openAlexId:null,abstract:null,abstractTruncated:false,citations:null,retracted:null,oaUrl:null,landingUrl:url,source:'deepseek',recordUrl:url,retrievedAt:new Date().toISOString(),identity:'webpage'};
 expect(isPaper(p)).toBe(true);for(const patch of [{citations:3},{doi:'10.5555/example'},{abstract:'伪摘要'},{year:2025},{authors:['伪作者']}])expect(isPaper({...p,...patch})).toBe(false);
});
test('401/402/403/429/504 分别返回且不伪造成功',async({request})=>{
 // Separate server has a 6-search/minute guard; this test is serial within one request budget.
 for(const code of [401,402,403,429,504]){const r=await request.post('http://127.0.0.1:3102/api/literature/discover',{headers:{Origin:'http://127.0.0.1:3102'},data:input('fixture-status-'+code,'zh')});expect(r.status()).toBe(code);const d=await r.json();expect(d.items).toBeUndefined();expect(d.error).toBeTruthy();}
});
test('普通网页即使意外进入响应，前端也不显示论文卡或收藏按钮',async({page})=>{
 const url='https://example.org/fixture-new-lead';
 const paper={key:webKey(url),title:'研究摘要行业新闻（夹具）',authors:[],authorsTruncated:false,year:null,venue:null,sourceIsCore:null,kind:'论文线索',doi:null,openAlexId:null,abstract:null,abstractTruncated:false,citations:null,retracted:null,oaUrl:null,landingUrl:url,source:'deepseek',recordUrl:url,retrievedAt:new Date().toISOString(),identity:'lead'};
 await page.route('**/api/literature/discover',r=>r.fulfill({json:{query:'fixture',provider:'deepseek',items:[paper],total:1,page:1,pageSize:10,notices:[],cached:false,hasMore:false}}));
 await page.goto('/literature');await page.getByLabel('文献关键词或 DOI').fill('fixture question');await page.getByRole('button',{name:'检索',exact:true}).click();await expect(page.getByRole('heading',{name:'本次搜索尚未找到可核实的学术文献。'})).toBeVisible();await expect(page.locator('.paper-card')).toHaveCount(0);await expect(page.getByRole('button',{name:'收藏文献',exact:true})).toHaveCount(0);
});
test('相关性失败显示上游原因，重试只评估已核实论文，不再次搜索',async({page})=>{
 const p=mapCrossref(records.crossref,new Date().toISOString())!;
 let searches=0,reviews=0;
 await page.route('**/api/literature/discover',r=>{searches++;return r.fulfill({json:{query:'fixture',provider:'deepseek',items:[p],total:1,page:1,pageSize:10,notices:[],cached:false,hasMore:false}});});
 await page.route('**/api/research',r=>{reviews++;expect(r.request().postDataJSON().context.evidence).toHaveLength(1);return reviews===1?r.fulfill({status:502,json:{error:'相关性模型返回格式不完整（测试）'}}):r.fulfill({json:{assessments:[{id:p.key,level:'direct',reason:'测试相关性理由',use:'理论背景',basis:p.title,limitation:'夹具测试，未读全文'}]}});});
 await page.goto('/literature');await page.getByLabel('文献关键词或 DOI').fill('fixture question');await page.getByRole('button',{name:'检索',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'论文身份核验已完成'})).toContainText('相关性模型返回格式不完整');await page.getByRole('button',{name:'重试相关性分析'}).click();await expect(page.locator('.assessment-direct')).toHaveCount(1);expect(searches).toBe(1);expect(reviews).toBe(2);await expect(page.getByRole('button',{name:'重试相关性分析'})).toHaveCount(0);
});
