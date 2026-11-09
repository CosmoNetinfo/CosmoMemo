import {pageTree} from '../page-content';
import {History} from './history';
import type {Store} from './store';

export type ContextOptions={mode?:'compact'|'full';page_limit?:number;memory_limit?:number;task_limit?:number;change_limit?:number;max_chars?:number};
export async function getContext(db:Store,reader:string,memoryAccess:boolean,input:ContextOptions={}){
 const compact=input.mode!=='full',limits={pages:input.page_limit??(compact?20:100),memories:input.memory_limit??(compact?5:15),tasks:input.task_limit??(compact?10:40),changes:input.change_limit??(compact?5:20)},maxChars=input.max_chars??(compact?16000:60000),excerptLength=compact?240:4000;
 const [snapshot,memoryRows,changes]=await Promise.all([db.snapshot(),memoryAccess?db.query('SELECT key,left(content,$2) AS content,tags,revision,updated_at,length(content)>$2 AS content_truncated,count(*) OVER() AS total FROM cm_memories ORDER BY updated_at DESC,key LIMIT $1',[limits.memories,excerptLength]):Promise.resolve([]),new History(db).changes(reader,memoryAccess,undefined,limits.changes)]);
 const shorten=(text:string,max:number)=>text.length>max?text.slice(0,max)+'…':text;
 const tree=pageTree(snapshot.workspace.pages,limits.pages);
 function clip(nodes:unknown[]){for(const node of nodes){const n=node as {title:string;icon:string;children:unknown[]};n.title=shorten(n.title,160);n.icon=shorten(n.icon,20);clip(n.children);}}
 clip(tree.pages);
 const open=snapshot.workspace.tasks.filter(task=>task.status!=='Completato');
 const data={server_version:'3.3.0',mode:compact?'compact':'full',retrieved_at:new Date().toISOString(),workspace_revision:snapshot.revision,
  page_tree:tree,memories:memoryRows.map(r=>({key:String(r.key),content:String(r.content),tags:(r.tags as string[]).slice(0,15),revision:Number(r.revision),updatedAt:Number(r.updated_at),content_truncated:Boolean(r.content_truncated)})),
  memory_access:memoryAccess,total_memories:Number(memoryRows[0]?.total||0),memories_limit:limits.memories,memories_truncated:false,
  open_tasks:open.slice(0,limits.tasks).map(t=>({...t,title:shorten(t.title,350),tag:shorten(t.tag,80)})),total_open_tasks:open.length,tasks_truncated:open.length>limits.tasks,
  changes:{...changes,events:changes.events.map(e=>({...e,title:shorten(e.title,160)}))},budget_truncated:false,max_chars:maxChars};
 // Bound the actual serialized response as well as individual collections.
 // Removing an event must never advance the checkpoint beyond unseen events.
 while(JSON.stringify(data).length>maxChars){
  data.budget_truncated=true;
  if(data.memories.length){data.memories.pop();continue;}
  if(data.open_tasks.length){data.open_tasks.pop();continue;}
  if(data.page_tree.pages.length){data.page_tree.pages.pop();continue;}
  if(data.changes.events.length){data.changes.events.pop();data.changes.has_more=true;data.changes.next_cursor=data.changes.events.at(-1)?.id??changes.since_cursor;continue;}
  break;
 }
 function count(nodes:unknown[]):number{return nodes.reduce<number>((sum,n)=>sum+1+count((n as {children:unknown[]}).children),0);}
 data.page_tree.returned=count(data.page_tree.pages);data.page_tree.truncated=data.page_tree.returned<data.page_tree.total;
 data.memories_truncated=data.memories.length<data.total_memories||data.memories.some(m=>m.content_truncated);
 data.tasks_truncated=data.open_tasks.length<open.length;
 return data;
}
