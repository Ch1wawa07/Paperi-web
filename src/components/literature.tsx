'use client';

import Link from 'next/link';
import { useEffect, useEffectEvent, useId, useRef, useState, type ReactNode } from 'react';
import { isRecord } from '@/lib/exploration';
import { crossrefRecordURL, doiURL, emptyLibrary, isPaper, isSearchResults, samePaper, type Category, type KeywordSuggestions, type Library, type Paper, type SavedPaper, type SearchOptions, type SearchResults } from '@/lib/literature';
import type { Project } from '@/lib/projects';
import { useProjects } from './project-provider';
import { emptyWorkbench, selectedConcepts, researchContext, profileFingerprint, isAssessments, type Assessment } from '@/lib/workbench';
import { WorkspaceToolbar, ProfileStrip, EvidencePicker, researchFetch } from './workspace-common';
import { Icon, LoadingState } from './ui';

const initialSearch = (project?: Project, query?:string): SearchOptions => ({ query: query ?? project?.workbench?.search?.input ?? (project ? selectedConcepts(project).slice(0,2).join(' ') : ''), provider:'auto',sort:'relevance',yearFrom:'',yearTo:'',journalsOnly:false,doiOnly:false,coreOnly:false,page:1 });
const sourceName = (p: Paper) => p.source === 'openalex' ? 'OpenAlex' : 'Crossref';
const kindName = (kind: string) => ({ article: '文章', review: '综述', 'journal-article': '期刊文章', 'book-chapter': '书籍章节', 'proceedings-article': '会议论文', preprint: '预印本', 'posted-content': '预发布内容' } as Record<string,string>)[kind] ?? kind;
const fold = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');

export function Literature({initialQuery,requestProject,fromConcepts=false}:{initialQuery?:string;requestProject?:string;fromConcepts?:boolean}) {
  const {ready,snapshot,error}=useProjects();const project=snapshot.projects.find(p=>p.id===snapshot.activeId);
  return <div className="module-page module-literature"><WorkspaceToolbar title="文献探索" project={project}/>{!ready?error?<p>{error}</p>:<LoadingState/>:<BoundLiterature project={project} initialQuery={initialQuery} requestProject={requestProject} fromConcepts={fromConcepts}/>}</div>;
}
function BoundLiterature({project,initialQuery,requestProject,fromConcepts}:{project?:Project;initialQuery?:string;requestProject?:string;fromConcepts:boolean}){
 const [binding]=useState(project?.id??'browse');const matches=(requestProject??binding)===(project?.id??'browse');
 return <LiteratureWorkspace key={project?.id??'browse'} project={project} initialQuery={matches?initialQuery:undefined} fromConcepts={matches&&fromConcepts}/>;
}

function LiteratureWorkspace({ project, initialQuery,fromConcepts }: { project?: Project;initialQuery?:string;fromConcepts:boolean }) {
  const { busy, saveLibrary,saveWorkbench } = useProjects();
  const workbench=project?.workbench??emptyWorkbench();
  const fingerprint=project?profileFingerprint(project):'';
  const [origin,setOrigin]=useState(initialQuery?'带入的临时检索':fromConcepts?'当前项目概念':workbench.search?'本项目上次检索':'当前项目概念');
  const [language,setLanguage]=useState<'auto'|'zh'|'en'>('auto');
  const [assessments,setAssessments]=useState<Assessment[]>([]);
  const [showOthers,setShowOthers]=useState(false);
  const [notice,setNotice]=useState('');
  const autoRequested=useRef(false);
  const library = project?.library ?? emptyLibrary();
  const seed = project?.exploration?.seed;
  const [view, setView] = useState<'search'|'saved'>('search');
  const [draft, setDraft] = useState<SearchOptions>(()=>initialSearch(project,fromConcepts&&project?selectedConcepts(project).slice(0,2).join(' '):initialQuery));
  const [activeSearch, setActiveSearch] = useState<SearchOptions | null>(null);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false), [generating, setGenerating] = useState(false);
  const [keywords, setKeywords] = useState<KeywordSuggestions | null>(workbench.search?.keywords??null);
  const [aiConfigured, setAIConfigured] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('all'), [localQuery, setLocalQuery] = useState('');
  const [librarySort, setLibrarySort] = useState('saved');
  const [editor, setEditor] = useState<{ paper: Paper; existing?: SavedPaper; revision: number } | null>(null);
  const [categoryEditor, setCategoryEditor] = useState<{ category?: Category; revision: number } | null>(null);
  const [removal, setRemoval] = useState<{ item?: SavedPaper; category?: Category; revision: number } | null>(null);
  const mounted = useRef(false), searchingRef = useRef(false), generatingRef = useRef(false);
  const controllers = useRef(new Set<AbortController>());
  useEffect(()=>{
    mounted.current = true; const controller = new AbortController(); const all = controllers.current;
    all.add(controller);
    fetch('/api/lab',{ signal: controller.signal, cache: 'no-store' }).then(r=>r.json()).then((data: unknown)=>{ if (mounted.current && isRecord(data)) setAIConfigured(data.configured===true); }).catch(()=>{}).finally(()=>all.delete(controller));
    return ()=>{ mounted.current=false; for (const c of all) c.abort(); all.clear(); };
  },[]);

  const context=project?researchContext(project):{observation:'',question:'',concepts:[],messages:[],evidence:[]};
  async function search(options:SearchOptions, multiple=false){
    if(searchingRef.current)return;searchingRef.current=true;setSearching(true);setError('');setResults(null);setAssessments([]);setActiveSearch(options);
    const controller=new AbortController();controllers.current.add(controller);
    try{
      let queries=[options.query],usedKeywords=keywords;
      if(language==='auto'&&/[\u3400-\u9fff]/.test(options.query)&&aiConfigured){const k=await researchFetch({task:'keywords',context,query:options.query},controller.signal);setKeywords(k);usedKeywords=k;queries=k.en.slice(0,2);}
      else if(multiple&&keywords)queries=keywords[language==='zh'?'zh':'en'].slice(0,2);
      const responses=await Promise.allSettled(queries.map(async query=>{const params=new URLSearchParams(Object.entries({...options,query}).map(([k,v])=>[k,String(v)]));const r=await fetch(`/api/literature?${params}`,{signal:controller.signal,cache:'no-store'});const d:unknown=await r.json();if(!r.ok)throw new Error(isRecord(d)&&typeof d.error==='string'?d.error:'检索失败。');if(!isSearchResults(d))throw new Error('文献数据格式不完整。');return d;}));
      const ok=responses.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);if(!ok.length)throw new Error(responses[0].status==='rejected'?responses[0].reason.message:'没有取得来源记录。');
      const unique:Paper[]=[];for(let i=0;i<10;i++)for(const r of ok){const paper=r.items[i];if(paper&&!unique.some(p=>samePaper(p,paper)))unique.push(paper);}
      const merged:SearchResults={...ok[0],total:ok.reduce((n,r)=>n+r.total,0),query:queries.join(' / '),items:unique.slice(0,10),hasMore:queries.length===1&&ok[0].hasMore,notices:[...new Set(ok.flatMap(r=>r.notices)),...queries.map(q=>'实际检索词：'+q),'实际数据源：'+[...new Set(ok.map(r=>r.provider))].join('、'),...(queries.length>1?['按各组查询交替取样并去重，本次最多复核10篇；命中总数包含来源之间的重叠，不是相关论文总数。']:[]),...(responses.some(r=>r.status==='rejected')?['部分检索请求失败，仅展示成功返回的来源记录。']:[])]};
      if(!mounted.current)return;setResults(merged);
      if(aiConfigured&&merged.items.length){try{const reviewed=await researchFetch({task:'assess',query:options.query,context:{...context,evidence:merged.items.map(p=>({id:p.key,paper:p}))}},controller.signal);if(!isAssessments(reviewed.assessments))throw new Error('评估结构不完整。');if(mounted.current)setAssessments(reviewed.assessments);}catch(e){if(mounted.current)setError('真实题录已取得，但相关性尚未评估：'+(e instanceof Error?e.message:'请重试。'));}}
      if(project&&mounted.current)await saveWorkbench(project.id,workbench.revision,{...workbench,search:{input:options.query,origin:'manual',fingerprint,keywords:usedKeywords??{zh:[],en:[]},history:[...new Set([options.query,...(workbench.search?.history??[])])].slice(0,12)}});
    }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'检索连接中断。');}finally{controllers.current.delete(controller);searchingRef.current=false;if(mounted.current)setSearching(false);}
  }
  async function suggestKeywords(){
    if(!aiConfigured||generatingRef.current)return;generatingRef.current=true;setGenerating(true);setError('');const controller=new AbortController();controllers.current.add(controller);
    try{const d=await researchFetch({task:'keywords',context,query:fromConcepts?'':draft.query},controller.signal);if(mounted.current){setKeywords(d);if(project)await saveWorkbench(project.id,workbench.revision,{...workbench,search:{input:workbench.search?.input??'',origin:'concepts',fingerprint,keywords:d,history:workbench.search?.history??[]}});}}
    catch(e){if(mounted.current)setError(e instanceof Error?e.message:'检索建议暂未生成。');}finally{controllers.current.delete(controller);generatingRef.current=false;if(mounted.current)setGenerating(false);}
  }
  const autoSuggest=useEffectEvent(()=>{if(!autoRequested.current){autoRequested.current=true;void suggestKeywords();}});
  useEffect(()=>{if(fromConcepts&&aiConfigured)autoSuggest();},[fromConcepts,aiConfigured]); // explicit cross-page action; no automatic search
  async function persist(next: Library, revision: number) {
    if (!project) { setError('请先创建研究项目，再收藏文献。'); return false; }
    setError(''); const ok=await saveLibrary(project.id,revision,next);
    if (!ok) setError('本次文献库修改没有保存。请处理上方的存储或其他页面更新提示，编辑内容仍保留在窗口中。');
    return ok;
  }
  async function saveItem(categoryIds: string[], note: string) {
    if (!editor || library.revision!==editor.revision) { setError('文献库已更新，请取消并重新打开编辑，避免覆盖其他页面的修改。'); return false; }
    if (!editor.existing && library.items.some(i=>samePaper(i.paper,editor.paper))) { setError('这篇文献已在当前项目收藏中，请重新打开管理。'); return false; }
    const now=new Date().toISOString();
    const item: SavedPaper={ id:editor.existing?.id ?? crypto.randomUUID(), paper:editor.existing?.paper ?? editor.paper, categoryIds,note,savedAt:editor.existing?.savedAt ?? now,updatedAt:now };
    const ok=await persist({...library,items:editor.existing ? library.items.map(i=>i.id===item.id ? item : i) : [item,...library.items]},editor.revision);
    if(ok) setEditor(null); return ok;
  }
  async function saveCategory(name: string) {
    if (!categoryEditor || library.revision!==categoryEditor.revision) { setError('分类已在其他页面更新，请取消并重新打开。'); return false; }
    if (library.categories.some(c=>c.name.trim().toLowerCase()===name.toLowerCase() && c.id!==categoryEditor.category?.id)) { setError('当前研究已有同名分类，请使用其他名称。'); return false; }
    const categories=categoryEditor.category ? library.categories.map(c=>c.id===categoryEditor.category!.id ? {...c,name} : c) : [...library.categories,{id:crypto.randomUUID(),name}];
    const ok=await persist({...library,categories},categoryEditor.revision); if(ok) setCategoryEditor(null); return ok;
  }
  async function confirmRemoval() {
    if (!removal || library.revision!==removal.revision) { setError('文献库已更新，请取消后重新操作。'); return false; }
    const id=removal.category?.id;
    const next=id ? {...library,categories:library.categories.filter(c=>c.id!==id),items:library.items.map(i=>i.categoryIds.includes(id) ? {...i,categoryIds:i.categoryIds.filter(c=>c!==id),updatedAt:new Date().toISOString()} : i)} : {...library,items:library.items.filter(i=>i.id!==removal.item?.id)};
    const ok=await persist(next,removal.revision); if(ok) { setRemoval(null); if(id===category)setCategory('all'); } return ok;
  }
  function openItem(paper: Paper) { setError(''); setEditor({paper,existing:library.items.find(i=>samePaper(i.paper,paper)),revision:library.revision}); }
  const selectedCategory=category==='uncategorized' || library.categories.some(c=>c.id===category) ? category : 'all';
  const filtered=library.items.filter(i=>(selectedCategory==='all' || selectedCategory==='uncategorized' ? selectedCategory!=='uncategorized' || !i.categoryIds.length : i.categoryIds.includes(selectedCategory)) &&
    [i.paper.title,...i.paper.authors,i.paper.venue??'',i.note].join(' ').toLowerCase().includes(localQuery.trim().toLowerCase())).slice().sort((a,b)=>librarySort==='year' ? (b.paper.year??0)-(a.paper.year??0) : librarySort==='title' ? a.paper.title.localeCompare(b.paper.title,'zh-CN') : (librarySort==='updated' ? b.updatedAt.localeCompare(a.updatedAt) : b.savedAt.localeCompare(a.savedAt)));
  return <>
    {project&&<ProfileStrip project={project}/>}
    {seed&&<details className="literature-seed"><summary>已确认研究问题</summary><p>{seed.workingQuestion}</p></details>}
    <div className="literature-tabs" role="tablist" aria-label="文献工作区"><button id="search-tab" role="tab" aria-selected={view==='search'} aria-controls="literature-panel" onClick={()=>setView('search')}>检索文献</button><button id="saved-tab" role="tab" aria-selected={view==='saved'} aria-controls="literature-panel" onClick={()=>setView('saved')}>我的文献库<span>{library.items.length}</span></button></div>
    {error && <p className="literature-error" role="alert">{error}</p>}
    <section id="literature-panel" role="tabpanel" aria-labelledby={view==='search'?'search-tab':'saved-tab'}>
    {view==='search' ? <>
      <section className="literature-search frosted-surface" aria-label="真实文献检索">
        <div className="literature-search-heading"><div><span className="eyebrow">FIND YOUR EVIDENCE</span><h2>让问题，找到依据。</h2></div><button className="button secondary" disabled={!aiConfigured || generating || searching} onClick={()=>void suggestKeywords()}>{generating?'正在生成…':'生成中英文检索词'}<Icon name="spark" size={16}/></button></div>
        <p className="muted search-assistance">{!aiConfigured?'AI 尚未配置，可直接检索真实来源；相关性需人工核对。':'输入中文可自动生成英文短查询；建议不会覆盖手动输入。AI 复核仅依据题名与可用摘要。'}</p>
        {workbench.search&&workbench.search.fingerprint!==fingerprint&&<p className="source-notice">概念或问题已变化，检索建议需要更新。</p>}
        {keywords&&<details className="keyword-suggestions" open={fromConcepts}><summary>本项目检索建议 · 点击使用一组</summary>{(['zh','en'] as const).map(lang=><div key={lang}><strong>{lang==='zh'?'中文':'English'}</strong><div>{keywords[lang].map(term=><button key={term} onClick={()=>{setDraft({...draft,query:term});setOrigin('当前项目推荐词');setLanguage(lang);}}>{term}</button>)}</div></div>)}<button className="text-button" disabled={searching} onClick={()=>void search({...draft,page:1},true)}>分别检索前两组并去重</button></details>}

        <form onSubmit={e=>{e.preventDefault();void search({...draft,page:1});}}>
          <label className="sr-only" htmlFor="literature-query">文献关键词或 DOI</label><div className="literature-query-row"><input id="literature-query" required minLength={2} maxLength={200} value={draft.query} onChange={e=>{setDraft({...draft,query:e.target.value});setOrigin('手动输入');}} placeholder="例如 algorithmic trust，或输入完整 DOI"/><button className="button primary" disabled={searching || draft.query.trim().length<2}>{searching?'正在检索…':'检索'}<Icon name="arrow" size={16}/></button></div>
          <div className="search-mode"><label>检索语言<select aria-label="检索语言" value={language} onChange={e=>setLanguage(e.target.value as typeof language)}><option value="auto">智能中英转换</option><option value="zh">仅中文（覆盖有限）</option><option value="en">仅英文</option></select></label><span>输入来源：{origin}</span></div><details className="advanced-filters"><summary>高级筛选</summary><div className="search-filters"><label>排序<select aria-label="排序" value={draft.sort} onChange={e=>setDraft({...draft,sort:e.target.value as SearchOptions['sort']})}><option value="relevance">相关性优先</option><option value="newest">最新发表</option><option value="citations">被引次数</option></select></label><label>数据源<select aria-label="数据源" value={draft.provider} onChange={e=>{const provider=e.target.value as SearchOptions['provider'];setDraft({...draft,provider,coreOnly:provider==='crossref'?false:draft.coreOnly});if(provider==='crossref')setNotice('Crossref 不支持该来源筛选，已为你关闭。');}}><option value="auto">自动（OpenAlex 优先）</option><option value="openalex">OpenAlex</option><option value="crossref">Crossref</option></select></label><label>起始年份<input aria-label="起始年份" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={draft.yearFrom} onChange={e=>setDraft({...draft,yearFrom:e.target.value})} placeholder="不限"/></label><label>结束年份<input aria-label="结束年份" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={draft.yearTo} onChange={e=>setDraft({...draft,yearTo:e.target.value})} placeholder="不限"/></label></div>
          <div className="search-checks"><label><input type="checkbox" checked={draft.journalsOnly} onChange={e=>setDraft({...draft,journalsOnly:e.target.checked})}/>仅期刊文章</label><label><input type="checkbox" checked={draft.doiOnly} onChange={e=>setDraft({...draft,doiOnly:e.target.checked})}/>仅有 DOI</label><label><input type="checkbox" checked={draft.coreOnly} disabled={draft.provider==='crossref'} onChange={e=>setDraft({...draft,coreOnly:e.target.checked})}/>仅 CWTS 核心来源</label><span>修改筛选后点击检索生效</span></div></details>{notice&&<p className="source-notice">{notice}</p>}
        </form>
      </section>
      <p className="search-integrity">相关性优先；被引次数、DOI 和来源标记不代表单篇质量。中文覆盖有限，DOI 可直接导入真实题录。评估失败或缺少证据时不标为直接相关。</p>
      {!!workbench.search?.history.length&&<details><summary>本项目检索历史</summary><div className="workspace-actions">{workbench.search.history.map(q=><button className="text-button" key={q} onClick={()=>{setDraft({...draft,query:q});setOrigin('本项目历史');}}>{q}</button>)}</div></details>}

      {searching && <div className="literature-loading" role="status"><span className="spinner"/>正在向真实学术数据源检索…</div>}
      {results && <><div className="literature-results-heading"><div><h2>「{results.query}」</h2><span>{results.provider==='openalex'?'OpenAlex':'Crossref'} · 数据源命中 {results.total.toLocaleString('zh-CN')} 条，本页 {results.items.length} 条{results.cached?' · 缓存结果':''}</span></div><span>第 {results.page} 页</span></div>{results.notices.map(n=><p className="source-notice" key={n}>{n}</p>)}
        {!results.items.length && <div className="literature-empty"><Icon name="book" size={28}/><h3>{results.total?'本页没有可展示的完整记录':'没有找到匹配记录'}</h3><p>试试更明确的关键词、英文词，或放宽年份筛选。不会用无关论文填充结果。</p></div>}
        {assessments.length>0&&!assessments.some(a=>a.level==='direct')&&<p className="source-notice">本批未识别出直接相关研究。可以换用另一组短查询或仅保留核心理论与情境。背景文献仅作为理论 / 方法线索，不能据此证明研究空白。</p>}<button className="text-button" onClick={()=>setShowOthers(!showOthers)}>{showOthers?'收起低相关 / 信息不足记录':'查看低相关 / 信息不足记录'}</button><div className="paper-list">{results.items.filter(p=>showOthers||!assessments.length||['direct','background'].includes(assessments.find(a=>a.id===p.key)?.level??'insufficient')).sort((a,b)=>{const rank=(p:Paper)=>({direct:0,background:1,insufficient:2,unrelated:3}[assessments.find(x=>x.id===p.key)?.level??'insufficient']);return rank(a)-rank(b);}).map(p=><PaperCard assessment={assessments.find(a=>a.id===p.key)} key={p.key} paper={p} saved={library.items.find(i=>samePaper(i.paper,p))} categories={library.categories} query={results.query} onManage={()=>openItem(p)} canSave={!!project} disabled={busy}/>)}</div>
        <div className="literature-pagination"><button className="button secondary" disabled={searching || results.page<=1} onClick={()=>activeSearch && void search({...activeSearch,page:results.page-1})}>上一页</button><span>最多浏览前 5 页，可细化关键词缩小范围</span><button className="button secondary" disabled={searching || !results.hasMore} onClick={()=>activeSearch && void search({...activeSearch,page:results.page+1})}>下一页</button></div></>}
      {!results && !searching && <div className="literature-empty"><Icon name="book" size={28}/><h3>先找真实，再读深入。</h3><p>搜索结果将显示作者、来源与可追溯记录；缺少的摘要和全文会如实标明。</p>{error && activeSearch && <button className="text-button" onClick={()=>void search(activeSearch)}>重试本次检索</button>}</div>}
    </> : <div className="library-layout">
      <aside className="library-sidebar frosted-surface"><span className="eyebrow">YOUR RESEARCH LIBRARY</span><h2>按研究整理</h2><p>{project?.name ?? '请先创建研究项目'}</p><div className="category-list"><button className={selectedCategory==='all'?'active':''} onClick={()=>setCategory('all')}>全部收藏<span>{library.items.length}</span></button><button className={selectedCategory==='uncategorized'?'active':''} onClick={()=>setCategory('uncategorized')}>未分类<span>{library.items.filter(i=>!i.categoryIds.length).length}</span></button>{library.categories.map(c=><div className="category-row" key={c.id}><button className={selectedCategory===c.id?'active':''} onClick={()=>setCategory(c.id)}>{c.name}<span>{library.items.filter(i=>i.categoryIds.includes(c.id)).length}</span></button><button className="category-action" disabled={busy || !project} aria-label={`重命名分类 ${c.name}`} onClick={()=>{setError('');setCategoryEditor({category:c,revision:library.revision});}}>改名</button><button className="category-action" disabled={busy || !project} aria-label={`删除分类 ${c.name}`} onClick={()=>{setError('');setRemoval({category:c,revision:library.revision});}}>删除</button></div>)}</div><button className="text-button" disabled={busy || !project || library.categories.length>=30} onClick={()=>{setError('');setCategoryEditor({revision:library.revision});}}><Icon name="plus" size={15}/>新建分类</button><p className="library-note">一篇文献可放入多个分类。删除分类保留文献；收藏和笔记只保存在当前浏览器。</p></aside>
      <div>{project&&<><EvidencePicker project={project}/><Link className="button secondary" href="/map?view=context">分析这些文献的研究脉络 →</Link><Link className="text-button" href="/canvas">进入研究设计 →</Link></>}<div className="library-toolbar"><label><span className="sr-only">搜索当前收藏</span><input value={localQuery} maxLength={100} onChange={e=>setLocalQuery(e.target.value)} placeholder="在收藏中找题名、作者或笔记"/></label><label><span className="sr-only">收藏排序</span><select aria-label="收藏排序" value={librarySort} onChange={e=>setLibrarySort(e.target.value)}><option value="saved">最近收藏</option><option value="updated">最近修改</option><option value="year">发表年份</option><option value="title">题名</option></select></label></div><p className="library-count">当前显示 {filtered.length} 篇 · 收藏在「{project?.name ?? '未选择研究'}」下</p>
        {!filtered.length && <div className="literature-empty"><Icon name="book" size={28}/><h3>{library.items.length?'这个分类或关键词下还没有文献':'把有用的线索，留在这里。'}</h3><p>从检索结果收藏文献，再按自己的研究思路分类、做笔记。</p><button className="text-button" onClick={()=>setView('search')}>去检索文献<Icon name="arrow" size={16}/></button></div>}
        <div className="paper-list">{filtered.map(i=><PaperCard key={i.id} paper={i.paper} saved={i} categories={library.categories} canSave={!!project} disabled={busy} onManage={()=>openItem(i.paper)} onRemove={()=>{setError('');setRemoval({item:i,revision:library.revision});}}/>)}</div>
      </div>
    </div>}
    </section>
    {editor && <SavePaperDialog paper={editor.paper} existing={editor.existing} categories={library.categories} projectName={project?.name ?? ''} busy={busy} onClose={()=>setEditor(null)} onSave={saveItem}/>}
    {categoryEditor && <CategoryDialog category={categoryEditor.category} busy={busy} onClose={()=>setCategoryEditor(null)} onSave={saveCategory}/>}
    {removal && <RemovalDialog removal={removal} busy={busy} onClose={()=>setRemoval(null)} onConfirm={confirmRemoval}/>}
  </>;
}

function PaperCard({paper:p,saved,categories,query='',canSave,disabled,onManage,onRemove,assessment}:{assessment?:Assessment;paper:Paper;saved?:SavedPaper;categories:Category[];query?:string;canSave:boolean;disabled:boolean;onManage:()=>void;onRemove?:()=>void}) {
  const [verify,setVerify]=useState<{paper:Paper;resolves:boolean|null;checkedAt:string}|null>(null);
  const [checking,setChecking]=useState(false),[error,setError]=useState('');
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  async function checkDOI(){if(!p.doi || checking)return;setChecking(true);setError('');const c=new AbortController();controller.current=c;try{const r=await fetch(`/api/literature/verify?doi=${encodeURIComponent(p.doi)}`,{signal:c.signal,cache:'no-store'});const d:unknown=await r.json();if(!r.ok)throw new Error(isRecord(d)&&typeof d.error==='string'?d.error:'暂时无法核查。');if(!isRecord(d)||!isPaper(d.paper)||(d.resolves!==null&&typeof d.resolves!=='boolean')||typeof d.checkedAt!=='string')throw new Error('登记记录格式不完整，不能标记核查成功。');setVerify({paper:d.paper,resolves:d.resolves,checkedAt:d.checkedAt});}catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'暂时无法核查。');}finally{if(!c.signal.aborted)setChecking(false);}}
  const matchTerms=[...new Set(query.split(/\s+/).filter(w=>w.length>2 && !['and','the','for','with','from'].includes(w.toLowerCase())))].filter(w=>(p.title+' '+(p.abstract??'')).toLowerCase().includes(w.toLowerCase())).slice(0,6);
  return <article className="paper-card frosted-surface"><div className="paper-badges"><span>{sourceName(p)} 来源记录</span><span>{kindName(p.kind)}</span><span>{p.sourceIsCore===true?'CWTS 核心来源（OpenAlex 标记）':p.sourceIsCore===false?'未列入 CWTS 核心来源':'核心来源标记未提供'}</span><span>{p.oaUrl?'有开放全文入口':'书目 / 摘要信息'}</span>{p.retracted && <span className="paper-warning">来源标记撤稿，请核查</span>}</div><h3>{p.title}</h3><p className="paper-authors">{p.authors.length?p.authors.join('；')+(p.authorsTruncated?' 等':''):'作者未提供'}</p><p className="paper-venue">{p.venue??'期刊 / 来源未提供'}<span>·</span>{p.year??'年份未提供'}{p.citations!==null&&<><span>·</span>{p.citations} 次被引（{sourceName(p)} 口径）</>}</p>
    {query&&<div className={`paper-assessment assessment-${assessment?.level??'insufficient'}`}><strong>{assessment?{direct:'直接相关 · AI 初评',background:'理论 / 方法背景 · AI 初评',unrelated:'不推荐 · 主题不匹配',insufficient:'无法充分评估'}[assessment.level]:'尚未评估相关性'}</strong>{assessment&&<><p>{assessment.reason} · 建议用途：{assessment.use}</p><details><summary>判断依据与限制</summary><p>题名 / 摘要依据：{assessment.basis}</p><p>{assessment.limitation}；请核对原文。</p></details></>}</div>}
    {matchTerms.length>0&&<p className="paper-matches">题名 / 摘要含：{matchTerms.join(' · ')}</p>}
    {p.doi?<p className="paper-doi">DOI：<a href={doiURL(p.doi)} target="_blank" rel="noopener noreferrer">{p.doi}<Icon name="arrow-up" size={13}/></a></p>:<p className="paper-missing">未提供 DOI · 可查看 OpenAlex 来源记录</p>}
    {p.abstract?<details className="paper-abstract"><summary>查看{p.abstractTruncated?'摘要节选':'数据源摘要'}</summary><p>{p.abstract}</p><span>来自 {sourceName(p)}，未读取或推断论文全文。</span></details>:<p className="paper-missing">数据源未提供摘要，不能据此推断论文全文内容。</p>}
    <div className="paper-links"><a href={p.recordUrl} target="_blank" rel="noopener noreferrer">查看来源记录<Icon name="arrow-up" size={13}/></a>{p.landingUrl&&<a href={p.landingUrl} target="_blank" rel="noopener noreferrer">出版 / 原始页面<Icon name="arrow-up" size={13}/></a>}{p.oaUrl&&<a href={p.oaUrl} target="_blank" rel="noopener noreferrer">开放全文入口<Icon name="arrow-up" size={13}/></a>}{p.doi&&<button onClick={()=>void checkDOI()} disabled={checking}>{checking?'正在核查…':'核查 DOI 登记'}</button>}</div>
    {error&&<p className="paper-check-error" role="alert">{error}</p>}{verify&&<div className="paper-verification"><strong>{fold(verify.paper.title)===fold(p.title)?'题名与 Crossref 登记记录一致':'题名与 Crossref 记录不同，请人工核对版本或译名'}</strong><p>{verify.paper.title}</p><p>{verify.paper.authors.join('；')||'作者未提供'} · {verify.paper.year??'年份未提供'}</p>{p.year!==null&&verify.paper.year!==null&&p.year!==verify.paper.year&&<p className="paper-check-error">年份记录不同：当前来源 {p.year}，Crossref {verify.paper.year}。可能涉及在线发表与卷期年份，请到出版方核对后引用。</p>}<span>{verify.resolves===true?'DOI 解析器返回有效响应 / 跳转':verify.resolves===false?'DOI 解析器未找到该标识，请谨慎核查':'本次未能检查 DOI 解析状态'}</span><a href={crossrefRecordURL(verify.paper.doi!)} target="_blank" rel="noopener noreferrer">打开本次登记记录</a><p>此核查仅确认元数据与标识，不代表全文已阅读或内容质量已认证。</p></div>}
    {saved&&<div className="paper-saved-info"><div className="concept-tags">{saved.categoryIds.length?saved.categoryIds.map(id=><span key={id}>{categories.find(c=>c.id===id)?.name??'分类已更新'}</span>):<span>未分类</span>}</div>{saved.note&&<p className="paper-note">我的笔记：{saved.note}</p>}</div>}
    <div className="paper-actions"><span>采集 {new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(p.retrievedAt))}</span><div>{onRemove&&<button className="small-button delete-button" disabled={disabled} onClick={onRemove}>移出收藏</button>}{canSave?<button className={`button ${saved?'secondary':'primary'}`} disabled={disabled} onClick={onManage}>{saved?'已收藏 · 管理':'收藏文献'}<Icon name={saved?'check':'plus'} size={15}/></button>:<Link className="text-button" href="/">创建研究后收藏<Icon name="arrow" size={15}/></Link>}</div></div>
  </article>;
}

function DialogFrame({title,busy,onClose,children}:{title:string;busy:boolean;onClose:()=>void;children:ReactNode}){
  const dialog=useRef<HTMLDialogElement>(null),id=useId();
  useEffect(()=>{const el=dialog.current,opener=document.activeElement;el?.showModal();el?.querySelector<HTMLElement>('[data-first-focus]')?.focus();return()=>{el?.close();if(opener instanceof HTMLElement)opener.focus();};},[]);
  return <dialog ref={dialog} className="project-dialog literature-dialog frosted-surface" aria-labelledby={id} onCancel={e=>{if(busy)e.preventDefault();else onClose();}}><div className="dialog-top"><span className="eyebrow">YOUR RESEARCH LIBRARY</span><button className="icon-button" disabled={busy} aria-label="关闭文献窗口" onClick={onClose}><Icon name="close"/></button></div><h2 id={id}>{title}</h2>{children}</dialog>;
}
function SavePaperDialog({paper,existing,categories,projectName,busy,onClose,onSave}:{paper:Paper;existing?:SavedPaper;categories:Category[];projectName:string;busy:boolean;onClose:()=>void;onSave:(ids:string[],note:string)=>Promise<boolean>}){
  const [ids,setIds]=useState(existing?.categoryIds??(categories.some(c=>c.id==='reading')?['reading']:[])),[note,setNote]=useState(existing?.note??''),[error,setError]=useState('');
  return <DialogFrame title={existing?'整理这篇文献':'收藏到当前研究'} busy={busy} onClose={onClose}><p className="save-target">研究：{projectName}</p><p className="save-paper-title">{paper.title}</p><form onSubmit={async e=>{e.preventDefault();setError('');if(!await onSave(ids,note))setError('还没有保存成功，你的编辑仍在这里，请查看页面提示。');}}><fieldset className="save-categories"><legend>放入分类 <span>可多选，不选则为未分类</span></legend>{categories.map((c,i)=><label key={c.id}><input data-first-focus={i===0?'true':undefined} type="checkbox" checked={ids.includes(c.id)} onChange={e=>setIds(e.target.checked?[...ids,c.id]:ids.filter(id=>id!==c.id))}/>{c.name}</label>)}</fieldset><label className="field-label" htmlFor="paper-note">我的阅读笔记 <span>选填，最多4000字</span></label><textarea data-first-focus={!categories.length?'true':undefined} id="paper-note" rows={4} maxLength={4000} value={note} onChange={e=>setNote(e.target.value)} placeholder="为什么这篇文献对你的研究有用？还需要核实什么？"/>{error&&<p role="alert" className="field-error">{error}</p>}<div className="dialog-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>取消</button><button className="button primary" disabled={busy}>{busy?'正在保存…':existing?'保存分类与笔记':'确认收藏'}</button></div></form></DialogFrame>;
}
function CategoryDialog({category,busy,onClose,onSave}:{category?:Category;busy:boolean;onClose:()=>void;onSave:(name:string)=>Promise<boolean>}){
  const [name,setName]=useState(category?.name??''),[error,setError]=useState('');
  return <DialogFrame title={category?'重命名分类':'新建文献分类'} busy={busy} onClose={onClose}><form onSubmit={async e=>{e.preventDefault();setError('');if(!await onSave(name.trim()))setError('分类未保存，请检查是否重名、超过容量或在其他页面发生更新。');}}><label className="field-label" htmlFor="category-name">分类名称</label><input data-first-focus id="category-name" required maxLength={40} value={name} onChange={e=>setName(e.target.value)} placeholder="例如：访谈方法、待读综述"/>{error&&<p className="field-error" role="alert">{error}</p>}<div className="dialog-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>取消</button><button className="button primary" disabled={busy||!name.trim()}>保存分类</button></div></form></DialogFrame>;
}
function RemovalDialog({removal,busy,onClose,onConfirm}:{removal:{item?:SavedPaper;category?:Category};busy:boolean;onClose:()=>void;onConfirm:()=>Promise<boolean>}){
  const [error,setError]=useState('');
  return <DialogFrame title={removal.category?'删除这个分类？':'从当前研究移出文献？'} busy={busy} onClose={onClose}><p className="delete-description">{removal.category?`将删除「${removal.category.name}」分类。文献和笔记都会保留，仅属于这个分类的文献会进入「未分类」。`:`将从当前研究移出「${removal.item?.paper.title}」及其笔记。其他研究里的收藏和原始论文不会受影响。`}</p>{error&&<p role="alert" className="field-error">{error}</p>}<div className="dialog-actions"><button data-first-focus type="button" className="button secondary" disabled={busy} onClick={onClose}>取消</button><button className="button danger" disabled={busy} onClick={async()=>{if(!await onConfirm())setError('操作未完成，原有内容未被更改，请查看页面提示。');}}>{removal.category?'确认删除分类':'确认移出收藏'}</button></div></DialogFrame>;
}
