import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {applySchema} from './helpers/schema';
import {Store,Conflict,InputError,type Row} from '../lib/cloud/store';
import {createMcpServer} from '../lib/cloud/mcp';
import {Trash} from '../lib/cloud/trash';
import {History} from '../lib/cloud/history';
import {getContext} from '../lib/cloud/context';
import {searchAll} from '../lib/cloud/search';
import {createPage,updatePage} from '../lib/cloud/page-service';
import {SCOPES} from '../lib/cloud/oauth';

async function fixture(){const pg=new PGlite();await applySchema(pg);const db=new Store(async(sql,args=[])=>{const r=await pg.query(sql,args);return r.rows as Row[];});return {pg,db};}
async function connection(db:Store,scopes:string[]){const server=createMcpServer(db,scopes),client=new Client({name:'regression',version:'1'}),pair=InMemoryTransport.createLinkedPair();await server.connect(pair[0]);await client.connect(pair[1]);return {client,close:async()=>{await client.close();await server.close();}};}

test('SDK MCP: checkbox loose, proprietà, progetto, blocchi mirati e revisioni dei ricordi coerenti',async()=>{
 const {db,pg}=await fixture(),conn=await connection(db,SCOPES);
 const call=async(name:string,args:Record<string,unknown>={})=>{const r=await conn.client.callTool({name,arguments:args});return {error:r.isError,data:JSON.parse((r.content as {text:string}[])[0].text)};};
 try{
  const imported=(await call('create_page_from_markdown',{markdown:'# Brief\n\n- [ ] Primo\n\n- [x] Secondo'})).data;assert.deepEqual(imported.page.blocks.map((b:{text:string})=>b.text),['Primo','Secondo']);
  const props=(await call('set_page_properties',{page_id:imported.page.id,expected_page_revision:1,kind:'project',status:'active'})).data;assert.deepEqual(props.page.blocks,imported.page.blocks);
  const task=(await call('save_task',{title:'Ricerca vigilant curl',project_id:props.page.id})).data;
  const project=(await call('get_project',{project_id:props.page.id})).data;assert.equal(project.tasks[0].id,task.task.id);assert.equal(project.total_tasks,1);
  const inserted=(await call('insert_block',{page_id:props.page.id,expected_page_revision:2,before_block_id:imported.page.blocks[1].id,block:{type:'text',text:'Nel mezzo'}})).data;
  assert.equal(inserted.page.blocks[1].id,inserted.inserted_block.id);assert.equal(inserted.page.blocks[2].id,imported.page.blocks[1].id);
  const start=(await call('insert_block',{page_id:props.page.id,expected_page_revision:3,after_block_id:null,block:{type:'h2',text:'Inizio'}})).data;assert.equal(start.page.blocks[0].text,'Inizio');
  assert.equal((await call('insert_block',{page_id:props.page.id,expected_page_revision:4,before_block_id:'missing',block:{type:'text',text:'Non salvare'}})).error,true);
  assert.equal((await call('delete_block',{page_id:props.page.id,block_id:inserted.inserted_block.id,expected_page_revision:3})).error,true);
  const deleted=(await call('delete_block',{page_id:props.page.id,block_id:inserted.inserted_block.id,expected_page_revision:4})).data;
  assert.deepEqual(deleted.page.blocks.slice(1),imported.page.blocks);
  const memory=(await call('remember',{key:'test/revision',content:'Vigilant e poi curl',expected_memory_revision:0})).data;
  assert.equal((await call('remember',{key:memory.key,content:'Non sovrascrivere',expected_memory_revision:1,expected_revision:2})).error,true);
  assert.equal((await call('forget',{key:memory.key})).error,true);
  const search=(await call('search_all',{query:'vigilant curl'})).data;assert.equal(search.tasks.total,1);assert.equal(search.memories.total,1);
  assert.equal((await call('remember',{key:memory.key,content:'Aggiornamento compatibile',expected_revision:1})).data.revision,2);
  assert.equal((await call('forget',{key:memory.key,expected_memory_revision:2})).data.deleted,true);
  assert.equal((await conn.client.listTools()).tools.length,32);
 }finally{await conn.close();await pg.close();}
});

test('ricerca unica: parole separate, accenti, paginazione e rispetto dei permessi',async()=>{
 const {pg,db}=await fixture();try{
  await createPage(db,{title:'Vigilant',icon:'📄',blocks:[{id:'body',type:'text',text:'Esempio curl'}]});
  await db.remember('caffe/unico','Vigilant seguito da curl e caffè',[],0);
  await db.remember('caffe/altro','Vigilant seguito da curl',[],0);
  const all=await searchAll(db,'vigilant curl',{pages:true,memories:true,limit:1});assert.equal(all.pages?.total,1);assert.equal(all.memories?.total,2);assert.equal(all.memories?.next_offset,1);
  const next=await searchAll(db,'vigilant curl',{pages:true,memories:true,limit:1,offset:1});assert.notEqual(next.memories?.results[0].key,all.memories?.results[0].key);
  const accents=await searchAll(db,'VIGILANT CAFFÈ',{pages:true,memories:true});assert.equal(accents.memories?.total,2);
  assert.equal((await searchAll(db,'vigilant curl',{pages:true,memories:true,mode:'phrase'})).memories?.total,0);
  const reader=await connection(db,['pages:read']);try{const r=await reader.client.callTool({name:'search_all',arguments:{query:'vigilant curl'}}),body=JSON.parse((r.content as {text:string}[])[0].text);assert.equal(body.memories,null);assert.equal(body.pages.total,1);assert.equal((await reader.client.listTools()).tools.some(t=>t.name==='empty_trash'),false);}finally{await reader.close();}
  const memoryReader=await connection(db,['memory:read']);try{const r=await memoryReader.client.callTool({name:'search_all',arguments:{query:'vigilant curl'}}),body=JSON.parse((r.content as {text:string}[])[0].text);assert.equal(body.pages,null);assert.equal(body.tasks,null);assert.equal(body.memories.total,2);}finally{await memoryReader.close();}
  await db.remember('long/accent','Premessa lunga. '.repeat(1000)+'Caffè specialissimofinale',[],0);
  const distant=await searchAll(db,'caffe specialissimofinale',{pages:false,memories:true});assert.match(distant.memories!.results[0].excerpt,/Caffè specialissimofinale/);
 }finally{await pg.close();}
});

test('contesto compatto: budget reale, estratti, limiti e cursore delle novità non lette',async()=>{
 const {pg,db}=await fixture();try{
  for(let i=0;i<8;i++)await db.remember('test/memory-'+i,'Corpo lungo '.repeat(4000),[],0);
  const compact=await getContext(db,'reader',true);assert.equal(compact.mode,'compact');assert.equal(compact.memories.length,5);assert.equal(compact.total_memories,8);assert.equal(compact.memories_truncated,true);assert.ok(compact.memories.every(m=>m.content.length===240&&m.content_truncated));assert.ok(JSON.stringify(compact).length<=16000);
  const tiny=await getContext(db,'reader',true,{mode:'full',max_chars:2000,memory_limit:8,change_limit:100});assert.ok(JSON.stringify(tiny).length<=2000);assert.equal(tiny.budget_truncated,true);assert.ok(tiny.changes.has_more);
  assert.equal(tiny.changes.next_cursor,tiny.changes.events.at(-1)?.id??tiny.changes.since_cursor);
  const rest=await new History(db).changes('reader',true,tiny.changes.next_cursor);assert.ok(rest.events.length>0);
  const limited=await getContext(db,'reader',false);assert.equal(limited.memories.length,0);assert.equal(limited.total_memories,0);assert.ok(limited.changes.events.every(e=>e.entity_type!=='memory'));
 }finally{await pg.close();}
});

test('cestino: conferma, conflitto atomico, relazioni conservate e cancellazione delle copie storiche',async()=>{
 const {pg,db}=await fixture();try{
  const parent=await createPage(db,{title:'Progetto da eliminare',kind:'project',icon:'📄',blocks:[{id:'sensitive',type:'text',text:'Contenuto da cancellare'}]});
  const child=await createPage(db,{title:'Figlio da conservare',icon:'📄',blocks:[]},parent.page.id);
  const linked=await db.snapshot();linked.workspace.tasks[0].project_id=parent.page.id;await db.save(linked.workspace,linked.revision);
  const snapshot=await db.snapshot();snapshot.workspace.pages.find(p=>p.id===parent.page.id)!.deleted=true;snapshot.workspace.pages.find(p=>p.id===child.page.id)!.deleted=true;
  await db.save(snapshot.workspace,snapshot.revision);
  const trash=new Trash(db),list=await trash.list();assert.equal(list.total,2);assert.equal(list.pages.find(p=>p.id===parent.page.id)!.linked_tasks,1);
  await assert.rejects(()=>trash.empty({pages:[{page_id:parent.page.id,expected_page_revision:2}]}),InputError);
  await assert.rejects(()=>trash.empty({pages:[{page_id:child.page.id,expected_page_revision:2},{page_id:parent.page.id,expected_page_revision:1}],confirm_permanent_deletion:true}),Conflict);
  assert.equal((await trash.list()).total,2);
  const unseen=await createPage(db,{title:'Cestino aggiunto dopo',icon:'📄',blocks:[]});await updatePage(db,unseen.page.id,1,p=>({...p,deleted:true}));
  const result=await trash.empty({pages:[{page_id:parent.page.id,expected_page_revision:2}],confirm_permanent_deletion:true});
  assert.equal(result.remaining_trash,2);assert.equal(result.workspace.pages.find(p=>p.id===child.page.id)?.parent,null);assert.equal(result.workspace.tasks[0].project_id,null);assert.equal(result.workspace.tasks.length,snapshot.workspace.tasks.length);
  const history=new History(db);await assert.rejects(()=>history.pageVersion(parent.page.id,1),InputError);
  const rows=await db.query('SELECT before_document,after_document FROM cm_history WHERE entity_type=\'page\' AND entity_id=$1',[parent.page.id]);assert.ok(rows.length>=2);assert.ok(rows.every(r=>r.before_document===null&&r.after_document===null));
  await assert.rejects(()=>trash.empty({pages:[{page_id:'welcome',expected_page_revision:1}],confirm_permanent_deletion:true}),InputError);
  await applySchema(pg);assert.equal((await trash.list()).total,2);
 }finally{await pg.close();}
});
