import { Literature } from '@/components/literature';
export const metadata = { title: '文献工作台' };
export default async function Page({searchParams}:{searchParams:Promise<{query?:string|string[];project?:string;concepts?:string}>}) {
  const {query,project,concepts}=await searchParams;
  return <Literature requestProject={project} fromConcepts={concepts==='1'} initialQuery={typeof query==='string'&&query.length<=200?query:undefined}/>;
}
