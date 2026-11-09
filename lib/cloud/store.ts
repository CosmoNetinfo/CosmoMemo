import { neon } from '@neondatabase/serverless';
import { initial, valid, type Workspace } from '../workspace';
import {normalizeWorkspace,workspaceChanges,type WorkspaceChanges} from '../workspace-changes';
import type {Actor} from '../activity';

export type Row = Record<string, unknown>;
export type Query = (text: string, values?: unknown[]) => Promise<Row[]>;
export type Snapshot = { workspace: Workspace; revision: number };
export type Memory = { key: string; content: string; tags: string[]; revision: number; updatedAt: number };
export class Conflict extends Error {
 constructor(readonly detail?:{entity_id?:string;collection?:string;expected_revision?:number;current_revision?:number}){super('Questo elemento è stato aggiornato altrove. Rileggi la sua revisione prima di riprovare.');}
}
export class InputError extends Error {}
export class Store {
  constructor(readonly query: Query,readonly actor:Actor={kind:'owner',id:'owner',name:'Tu'}){}
  asActor(actor:Actor){return new Store(this.query,actor);}
  async snapshot(): Promise<Snapshot> {
    await this.query('INSERT INTO cm_workspace(id, document, updated_at) VALUES(1,$1::jsonb,$2) ON CONFLICT DO NOTHING',[JSON.stringify(initial),Date.now()]);
    const [row] = await this.query('SELECT document, revision FROM cm_workspace WHERE id=1');
    return {workspace:normalizeWorkspace(row.document as Workspace),revision:Number(row.revision)};
  }
  async save(workspace: Workspace, revision: number, base?:Workspace): Promise<Snapshot> {
    if(!valid(workspace)||JSON.stringify(workspace).length>2_000_000)throw new InputError('Workspace non valido o troppo grande (massimo 2 MB).');
    if(base&&!valid(base))throw new InputError('Versione di partenza non valida.');
    const current=await this.snapshot();
    if(!base&&current.revision!==revision)throw new Conflict({entity_id:'workspace',expected_revision:revision,current_revision:current.revision});
    return this.apply(workspaceChanges(base||current.workspace,workspace),base?undefined:revision);
  }
  async apply(changes:WorkspaceChanges,legacyRevision?:number):Promise<Snapshot>{
    const current=await this.snapshot();
    const projected:Workspace=structuredClone(current.workspace);
    for(const collection of ['pages','tasks'] as const){
      const ids=new Set<string>();
      for(const change of changes[collection]){
        if(ids.has(change.id)||!Number.isSafeInteger(change.expected_revision)||change.expected_revision<0)throw new InputError('Modifiche non valide.');ids.add(change.id);
        const items=projected[collection] as {id:string}[],index=items.findIndex(item=>item.id===change.id);
        if(!change.document){if(index>=0)items.splice(index,1);}else if(index<0)items.push(change.document);else items[index]=change.document;
      }
    }
    if(!valid(projected))throw new InputError('Gerarchia o contenuto non validi.');
    try{
      const [row]=await this.query('SELECT cm_apply_changes_audited($1::jsonb,$2::integer,$3::jsonb) AS snapshot',[JSON.stringify(changes),legacyRevision??null,JSON.stringify(this.actor)]);
      const result=row.snapshot as Snapshot;return {...result,workspace:normalizeWorkspace(result.workspace)};
    }catch(error){
      const e=error as {message?:string;detail?:string};
      if(e.message?.startsWith('CM_CONFLICT')){let detail;try{detail=JSON.parse(e.detail||'{}');}catch{}throw new Conflict(detail);}
      if(e.message?.startsWith('CM_INVALID'))throw new InputError('Modifica non valida: controlla dimensioni, gerarchia e pagine nel cestino.');
      throw error;
    }
  }
  async memories(query='',limit=100): Promise<Memory[]> {
    const rows=await this.query("SELECT * FROM cm_memories WHERE strpos(lower(key || ' ' || content || ' ' || tags::text),lower($1))>0 ORDER BY updated_at DESC,key LIMIT $2",[query,Math.min(100,Math.max(1,limit))]);
    return rows.map(row=>({key:String(row.key),content:String(row.content),tags:row.tags as string[],revision:Number(row.revision),updatedAt:Number(row.updated_at)}));
  }
  async remember(key: string, content: string, tags: string[], revision: number): Promise<Memory> {
    if(!/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,119}$/.test(key)||!content.trim()||content.length>50_000||tags.length>15||tags.some(t=>typeof t!=='string'||t.length>80))throw new InputError('Chiave, contenuto o tag non validi.');
    const stored=await this.writeMemory(key,content,tags,revision,false);
    return {key,content,tags,revision:Number(stored.revision),updatedAt:Number(stored.updated_at)};
  }
  async forget(key: string, revision: number) {
    await this.writeMemory(key,'',[],revision,true);
    return {deleted:true,key};
  }
  private async writeMemory(key:string,content:string,tags:string[],revision:number,remove:boolean){
    try{const [row]=await this.query('SELECT cm_write_memory($1,$2,$3::jsonb,$4,$5,$6::jsonb) AS memory',[key,content,JSON.stringify(tags),revision,remove,JSON.stringify(this.actor)]);return row.memory as Row;}
    catch(e){if((e as Error).message?.startsWith('CM_CONFLICT'))throw new Conflict();throw e;}
  }
  async exportMemories(after='') {
    const rows=await this.query('SELECT * FROM cm_memories WHERE key>$1 ORDER BY key LIMIT 40',[after]);
    const memories=rows.map(row=>({key:String(row.key),content:String(row.content),tags:row.tags as string[],revision:Number(row.revision),updatedAt:Number(row.updated_at)}));
    return {memories,nextCursor:memories.length===40?memories[memories.length-1].key:null};
  }
  async rateLimit(key: string, limit=10, window=900_000) {
    const now=Date.now();
    const [row]=await this.query('INSERT INTO cm_rate_limits(key,attempts,reset_at) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN cm_rate_limits.reset_at<$3 THEN 1 ELSE cm_rate_limits.attempts+1 END,reset_at=CASE WHEN cm_rate_limits.reset_at<$3 THEN $2 ELSE cm_rate_limits.reset_at END RETURNING attempts',[key,now+window,now]);
    return Number(row.attempts)<=limit;
  }
}
let cached: Store|undefined;
export function store() {
  if(!cached){const url=process.env.DATABASE_URL||process.env.POSTGRES_URL;if(!url)throw new Error('Database non configurato.');const sql=neon(url);cached=new Store(async(text,values=[])=>await sql.query(text,values) as Row[]);}
  return cached;
}
export function configured(){return Boolean((process.env.DATABASE_URL||process.env.POSTGRES_URL)&&process.env.COSMOMEMO_SESSION_SECRET&&process.env.COSMOMEMO_SETUP_TOKEN&&process.env.COSMOMEMO_APP_URL);}
