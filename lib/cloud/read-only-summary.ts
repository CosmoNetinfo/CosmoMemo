import {createHash,timingSafeEqual} from 'node:crypto';
import type {Query} from './store';

// Project metadata inside PostgreSQL: page blocks and memory text never reach
// the application, and an empty workspace is never initialized by this route.
export const SUMMARY_SQL=`SELECT
 coalesce((SELECT jsonb_agg(jsonb_build_object(
  'id',page->>'id','title',page->>'title',
  'kind',coalesce(page->>'kind','note'),'status',coalesce(page->>'status','draft'),
  'parent_id',page->>'parent','updated',page->'updated') ORDER BY ordinal)
  FROM cm_workspace w CROSS JOIN LATERAL jsonb_array_elements(w.document->'pages') WITH ORDINALITY AS p(page,ordinal)
  WHERE w.id=1 AND NOT coalesce((page->>'deleted')::boolean,false)), '[]'::jsonb) AS pages,
 coalesce((SELECT jsonb_agg(jsonb_build_object(
  'id',task->>'id','title',task->>'title','status',task->>'status',
  'priority',task->>'priority','project_id',task->>'project_id','due',nullif(task->>'date','')) ORDER BY ordinal)
  FROM cm_workspace w CROSS JOIN LATERAL jsonb_array_elements(w.document->'tasks') WITH ORDINALITY AS t(task,ordinal)
  WHERE w.id=1), '[]'::jsonb) AS tasks,
 (SELECT count(*) FROM cm_memories) AS memories_count`;

const WINDOW_MS=60_000,MAX_FAILURES=10,MAX_KEYS=1000;
type Failure={count:number;expires:number};
function clientKey(request:Request){
 // Vercel supplies this proxy header. Elsewhere use one conservative bucket
 // rather than trusting arbitrary forwarded headers supplied by a client.
 const ip=process.env.VERCEL==='1'?request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim():'local';
 return createHash('sha256').update(ip||'unknown').digest('hex');
}
function json(body:unknown,status=200,headers:Record<string,string>={}){
 return Response.json(body,{status,headers:{'Cache-Control':'no-store',Vary:'Authorization',...headers}});
}

export function createSummaryHandler(query:Query,options:{token?:()=>string|undefined;now?:()=>number;clientKey?:(request:Request)=>string}={}){
 const failures=new Map<string,Failure>();let overflow:Failure|undefined;
 const clock=options.now??Date.now,configuredToken=options.token??(()=>process.env.COSMOMEMO_READ_TOKEN),keyFor=options.clientKey??clientKey;
 function bucket(key:string,now:number){
  const existing=failures.get(key);if(existing&&existing.expires>now)return existing;
  if(existing)failures.delete(key);
  if(failures.size>=MAX_KEYS){for(const [id,entry]of failures)if(entry.expires<=now)failures.delete(id);}
  if(failures.size>=MAX_KEYS){if(!overflow||overflow.expires<=now)overflow={count:0,expires:now+WINDOW_MS};return overflow;}
  const entry={count:0,expires:now+WINDOW_MS};failures.set(key,entry);return entry;
 }
 return async function GET(request:Request){
  const expected=configuredToken();if(!expected)return json({error:'Not found'},404);
  const now=clock(),entry=bucket(keyFor(request),now);
  const unauthorized=()=>json({error:'Unauthorized'},401,{'WWW-Authenticate':'Bearer realm="CosmoMemo read-only"',...(entry.count>=MAX_FAILURES?{'Retry-After':String(Math.max(1,Math.ceil((entry.expires-now)/1000)))}:{})});
  // Stop authentication attempts while throttled, without touching the database.
  if(entry.count>=MAX_FAILURES)return unauthorized();
  const authorization=request.headers.get('authorization')||'';
  const token=authorization.length<=8192?authorization.match(/^Bearer ([^\s,]+)$/i)?.[1]:undefined;
  // Fixed-size digests permit timingSafeEqual even for different token lengths.
  const actualHash=createHash('sha256').update(token||'').digest(),expectedHash=createHash('sha256').update(expected).digest();
  if(!timingSafeEqual(actualHash,expectedHash)||!token){entry.count++;return unauthorized();}
  try{
   const [row]=await query(SUMMARY_SQL);
   return json({generated_at:new Date(clock()).toISOString(),pages:row.pages,tasks:row.tasks,memories_count:Number(row.memories_count)});
  }catch{return json({error:'Riepilogo temporaneamente non disponibile.'},503);}
 };
}
