import {type Page,type Task,type Workspace} from './workspace';

type Entity=Page|Task;
export type EntityChange={id:string;expected_revision:number;document:Entity|null};
export type WorkspaceChanges={pages:EntityChange[];tasks:EntityChange[]};
export const entityRevision=(entity:Entity)=>entity.revision??1;
function ordered(value:unknown):unknown {
 if(Array.isArray(value))return value.map(ordered);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,ordered(item)]));
 return value;
}
function body(entity:Entity){const {revision:_,...content}=entity;return JSON.stringify(ordered(content));}
export function normalizeWorkspace(workspace:Workspace):Workspace {
 return {...workspace,pages:workspace.pages.map(p=>({...p,revision:entityRevision(p)})),tasks:workspace.tasks.map(t=>({...t,revision:entityRevision(t)}))};
}
export function workspaceChanges(base:Workspace,next:Workspace):WorkspaceChanges {
 function diff(old:Entity[],current:Entity[]):EntityChange[]{
  const previous=new Map(old.map(item=>[item.id,item])),incoming=new Map(current.map(item=>[item.id,item]));
  return [...new Set([...previous.keys(),...incoming.keys()])].flatMap(id=>{
   const before=previous.get(id),after=incoming.get(id);
   if(before&&after&&body(before)===body(after))return [];
   return [{id,expected_revision:before?entityRevision(before):0,document:after||null}];
  });
 }
 return {pages:diff(base.pages,next.pages),tasks:diff(base.tasks,next.tasks)};
}
// Rebase edits made during a save on the canonical response, keeping other pages intact.
export function rebaseWorkspace(base:Workspace,edited:Workspace,remote:Workspace):Workspace {
 const changes=workspaceChanges(base,edited);
 function apply<T extends Entity>(items:T[],changes:EntityChange[]):T[]{
  const result=[...items];
  for(const change of changes){const index=result.findIndex(item=>item.id===change.id);if(!change.document){if(index>=0)result.splice(index,1);continue;}const next={...change.document,...(index>=0?{revision:entityRevision(result[index])}:{})} as T;if(index<0)result.push(next);else result[index]=next;}
  return result;
 }
 return {...remote,pages:apply(remote.pages,changes.pages),tasks:apply(remote.tasks,changes.tasks)};
}
export function hasEntityConflict(base:Workspace,edited:Workspace,remote:Workspace){
 const changes=workspaceChanges(base,edited);
 return (['pages','tasks'] as const).some(collection=>changes[collection].some(change=>{
  const current=remote[collection].find(item=>item.id===change.id);
  return (current?entityRevision(current):0)!==change.expected_revision;
 }));
}
