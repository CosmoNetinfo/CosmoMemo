import {test,expect,type Page} from '@playwright/test';
import {mockCloud} from './helpers/cloud';
import {initial,type Page as WorkspacePage} from '../../lib/workspace';

async function directoryFixture(page:Page){
 const cloud=await mockCloud(page),base=initial.pages[0];
 cloud.workspace.pages=Array.from({length:137},(_,i):WorkspacePage=>({...structuredClone(base),id:'page-'+i,title:'Pagina '+String(i).padStart(3,'0'),revision:1,updated:Date.UTC(2026,10,10,12)+i,kind:i%3===0?'project':i%3===1?'idea':'note',status:i%4===0?'active':'draft',favorite:i===16,parent:i>0&&i<20?'page-'+(i-1):null,blocks:[{id:'block-'+i,type:'text',text:i===16?'Un dettaglio ricercabile unico':'Contenuto di esempio'}]}));
 cloud.workspace.pages.push({...structuredClone(base),id:'trashed',title:'DA NON MOSTRARE',deleted:true});cloud.revision++;
 await page.getByRole('button',{name:'Sincronizza',exact:true}).click();return cloud;
}

test('archivio completo: tutte le pagine, paginazione, sottopagine profonde e ritorno senza perdere posizione',async({page})=>{
 await directoryFixture(page);await page.getByRole('button',{name:/^Tutte le pagine/}).click();const archive=page.getByRole('region',{name:'Archivio delle pagine'});
 await expect(archive.getByRole('heading',{name:'Tutte le pagine',exact:true})).toBeVisible();await expect(archive.getByRole('status')).toContainText('137 di 137 pagine');await expect(archive.locator('.directory-row')).toHaveCount(50);
 await archive.getByLabel('Vai alla pagina dell’elenco').selectOption('3');await expect(archive.locator('.directory-row')).toHaveCount(37);await expect(archive.getByRole('status')).toContainText('101–137');
 await archive.getByRole('button',{name:'Apri pagina Pagina 016',exact:true}).click();await expect(page.getByLabel('Titolo della pagina',{exact:true})).toHaveValue('Pagina 016');
 await page.getByRole('button',{name:/^Tutte le pagine/}).click();await expect(archive.getByLabel('Vai alla pagina dell’elenco')).toHaveValue('3');await expect(archive.getByRole('button',{name:'Apri pagina Pagina 000',exact:true})).toBeVisible();
 await archive.getByLabel('Pagine per schermata').selectOption('25');await expect(archive.locator('.directory-row')).toHaveCount(25);await expect(archive.getByLabel('Vai alla pagina dell’elenco')).toHaveValue('1');
 await expect(archive.getByRole('button',{name:/DA NON MOSTRARE/})).toHaveCount(0);
});

test('ricerca nel contenuto e filtri combinati, nessun risultato, reset e ordinamento',async({page})=>{
 const cloud=await directoryFixture(page);await page.getByRole('button',{name:'Vedi tutte le pagine',exact:true}).click();const archive=page.getByRole('region',{name:'Archivio delle pagine'});
 await archive.getByLabel('Cerca tra tutte le pagine').fill('dettaglio unico');await expect(archive.locator('.directory-row')).toHaveCount(1);await expect(archive).toContainText('Pagina 016');
 await archive.getByLabel('Filtra pagine per tipo').selectOption('idea');await archive.getByLabel('Filtra pagine per stato').selectOption('active');await archive.getByRole('button',{name:'Preferiti',exact:true}).click();await expect(archive.locator('.directory-row')).toHaveCount(1);
 await archive.getByLabel('Filtra pagine per tipo').selectOption('project');await expect(archive.getByText('Nessuna pagina con questi filtri')).toBeVisible();await archive.getByRole('button',{name:'Rimuovi filtri'}).click();
 await archive.getByLabel('Ordina pagine').selectOption('name');await expect(archive.locator('.directory-row').first()).toContainText('Pagina 000');await archive.getByLabel('Ordina pagine').selectOption('recent');await expect(archive.locator('.directory-row').first()).toContainText('Pagina 136');
 expect(cloud.events.filter(e=>e==='PUT')).toHaveLength(0);
});

test('elenco su telefono: accesso dalla navigazione, filtri e apertura di una pagina',async({page})=>{
 await mockCloud(page);await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Apri navigazione'}).click();await page.getByRole('button',{name:/^Tutte le pagine/}).click();const archive=page.getByRole('region',{name:'Archivio delle pagine'});
 await expect(archive).toBeVisible();await archive.getByLabel('Cerca tra tutte le pagine').fill('ispirazioni');await expect(archive.locator('.directory-row')).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await archive.getByRole('button',{name:'Apri pagina Appunti e ispirazioni'}).click();await expect(page.getByLabel('Titolo della pagina',{exact:true})).toHaveValue('Appunti e ispirazioni');
});
