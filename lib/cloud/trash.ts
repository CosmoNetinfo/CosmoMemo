import {z} from 'zod';
import {normalizeWorkspace} from '../workspace-changes';
import {trashTime} from '../trash-state';
import {Conflict,InputError,type Store,type Snapshot} from './store';
export const purgeInput=z.object({pages:z.array(z.object({page_id:z.string().min(1).max(120),expected_page_revision:z.number().int().min(1)})).min(1).max(200),confirm_permanent_deletion:z.literal(true)});
export class Trash {
 constructor(readonly db:Store){}
 async list(limit=50,offset=0,olderThanDays?:number,now=Date.now()){
  if(!Number.isSafeInteger(limit)||limit<1||limit>200||!Number.isSafeInteger(offset)||offset<0||(olderThanDays!==undefined&&(!Number.isFinite(olderThanDays)||olderThanDays<0||olderThanDays>36500)))throw new InputError('Limite, offset o older_than_days non validi.');
  const cutoff=olderThanDays===undefined?null:now-olderThanDays*86_400_000;
  const {workspace,revision}=await this.db.snapshot(),pages=workspace.pages.filter(p=>p.deleted&&(cutoff===null||trashTime(p)<cutoff)).sort((a,b)=>trashTime(a)-trashTime(b)||a.id.localeCompare(b.id));
  return {workspace_revision:revision,older_than_days:olderThanDays??null,cutoff_at:cutoff,total:pages.length,next_offset:offset+limit<pages.length?offset+limit:null,pages:pages.slice(offset,offset+limit).map(p=>({id:p.id,title:p.title,icon:p.icon,kind:p.kind||'note',status:p.status||'draft',revision:p.revision||1,parent:p.parent,updated:p.updated,trashed_at:trashTime(p),trashed_at_source:p.trashed_at===undefined?'updated':'trashed_at',linked_tasks:workspace.tasks.filter(t=>t.project_id===p.id).length}))};
 }
 async empty(input:unknown){
  const parsed=purgeInput.safeParse(input);if(!parsed.success)throw new InputError('Seleziona le pagine con le revisioni e conferma la cancellazione permanente.');
  await this.db.snapshot();
  try{
   const [row]=await this.db.query('SELECT cm_purge_trash($1::jsonb,$2::jsonb) AS snapshot',[JSON.stringify(parsed.data.pages),JSON.stringify(this.db.actor)]);
   const saved=row.snapshot as Snapshot;
   return {...saved,workspace:normalizeWorkspace(saved.workspace),deleted_page_ids:parsed.data.pages.map(p=>p.page_id),permanently_deleted:true,history_content_removed:true,remaining_trash:saved.workspace.pages.filter(p=>p.deleted).length};
  }catch(error){const e=error as {message?:string;detail?:string};if(e.message?.startsWith('CM_CONFLICT')){let detail;try{detail=JSON.parse(e.detail||'{}');}catch{}throw new Conflict(detail);}if(e.message?.startsWith('CM_INVALID'))throw new InputError('Una pagina selezionata non è più nel cestino o la selezione non è valida.');throw error;}
 }
}
