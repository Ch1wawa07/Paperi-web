import { Literature } from '@/components/literature';
export const metadata = { title: '文献工作台' };
export default async function Page({searchParams}:{searchParams:Promise<{query?:string|string[];project?:string;concepts?:string;mode?:string;history?:string}>}) {
  const {query,project,concepts,mode,history}=await searchParams;
  return <Literature showHistory={history==='1'} initialMode={mode&&["library","import","reading","context"].includes(mode)?mode:"start"} requestProject={project} fromConcepts={concepts==='1'} initialQuery={typeof query==='string'&&query.length<=200?query:undefined}/>;
}
