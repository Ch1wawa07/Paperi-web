import { ResearchMap } from '@/components/research-map';
export default async function Page({searchParams}:{searchParams:Promise<{view?:string}>}) {const {view}=await searchParams;return <ResearchMap initialMode={view==='context'?'context':'citations'}/>;}
