// Test fixture only. This local process is never imported by the app or used as a production fallback.
import { createServer } from 'node:http';
const reply = text => JSON.stringify({ reply: `测试夹具回复：${text}`, directions: [0, 1].map(i => ({
  title: `测试候选 ${i + 1}`, description: '测试数据，不是真实 AI 研究建议', concepts: ['测试概念'],
  rationale: '仅用于验证接口和保存逻辑', question: `测试问题 ${i + 1}？`, uncertainties: ['测试待确认项'],
})) });
createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json');
  if (request.url === '/health') { response.end('{}'); return; }
  let raw = '';
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw);
  if(body.max_tokens===700 && body.model==='fixture-model' && body.response_format?.type==='json_object' && request.headers.authorization==='Bearer test-only-not-a-real-key') {
    response.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({zh:['测试主题','测试概念','测试对象'],en:['fixture topic','fixture concept','fixture population']})}}]})); return;
  }
  if (request.url !== '/v1/chat/completions' || request.headers.authorization !== 'Bearer test-only-not-a-real-key' ||
    body.model !== 'fixture-model' || body.max_tokens !== 1800 || body.response_format?.type !== 'json_object' ||
    body.messages?.[0]?.role !== 'system' || !body.messages[0].content.includes('不能声称已替用户修改')) {
    response.statusCode = 400; response.end('{"error":"incorrect adapter contract"}'); return;
  }
  const text = body.messages.at(-1).content;
  if (text === 'UPSTREAM_BALANCE') { response.statusCode = 402; response.end('{"error":"Insufficient Balance"}'); return; }
  if (text === 'UPSTREAM_UNAUTHORIZED') { response.statusCode = 401; response.end('{"error":"test-only-not-a-real-key"}'); return; }
  if (text === 'UPSTREAM_LIMIT') { response.statusCode = 429; response.end('{}'); return; }
  response.end(JSON.stringify({ choices: [{ finish_reason: text === 'UPSTREAM_TRUNCATED' ? 'length' : 'stop', message: { content: text === 'UPSTREAM_BADJSON' ? 'invalid-json' : reply(text) } }] }));
}).listen(3110, '127.0.0.1');
