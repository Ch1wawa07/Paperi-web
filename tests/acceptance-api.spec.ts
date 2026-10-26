import {test,expect} from '@playwright/test';
import {importedPaper} from '../src/lib/bibliography';
test('共享故障真实HTTP复现（本地协议夹具，非真实DeepSeek）：截断/JSON/仅推理/建议与事实分开',async({playwright})=>{
 const base='http://127.0.0.1:3106';
 const r=await playwright.request.newContext({baseURL:base,extraHTTPHeaders:{Origin:base}});
 const body={task:'directions',observation:'品牌联名',direction:'',question:'',concepts:[],evidence:[{id:'a',paper:importedPaper({title:'协议测试文献',abstract:'测试原文中存在的一段研究介绍，仅用于本地协议验证。'}),pages:[]}]};
 try{
  for(const [question,message] of [['TRUNCATED','被截断'],['INVALID_JSON','结构解析失败'],['REASONING_ONLY','仅返回推理']]){
   const response=await r.post('/api/workflow',{data:{...body,question}});expect(response.status()).toBe(502);expect((await response.json()).error).toContain(message);
  }
  const proposal=await r.post('/api/workflow',{data:{...body,question:'BADQUOTE'}});
  expect(proposal.status()).toBe(200);const data=await proposal.json();
  expect(data.sections[0].body).not.toContain('无法从本次提供的原文核对');expect(data.sections[0].evidenceStatus).toBe('proposal');
  const review=await r.post('/api/workflow',{data:{...body,task:'review',question:'BADQUOTE'}});
  expect((await review.json()).sections[0]).toMatchObject({evidenceStatus:'insufficient',quote:''});
  const pdf=await r.post('/api/workflow',{data:{...body,task:'reading',evidence:[{...body.evidence[0],pages:[{page:8,text:'这是实际传入的测试正文方法部分，采用测试访谈，仅用于协议验证。'}]}]}});
  expect(pdf.status()).toBe(200);expect((await pdf.json()).sections[5]).toMatchObject({page:8,evidenceStatus:'verified'});
 }finally{await r.dispose();}
});
