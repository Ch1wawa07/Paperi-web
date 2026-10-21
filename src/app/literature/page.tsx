import { Literature } from '@/components/literature';
export const metadata = { title: '文献探索' };
export default async function Page({searchParams}:{searchParams:Promise<{query?:string|string[]}>}) {
  const {query}=await searchParams;
  return <Literature initialQuery={typeof query==='string'&&query.length<=200?query:undefined}/>;
}
