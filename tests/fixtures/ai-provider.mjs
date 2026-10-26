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
