import type {Block,Page,Workspace} from './workspace';
export const normalizeText=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('it').trim();
export type SearchMode='all'|'any'|'phrase';
export function searchTerms(query:string,mode:SearchMode='all'){const normalized=normalizeText(query);return mode==='phrase'?[normalized].filter(Boolean):[...new Set(normalized.split(/\s+/).filter(Boolean))];}
export function matchesSearch(text:string,terms:string[],mode:SearchMode='all'){const normalized=normalizeText(text);return terms.length>0&&(mode==='any'?terms.some(term=>normalized.includes(term)):terms.every(term=>normalized.includes(term)));}
export function sectionRange(page:Page,selector:{heading?:string;heading_id?:string;occurrence?:number}){
 const headings=page.blocks.map((block,index)=>({block,index})).filter(({block})=>/^h[1-6]$/.test(block.type));
 const matches=selector.heading_id?headings.filter(({block})=>block.id===selector.heading_id):headings.filter(({block})=>normalizeText(block.text)===normalizeText(selector.heading||''));
 if(!matches.length)throw Error('Sezione non trovata. Usa il titolo esatto o heading_id da read_page.');
 if(matches.length>1&&!selector.occurrence&&!selector.heading_id)throw Error('Titolo ripetuto: specifica heading_id oppure occurrence (a partire da 1).');
 const selected=matches[(selector.occurrence||1)-1];if(!selected)throw Error('Occorrenza della sezione non trovata.');
 const level=Number(selected.block.type.slice(1));
 const next=headings.find(({block,index})=>index>selected.index&&Number(block.type.slice(1))<=level);
 return {heading:selected.block,start:selected.index,end:next?.index??page.blocks.length};
}
export function pageTree(pages:Page[],limit=300){
 const active=pages.filter(page=>!page.deleted),available=new Set(active.map(page=>page.id));
 let count=0;
 function children(parent:string|null):unknown[]{return active.filter(page=>(page.parent&&available.has(page.parent)?page.parent:null)===parent).flatMap(page=>{
  if(count>=limit)return [];count++;return [{id:page.id,title:page.title,icon:page.icon,kind:page.kind||'note',status:page.status||'draft',revision:page.revision||1,parent:page.parent,children:children(page.id)}];
 });}
 return {pages:children(null),total:active.length,returned:Math.min(active.length,count),truncated:count<active.length};
}
export function excerpt(text:string,terms:string[],length=260){const normalized=normalizeText(text),indexes=terms.map(term=>normalized.indexOf(term)).filter(i=>i>=0),index=indexes.length?Math.min(...indexes):0,start=Math.max(0,index-70);return (start?'…':'')+text.slice(start,start+length)+(text.length>start+length?'…':'');}
export function searchPages(workspace:Workspace,query:string,limit=20,offset=0,mode:SearchMode='all'){
 const terms=searchTerms(query,mode);if(!terms.length)throw Error('Inserisci almeno una parola da cercare.');
 const results=workspace.pages.filter(page=>!page.deleted).flatMap(page=>{
  if(!matchesSearch(page.title+' '+page.blocks.map(b=>b.text).join(' '),terms,mode))return [];
  let heading:Block|undefined;
  const matches=page.blocks.flatMap((block,index)=>{
   if(/^h[1-6]$/.test(block.type))heading=block;
   return matchesSearch(block.text,terms,'any')?[{block_id:block.id,index,type:block.type,section:heading?{id:heading.id,title:heading.text}:null,excerpt:excerpt(block.text,terms)}]:[];
  });
  const titleMatch=matchesSearch(page.title,terms,mode);
  return [{page_id:page.id,title:page.title,revision:page.revision||1,parent:page.parent,title_match:titleMatch,matches:matches.slice(0,5),total_matches:matches.length,score:terms.filter(term=>normalizeText(page.title).includes(term)).length*10+matches.length}];
 }).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title));
 return {query,mode,terms,total:results.length,results:results.slice(offset,offset+limit),next_offset:offset+limit<results.length?offset+limit:null};
}
export function searchTasks(workspace:Workspace,query:string,limit=20,offset=0,mode:SearchMode='all'){
 const terms=searchTerms(query,mode),projects=new Map(workspace.pages.map(p=>[p.id,p]));
 const results=workspace.tasks.filter(task=>matchesSearch([task.title,task.tag,task.status,task.project_id?projects.get(task.project_id)?.title||'':''].join(' '),terms,mode)).map(task=>({...task,project_title:task.project_id?projects.get(task.project_id)?.title||null:null}));
 return {query,mode,terms,total:results.length,results:results.slice(offset,offset+limit),next_offset:offset+limit<results.length?offset+limit:null};
}
