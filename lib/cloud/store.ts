import { neon } from '@neondatabase/serverless';
import { initial, valid, type Workspace } from '../workspace';

export type Row = Record<string, unknown>;
export type Query = (text: string, values?: unknown[]) => Promise<Row[]>;
export type Snapshot = { workspace: Workspace; revision: number };
export type Memory = { key: string; content: string; tags: string[]; revision: number; updatedAt: number };
export class Conflict extends Error { constructor(){super('Contenuto aggiornato altrove. Ricarica la versione più recente prima di riprovare.');} }
export class InputError extends Error {}
export class Store {
  constructor(readonly query: Query){}
  async snapshot(): Promise<Snapshot> {
    await this.query('INSERT INTO cm_workspace(id, document, updated_at) VALUES(1,$1::jsonb,$2) ON CONFLICT DO NOTHING',[JSON.stringify(initial),Date.now()]);
    const [row] = await this.query('SELECT document, revision FROM cm_workspace WHERE id=1');
    return {workspace:row.document as Workspace,revision:Number(row.revision)};
  }
  async save(workspace: Workspace, revision: number): Promise<Snapshot> {
    if(!valid(workspace)||JSON.stringify(workspace).length>2_000_000)throw new InputError('Workspace non valido o troppo grande (massimo 2 MB).');
    const rows=await this.query('UPDATE cm_workspace SET document=$1::jsonb, revision=revision+1, updated_at=$2 WHERE id=1 AND revision=$3 RETURNING revision',[JSON.stringify(workspace),Date.now(),revision]);
    if(!rows.length)throw new Conflict();
    return {workspace,revision:Number(rows[0].revision)};
  }
  async memories(query='',limit=100): Promise<Memory[]> {
    const rows=await this.query("SELECT * FROM cm_memories WHERE strpos(lower(key || ' ' || content || ' ' || tags::text),lower($1))>0 ORDER BY updated_at DESC,key LIMIT $2",[query,Math.min(100,Math.max(1,limit))]);
    return rows.map(row=>({key:String(row.key),content:String(row.content),tags:row.tags as string[],revision:Number(row.revision),updatedAt:Number(row.updated_at)}));
  }
  async remember(key: string, content: string, tags: string[], revision: number): Promise<Memory> {
    if(!/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,119}$/.test(key)||!content.trim()||content.length>50_000||tags.length>15||tags.some(t=>typeof t!=='string'||t.length>80))throw new InputError('Chiave, contenuto o tag non validi.');
    const now=Date.now();
    const rows=revision===0
      ?await this.query('INSERT INTO cm_memories(key,content,tags,updated_at) VALUES($1,$2,$3::jsonb,$4) ON CONFLICT DO NOTHING RETURNING revision',[key,content,JSON.stringify(tags),now])
      :await this.query('UPDATE cm_memories SET content=$2,tags=$3::jsonb,updated_at=$4,revision=revision+1 WHERE key=$1 AND revision=$5 RETURNING revision',[key,content,JSON.stringify(tags),now,revision]);
    if(!rows.length)throw new Conflict();
    return {key,content,tags,revision:Number(rows[0].revision),updatedAt:now};
  }
  async forget(key: string, revision: number) {
    const rows=await this.query('DELETE FROM cm_memories WHERE key=$1 AND revision=$2 RETURNING key',[key,revision]);
    if(!rows.length)throw new Conflict();
    return {deleted:true,key};
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
