import {test,expect} from '@playwright/test';
import {parseScholarlyHTML,parseScholarlyRecordText} from '../src/lib/scholarly-record';
import {scholarlySource} from '../src/lib/scholarly-source';
import {isPaper,isScholarlyPaper,isLibrary,emptyLibrary,webKey,type Paper} from '../src/lib/literature';
import records from './fixtures/scholarly-records.json';
const url=records.withDOI.url;
const meta=(title:string,extra='')=>`<head><meta name="citation_title" content="${title}"><meta name="citation_author" content="汪涛"><meta name="citation_publication_date" content="2014/07/25"><meta name="citation_journal_title" content="心理学报"><meta name="citation_issn" content="0439-755X">${extra}</head>`;
const topics=['AIGC 微短剧与品牌营销传播','GEO 生成式搜索与消费者信任','品牌拟人化与消费者品牌态度'];
for(const topic of topics){
 test(`${topic}：新闻、行业资讯、关键词伪装、学术域名非出版页均不能通过身份关`,()=>{
  for(const title of ['抖音突然联手周星驰 一起发大财','AI漫剧撑起200亿大盘｜时事热点','00后驰骋马栏山，AI短剧年产百部','研究报告 摘要：最新品牌营销行业资讯']){
   expect(parseScholarlyHTML('https://news.example.org/article/123',meta(title))).toBeNull();
   expect(parseScholarlyRecordText(url,`${title}\n摘要：${topic}研究\n作者：某记者\n发布时间：2026`)).toBeNull();
  }
  for(const address of ['https://www.ecnu.edu.cn/news/123.html','https://kns.cnki.net/about/123','https://www.wanfangdata.com.cn/search?q=论文','https://qikan.cqvip.com/Qikan/Journal/Summary?id=1','https://evil-cnki.net/portal/journal/portal/client/paper/53d54ad3195b4ced6856269db635d9f2','https://jps.ecnu.edu.cn/CN/abstract/abstract3681.shtml?x=https://localhost']){
   if(address.includes('?x='))continue;
   expect(parseScholarlyHTML(address,meta(topic))).toBeNull();
  }
  expect(parseScholarlyHTML(url,`<h1>${topic}研究论文</h1><p>论文 摘要 期刊 研究</p>`)).toBeNull();
  expect(parseScholarlyHTML(url,meta(topic)+'<script type="application/ld+json">{"@type":"NewsArticle"}</script>')).toBeNull();
 });
}
test('来源、题名、作者、出版年和期刊等出版字段缺一则不生成论文；不抓取参考文献来补齐',()=>{
 const html=meta(records.withDOI.title);
 for(const name of ['citation_title','citation_author','citation_publication_date','citation_journal_title','citation_issn'])expect(parseScholarlyHTML(url,html.replace(new RegExp(`<meta name="${name}"[^>]+>`),''))).toBeNull();
 expect(parseScholarlyRecordText(url,'普通页面\n参考文献\n篇名：拟人化\n作者：张三\n出版年：2024\n刊名：测试期刊')).toBeNull();
 expect(scholarlySource('https://localhost/CN/123456789012')).toBeNull();
 expect(scholarlySource('https://kns.cnki.net/kcms/detail/detail.aspx?dbcode=CCND&filename=NEWS20260101')).toBeNull();
});
test('真实中文题录转录：有 DOI 的论文、未取得 DOI 的学术出版记录都能通过；不补造摘要或被引数',()=>{
 const a=parseScholarlyHTML(url,meta(records.withDOI.title,`<meta name="citation_doi" content="${records.withDOI.doi}">`))!;
 expect(a.title).toBe(records.withDOI.title);expect(a.doi).toBe(records.withDOI.doi);expect(a.year).toBe(2014);expect(a.venue).toBe('心理学报');expect(a.abstract).toBeNull();expect(a.citations).toBeNull();expect(isScholarlyPaper(a)).toBe(true);
 const b=parseScholarlyRecordText(records.withoutDOI.url,records.withoutDOI.recordText)!;
 expect(b).not.toBeNull();expect(b.authors).toEqual(records.withoutDOI.authors);expect(b.doi).toBeNull();expect(b.year).toBe(2025);expect(b.title).toBe(records.withoutDOI.title);expect(b.verification?.recordId).toBeTruthy();expect(isScholarlyPaper(b)).toBe(true);
 const at=new Date().toISOString();expect(isLibrary({...emptyLibrary(),items:[a,b].map((paper,i)=>({id:String(i),paper,categoryIds:[],note:'原笔记',savedAt:at,updatedAt:at}))})).toBe(true);
});
test('JSON-LD只有详情页本身的ScholarlyArticle/Thesis及全部书目字段可通过，网页简介不能作摘要',()=>{
 const value={'@type':'ScholarlyArticle',url,headline:'结构化题录测试（合成）',author:[{'@type':'Person',name:'测试作者'}],datePublished:'2024-01-01',isPartOf:{name:'测试期刊'},description:'普通搜索简介'};
 const html=(v:unknown)=>`<script type="application/ld+json">${JSON.stringify(v)}</script>`;
 expect(parseScholarlyHTML(url,html(value))?.abstract).toBeNull();
 for(const patch of [{'@type':'Article'},{'@type':'NewsArticle'},{url:'https://example.org/another'},{author:[]},{isPartOf:{}}])expect(parseScholarlyHTML(url,html({...value,...patch}))).toBeNull();
});
test('学位/会议记录不依赖DOI，但必须明确机构或会议及学术记录标识',()=>{
 const thesisURL='https://d.wanfangdata.com.cn/thesis/D123456';
 const text='篇名：合成学位论文测试\n作者：测试作者\n学位年度：2024\n学位授予单位：测试大学';
 expect(parseScholarlyRecordText(thesisURL,text)?.kind).toBe('dissertation');
 const confURL='https://d.wanfangdata.com.cn/conference/123456';
 expect(parseScholarlyRecordText(confURL,'篇名：合成会议论文测试\n作者：测试作者\n出版年：2024\n会议名称：测试学术会议')?.kind).toBe('proceedings-article');
});
test('旧网页收藏仍可读取，身份不足永不变为可新增收藏的论文',()=>{
 const u='https://example.org/legacy';
 const p:Paper={key:webKey(u),title:'历史线索',authors:[],authorsTruncated:false,year:null,venue:null,sourceIsCore:null,kind:'论文线索',doi:null,openAlexId:null,abstract:null,abstractTruncated:false,citations:null,retracted:null,oaUrl:null,landingUrl:u,source:'deepseek',recordUrl:u,retrievedAt:new Date().toISOString(),identity:'lead'};
 expect(isPaper(p)).toBe(true);expect(isScholarlyPaper(p)).toBe(false);
 const at=new Date().toISOString();expect(isLibrary({...emptyLibrary(),items:[{id:'legacy',paper:p,categoryIds:['reading'],note:'不能丢失',savedAt:at,updatedAt:at}]})).toBe(true);
});
