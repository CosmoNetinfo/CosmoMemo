import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {applySchema} from './helpers/schema';
import {Store,type Row} from '../lib/cloud/store';
import {createMcpServer} from '../lib/cloud/mcp';
import {SCOPES} from '../lib/cloud/oauth';

test('strumenti reali: Markdown, sezioni, blocchi, contesto, ricerca, spostamento e ripristino',async()=>{
 const pg=new PGlite();await applySchema(pg);const db=new Store(async(sql,args=[])=>{const result=await pg.query(sql,args);return result.rows as Row[];});
 const server=createMcpServer(db,SCOPES),client=new Client({name:'content-test',version:'1'}),pair=InMemoryTransport.createLinkedPair();await server.connect(pair[0]);await client.connect(pair[1]);
 const call=(name:string,args:Record<string,unknown>)=>client.callTool({name,arguments:args});
 const json=(value:unknown)=>JSON.parse((value as {content:{text:string}[]}).content[0].text);
 try{
  const imported=json(await call('create_page_from_markdown',{markdown:'# Progetto nuovo\n\n## Todo\n\n- [ ] Scrivere il brief\n\n## Decisioni\n\nDatabase Neon'}));
  assert.equal(imported.revision,1);assert.equal(imported.page.title,'Progetto nuovo');
  assert.equal((await call('update_page',{page_id:imported.page.id,expected_revision:imported.workspace_revision,title:'Vecchio schema'})).isError,true);
  const section=json(await call('read_section',{page_id:imported.page.id,heading:'Todo'}));assert.equal(section.blocks[0].type,'todo');
  const appended=json(await call('append_to_section',{page_id:imported.page.id,heading_id:section.heading.id,text:'- [ ] Aggiungere una seconda idea',expected_page_revision:section.revision}));assert.equal(appended.revision,2);
  const other=appended.page.blocks.find((b:{text:string})=>b.text==='Database Neon');
  const updated=json(await call('update_block',{page_id:imported.page.id,block_id:section.blocks[0].id,checked:true,expected_page_revision:appended.revision}));
  assert.equal(updated.page.blocks.find((b:{id:string})=>b.id===section.blocks[0].id).checked,true);assert.deepEqual(updated.page.blocks.find((b:{id:string})=>b.id===other.id),other);
  const exported=json(await call('export_page_markdown',{page_id:imported.page.id}));assert.match(exported.markdown,/- \[x\] Scrivere il brief/);assert.ok(exported.markdown.indexOf('seconda idea')<exported.markdown.indexOf('## Decisioni'));
  const searched=json(await call('search_pages',{query:'Database Neon'}));assert.equal(searched.results[0].page_id,imported.page.id);assert.equal(searched.results[0].matches[0].section.title,'Decisioni');
  await call('remember',{key:'project/new',content:'Contesto utile per il progetto'});
  const context=json(await call('get_context',{}));assert.ok(context.page_tree.total>=5);assert.equal(context.memories[0].key,'project/new');assert.ok(context.open_tasks.every((t:{status:string})=>t.status!=='Completato'));
  const parent=json(await call('create_page',{title:'Cartella'}));
  const moved=json(await call('move_page',{page_id:imported.page.id,parent_id:parent.page.id,expected_page_revision:updated.revision}));assert.equal(moved.page.parent,parent.page.id);
  const bad=await call('move_page',{page_id:parent.page.id,parent_id:imported.page.id,expected_page_revision:parent.revision});assert.equal(bad.isError,true);
  const deleted=json(await call('delete_page',{page_id:imported.page.id,expected_page_revision:moved.revision}));
  const restored=json(await call('restore_page',{page_id:imported.page.id,expected_page_revision:deleted.revision}));assert.equal(restored.page.deleted,false);assert.equal(restored.page.parent,parent.page.id);
  const readonly=createMcpServer(db,['pages:read']),reader=new Client({name:'reader',version:'1'}),linked=InMemoryTransport.createLinkedPair();await readonly.connect(linked[0]);await reader.connect(linked[1]);
  try{const tools=await reader.listTools();assert.equal(tools.tools.some(tool=>tool.name==='update_block'),false);const limited=json(await reader.callTool({name:'get_context',arguments:{}}));assert.equal(limited.memory_access,false);assert.deepEqual(limited.memories,[]);}finally{await reader.close();await readonly.close();}
 }finally{await client.close();await server.close();await pg.close();}
});
