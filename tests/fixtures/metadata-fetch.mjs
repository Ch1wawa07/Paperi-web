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
