import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {applySchema} from './helpers/schema';
import {Store,Conflict,InputError,type Row} from '../lib/cloud/store';
import {workspaceChanges,rebaseWorkspace} from '../lib/workspace-changes';

async function fixture(){const pg=new PGlite();await applySchema(pg);const db=new Store(async(sql,args=[])=>{const result=await pg.query(sql,args);return result.rows as Row[];});return {pg,db};}
test('revisioni indipendenti: due pagine si aggiornano in parallelo senza conflitti globali',async()=>{
 const {pg,db}=await fixture();try{
  const base=await db.snapshot(),one=structuredClone(base.workspace),two=structuredClone(base.workspace);
  one.pages[0].title='Pagina A aggiornata';two.pages[1].title='Pagina B aggiornata';
  const responses=await Promise.all([db.save(one,base.revision,base.workspace),db.save(two,base.revision,base.workspace)]);
  const saved=await db.snapshot();assert.equal(saved.workspace.pages[0].title,'Pagina A aggiornata');assert.equal(saved.workspace.pages[1].title,'Pagina B aggiornata');assert.equal(saved.workspace.pages[0].revision,2);assert.equal(saved.workspace.pages[1].revision,2);assert.equal(saved.revision,2);assert.equal(responses.length,2);
  await assert.rejects(()=>db.save(one,base.revision,base.workspace),Conflict);
  assert.equal((await db.snapshot()).workspace.pages[1].title,'Pagina B aggiornata');
 }finally{await pg.close();}
});
test('una scrittura basata su una vecchia schermata conserva pagine e attività cambiate altrove',async()=>{
 const {pg,db}=await fixture();try{
  const base=await db.snapshot(),remote=structuredClone(base.workspace),local=structuredClone(base.workspace);
  remote.pages[1].title='Scritta da Claude';remote.tasks[0].status='Completato';await db.save(remote,base.revision,base.workspace);
  local.pages[0].title='Scritta nel browser';const saved=await db.save(local,base.revision,base.workspace);
  assert.equal(saved.workspace.pages[0].title,'Scritta nel browser');assert.equal(saved.workspace.pages[1].title,'Scritta da Claude');assert.equal(saved.workspace.tasks[0].status,'Completato');
  const during=structuredClone(local);during.pages[0].blocks[0].text='Continuo a scrivere';const rebased=rebaseWorkspace(local,during,saved.workspace);
  assert.equal(rebased.pages[0].revision,2);assert.equal(rebased.pages[1].title,'Scritta da Claude');
  const again=await db.save(rebased,saved.revision,saved.workspace);assert.equal(again.workspace.pages[0].revision,3);
 }finally{await pg.close();}
});
test('conflitto su una pagina annulla tutto il lotto senza toccare altri elementi',async()=>{
 const {pg,db}=await fixture();try{
  const base=await db.snapshot(),remote=structuredClone(base.workspace),batch=structuredClone(base.workspace);
  remote.pages[1].title='Versione da conservare';await db.save(remote,base.revision,base.workspace);
  batch.pages[0].title='Non deve essere salvata parzialmente';batch.pages[1].title='Vecchia versione';batch.tasks[0].title='Neppure questa';
  await assert.rejects(()=>db.save(batch,base.revision,base.workspace),Conflict);
  const saved=await db.snapshot();assert.equal(saved.workspace.pages[0].title,base.workspace.pages[0].title);assert.equal(saved.workspace.pages[1].title,'Versione da conservare');assert.equal(saved.workspace.tasks[0].title,base.workspace.tasks[0].title);
 }finally{await pg.close();}
});
test('compatibilità vecchi salvataggi e controllo dei cicli anche tra richieste concorrenti',async()=>{
 const {pg,db}=await fixture();try{
  const base=await db.snapshot(),legacy=structuredClone(base.workspace);legacy.pages[0].title='Vecchio client';
  const saved=await db.save(legacy,base.revision);assert.equal(saved.workspace.pages[0].revision,2);
  await assert.rejects(()=>db.save(legacy,base.revision),Conflict);
  const a=structuredClone(saved.workspace),b=structuredClone(saved.workspace);a.pages[0].parent=a.pages[1].id;b.pages[1].parent=b.pages[0].id;
  const results=await Promise.allSettled([db.apply(workspaceChanges(saved.workspace,a)),db.apply(workspaceChanges(saved.workspace,b))]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
  const current=await db.snapshot();assert.ok(current.workspace.pages[0].parent===null||current.workspace.pages[1].parent===null);
 }finally{await pg.close();}
});
