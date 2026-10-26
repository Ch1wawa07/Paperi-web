import {test,expect} from '@playwright/test';
import {pdfMetadataCandidates} from '../src/lib/pdf-metadata';
import {isGuide,emptyNavigation,mergeConcepts} from '../src/lib/research-navigation';
import {emptyWorkflow,isWorkflow,directionPlainText,sourceFingerprint} from '../src/lib/workflow';
import {parseSnapshot} from '../src/lib/projects';
test('正文元数据是有原文的候选；缺字段不填造；旧工作流和新方向卡兼容',()=>{
 const result=pdfMetadataCandidates(['题目：品牌态度的形成\n作者：张三、李四\n出版年：2024\n刊名：测试学术期刊\n摘要：'+ '这是一段明确标注的测试摘要。'.repeat(5)+'\n关键词：品牌；态度']);
 expect(result.fields).toMatchObject({title:'品牌态度的形成',authors:['张三','李四'],year:2024,venue:'测试学术期刊'});expect(result.evidence).toContain('[第 1 页]');
 expect(pdfMetadataCandidates(['这是没有身份字段的正文。']).fields.year).toBeUndefined();
 const f=emptyWorkflow();f.review=[{id:'old',title:'旧内容',body:'保留的用户编辑',evidenceIds:[],uncertainty:'待查',x:0,y:0}];
 const c={title:'研究方向',question:'拟研究什么',value:'为何研究',method:'待确认的访谈',limitations:'未证实',evidenceIds:[]};
 expect(isWorkflow({...f,direction:{text:directionPlainText(c,[]),card:c,evidenceIds:[],fingerprint:'x'}})).toBe(true);expect(isWorkflow(f)).toBe(true);
 const p={id:'old',name:'旧项目',discipline:'广告学',status:'starting' as const,observation:'想法',createdAt:'2026-10-26T00:00:00Z',updatedAt:'2026-10-26T00:00:00Z',workflow:f};
 expect(parseSnapshot(JSON.stringify({version:1,revision:0,activeId:'old',projects:[p]})).projects[0].workflow?.review[0].body).toBe('保留的用户编辑');
 expect(sourceFingerprint(p,false)).toBe(sourceFingerprint({...p,workflow:{...f,direction:{text:'选择后',evidenceIds:[],fingerprint:''}}},false));
});
test('12个可分组概念可读取，追加不覆盖用户编辑/排除；不是伪造学术推荐验收',()=>{
 const concepts=Array.from({length:12},(_,i)=>({term:`测试概念${i}`,explanation:'测试解释',everyday:'边界',uncertainty:'待文献核对',group:'测试分组',relevance:'测试关联'}));
 expect(isGuide({stage:'concepts',understanding:'',concepts,keywords:{zh:[],en:[]},threads:[]})).toBe(true);
 const n=emptyNavigation();n.concepts=[{...concepts[0],id:'keep',origin:'user',status:'excluded'}];
 expect(mergeConcepts(n.concepts,concepts)[0]).toEqual(n.concepts[0]);
});
