import {test,expect} from '@playwright/test';
import {mockCloud} from './helpers/cloud';
import type {Activity} from '../../lib/activity';

const event=(id:number):Activity=>({id,entity_type:'page',entity_id:'welcome',operation:'update',actor:{kind:id===1?'claude':'owner',id:id===1?'client':'owner',name:id===1?'Claude':'Tu'},title:id===1?'Versione precedente':'Versione attuale',changed_fields:['title','blocks'],revision:id+1,occurred_at:Date.UTC(2026,10,9,12,id)});

test('tipo e stato della pagina, attività del progetto e collegamento dalla tabella',async({page})=>{
 const cloud=await mockCloud(page);await page.getByRole('button',{name:/Benvenuto nel tuo Spazio/}).first().click();
 await page.getByLabel('Tipo pagina',{exact:true}).selectOption('project');await page.getByLabel('Stato pagina',{exact:true}).selectOption('active');
 await page.getByRole('button',{name:'Aggiungi attività al progetto'}).click();
 await expect.poll(()=>cloud.workspace.tasks.find(t=>t.project_id==='welcome')?.title).toBe('Nuova attività');
 const project=page.getByRole('region',{name:'Attività del progetto'});await expect(project).toContainText('0/1');
 await project.getByLabel('Completa Nuova attività').check();await expect(project).toContainText('1/1');
 await expect(page.getByLabel('Tipo pagina').locator('option[value=note]')).toBeDisabled();
 await page.getByRole('button',{name:'Tutti i progetti',exact:false}).first().click();
 await page.getByLabel('Progetto Organizzare gli appunti',{exact:true}).selectOption('welcome');
 await expect.poll(()=>cloud.workspace.tasks.find(t=>t.id==='t2')?.project_id).toBe('welcome');
 await page.getByRole('button',{name:/Benvenuto nel tuo Spazio/}).first().click();await expect(project).toContainText('1/2');
 expect(cloud.workspace.pages[0].kind).toBe('project');expect(cloud.workspace.pages[0].status).toBe('active');
});

test('cronologia con autore, anteprima prima della modifica e ripristino confermato',async({page})=>{
 const cloud=await mockCloud(page),previous=structuredClone(cloud.workspace.pages[0]);previous.title='Titolo da recuperare';previous.blocks=[{id:'old-block',type:'text',text:'Testo storico preservato'}];
 let restored=false;
 await page.route('**/api/history**',async route=>{
  const url=new URL(route.request().url());
  if(route.request().method()==='POST'){
   const body=route.request().postDataJSON();expect(body.side).toBe('before');expect(body.expected_page_revision).toBe(cloud.workspace.pages[0].revision);
   cloud.workspace.pages[0]={...previous,revision:2};cloud.revision++;restored=true;
   await route.fulfill({json:{page:cloud.workspace.pages[0],revision:2,workspace_revision:cloud.revision}});return;
  }
  if(url.searchParams.has('event_id')){await route.fulfill({json:{page:previous,event_id:1,side:'before'}});return;}
  await route.fulfill({json:{versions:[{...event(1),has_before:true,has_after:true}],next_before:null}});
 });
 await page.getByRole('button',{name:/Benvenuto nel tuo Spazio/}).first().click();await page.getByRole('button',{name:'Menu dello spazio'}).click();await page.getByRole('button',{name:'Cronologia pagina',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Cronologia pagina'});await expect(dialog).toContainText('Claude');await dialog.getByRole('button',{name:'Prima della modifica'}).click();
 await expect(dialog.locator('pre')).toContainText('Testo storico preservato');await dialog.getByRole('button',{name:'Ripristina questa versione'}).click();expect(restored).toBe(false);
 await dialog.getByRole('button',{name:'Conferma ripristino'}).click();await expect.poll(()=>restored).toBe(true);await page.getByLabel('Chiudi finestra').click();
 await expect(page.getByLabel('Titolo della pagina',{exact:true})).toHaveValue('Titolo da recuperare');await expect(page.locator('[contenteditable]').first()).toHaveText('Testo storico preservato');
});

test('novità paginate: nessuna lettura implicita, conferma del cursore visto e persistenza dopo ricarica',async({page})=>{
 await mockCloud(page);let checkpoint=0;
 await page.route('**/api/changes**',async route=>{
  if(route.request().method()==='POST'){checkpoint=route.request().postDataJSON().cursor;await route.fulfill({json:{cursor:checkpoint}});return;}
  const url=new URL(route.request().url()),since=Number(url.searchParams.get('since_cursor')??checkpoint);
  await route.fulfill({json:{events:since===0?[event(1)]:since===1?[event(2)]:[],since_cursor:since,next_cursor:since===0?1:2,latest_cursor:2,has_more:since===0}});
 });
 await page.getByRole('button',{name:'Cosa è cambiato',exact:true}).click();await expect(page.locator('.activity-list')).toContainText('Claude');expect(checkpoint).toBe(0);
 await page.getByRole('button',{name:'Carica altre modifiche'}).click();await expect(page.locator('.activity-list article')).toHaveCount(2);expect(checkpoint).toBe(0);
 await page.getByRole('button',{name:'Segna queste modifiche come lette'}).click();await expect.poll(()=>checkpoint).toBe(2);await expect(page.getByText('Nessuna nuova modifica da leggere.')).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Cosa è cambiato',exact:true}).click();await expect(page.getByText('Nessuna nuova modifica da leggere.')).toBeVisible();
});

test('importare un backup rimappa anche il progetto delle attività',async({page})=>{
 const cloud=await mockCloud(page),copy=structuredClone(cloud.workspace);copy.pages[0].kind='project';copy.tasks[0].project_id='welcome';
 await page.locator('input[type=file]').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(copy))});
 await expect.poll(()=>cloud.workspace.tasks.length).toBe(8);
 const imported=cloud.workspace.tasks.find(t=>t.id!=='t1'&&t.title===copy.tasks[0].title)!;
 expect(imported.project_id).not.toBe('welcome');expect(cloud.workspace.pages.find(p=>p.id===imported.project_id)?.kind).toBe('project');
});
