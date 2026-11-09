import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {Store,type Row} from '../lib/cloud/store';
import {createMcpServer} from '../lib/cloud/mcp';
import {SCOPES} from '../lib/cloud/oauth';

test('Claude cancella singole pagine e attività con revisioni e conserva le sottopagine',async()=>{
 const pg=new PGlite();
 await pg.exec(readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8'));
 const db=new Store(async(sql,args=[])=>{const result=await pg.query(sql,args);return result.rows as Row[];});
 const server=createMcpServer(db,SCOPES),client=new Client({name:'deletion-test',version:'1'}),pair=InMemoryTransport.createLinkedPair();
 await server.connect(pair[0]);await client.connect(pair[1]);
 const call=(name:string,args:Record<string,unknown>)=>client.callTool({name,arguments:args});
 const json=(result:unknown)=>JSON.parse((result as {content:{text:string}[]}).content[0].text);
 try{
  const tools=await client.listTools();
  for(const name of ['delete_page','delete_task'])assert.equal(tools.tools.find(t=>t.name===name)?.annotations?.destructiveHint,true);
  const parent=json(await call('create_page',{title:'Genitore da cancellare'})).page;
  const child=json(await call('create_page',{title:'Sottopagina da conservare',parent_id:parent.id})).page;
  const grandchild=json(await call('create_page',{title:'Nipote da conservare',parent_id:child.id})).page;
  const before=await db.snapshot();
  assert.equal((await call('delete_page',{page_id:parent.id,expected_revision:before.revision-1})).isError,true);
  assert.equal((await db.snapshot()).workspace.pages.find(p=>p.id===parent.id)?.deleted,false);
  assert.equal((await call('delete_page',{page_id:'missing',expected_revision:before.revision})).isError,true);
  assert.equal((await db.snapshot()).revision,before.revision);
  const removed=json(await call('delete_page',{page_id:parent.id,expected_revision:before.revision}));
  assert.equal(removed.trashed,true);assert.equal(removed.permanently_deleted,false);assert.deepEqual(removed.retained_children,[child.id]);
  const after=await db.snapshot();
  assert.equal(after.workspace.pages.find(p=>p.id===parent.id)?.deleted,true);
  assert.equal(after.workspace.pages.find(p=>p.id===child.id)?.parent,null);
  assert.equal(after.workspace.pages.find(p=>p.id===grandchild.id)?.parent,child.id);
  assert.equal(after.workspace.pages.length,before.workspace.pages.length);
  const visible=json(await call('list_pages',{query:'Genitore da cancellare'}));assert.equal(visible.pages.length,0);
  assert.equal((await call('delete_page',{page_id:parent.id,expected_revision:after.revision})).isError,true);
  assert.equal((await db.snapshot()).revision,after.revision);
  const task=after.workspace.tasks[0];
  assert.equal((await call('delete_task',{task_id:task.id,expected_revision:before.revision})).isError,true);
  assert.equal((await call('delete_task',{task_id:'missing',expected_revision:after.revision})).isError,true);
  assert.equal((await db.snapshot()).revision,after.revision);
  const deleted=json(await call('delete_task',{task_id:task.id,expected_revision:after.revision}));assert.equal(deleted.permanently_deleted,true);
  const remaining=await db.snapshot();assert.deepEqual(remaining.workspace.tasks,after.workspace.tasks.filter(t=>t.id!==task.id));
  assert.equal((await call('delete_task',{task_id:task.id,expected_revision:remaining.revision})).isError,true);
  const readOnly=createMcpServer(db,['pages:read']),reader=new Client({name:'read-only',version:'1'}),linked=InMemoryTransport.createLinkedPair();
  await readOnly.connect(linked[0]);await reader.connect(linked[1]);
  try{
   assert.equal((await reader.listTools()).tools.some(t=>['delete_page','delete_task'].includes(t.name)),false);
   const denied=await reader.callTool({name:'delete_task',arguments:{task_id:remaining.workspace.tasks[0].id,expected_revision:remaining.revision}}).catch(()=>({isError:true}));
   assert.equal(denied.isError,true);assert.equal((await db.snapshot()).revision,remaining.revision);
  }finally{await reader.close();await readOnly.close();}
  const memory=json(await call('remember',{key:'temporary/memory',content:'Ricordo da eliminare'}));
  await call('forget',{key:memory.key,expected_revision:memory.revision});assert.equal((await db.memories('temporary/memory')).length,0);
 }finally{await client.close();await server.close();await pg.close();}
});
