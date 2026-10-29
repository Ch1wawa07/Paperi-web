import {test,expect} from '@playwright/test';
import {readAIReply,isAIReply,type ReplyDiagnostic} from '../src/lib/exploration';
const minimal={reply:'已有有效聊天回复，合成测试。',guide:{stage:'phenomenon'}};
function parse(v:unknown){const issues:ReplyDiagnostic[]=[];const result=readAIReply(v,{stage:'phenomenon',report:i=>issues.push(i)});return {result,issues};}
test('可选字段省略保持聊天，不制造概念、引用、方向或确认；严格存储schema不放宽',()=>{
 const {result,issues}=parse(minimal);expect(result?.reply).toBe(minimal.reply);expect(result?.guide).toEqual({stage:'phenomenon',understanding:'',concepts:[],keywords:{zh:[],en:[]},threads:[]});expect(result?.directions).toEqual([]);expect(isAIReply(result)).toBe(true);expect(isAIReply(minimal)).toBe(false);expect(readAIReply(minimal)).toBeNull();expect(issues.map(i=>i.field)).toContain('guide.keywords.en');
});
test('仅补空展示字段，保留实际有效建议；缺核心解释或不确定性就舍弃建议',()=>{
 const {result,issues}=parse({...minimal,guide:{...minimal.guide,concepts:[{term:'测试',explanation:'真实返回的测试解释',uncertainty:'待核实'},{term:'没有解释'}],keywords:{zh:['用户材料',null],en:null}}});
 expect(result?.guide.concepts).toHaveLength(1);expect(result?.guide.concepts[0].everyday).toBe('');expect(result?.guide.keywords).toEqual({zh:['用户材料'],en:[]});expect(issues.some(i=>i.field==='guide.concepts[1]')).toBe(true);
});
for(const [field,v] of [
 ['reply',{...minimal,reply:''}],['guide.stage',{...minimal,guide:{}}],['guide.stage',{...minimal,guide:{stage:'questions'}}],['guide.threads',{...minimal,guide:{...minimal.guide,threads:[{title:'缺引用'}]}}],['directions',{...minimal,directions:[{title:'不完整'}]}],['guide.threads',{...minimal,guide:{...minimal.guide,threads:null}}],
] as const){test(`严格拒绝关键字段异常 ${field} ${JSON.stringify(v)}`,()=>{const {result,issues}=parse(v);expect(result).toBeNull();expect(issues.map(i=>i.field)).toContain(field);expect(JSON.stringify(issues)).not.toContain('已有有效聊天回复');});}
