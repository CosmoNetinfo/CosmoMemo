import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {applySchema} from './helpers/schema';
import {Store,InputError,type Row} from '../lib/cloud/store';
import {History} from '../lib/cloud/history';
import {Trash} from '../lib/cloud/trash';
import {createPage,updatePage} from '../lib/cloud/page-service';
import {createMcpServer} from '../lib/cloud/mcp';
import {SCOPES} from '../lib/cloud/oauth';
import {initial,valid} from '../lib/workspace';
import {withTrashTimestamps} from '../lib/trash-state';

async function fixture(){const pg=new PGlite(),queries:string[]=[];await applySchema(pg);const db=new Store(async(sql,args=[])=>{queries.push(sql);const r=await pg.query(sql,args);return r.rows as Row[];});return {pg,db,queries};}
async function connection(db:Store){const server=createMcpServer(db,SCOPES),client=new Client({name:'claude-fresh-regression',version:'1'}),pair=InMemoryTransport.createLinkedPair();await server.connect(pair[0]);await client.connect(pair[1]);return {client,call:async(name:string,args:Record<string,unknown>={})=>{const r=await client.callTool({name,arguments:args});return {error:r.isError,data:JSON.parse((r.content as {text:string}[])[0].text)};},close:async()=>{await client.close();await server.close();}};}

test('trashed_at: clock server, conservazione durante modifiche, restore e nuovo cestinamento',async()=>{
 const {db,pg}=await fixture();try{
  const created=await createPage(db,{title:'Date',icon:'📄',blocks:[]}),start=Date.now();
  const trashed=await updatePage(db,created.page.id,1,p=>({...p,deleted:true,trashed_at:1}));
  assert.ok(trashed.page.trashed_at!>=start);assert.ok(trashed.page.trashed_at!<=Date.now());
  const edited=await updatePage(db,created.page.id,2,p=>({...p,title:'Ancora nel cestino',trashed_at:2}),true);assert.equal(edited.page.trashed_at,trashed.page.trashed_at);
  const restored=await updatePage(db,created.page.id,3,p=>({...p,deleted:false}),true);assert.equal(Object.hasOwn(restored.page,'trashed_at'),false);
  const again=await updatePage(db,created.page.id,4,p=>({...p,deleted:true}));assert.ok(again.page.trashed_at!>=trashed.page.trashed_at!);
  const versions=await new History(db).pageHistory(created.page.id),creation=versions.versions.find(v=>v.operation==='create')!;
  const historical=await new History(db).restorePageVersion(created.page.id,creation.id,5);assert.equal(historical.page.deleted,false);assert.equal(Object.hasOwn(historical.page,'trashed_at'),false);
  await applySchema(pg);const after=await updatePage(db,created.page.id,6,p=>({...p,deleted:true}));assert.ok(Number.isSafeInteger(after.page.trashed_at));
 }finally{await pg.close();}
});

test('cestino storico: ripiego updated, ordine stabile, older_than_days prima della paginazione, nessuna cancellazione',async()=>{
 const {db,pg,queries}=await fixture();try{
  const now=Date.UTC(2030,0,1),day=86_400_000,workspace=structuredClone(initial),base=workspace.pages[0];
  workspace.pages=[{...base,id:'old-legacy',deleted:true,updated:now-90*day},{...base,id:'a',deleted:true,updated:now,trashed_at:now-60*day},{...base,id:'b',deleted:true,updated:now,trashed_at:now-60*day},{...base,id:'boundary',deleted:true,updated:now,trashed_at:now-30*day},{...base,id:'recent',deleted:true,updated:now-3*day},{...base,id:'active',deleted:false,updated:now-200*day}];
  await db.snapshot();await db.query('UPDATE cm_workspace SET document=$1::jsonb WHERE id=1',[JSON.stringify(workspace)]);const snapshot=await db.snapshot();queries.length=0;
  const trash=new Trash(db),all=await trash.list(200,0,undefined,now);assert.deepEqual(all.pages.map(p=>p.id),['old-legacy','a','b','boundary','recent']);assert.equal(all.pages[0].trashed_at,now-90*day);assert.equal(all.pages[0].trashed_at_source,'updated');
  const filtered=await trash.list(1,1,30,now);assert.equal(filtered.total,3);assert.equal(filtered.pages[0].id,'a');assert.equal(filtered.next_offset,2);assert.equal((await trash.list(200,0,30,now)).pages.some(p=>p.id==='boundary'),false);
  await assert.rejects(()=>trash.list(20,0,-1,now),InputError);
  assert.equal((await db.snapshot()).revision,snapshot.revision);assert.equal(queries.some(q=>/cm_purge_trash|DELETE FROM/i.test(q)),false);
  const legacy=snapshot.workspace.pages[0];const changed=await updatePage(db,legacy.id,1,p=>({...p,title:'Titolo storico corretto'}),true);assert.equal(changed.page.trashed_at,legacy.updated);
 }finally{await pg.close();}
});

test('date locali: cancellazione, ripristino e pagine non modificate',()=>{
 const before=structuredClone(initial),after=structuredClone(before);after.pages[0].deleted=true;
 const trashed=withTrashTimestamps(before,after,123456);assert.equal(trashed.pages[0].trashed_at,123456);
 const edited={...trashed,pages:trashed.pages.map(p=>p.id===trashed.pages[0].id?{...p,title:'Altro titolo'}:p)};assert.equal(withTrashTimestamps(trashed,edited,999999).pages[0].trashed_at,123456);
 const active={...trashed,pages:trashed.pages.map(p=>({...p,deleted:false}))};assert.equal(Object.hasOwn(withTrashTimestamps(trashed,active,999999).pages[0],'trashed_at'),false);
 assert.equal(withTrashTimestamps(before,before,999999).pages[1],before.pages[1]);
 const invalid=structuredClone(before);invalid.pages[0].trashed_at=-1;assert.equal(valid(invalid),false);
});

test('save_task e store: project_id inesistente, cestinato o non progetto restituisce invalid_input',async()=>{
 const {db,pg}=await fixture(),conn=await connection(db);try{
  const project=await createPage(db,{title:'Progetto',kind:'project',icon:'🎯',blocks:[]}),trash=await createPage(db,{title:'Cestino',kind:'project',icon:'📄',blocks:[]});await updatePage(db,trash.page.id,1,p=>({...p,deleted:true}));
  const before=await db.snapshot();
  for(const project_id of ['missing',trash.page.id,'welcome']){
   const bad=await conn.call('save_task',{title:'Non salvare',project_id});assert.equal(bad.error,true);assert.equal(bad.data.error.code,'invalid_input');assert.match(bad.data.error.message,/project_id/);
   await assert.rejects(()=>db.apply({pages:[],tasks:[{id:'bad-'+project_id,expected_revision:0,document:{...initial.tasks[0],id:'bad-'+project_id,project_id}}]}),InputError);
  }
  assert.equal((await db.snapshot()).revision,before.revision);
  const good=(await conn.call('save_task',{title:'Valida',project_id:project.page.id})).data;await updatePage(db,project.page.id,1,p=>({...p,deleted:true}));
  const omitted=await conn.call('save_task',{task_id:good.task.id,expected_task_revision:1,title:'Mantiene progetto cestinato'});assert.equal(omitted.data.error.code,'invalid_input');
  assert.equal((await conn.call('save_task',{task_id:good.task.id,expected_task_revision:1,title:'Scollegata',project_id:null})).error,undefined);
 }finally{await conn.close();await pg.close();}
});

test('update_page: riduzione blocks richiede conferma anche se append_blocks compensa il numero',async()=>{
 const {db,pg}=await fixture(),conn=await connection(db);try{
  const created=await createPage(db,{title:'Intera',icon:'📄',blocks:[{id:'one',type:'text',text:'Uno'},{id:'two',type:'text',text:'Due'}]}),history=new History(db);
  for(const args of [{blocks:[]},{blocks:[],confirm_replace:false},{blocks:[{type:'text',text:'Rimpiazzo'}],append_blocks:[{type:'text',text:'Nuovo'}]}]){
   const bad=await conn.call('update_page',{page_id:created.page.id,expected_page_revision:1,title:'Non salvare',...args});assert.equal(bad.data.error.code,'invalid_input');assert.match(bad.data.error.message,/confirm_replace/);for(const tool of ['update_block','insert_block','append_to_section'])assert.ok(bad.data.error.message.includes(tool));
  }
  assert.equal((await history.pageHistory(created.page.id)).versions.length,1);assert.equal((await db.snapshot()).workspace.pages.find(p=>p.id===created.page.id)!.title,'Intera');
  const same=await conn.call('update_page',{page_id:created.page.id,expected_page_revision:1,blocks:[{type:'text',text:'A'},{type:'text',text:'B'}]});assert.equal(same.error,undefined);
  const confirmed=await conn.call('update_page',{page_id:created.page.id,expected_page_revision:2,blocks:[],confirm_replace:true});assert.equal(confirmed.error,undefined);assert.equal(confirmed.data.page.blocks.length,0);assert.equal((await history.pageHistory(created.page.id)).versions.length,3);
 }finally{await conn.close();await pg.close();}
});

test('client MCP nuovo: discovery, Markdown todo/export, filtri attività, età cestino e offset memoria',async()=>{
 const {db,pg}=await fixture();let conn=await connection(db);try{
  await conn.close();conn=await connection(db);const tools=await conn.client.listTools();assert.equal(tools.tools.length,32);
  const schema=(name:string)=>tools.tools.find(t=>t.name===name)!.inputSchema.properties!;assert.ok(schema('list_trash').older_than_days);assert.ok(schema('search_memories').offset);assert.ok(schema('update_page').confirm_replace);assert.ok(schema('list_tasks').priority);
  assert.equal((await conn.call('get_context')).data.server_version,'3.3.0');
  const imported=(await conn.call('create_page_from_markdown',{markdown:'# Verifica 3.3\n\n- [ ] Primo\n\n- [x] Secondo',kind:'project'})).data;assert.deepEqual(imported.page.blocks.map((b:{text:string})=>b.text),['Primo','Secondo']);
  const exported=(await conn.call('export_page_markdown',{page_id:imported.page.id})).data.markdown;assert.match(exported,/- \[ \] Primo/);assert.match(exported,/- \[x\] Secondo/);
  for(const status of ['Da iniziare','In corso','Completato'])await conn.call('save_task',{title:'Task 3.3',status,priority:'Alta',tag:'Caffè',project_id:imported.page.id});
  const listed=(await conn.call('list_tasks',{project_id:imported.page.id,priority:'Alta',tag:'CAFFE',query:'Task 3.3',limit:1,offset:1})).data;assert.equal(listed.total,3);assert.equal(listed.tasks[0].status,'In corso');assert.equal(listed.next_offset,2);
  assert.equal((await conn.call('list_tasks',{project_id:imported.page.id,status:'Completato'})).data.total,1);
  await conn.call('delete_page',{page_id:imported.page.id,expected_page_revision:1});assert.equal((await conn.call('list_trash',{older_than_days:30})).data.total,0);
  const trashed=(await conn.call('list_trash',{})).data;assert.ok(Number.isSafeInteger(trashed.pages[0].trashed_at));await conn.call('restore_page',{page_id:imported.page.id,expected_page_revision:2});assert.equal(Object.hasOwn((await conn.call('read_page',{page_id:imported.page.id})).data.page,'trashed_at'),false);
  await db.remember('release33/a','Verifica offset A',[],0);await db.remember('release33/b','Verifica offset B',[],0);
  const first=(await conn.call('search_memories',{query:'Verifica offset',limit:1,offset:0})).data,second=(await conn.call('search_memories',{query:'Verifica offset',limit:1,offset:1})).data;assert.equal(first.total,2);assert.equal(first.next_offset,1);assert.equal(second.next_offset,null);assert.notEqual(first.memories[0].key,second.memories[0].key);
 }finally{await conn.close();await pg.close();}
});
