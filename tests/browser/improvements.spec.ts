import {test,expect} from '@playwright/test';
import {mockCloud} from './helpers/cloud';

test('ricerca unica: gruppi pagine/attività/ricordi, modalità e apertura del ricordo',async({page})=>{
 await mockCloud(page);const requests:{q:string;mode:string}[]=[];
 await page.route('**/api/search?**',async route=>{const url=new URL(route.request().url());requests.push({q:url.searchParams.get('q')!,mode:url.searchParams.get('mode')!});await route.fulfill({json:{query:'vigilant curl',mode:url.searchParams.get('mode'),terms:['vigilant','curl'],access:{pages:true,memories:true},pages:{total:1,next_offset:null,results:[{page_id:'welcome',title:'Pagina vigilant',matches:[{excerpt:'Esempio curl'}]}]},tasks:{total:1,next_offset:null,results:[{id:'t1',title:'Attività vigilant curl',status:'In corso',project_title:'Progetto'}]},memories:{total:1,next_offset:null,results:[{key:'test/vigilant',excerpt:'Ricordo curl'}]}}});});
 await page.getByRole('button',{name:'Cerca',exact:false}).first().click();const dialog=page.getByRole('dialog',{name:'Cerca nello spazio'});await dialog.getByLabel('Cerca nello spazio').fill('vigilant curl');
 await expect(dialog).toContainText('PAGINE · 1');await expect(dialog).toContainText('ATTIVITÀ · 1');await expect(dialog).toContainText('RICORDI · 1');expect(requests.at(-1)).toEqual({q:'vigilant curl',mode:'all'});
 await dialog.getByLabel('Modalità di ricerca').selectOption('phrase');await expect.poll(()=>requests.at(-1)?.mode).toBe('phrase');await expect(dialog).toContainText('Cerca la frase esatta');
 await dialog.getByRole('button',{name:/test\/vigilant/}).click();await expect(page.getByRole('heading',{name:'Memoria di Claude',exact:true})).toBeVisible();await expect(page.getByLabel('Cerca nella memoria')).toHaveValue('test/vigilant');
});

test('svuota cestino: conferma esplicita, conserva le pagine aggiunte dopo la selezione',async({page})=>{
 const cloud=await mockCloud(page);cloud.workspace.pages[1].deleted=true;cloud.revision++;
 await page.getByRole('button',{name:'Sincronizza',exact:true}).click();await page.getByRole('button',{name:'Cestino',exact:true}).click();let removed=false;
 await page.route('**/api/trash',async route=>{const b=route.request().postDataJSON();expect(b.confirm_permanent_deletion).toBe(true);expect(b.pages).toEqual([{page_id:'ideas',expected_page_revision:1}]);cloud.workspace.pages=cloud.workspace.pages.filter(p=>p.id!=='ideas');cloud.revision++;removed=true;await route.fulfill({json:{permanently_deleted:true,deleted_page_ids:['ideas']}});});
 await page.getByRole('button',{name:'Svuota cestino'}).click();expect(removed).toBe(false);await expect(page.getByText(/comprese le copie nella loro cronologia/)).toBeVisible();await page.getByRole('button',{name:'Annulla',exact:true}).click();expect(removed).toBe(false);
 await page.getByRole('button',{name:'Svuota cestino'}).click();cloud.workspace.pages[2].deleted=true;cloud.workspace.pages[2].revision!++;cloud.revision++;
 await page.getByRole('button',{name:'Conferma eliminazione definitiva'}).click();await expect.poll(()=>removed).toBe(true);await expect(page.locator('.trash-row')).toHaveCount(1);await expect(page.locator('.trash-row')).toContainText('La mia settimana');expect(cloud.workspace.pages.some(p=>p.id==='welcome')).toBe(true);
});

test('errore nello svuotamento: il cestino resta disponibile senza perdere le pagine',async({page})=>{
 const cloud=await mockCloud(page);cloud.workspace.pages[1].deleted=true;cloud.revision++;
 await page.getByRole('button',{name:'Sincronizza',exact:true}).click();await page.getByRole('button',{name:'Cestino',exact:true}).click();await page.route('**/api/trash',route=>route.fulfill({status:503,json:{error:'Connessione interrotta. Riprova.'}}));
 await page.getByRole('button',{name:'Svuota cestino'}).click();await page.getByRole('button',{name:'Conferma eliminazione definitiva'}).click();await expect(page.locator('.trash-actions').getByRole('alert')).toContainText('Connessione interrotta');await expect(page.locator('.trash-row')).toHaveCount(1);await expect(page.getByRole('button',{name:'Ripristina',exact:true})).toBeVisible();expect(cloud.workspace.pages.some(p=>p.id==='ideas')).toBe(true);
});
