import { test,expect } from '@playwright/test';
import {pdfExcerpts,cleanDirection,isFailedSection} from '../src/lib/workflow';
test('正文预算包含后部研究结果，保留真实页码；旧错误不作为研究主题',()=>{
 const pages=Array.from({length:40},(_,i)=>`${i===35?'研究结果与讨论':'正文'} ${i} `+'资料'.repeat(3000));
 const excerpts=pdfExcerpts(pages,24000);
 expect(excerpts.reduce((n,p)=>n+p.text.length,0)).toBeLessThanOrEqual(24000);
 expect(excerpts.some(p=>p.page===36)).toBe(true);
 expect(excerpts.some(p=>p.page===40)).toBe(true);
 expect(cleanDirection('方向A\n无法从本次提供的原文核对这一分析，请补充资料或重试。')).toBe('方向A');
 expect(isFailedSection({title:'A',body:'无法从本次提供的原文核对这一分析，请补充资料或重试。',evidenceIds:[],quote:'',page:null,uncertainty:''})).toBe(true);
});
