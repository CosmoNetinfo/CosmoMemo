import type {Page,Workspace} from './workspace';
export const trashTime=(page:Page)=>page.trashed_at??page.updated;
// Local edits get an immediate timestamp; PostgreSQL is authoritative in cloud.
export function withTrashTimestamps(before:Workspace,after:Workspace,now=Date.now()):Workspace{
 const previous=new Map(before.pages.map(p=>[p.id,p]));
 return {...after,pages:after.pages.map(page=>{
  const old=previous.get(page.id);
  if(page===old)return page;
  if(page.deleted)return {...page,trashed_at:old?.deleted?trashTime(old):now};
  if(page.trashed_at===undefined)return page;
  const {trashed_at:_,...active}=page;return active;
 })};
}
