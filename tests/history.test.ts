import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {applySchema} from './helpers/schema';
import {Store,Conflict,InputError,type Row} from '../lib/cloud/store';
import {History} from '../lib/cloud/history';
import {createPage,updatePage} from '../lib/cloud/page-service';
import {createMcpServer} from '../lib/cloud/mcp';
import {valid} from '../lib/workspace';

async function fixture(){const pg=new PGlite();await applySchema(pg);const db=new Store(async(sql,args=[])=>{const r=await pg.query(sql,args);return r.rows as Row[];});return {pg,db,history:new History(db)};}
const actor={kind:'claude' as const,id:'client-a',name:'Claude'};
test('cronologia atomica: autore server, versione precedente, ripristino e conflitti',async()=>{
 const {pg,db,history}=await fixture();try{
  const base=await db.snapshot(),page=base.workspace.pages[0];
  assert.equal((await history.pageHistory(page.id)).versions.length,0);
  const updated=await updatePage(db.asActor(actor),page.id,1,p=>({...p,title:'Titolo da Claude'}));
  const entries=(await history.pageHistory(page.id)).versions;assert.equal(entries.length,1);assert.deepEqual(entries[0].actor,actor);assert.deepEqual(entries[0].changed_fields,['title']);
  const before=await history.pageVersion(page.id,entries[0].id,'before');assert.equal(before.page.title,page.title);
  await assert.rejects(()=>history.restorePageVersion(page.id,entries[0].id,1,'before'),Conflict);
  assert.equal((await history.pageHistory(page.id)).versions.length,1);
  const restored=await history.restorePageVersion(page.id,entries[0].id,updated.revision,'before');
  assert.equal(restored.page.title,page.title);assert.equal(restored.revision,3);
  const after=(await history.pageHistory(page.id)).versions;assert.equal(after.length,2);assert.equal(after[0].actor.kind,'owner');assert.equal((await history.pageVersion(page.id,entries[0].id)).page.title,'Titolo da Claude');
  await updatePage(db,page.id,3,p=>p);assert.equal((await history.pageHistory(page.id)).versions.length,2);
  const legacy=await db.snapshot(),other=legacy.workspace.pages[1];
  await db.query('SELECT cm_apply_changes($1::jsonb,NULL)',[JSON.stringify({pages:[{id:other.id,expected_revision:1,document:{...other,title:'Client prima dell’aggiornamento'}}],tasks:[]})]);
  assert.equal((await history.pageHistory(other.id)).versions[0].actor.kind,'unknown');
  await assert.rejects(()=>history.pageVersion('other-page',entries[0].id),InputError);
  const now=await db.snapshot();await assert.rejects(()=>db.apply({pages:[{id:page.id,expected_revision:1,document:{...now.workspace.pages[0],title:'Non salvare'}}],tasks:[]}),Conflict);
  assert.equal((await history.pageHistory(page.id)).versions.length,2);
 }finally{await pg.close();}
});

test('progetti: tipi validi, attività collegate, cestino e controllo relazionale atomico SQL',async()=>{
 const {pg,db,history}=await fixture();try{
  const project=await createPage(db,{title:'Lancio',icon:'🚀',blocks:[],kind:'project',status:'active'});
  const task={id:'linked-task',title:'Preparare',status:'Da iniziare',priority:'Media',date:'',tag:'Test',project_id:project.page.id};
  await db.apply({pages:[],tasks:[{id:task.id,expected_revision:0,document:task}]});
  await assert.rejects(()=>updatePage(db,project.page.id,1,p=>({...p,kind:'idea'})),InputError);
  const original=(await history.pageHistory(project.page.id)).versions.length;
  // Bypass TypeScript prevalidation to verify SQL protects concurrent project changes too.
  await assert.rejects(()=>db.query('SELECT cm_apply_changes_audited($1::jsonb,NULL,$2::jsonb)',[JSON.stringify({pages:[{id:project.page.id,expected_revision:1,document:{...project.page,kind:'note'}}],tasks:[]}),JSON.stringify(actor)]),/CM_INVALID/);
  assert.equal((await history.pageHistory(project.page.id)).versions.length,original);
  assert.equal((await db.snapshot()).workspace.pages.find(p=>p.id===project.page.id)!.kind,'project');
  await updatePage(db,project.page.id,1,p=>({...p,deleted:true}));
  assert.equal((await db.snapshot()).workspace.tasks.find(t=>t.id===task.id)!.project_id,project.page.id);
  await assert.rejects(()=>db.apply({pages:[],tasks:[{id:task.id,expected_revision:1,document:{...task,title:'Non salvare nel cestino'}}]}),InputError);
  await db.apply({pages:[],tasks:[{id:task.id,expected_revision:1,document:{...task,project_id:null}}]});
  const snapshot=await db.snapshot();snapshot.workspace.tasks[0].project_id='missing';assert.equal(valid(snapshot.workspace),false);
 }finally{await pg.close();}
});

test('novità: paginazione senza perdere eventi, letture separate, permessi memoria e cursori monotoni',async()=>{
 const {pg,db,history}=await fixture();try{
  const a=await createPage(db,{title:'A',icon:'📄',blocks:[]});
  const secret=await db.asActor(actor).remember('profilo/riservato','Testo privato',[],0);
  await updatePage(db.asActor(actor),a.page.id,1,p=>({...p,title:'A aggiornato'}));
  const first=await history.changes('owner:web',true,undefined,1);assert.equal(first.events.length,1);assert.equal(first.has_more,true);
  await history.markSeen('owner:web',first.next_cursor);
  const remaining=await history.changes('owner:web',true);assert.equal(remaining.events.length,2);assert.equal(remaining.events[0].entity_type,'memory');
  assert.equal(JSON.stringify(remaining.events).includes('Testo privato'),false);
  const restricted=await history.changes('claude:client-a',false);assert.equal(restricted.events.length,2);assert.ok(restricted.events.every(e=>e.entity_type!=='memory'));
  const claude=await history.changes('claude:client-a',true);assert.equal(claude.events.length,3);
  await history.markSeen('owner:web',remaining.next_cursor);await history.markSeen('owner:web',0);
  assert.equal((await history.changes('owner:web',true)).events.length,0);
  assert.equal((await history.changes('claude:client-a',true)).events.length,3);
  await assert.rejects(()=>history.markSeen('owner:web',remaining.latest_cursor+1),InputError);
  await assert.rejects(()=>db.asActor(actor).remember(secret.key,'Stale',[],0),Conflict);
  assert.equal((await history.changes('owner:web',true)).events.length,0);
  await db.forget(secret.key,secret.revision);const forgotten=await history.changes('owner:web',true);assert.equal(forgotten.events[0].operation,'delete');assert.equal(forgotten.events[0].actor.kind,'owner');
  await applySchema(pg);assert.equal((await history.changes('claude:client-a',true)).events.length,4);
 }finally{await pg.close();}
});

test('MCP: proprietà, progetto, cronologia, ripristino e contesto persistono tra conversazioni',async()=>{
 const {pg,db}=await fixture();const server=createMcpServer(db,['pages:read','pages:write'],'client-test');const client=new Client({name:'test',version:'1'}),pair=InMemoryTransport.createLinkedPair();await server.connect(pair[0]);await client.connect(pair[1]);
 const call=async(name:string,args:Record<string,unknown>={})=>{const r=await client.callTool({name,arguments:args});return {error:r.isError,data:JSON.parse((r.content as {text:string}[])[0].text)};};
 try{
  const {data:project}=await call('create_page',{title:'Progetto',kind:'project',status:'active'});
  const {data:task}=await call('save_task',{title:'Fare ricerca',project_id:project.page.id});
  assert.equal(task.task.project_id,project.page.id);
  assert.equal((await call('list_tasks',{project_id:project.page.id})).data.tasks.length,1);
  const changed=await call('update_page',{page_id:project.page.id,expected_page_revision:1,title:'Progetto nuovo',status:'done'});assert.equal(changed.data.page.status,'done');
  const {data:list}=await call('list_page_history',{page_id:project.page.id});assert.equal(list.versions[0].actor.kind,'claude');assert.equal(list.versions[0].actor.id,'client-test');
  const event=list.versions[0].id;
  assert.equal((await call('read_page_version',{page_id:project.page.id,event_id:event,side:'before'})).data.page.title,'Progetto');
  assert.equal((await call('restore_page_version',{page_id:project.page.id,event_id:event,side:'before',expected_page_revision:2})).data.revision,3);
  const {data:context}=await call('get_context');assert.equal(context.changes.events.length,4);assert.equal(context.open_tasks.find((t:{id:string})=>t.id===task.task.id).project_id,project.page.id);
  await call('mark_changes_seen',{cursor:context.changes.next_cursor});assert.equal((await call('get_changes')).data.events.length,0);
  const tools=await client.listTools();assert.equal(tools.tools.length,29);
  const readerServer=createMcpServer(db,['pages:read'],'client-test'),readerClient=new Client({name:'new-chat',version:'1'}),readerPair=InMemoryTransport.createLinkedPair();await readerServer.connect(readerPair[0]);await readerClient.connect(readerPair[1]);
  try{assert.equal((await readerClient.listTools()).tools.some(t=>t.name==='restore_page_version'),false);const r=await readerClient.callTool({name:'get_changes',arguments:{}});assert.equal(JSON.parse((r.content as {text:string}[])[0].text).events.length,0);}finally{await readerClient.close();await readerServer.close();}
 }finally{await client.close();await server.close();await pg.close();}
});
