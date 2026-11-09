import type {Activity,ChangeFeed} from '../activity';
import type {Page} from '../workspace';
import {entityRevision} from '../workspace-changes';
import {InputError,type Row,type Store} from './store';
import {readPage,updatePage} from './page-service';

const summaryColumns=`id,entity_type,entity_id,operation,actor,changed_fields,occurred_at,
 coalesce(after_document->>'title',before_document->>'title',entity_id) AS title,
 coalesce(after_document->>'revision',before_document->>'revision') AS revision`;
function activity(row:Row):Activity{return {id:Number(row.id),entity_type:row.entity_type as Activity['entity_type'],entity_id:String(row.entity_id),operation:String(row.operation),actor:row.actor as Activity['actor'],changed_fields:row.changed_fields as string[],occurred_at:Number(row.occurred_at),title:String(row.title),revision:row.revision===null?null:Number(row.revision)};}
function cursor(value:number){if(!Number.isSafeInteger(value)||value<0)throw new InputError('Cursore non valido.');return value;}
export class History {
 constructor(readonly db:Store){}
 async pageHistory(pageId:string,before?:number,limit=30){
  limit=Math.min(100,Math.max(1,Math.trunc(limit)));
  await readPage(this.db,pageId,true);
  const rows=await this.db.query(`SELECT ${summaryColumns},before_document IS NOT NULL AS has_before,after_document IS NOT NULL AS has_after FROM cm_history WHERE entity_type='page' AND entity_id=$1 AND ($2::bigint IS NULL OR id<$2) ORDER BY id DESC LIMIT $3`,[pageId,before===undefined?null:cursor(before),Math.min(100,Math.max(1,limit))+1]);
  const selected=rows.slice(0,limit);
  return {page_id:pageId,versions:selected.map(row=>({...activity(row),has_before:Boolean(row.has_before),has_after:Boolean(row.has_after)})),next_before:rows.length>limit?Number(selected.at(-1)!.id):null};
 }
 async pageVersion(pageId:string,eventId:number,side:'before'|'after'='after'){
  const [row]=await this.db.query('SELECT before_document,after_document,actor,occurred_at FROM cm_history WHERE id=$1 AND entity_type=\'page\' AND entity_id=$2',[cursor(eventId),pageId]);
  const page=row?.[side+'_document'] as Page|undefined;
  if(!page)throw new InputError('Versione della pagina non disponibile.');
  return {event_id:eventId,side,page,actor:row.actor,occurred_at:Number(row.occurred_at),revision:entityRevision(page)};
 }
 async restorePageVersion(pageId:string,eventId:number,expected:number,side:'before'|'after'='after'){
  const version=await this.pageVersion(pageId,eventId,side);
  return updatePage(this.db,pageId,expected,(current,workspace)=>{
   const page={...structuredClone(version.page),id:current.id,revision:current.revision};
   if(!workspace.pages.some(p=>p.id===page.parent&&!p.deleted))page.parent=null;
   // Existing project links remain valid; a historical type cannot orphan tasks.
   if(workspace.tasks.some(t=>t.project_id===pageId)&&page.kind!=='project')throw new InputError('Scollega prima le attività: questa versione non è un progetto.');
   return page;
  },true);
 }
 async changes(reader:string,includeMemory:boolean,since?:number,limit=40):Promise<ChangeFeed>{
  const [checkpoint]=await this.db.query('SELECT cursor FROM cm_checkpoints WHERE reader=$1',[reader]);
  const from=cursor(since??Number(checkpoint?.cursor||0));
  const [watermark]=await this.db.query('SELECT coalesce(max(id),0) AS cursor FROM cm_history');
  const latest=Number(watermark.cursor);if(from>latest)throw new InputError('Il cursore supera la cronologia disponibile.');
  const size=Math.min(100,Math.max(1,limit));
  const rows=await this.db.query(`SELECT ${summaryColumns} FROM cm_history WHERE id>$1 AND id<=$2 AND ($3::boolean OR entity_type<>'memory') ORDER BY id LIMIT $4`,[from,latest,includeMemory,size+1]);
  const events=rows.slice(0,size).map(activity),hasMore=rows.length>size;
  return {events,since_cursor:from,next_cursor:hasMore?events.at(-1)!.id:latest,latest_cursor:latest,has_more:hasMore};
 }
 async markSeen(reader:string,seen:number){
  cursor(seen);const [row]=await this.db.query('SELECT coalesce(max(id),0) AS cursor FROM cm_history');
  if(seen>Number(row.cursor))throw new InputError('Il cursore supera la cronologia disponibile.');
  const [saved]=await this.db.query('INSERT INTO cm_checkpoints(reader,cursor) VALUES($1,$2) ON CONFLICT(reader) DO UPDATE SET cursor=greatest(cm_checkpoints.cursor,excluded.cursor) RETURNING cursor',[reader,seen]);
  return {cursor:Number(saved.cursor)};
 }
}
