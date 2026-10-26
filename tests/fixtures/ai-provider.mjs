// Test fixture only. This local process is never imported by the app or used as a production fallback.
import { createServer } from 'node:http';
const reply = (text,context) => {
  const stage=context.stage??'phenomenon',ids=(context.evidence??[]).map(e=>e.id);
  return JSON.stringify({reply:`测试夹具回复：${text}`,guide:{stage,understanding:'测试现象梳理，非真实研究结论。',concepts:['phenomenon','concepts'].includes(stage)?[{term:'测试概念',explanation:'测试候选解释',everyday:'与日常用语的区别待查',uncertainty:'需要真实文献核实'}]:[],keywords:{zh:stage==='literature'?['测试概念 消费']:[],en:stage==='literature'?['fixture trust consumer']:[]},threads:stage==='context'&&ids.length?[{title:'测试脉络',description:'仅基于测试摘要',evidenceIds:ids,uncertainty:'未读全文'}]:[]},directions:stage==='questions'?[{title:'测试候选 1',description:'测试数据，不是真实 AI 研究建议',concepts:['测试概念'],rationale:'仅用于验证接口和保存逻辑',question:'测试问题 1？',uncertainties:['测试待确认项'],evidenceIds:ids}]:[]});
};
createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json');
  if (request.url === '/health') { response.end('{}'); return; }
  let raw = '';
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw);
  if (body.messages?.[0]?.content?.includes('Paperi staged research journey')) {
    const input = JSON.parse(body.messages[1].content), c = input.context, e = c.evidence[0], step = input.designStep ?? 'question';
    const respond = value => response.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]}));
    if (input.message === 'UPSTREAM_LIMIT') { response.statusCode=429; response.end('{}'); return; }
    if (input.message === 'UPSTREAM_BALANCE') { response.statusCode=402; response.end('{}'); return; }
    if (input.message === 'INVALID_JSON') { response.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'not-json'}}]})); return; }
    if (input.message === 'TRUNCATED') { response.end(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{"reply":'}}]})); return; }
    if (input.message === 'BAD_SHAPE') { respond({unexpected:'fixture bad shape'}); return; }
    if (input.task === 'context') {
      const quote = e.pages[0]?.text.slice(0, 80) || e.abstract || '';
      respond({sections:['总体研究什么','理论、主题与方法分组','已有发现、分歧与限制','可继续探索的切入口'].map((title,i)=>({title,body:'模拟跨篇归纳，仅验证产品流程，不是实际论文结论。',evidenceIds:[input.message==='FORGED'?'unknown':e.id],quote:input.message==='BADQUOTE'?'这是不存在于资料中的引句':quote,page:e.pages[0]?.page??null,uncertainty:'仅测试夹具，非真实AI能力',evidenceStatus:i===3?'proposal':'verified'}))}); return;
    }
    if (input.task === 'discussion') { respond({reply:`模拟项目讨论：${input.message || c.concepts.join('、') || c.observation}。已有${c.evidence.length}篇材料；${c.preferences || '偏好待用户确认'}。这是测试夹具，不是学术结论。`,quickQuestions:[`围绕${c.concepts[0]||'当前问题'}如何缩小对象？`,'这些材料还缺什么证据？','只做问卷时可以怎样取舍？']}); return; }
    if (input.task === 'directions') { respond({cards:[1,2].map(i=>({title:`模拟方向${i}`,question:`拟研究大学生的测试反应${i}，仅夹具`,value:'仅用于界面和保存测试',method:'拟用问卷，尚需真实方法核对',limitations:'模拟建议，不是文献验证',evidenceIds:[input.message==='FORGED'?'unknown':e.id],concepts:c.concepts.slice(0,2)}))}); return; }
    if (input.task === 'method') { respond({advice:'模拟方法比较：问卷讨论关联，访谈理解经验。用户自己选择；非真实AI建议。'}); return; }
    if (input.task === 'quantitative') {
      if (step==='question') respond({question:'模拟大学生研究问题？',value:'测试价值，非学术判断',evidenceGap:'待真实资料核查'});
      else if (step==='variables') respond({variables:[{id:'x',name:'测试广告理解',role:'X'},{id:'y',name:'测试品牌态度',role:'Y'},{id:'m',name:'测试心理反应',role:'M'}].map(v=>({...v,explanation:'测试变量解释',rationale:'仅测试候选',evidenceIds:[e.id],uncertainty:'待核查',confirmed:false}))});
      else if (step==='hypotheses') {const vars=c.quantitative.variables;respond({hypotheses:[{id:'h1',from:vars[0].id,to:vars[1].id,text:`${vars[0].name}与${vars[1].name}可能相关，待检验。`,rationale:'仅验证结构；横截面不能确证因果',evidenceIds:[e.id],confirmed:false},{id:'h2',from:vars[0].id,to:vars[2]?.id??vars[1].id,text:'测试第二个拟检验关系',rationale:'仅测试',evidenceIds:[e.id],confirmed:false}]});}
      else respond({method:'模拟问卷建议',target:'大学生测试群体',sampling:'可接触样本，非代表性保证',operationalization:'模拟测量思路，需核实量表',analysis:'模拟相关分析条件',limitations:'不能从横截面断言因果'});
      return;
    }
    if (input.task === 'qualitative') {
      if (step==='question') respond({question:'模拟：大学生如何理解广告？',value:'测试价值',evidenceGap:'待真实资料核查',target:'大学生',setting:'测试广告接触情境'});
      else if (step==='themes') respond({themes:[1,2,3].map(i=>({id:`t${i}`,title:`测试主题${i}`,explanation:'与测试问题的联系'}))});
      else if (step==='questions') respond({questions:[1,2,3,4,5].map((n,i)=>({id:`q${n}`,themeId:c.qualitative.themes[i%c.qualitative.themes.length].id,text:`请描述测试经历${n}？`}))});
      else respond({method:'模拟深度访谈',sampling:'模拟招募考虑',analysis:'模拟主题分析路线',ethics:'知情同意与匿名化',limitations:'小样本仅理解经验，不作总体推断'});
      return;
    }
  }
  if(body.messages?.[0]?.content?.includes('Paperi 研究工作流助手')){
    const input=JSON.parse(body.messages[1].content),e=input.evidence[0];
    if(['TRUNCATED','INVALID_JSON','REASONING_ONLY'].includes(input.question)){
      const message=input.question==='REASONING_ONLY'?{content:'',reasoning_content:'fixture reasoning only'}:{content:input.question==='INVALID_JSON'?'not json':'{"sections":['};
      response.end(JSON.stringify({choices:[{finish_reason:input.question==='TRUNCATED'?'length':'stop',message}]}));return;
    }
    const titles=input.task==='reading'?['30 秒读懂','研究问题与动机','理论与核心概念','研究方法与过程','关键发现与结论','局限与研究启发','对当前项目的价值']:['测试候选方向'];
    const sections=titles.map(title=>({title,body:'仅测试模型协议，不代表研究结论',evidenceIds:[input.question==='FORGED'?'unknown':e.id],quote:input.question==='BADQUOTE'?'不存在的原文':e.pages?.[0]?.text||e.abstract||e.title,page:e.pages?.[0]?.page??null,uncertainty:'测试限制'}));
    response.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({sections,...(input.task==='directions'?{synthesis:sections,cards:[{title:'测试方向A',question:'拟比较测试反应',value:'仅测试协议',method:'待实际核对',limitations:'测试夹具，非学术结论',evidenceIds:[e.id]}]}:{})})}}]}));return;
  }
  if(body.messages?.[0]?.content?.includes('你是 Paperi 人文社科研究助手')){
    const system=body.messages[0].content,input=JSON.parse(body.messages[1].content),context=input.context??input;
    let value;
    if(system.includes('逐篇审查相关性'))value={assessments:context.evidence.map(e=>({id:e.id,level:e.title.includes('irrelevant')?'unrelated':'direct',reason:'测试相关性理由',use:'理论背景',basis:e.title,limitation:'测试数据，未读全文'}))};
    else if(system.includes('只给有来源'))value={threads:[{title:'测试脉络',kind:'主题',body:'测试摘要归纳，非真实研究结论',evidenceIds:[context.evidence[0].id],uncertainty:'未读全文'}]};
    else if(system.includes('个可编辑节点'))value={nodes:[{id:'n1',kind:'研究问题',title:'测试候选问题',body:'测试研究内容',evidenceIds:context.evidence.map(e=>e.id),uncertainty:'待核实'}],edges:[]};
    else value={zh:['测试信任 消费','测试推荐 商业'],en:['fixture trust consumer','fixture advertising persuasion']};
    if(input.query==='FORGED')value={assessments:[{id:'forged',level:'direct',reason:'假引用测试',use:'不应通过',basis:'不存在',limitation:'测试'}]};
    response.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]}));return;
  }
  if(body.max_tokens===700 && body.messages?.[0]?.content?.includes('Paperi 的双语检索词助手')) {response.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({reply:'测试独立检索组合',zh:['测试概念 消费','测试概念 对象'],en:['fixture trust consumer','fixture concept study']})}}]}));return;}
  if(body.max_tokens===700 && body.model==='fixture-model' && body.response_format?.type==='json_object' && request.headers.authorization==='Bearer test-only-not-a-real-key') {
    response.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({zh:['测试主题','测试概念','测试对象'],en:['fixture topic','fixture concept','fixture population']})}}]})); return;
  }
  if (request.url !== '/v1/chat/completions' || request.headers.authorization !== 'Bearer test-only-not-a-real-key' ||
    body.model !== 'fixture-model' || body.max_tokens !== 5000 || body.response_format?.type !== 'json_object' ||
    body.messages?.[0]?.role !== 'system' || !body.messages[0].content.includes('不能声称已替用户修改')) {
    response.statusCode = 400; response.end('{"error":"incorrect adapter contract"}'); return;
  }
  const text = body.messages.at(-1).content;
  const context=JSON.parse(body.messages[1].content.slice(body.messages[1].content.indexOf('{')));
  if (text === 'UPSTREAM_BALANCE') { response.statusCode = 402; response.end('{"error":"Insufficient Balance"}'); return; }
  if (text === 'UPSTREAM_UNAUTHORIZED') { response.statusCode = 401; response.end('{"error":"test-only-not-a-real-key"}'); return; }
  if (text === 'UPSTREAM_LIMIT') { response.statusCode = 429; response.end('{}'); return; }
  const generated=JSON.parse(reply(text,context));
  if(text==='UPSTREAM_NESTED'){generated.guide.directions=generated.directions;delete generated.directions;}
  if(text==='UPSTREAM_BADREF')generated.guide.threads=[{title:'测试非法引用',description:'应被拒绝',evidenceIds:['not-provided'],uncertainty:'测试'}];
  response.end(JSON.stringify({ choices: [{ finish_reason: text === 'UPSTREAM_TRUNCATED' ? 'length' : 'stop', message: { content: text === 'UPSTREAM_EMPTY' ? '   ' : text === 'UPSTREAM_BADJSON' ? 'invalid-json' : JSON.stringify(generated) } }] }));
}).listen(3110, '127.0.0.1');
