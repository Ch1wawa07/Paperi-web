import { readBoundedJSON } from '@/lib/ai-server';
import { discover, discoveryError, parseDiscovery } from '@/lib/discovery-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){
  const origin=request.headers.get('origin');
  let valid=false;try{const u=new URL(origin??'');valid=u.origin===origin&&u.host===request.headers.get('host')&&u.protocol===new URL(request.url).protocol;}catch{}
  if(!valid)return Response.json({error:'请从当前网站发起检索。'},{status:403});
  try{return Response.json(await discover(parseDiscovery(await readBoundedJSON(request,12000)),request.signal),{headers:{'Cache-Control':'no-store'}});}
  catch(e){const error=discoveryError(e);return Response.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}});}
}
