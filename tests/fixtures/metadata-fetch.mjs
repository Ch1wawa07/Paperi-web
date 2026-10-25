// Test process preloader only; no fixture override or fallback is present in production app code.
import { readFileSync } from 'node:fs';
const records=JSON.parse(readFileSync(new URL('./metadata-records.json',import.meta.url),'utf8'));
const originalFetch=globalThis.fetch;
globalThis.fetch=async function(input,init){
  const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(!['api.openalex.org','api.crossref.org','doi.org'].includes(u.hostname))return originalFetch(input,init);
  if(u.hostname==='doi.org')return new Response(null,{status:302,headers:{Location:'https://example.org/fixture-resolved'}});
  const query=u.searchParams.get('search')??u.searchParams.get('query.bibliographic')??'';
  if(query.includes('fixture-rate'))return Response.json({error:'test rate limit'},{status:429});
  if(query.includes('fixture-malformed'))return Response.json({unexpected:true});
  if(query.includes('fixture-fallback')&&u.hostname==='api.openalex.org')return Response.json({error:'test auth required'},{status:401});
  if(u.hostname==='api.openalex.org' && !u.searchParams.has('search')){
    const center={...records.openalex,referenced_works:['https://openalex.org/W9999999911']};
    const ref={...records.openalex,id:'https://openalex.org/W9999999911',doi:'https://doi.org/10.5555/reference-fixture',display_name:'Reference fixture',referenced_works:[]};
    const citing={...records.openalex,id:'https://openalex.org/W9999999912',doi:'https://doi.org/10.5555/citing-fixture',display_name:'Citing fixture',referenced_works:[center.id]};
    if(u.pathname.includes('/works/'))return Response.json(center);
    if(u.searchParams.get('filter')?.startsWith('cites:'))return Response.json({results:[citing,{...ref,id:'https://openalex.org/W9999999913',referenced_works:[]}]});
    if(u.searchParams.get('filter')?.startsWith('openalex_id:'))return Response.json({results:[ref]});
  }
  if(u.pathname.startsWith('/works/')){
    const doi=decodeURIComponent(u.pathname.slice('/works/'.length)).toLowerCase();
    if(doi.includes('missing'))return Response.json({error:'test not found'},{status:404});
    if(doi.includes('mismatch'))return Response.json({message:records.crossref});
    return Response.json({message:{...records.crossref,DOI:doi}});
  }
  if(u.hostname==='api.openalex.org'){
    if(query==='fixture-options' && (!['is_retracted:false','has_doi:true','primary_location.source.is_core:true','primary_location.source.type:journal','type:article|review','from_publication_date:2000-01-01','to_publication_date:2025-12-31'].every(f=>u.searchParams.get('filter')?.split(',').includes(f)) || u.searchParams.get('sort')!=='publication_date:desc' || u.searchParams.get('page')!=='2'))return Response.json({error:'filter contract not transmitted'},{status:400});
    if(!u.searchParams.has('search')||u.searchParams.get('per-page')!=='10'||!u.searchParams.get('filter')?.includes('is_retracted:false'))return Response.json({error:'invalid adapter contract'},{status:400});
    const items=query.includes('fixture-empty')?[]:[records.openalex,{...records.openalex,is_retracted:true,id:'https://openalex.org/W9999999992',doi:'https://doi.org/10.5555/retracted-fixture'},records.openalex,{...records.openalex,id:'https://openalex.org/W9999999993',doi:'https://doi.org/10.5555/noncore-fixture',primary_location:{source:{display_name:'Noncore fixture',is_core:false}}},{display_name:'Invalid identifier fixture'}];
    return Response.json({meta:{count:items.length?34:0},results:items});
  }
  if(!u.searchParams.has('query.bibliographic')||u.searchParams.get('rows')!=='10')return Response.json({error:'invalid Crossref adapter contract'},{status:400});
  const items=query.includes('fixture-empty')?[]:[records.crossref,records.missing];
  return Response.json({message:{'total-results':items.length?24:0,items}});
};

// Official-schema Search/Fetch fixture. Synthetic pages only, never evidence of live success.
const scholarly=JSON.parse(readFileSync(new URL('./scholarly-records.json',import.meta.url),'utf8'));
const metadataFetch=globalThis.fetch;
globalThis.fetch=async function(input,init){
 const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
 if(u.href===scholarly.withDOI.url){const p=scholarly.withDOI;return new Response(`<head><meta name="citation_title" content="${p.title}">${p.authors.map(a=>`<meta name="citation_author" content="${a}">`).join('')}<meta name="citation_publication_date" content="${p.year}"><meta name="citation_journal_title" content="${p.venue}"><meta name="citation_doi" content="${p.doi}"></head>`,{headers:{'Content-Type':'text/html'}});}
 if(u.href===scholarly.withoutDOI.url)return new Response('Public detail text needs Fetch',{headers:{'Content-Type':'text/html'}});
 if(u.hostname==='jps.ecnu.edu.cn')return new Response('<h1>研究摘要、关键词并不构成出版身份</h1>',{headers:{'Content-Type':'text/html'}});
 if(u.hostname!=='api.deepseek.com')return metadataFetch(input,init);
 const body=JSON.parse(init.body);
 if(!String(init.headers.Authorization).includes('test-only-search-key'))throw new Error('Unexpected credential in fixture');
 const query=body.query??'';
 if((body.query&&[...query].length>128)||body.count>10)throw new Error('Invalid official request contract');
 if(u.pathname.endsWith('/search') && (body.need_content!==false||!/(?:期刊|学位|site:|scholarly)/.test(query)))throw new Error('Search must target academic records, not generic topic pages');
 const code=query.match(/fixture-status-(\d+)/)?.[1];if(code)return Response.json({error:'fixture only'},{status:Number(code)});
 if(query.includes('fixture-empty'))return Response.json({results:[]});
 if(u.pathname.endsWith('/fetch'))return Response.json({title:scholarly.withoutDOI.title,content:body.url===scholarly.withoutDOI.url?scholarly.withoutDOI.recordText:'普通网页研究摘要，不是论文'});
 if(query.includes('fixture-malformed'))return Response.json({unexpected:[]});
 const news=[{title:'抖音突然联手周星驰 一起发大财',url:'https://news.example.org/a',summary:'论文研究 摘要：营销资讯',authority:4,rerank_score:3},{title:'00后驰骋马栏山，AI短剧年产百部',url:'https://www.ecnu.edu.cn/news/123.html',content:'学术论文 研究摘要 作者：记者',authority:4}];
 if(query.includes('fixture-news-only'))return Response.json({results:news});
 return Response.json({results:[...news,{title:scholarly.withDOI.title,url:scholarly.withDOI.url,summary:'搜索简介不是论文摘要',authority:4},{title:scholarly.withoutDOI.title,url:scholarly.withoutDOI.url,summary:'网页只提供线索，身份必须从详情取得',authority:4},{title:'合成伪装学术页面',url:'https://jps.ecnu.edu.cn/CN/Y2024/V47/I2/999',content:'篇名：伪造搜索简介\n作者：搜索虚构作者\n出版年：2024\n刊名：测试期刊'},{title:'期刊介绍',url:'https://kns.cnki.net/about/123',summary:'论文摘要作者年份齐全也不是出版详情'}]});
};
