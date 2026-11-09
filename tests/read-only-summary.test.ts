import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {applySchema} from './helpers/schema';
import {createSummaryHandler} from '../lib/cloud/read-only-summary';
import type {Query,Row} from '../lib/cloud/store';
import {initial} from '../lib/workspace';

const request=(token?:string,cookie?:string)=>new Request('https://cosmomemo.example/api/read-only/summary',{headers:{...(token?{Authorization:'Bearer '+token}:{}),...(cookie?{Cookie:cookie}:{})}});
function checks(response:Response,status:number){assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.has('set-cookie'),false);}
const emptyQuery:Query=async()=>[{pages:[],tasks:[],memories_count:0}];

test('summary: token valido, proiezione esatta dei metadati e transazione PostgreSQL READ ONLY',async()=>{
 const pg=new PGlite();await applySchema(pg);const secret=randomBytes(32).toString('base64url'),queries:string[]=[];
 try{
  const workspace=structuredClone(initial);workspace.pages[0].blocks=[{id:'private',type:'text',text:'CONTENUTO_PAGINA_DA_NON_ESPORRE'}];workspace.pages[1].deleted=true;workspace.pages[2].parent=workspace.pages[0].id;workspace.pages[2].kind='idea';workspace.pages[2].status='active';workspace.tasks[0].project_id='project-metadata';workspace.tasks[1].date='';
  await pg.query('INSERT INTO cm_workspace(id,document,updated_at) VALUES(1,$1::jsonb,$2)',[JSON.stringify(workspace),Date.now()]);
  await pg.query('INSERT INTO cm_memories(key,content,tags,updated_at) VALUES($1,$2,$3::jsonb,$4)',['CHIAVE_RICORDO_PRIVATA','TESTO_RICORDO_DA_NON_ESPORRE','["TAG_PRIVATO"]',Date.now()]);
  const handle=createSummaryHandler(async(sql,args=[])=>{queries.push(sql);const result=await pg.query(sql,args);return result.rows as Row[];},{token:()=>secret});
  await pg.exec('BEGIN READ ONLY');
  const response=await handle(request(secret,'cosmomemo_session=non-utilizzare'));checks(response,200);const body=await response.json();
  await pg.exec('ROLLBACK');
  assert.deepEqual(Object.keys(body).sort(),['generated_at','memories_count','pages','tasks']);assert.ok(Number.isFinite(Date.parse(body.generated_at)));assert.equal(body.memories_count,1);
  assert.equal(body.pages.length,3);assert.equal(body.tasks.length,4);
  for(const p of body.pages)assert.deepEqual(Object.keys(p).sort(),['id','kind','parent_id','status','title','updated']);
  for(const t of body.tasks)assert.deepEqual(Object.keys(t).sort(),['due','id','priority','project_id','status','title']);
  assert.equal(body.pages[0].kind,'note');assert.equal(body.pages[0].status,'draft');assert.equal(body.pages[0].parent_id,null);assert.equal(typeof body.pages[0].updated,'number');assert.equal(body.pages[1].parent_id,'welcome');assert.equal(body.pages[1].kind,'idea');assert.equal(body.pages[1].status,'active');
  assert.equal(body.tasks[0].due,workspace.tasks[0].date);assert.equal(body.tasks[0].project_id,'project-metadata');assert.equal(body.tasks[1].due,null);assert.equal(body.tasks[1].project_id,null);
  const output=JSON.stringify(body);for(const value of ['CONTENUTO_PAGINA_DA_NON_ESPORRE','TESTO_RICORDO_DA_NON_ESPORRE','CHIAVE_RICORDO_PRIVATA','TAG_PRIVATO',secret])assert.equal(output.includes(value),false);
  assert.equal(queries.length,1);assert.match(queries[0],/^SELECT/);assert.doesNotMatch(queries[0],/\b(?:INSERT|UPDATE|DELETE|blocks|content|cm_owner|cm_rate_limits)\b/i);
  const rows=await pg.query<{revision:number}>('SELECT revision FROM cm_workspace');assert.equal(rows.rows[0].revision,0);
 }finally{await pg.close();}
});

test('summary: token errato, anche con lunghezza diversa, restituisce 401 senza query',async()=>{
 const token=randomBytes(32).toString('base64url');let queries=0;const handle=createSummaryHandler(async()=>{queries++;return [];},{token:()=>token});
 for(const wrong of [randomBytes(32).toString('base64url'),'x','é','x'.repeat(10000)]){const response=await handle(request(wrong));checks(response,401);assert.equal(response.headers.get('www-authenticate'),'Bearer realm="CosmoMemo read-only"');assert.deepEqual(await response.json(),{error:'Unauthorized'});}
 assert.equal(queries,0);
});

test('summary: token mancante restituisce 401 e ignora completamente cookie e sessioni',async()=>{
 let queries=0;const handle=createSummaryHandler(async()=>{queries++;return [];},{token:()=>randomBytes(32).toString('base64url')});
 const response=await handle(request(undefined,'cosmomemo_session=qualsiasi-sessione'));checks(response,401);assert.equal(queries,0);
});

test('summary: variabile non impostata o vuota restituisce 404 anche con Authorization',async()=>{
 let queries=0;for(const disabled of [undefined,'']){const handle=createSummaryHandler(async()=>{queries++;return [];},{token:()=>disabled});const response=await handle(request(randomBytes(32).toString('base64url')));checks(response,404);assert.equal(response.headers.has('www-authenticate'),false);assert.deepEqual(await response.json(),{error:'Not found'});}assert.equal(queries,0);
});

test('summary: rate limit dei soli fallimenti, 401 con Retry-After e scadenza senza scritture',async()=>{
 const token=randomBytes(32).toString('base64url');let now=Date.now(),queries=0;const handle=createSummaryHandler(async()=>{queries++;return emptyQuery('');},{token:()=>token,now:()=>now});
 for(let i=0;i<9;i++){checks(await handle(request('invalid')),401);checks(await handle(request(token)),200);}
 checks(await handle(request('invalid')),401);const blocked=await handle(request(token));checks(blocked,401);assert.equal(blocked.headers.get('retry-after'),'60');assert.equal(queries,9);
 now+=60_000;checks(await handle(request(token)),200);assert.equal(queries,10);
});

test('summary: workspace mai inizializzato resta assente, risposta vuota senza INSERT',async()=>{
 const pg=new PGlite();await applySchema(pg);try{const token=randomBytes(32).toString('base64url');const handle=createSummaryHandler(async(sql,args=[])=>{const r=await pg.query(sql,args);return r.rows as Row[];},{token:()=>token});await pg.exec('BEGIN READ ONLY');const response=await handle(request(token));checks(response,200);const body=await response.json();assert.deepEqual(body.pages,[]);assert.deepEqual(body.tasks,[]);assert.equal(body.memories_count,0);await pg.exec('ROLLBACK');const count=await pg.query<{count:string|number}>('SELECT count(*) AS count FROM cm_workspace');assert.equal(Number(count.rows[0].count),0);}finally{await pg.close();}
});

test('summary: route Next reale e variabile COSMOMEMO_READ_TOKEN, indipendente dalle sessioni',async()=>{
 const previous=process.env.COSMOMEMO_READ_TOKEN;const {GET}=await import('../app/api/read-only/summary/route');
 try{delete process.env.COSMOMEMO_READ_TOKEN;checks(await GET(request()),404);
  const token=randomBytes(32).toString('base64url');process.env.COSMOMEMO_READ_TOKEN=token;
  checks(await GET(request(undefined,'cosmomemo_session=non-rilevante')),401);checks(await GET(request('invalid')),401);
  // A valid-token request uses the same default environment lookup with a test
  // database adapter, never the real Neon connection from the production route.
  checks(await createSummaryHandler(emptyQuery)(request(token)),200);
 }finally{if(previous===undefined)delete process.env.COSMOMEMO_READ_TOKEN;else process.env.COSMOMEMO_READ_TOKEN=previous;}
});

test('summary: errori database restituiscono 503 senza dettagli o credenziali',async()=>{
 const token=randomBytes(32).toString('base64url');const handle=createSummaryHandler(async()=>{throw Error('DETTAGLI_RISERVATI '+token);},{token:()=>token});const response=await handle(request(token));checks(response,503);assert.deepEqual(await response.json(),{error:'Riepilogo temporaneamente non disponibile.'});
});

test('summary: schema Authorization deve essere Bearer, nessun token in URL o altri header',async()=>{
 const token=randomBytes(32).toString('base64url');let queries=0;const handle=createSummaryHandler(async()=>{queries++;return emptyQuery('');},{token:()=>token});
 for(const authorization of ['Basic '+token,'Bearer '+token+' extra','Bearer '+token+',other'])checks(await handle(new Request('https://cosmomemo.example/api/read-only/summary?token='+token,{headers:{Authorization:authorization,'x-api-key':token}})),401);
 const response=await handle(new Request('https://cosmomemo.example/api/read-only/summary',{headers:{Authorization:'bearer '+token}}));checks(response,200);assert.equal(queries,1);
});
