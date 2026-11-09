import type {Block,Page,Workspace} from './workspace';
export const normalizeText=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('it').trim();
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
  if(count>=limit)return [];count++;return [{id:page.id,title:page.title,icon:page.icon,revision:page.revision||1,parent:page.parent,children:children(page.id)}];
 });}
 return {pages:children(null),total:active.length,returned:Math.min(active.length,count),truncated:count<active.length};
}
function excerpt(text:string,query:string){const normalized=normalizeText(text),index=normalized.indexOf(normalizeText(query)),start=Math.max(0,index-70);return (start?'…':'')+text.slice(start,start+260)+(text.length>start+260?'…':'');}
export function searchPages(workspace:Workspace,query:string,limit=20,offset=0){
 const term=normalizeText(query);if(!term)throw Error('Inserisci almeno una parola da cercare.');
 const results=workspace.pages.filter(page=>!page.deleted).flatMap(page=>{
  let heading:Block|undefined;
  const matches=page.blocks.flatMap((block,index)=>{
   if(/^h[1-6]$/.test(block.type))heading=block;
   return normalizeText(block.text).includes(term)?[{block_id:block.id,index,type:block.type,section:heading?{id:heading.id,title:heading.text}:null,excerpt:excerpt(block.text,query)}]:[];
  });
  const titleMatch=normalizeText(page.title).includes(term);if(!titleMatch&&!matches.length)return [];
  return [{page_id:page.id,title:page.title,revision:page.revision||1,parent:page.parent,title_match:titleMatch,matches:matches.slice(0,5),total_matches:matches.length,score:(titleMatch?10:0)+matches.length}];
 }).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title));
 return {query,total:results.length,results:results.slice(offset,offset+limit),next_offset:offset+limit<results.length?offset+limit:null};
}
