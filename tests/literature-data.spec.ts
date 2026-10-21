import { test, expect } from '@playwright/test';
import records from './fixtures/metadata-records.json';
import { mapCrossref, mapOpenAlex, deduplicate } from '../src/lib/literature-mapping';
import { doiURL, emptyLibrary, isLibrary, isPaper, normalizeDOI } from '../src/lib/literature';
const date='2026-10-21T08:00:00.000Z';

test('真实标识格式、跨源同 DOI 去重与合法历史 DOI 标点',()=>{
  const c=mapCrossref(records.crossref,date)!,o=mapOpenAlex(records.openalex,date)!;
  expect(c.doi).toBe(o.doi);expect(deduplicate([c,o])).toHaveLength(1);
  const legacy='10.1002/1520-6629(198601)14:1<6::AID-JCOP2290140103>3.0.CO;2-I';
  expect(normalizeDOI('https://doi.org/'+encodeURIComponent(legacy))).toBe(legacy.toLowerCase());
  expect(new URL(doiURL(legacy)).hostname).toBe('doi.org');
  expect(doiURL(legacy)).toContain('%3C');
  expect(normalizeDOI('not a doi')).toBeNull();
});
test('缺失作者年份摘要不补造；摘要来自原文且危险链接被拒绝',()=>{
  const p=mapCrossref(records.missing,date)!;
  expect(p.authors).toEqual([]);expect(p.year).toBeNull();expect(p.abstract).toBeNull();expect(p.venue).toBeNull();expect(p.citations).toBeNull();expect(p.sourceIsCore).toBeNull();
  expect(mapOpenAlex(records.openalex,date)!.abstract).toBe('Fixture algorithmic trust abstract.');
  const unsafe=mapCrossref({...records.crossref,URL:'javascript:alert(1)'},date)!;expect(unsafe.landingUrl).toBeNull();
  expect(mapCrossref({title:['无 DOI 的测试记录']},date)).toBeNull();
  expect(mapOpenAlex({...records.openalex,id:'https://untrusted.example/W123'},date)).toBeNull();
  expect(isPaper({...p,recordUrl:'https://untrusted.example/record'})).toBe(false);
});
test('文献库拒绝同 DOI 重复、无效分类和不完整来源；保持旧数据边界',()=>{
  const paper=mapCrossref(records.crossref,date)!;
  const item={id:'one',paper,categoryIds:['reading'],note:'自己的笔记',savedAt:date,updatedAt:date};
  const library={...emptyLibrary(),items:[item]};expect(isLibrary(library)).toBe(true);
  expect(isLibrary({...library,items:[item,{...item,id:'two'}]})).toBe(false);
  expect(isLibrary({...library,items:[{...item,categoryIds:['not-existing']}]})).toBe(false);
  expect(isLibrary({...library,items:[{...item,paper:{...paper,doi:'10.5555/other'}}]})).toBe(false);
});

test.describe('文献服务端适配器隔离集成验证（本地夹具，不是真实论文）',()=>{
  test.use({baseURL:'http://127.0.0.1:3102'});
  test('输入约束与固定数据源，拒绝无效范围和自定义外部地址',async({request})=>{
    for(const query of ['query=x','query=fixture&yearFrom=2025&yearTo=2000','query=fixture&page=99','query=fixture&provider=https://untrusted.example']) expect((await request.get('/api/literature?'+query)).status()).toBe(400);
  });
  test('OpenAlex 排序、过滤、去重、原始链接与有界缓存',async({request})=>{
    const url='/api/literature?query=fixture-cache&provider=openalex';
    const first=await request.get(url);expect(first.status()).toBe(200);const d=await first.json();expect(d.items).toHaveLength(1);expect(d.provider).toBe('openalex');expect(d.cached).toBe(false);expect(d.items[0].oaUrl).toBe('https://example.org/fixture-a.pdf');expect(JSON.stringify(d)).not.toContain('test-only-openalex-key');
    const options=await request.get('/api/literature?query=fixture-options&provider=openalex&sort=newest&yearFrom=2000&yearTo=2025&page=2');expect(options.status()).toBe(200);
    const cached=await(await request.get(url)).json();expect(cached.cached).toBe(true);expect(cached.items[0].retrievedAt).toBe(d.items[0].retrievedAt);
  });
  test('空结果与上游失败明确分开，不捏造论文',async({request})=>{
    const empty=await(await request.get('/api/literature?query=fixture-empty&provider=openalex')).json();expect(empty.items).toEqual([]);expect(empty.total).toBe(0);
    expect((await request.get('/api/literature?query=fixture-rate&provider=openalex')).status()).toBe(429);
    expect((await request.get('/api/literature?query=fixture-malformed&provider=openalex')).status()).toBe(502);
  });
  test('自动源切换明确标识 Crossref，保持原检索词与缺失字段',async({request})=>{
    const r=await request.get('/api/literature?query=fixture-fallback&provider=auto&coreOnly=false');expect(r.status()).toBe(200);const d=await r.json();expect(d.provider).toBe('crossref');expect(d.query).toBe('fixture-fallback');expect(d.notices.join(' ')).toContain('Crossref');expect(d.items[1].abstract).toBeNull();
  });
  test('核心来源要求不会因备用源缺少标记而静默放宽',async({request})=>{
    const r=await request.get('/api/literature?query=fixture-strict&provider=crossref');expect(r.status()).toBe(503);expect((await r.json()).error).toContain('没有放宽筛选');
    const d=await(await request.get('/api/literature?query=fixture-core&provider=openalex')).json();expect(d.items.every((p:{sourceIsCore:boolean})=>p.sourceIsCore===true)).toBe(true);
  });
  test('DOI 精确查登记与解析；404 和标识不一致不报告成功',async({request})=>{
    const r=await request.get('/api/literature/verify?doi=10.5555%2Fpaperi-fixture-a');expect(r.status()).toBe(200);const data=await r.json();expect(data.resolves).toBe(true);expect(data.paper.doi).toBe('10.5555/paperi-fixture-a');
    expect((await request.get('/api/literature/verify?doi=10.5555%2Fmissing-fixture')).status()).toBe(404);
    expect((await request.get('/api/literature/verify?doi=10.5555%2Fmismatch-fixture')).status()).toBe(502);
    expect((await request.get('/api/literature/verify?doi=javascript%3Aalert(1)')).status()).toBe(400);
    const exact=await(await request.get('/api/literature?query=10.5555%2Fpaperi-fixture-a')).json();expect(exact.items).toHaveLength(1);expect(exact.provider).toBe('crossref');
  });
  test('中英文建议只返回检索词，不生成论文或覆盖种子',async({request})=>{
    const seed={angle:'测试视角',workingQuestion:'测试问题？',concepts:['测试概念'],rawObservation:'测试观察',version:1,confirmedAt:date,sourceDirectionId:null};
    const r=await request.post('/api/literature/keywords',{headers:{Origin:'http://127.0.0.1:3102'},data:{seed}});expect(r.status()).toBe(200);const d=await r.json();expect(d.zh).toHaveLength(3);expect(d.en).toHaveLength(3);expect(d.items).toBeUndefined();
  });
});
