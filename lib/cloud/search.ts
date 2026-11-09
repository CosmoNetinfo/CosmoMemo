import {searchPages,searchTasks,searchTerms,type SearchMode} from '../page-content';
import {InputError,type Store} from './store';

export type SearchKind='page'|'task'|'memory';
const memoryText=String.raw`regexp_replace(normalize(lower(key || ' ' || content || ' ' || tags::text),NFD),U&'[\0300-\036f]','','g')`;
export async function searchMemory(db:Store,query:string,mode:SearchMode,limit:number,offset:number){
 const terms=searchTerms(query,mode);if(!terms.length)throw new InputError('Inserisci almeno una parola.');
 const condition=`${mode==='any'?'EXISTS':'NOT EXISTS'} (SELECT 1 FROM jsonb_array_elements_text($1::jsonb) term WHERE strpos(${memoryText},term)${mode==='any'?'>0':'=0'})`;
 const [count]=await db.query(`SELECT count(*) AS total FROM cm_memories WHERE ${condition}`,[JSON.stringify(terms)]);
 const rows=await db.query(`SELECT key,tags,revision,updated_at,
  substring(content FROM greatest(1,strpos(${memoryText.replace("key || ' ' || content || ' ' || tags::text",'content')},$4)-70) FOR 260) AS excerpt,
  length(content)>260 AS content_truncated
  FROM cm_memories WHERE ${condition} ORDER BY updated_at DESC,key LIMIT $2 OFFSET $3`,[JSON.stringify(terms),limit,offset,terms[0]]);
 const total=Number(count.total);
 return {query,mode,terms,total,results:rows.map(r=>({key:String(r.key),tags:r.tags as string[],revision:Number(r.revision),updatedAt:Number(r.updated_at),excerpt:String(r.excerpt),content_truncated:Boolean(r.content_truncated)})),next_offset:offset+limit<total?offset+limit:null};
}
export async function searchAll(db:Store,query:string,options:{mode?:SearchMode;limit?:number;offset?:number;kinds?:SearchKind[];pages:boolean;memories:boolean}){
 const mode=options.mode||'all',limit=options.limit??10,offset=options.offset??0,kinds=new Set(options.kinds||['page','task','memory']);
 if(!query.trim()||query.length>300||!['all','any','phrase'].includes(mode)||!Number.isSafeInteger(limit)||limit<1||limit>50||!Number.isSafeInteger(offset)||offset<0)throw new InputError('Parametri di ricerca non validi.');
 const [snapshot,memories]=await Promise.all([options.pages&&(kinds.has('page')||kinds.has('task'))?db.snapshot():null,options.memories&&kinds.has('memory')?searchMemory(db,query,mode,limit,offset):null]);
 return {query,mode,terms:searchTerms(query,mode),access:{pages:options.pages,memories:options.memories},
  pages:snapshot&&kinds.has('page')?searchPages(snapshot.workspace,query,limit,offset,mode):null,
  tasks:snapshot&&kinds.has('task')?searchTasks(snapshot.workspace,query,limit,offset,mode):null,memories};
}
