import {test,expect,type Page} from '@playwright/test';
import {initial,type Workspace} from '../../lib/workspace';

import {mockCloud} from './helpers/cloud';

const sync=(page:Page)=>page.getByRole('button',{name:'Sincronizza',exact:true});
const banner=(page:Page)=>page.locator('.cloud-banner');

test('il pulsante aggiorna pagine, editor e mostra la conferma anche senza novità',async({page})=>{
 const cloud=await mockCloud(page);
 await page.getByRole('button',{name:/Benvenuto nel tuo Spazio/}).first().click();
 cloud.workspace.pages[0].title='Aggiornata da Claude';cloud.workspace.pages[0].blocks[1].text='Testo nuovo dal cloud';cloud.workspace.pages[0].revision!++;cloud.revision++;
 await sync(page).click();
 await expect(page.getByRole('textbox',{name:'Titolo della pagina'})).toHaveValue('Aggiornata da Claude');
 await expect(page.locator('[contenteditable]').nth(1)).toHaveText('Testo nuovo dal cloud');
 await expect(banner(page)).toContainText('Sincronizzazione completata.');
 await sync(page).click();await expect(banner(page)).toContainText('Sincronizzazione completata.');
});

test('sincronizza anche i ricordi, che non cambiano la revisione delle pagine',async({page})=>{
 const cloud=await mockCloud(page);
 await page.getByRole('button',{name:'Memoria di Claude',exact:true}).click();
 await expect(page.getByText('Un nuovo punto di partenza.')).toBeVisible();
 cloud.memories=[{key:'preferenze/stile',content:'Ricordo aggiunto da Claude',tags:[],revision:1,updatedAt:Date.now()}];
 await sync(page).click();await expect(page.getByText('Ricordo aggiunto da Claude',{exact:true})).toBeVisible();
 cloud.memories=[];await sync(page).click();await expect(page.getByText('Un nuovo punto di partenza.')).toBeVisible();
});

test('salva le modifiche in attesa prima di scaricare la versione cloud',async({page})=>{
 const cloud=await mockCloud(page);
 await page.getByRole('button',{name:/Benvenuto nel tuo Spazio/}).first().click();
 cloud.events=[];
 await page.getByRole('textbox',{name:'Titolo della pagina'}).fill('Modifica locale da conservare');
 await expect(sync(page)).toBeEnabled();await sync(page).click();
 await expect(banner(page)).toContainText('Sincronizzazione completata.');
 expect(cloud.workspace.pages[0].title).toBe('Modifica locale da conservare');
 expect(cloud.events).toEqual(['PUT','GET']);
 await expect(page.getByRole('textbox',{name:'Titolo della pagina'})).toHaveValue('Modifica locale da conservare');
});

test('mostra gli errori e permette di riprovare senza ricaricare la pagina',async({page})=>{
 const cloud=await mockCloud(page);cloud.failRead=503;
 await sync(page).click();await expect(banner(page).getByRole('alert')).toContainText('Sincronizzazione non riuscita');
 await expect(sync(page)).toBeEnabled();
 await sync(page).click();await expect(banner(page)).toContainText('Sincronizzazione completata.');
 await expect(banner(page).getByRole('alert')).toHaveCount(0);
 cloud.failRead=401;await sync(page).click();
 await expect(banner(page)).toContainText('Sessione scaduta');await expect(page.getByRole('link',{name:'Accedi di nuovo'})).toBeVisible();
});

test('mostra il caricamento ed evita richieste duplicate',async({page})=>{
 const cloud=await mockCloud(page);let started!:()=>void,release!:()=>void;
 const startedPromise=new Promise<void>(resolve=>{started=resolve;});
 cloud.holdRead={started,wait:new Promise<void>(resolve=>{release=resolve;})};
 await sync(page).click();await startedPromise;
 await expect(page.getByRole('button',{name:'Sincronizzazione…',exact:true})).toBeDisabled();
 release();await expect(sync(page)).toBeEnabled();await expect(banner(page)).toContainText('Sincronizzazione completata.');
});

test('una risposta lenta non sostituisce ciò che viene scritto durante la sincronizzazione',async({page})=>{
 const cloud=await mockCloud(page);await page.getByRole('button',{name:/Benvenuto nel tuo Spazio/}).first().click();
 let started!:()=>void,release!:()=>void;const startedPromise=new Promise<void>(resolve=>{started=resolve;});
 cloud.holdRead={started,wait:new Promise<void>(resolve=>{release=resolve;})};
 await sync(page).click();await startedPromise;
 await page.getByRole('textbox',{name:'Titolo della pagina'}).fill('Scrittura durante sincronizzazione');
 release();await expect(sync(page)).toBeEnabled();
 await expect(page.getByRole('textbox',{name:'Titolo della pagina'})).toHaveValue('Scrittura durante sincronizzazione');
 await expect.poll(()=>cloud.workspace.pages[0].title).toBe('Scrittura durante sincronizzazione');
});

test('se la pagina aperta è stata cancellata, torna alla home dopo la sincronizzazione',async({page})=>{
 const cloud=await mockCloud(page);await page.getByRole('button',{name:/Benvenuto nel tuo Spazio/}).first().click();
 cloud.workspace.pages[0].deleted=true;cloud.workspace.pages[0].revision!++;cloud.revision++;
 await sync(page).click();await expect(page.getByRole('heading',{name:'Bentornato nel tuo Spazio'})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Titolo della pagina'})).toHaveCount(0);
});

test('un salvataggio fallito conserva la bozza e impedisce di sostituirla con il cloud',async({page})=>{
 const cloud=await mockCloud(page);await page.getByRole('button',{name:/Benvenuto nel tuo Spazio/}).first().click();
 cloud.failSave=503;cloud.events=[];
 await page.getByRole('textbox',{name:'Titolo della pagina'}).fill('Bozza da non perdere');
 await sync(page).click();await expect(banner(page)).toContainText('La bozza resta in questo browser');
 expect(cloud.events).toEqual(['PUT']);
 await expect(page.getByRole('textbox',{name:'Titolo della pagina'})).toHaveValue('Bozza da non perdere');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('cosmomemo.cloud-draft.v1')!).workspace.pages[0].title)).toBe('Bozza da non perdere');
 await sync(page).click();await expect(banner(page)).toContainText('Sincronizzazione completata.');
 expect(cloud.workspace.pages[0].title).toBe('Bozza da non perdere');
});

test('una modifica concorrente nel cloud ferma la sincronizzazione e conserva entrambe le versioni',async({page})=>{
 const cloud=await mockCloud(page);await page.getByRole('button',{name:/Benvenuto nel tuo Spazio/}).first().click();
 cloud.workspace.pages[0].title='Versione remota da conservare';cloud.workspace.pages[0].revision!++;cloud.revision++;
 await page.getByRole('textbox',{name:'Titolo della pagina'}).fill('Versione locale da conservare');
 await sync(page).click();await expect(page.getByRole('button',{name:'Esporta bozza e ricarica'})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Titolo della pagina'})).toHaveValue('Versione locale da conservare');
 expect(cloud.workspace.pages[0].title).toBe('Versione remota da conservare');
});
