import {test,expect} from '@playwright/test';
import {mockCloud} from './helpers/cloud';

test('importa un brief Markdown nell’app e lo esporta conservando checkbox e codice',async({page})=>{
 const cloud=await mockCloud(page);
 await page.locator('input[type=file]').setInputFiles({name:'brief.md',mimeType:'text/markdown',buffer:Buffer.from('# Brief nuovo\n\n## Todo\n\n- [x] Prima scelta\n\n- [ ] Seconda scelta\n\n3. Terza\n4. Quarta\n\n```js\nconst idea = true;\n```')});
 await expect(page.getByRole('textbox',{name:'Titolo della pagina'})).toHaveValue('Brief nuovo');
 await expect(page.locator('.block-todo input').first()).toBeChecked();await expect(page.locator('.block-todo input').nth(1)).not.toBeChecked();
 await expect(page.locator('.block-todo [contenteditable]').first()).toHaveText('Prima scelta');await expect(page.locator('.block-todo [contenteditable]').nth(1)).toHaveText('Seconda scelta');
 await expect(page.locator('.block-numbered')).toHaveCount(2);await expect(page.locator('.block-code')).toContainText('const idea = true;');
 await expect.poll(()=>cloud.workspace.pages.some(p=>p.title==='Brief nuovo')).toBe(true);
 await page.getByRole('button',{name:'Menu dello spazio'}).click();
 const event=page.waitForEvent('download');await page.getByRole('button',{name:'Esporta Markdown'}).click();const download=await event;
 const stream=await download.createReadStream();const chunks:Buffer[]=[];for await(const part of stream!)chunks.push(Buffer.from(part));const text=Buffer.concat(chunks).toString('utf8');
 expect(text).toContain('# Brief nuovo');expect(text).toContain('- [x] Prima scelta');expect(text).toContain('```js');
});

test('una modifica del browser non sovrascrive un’altra pagina aggiornata da Claude',async({page})=>{
 const cloud=await mockCloud(page);await page.getByRole('button',{name:/Benvenuto nel tuo Spazio/}).first().click();
 cloud.workspace.pages[1].title='Aggiornamento indipendente di Claude';cloud.workspace.pages[1].revision!++;cloud.revision++;
 await page.getByRole('textbox',{name:'Titolo della pagina'}).fill('Modifica indipendente nel browser');
 await page.getByRole('button',{name:'Sincronizza',exact:true}).click();
 await expect(page.locator('.cloud-banner')).toContainText('Sincronizzazione completata.');
 expect(cloud.workspace.pages[0].title).toBe('Modifica indipendente nel browser');expect(cloud.workspace.pages[1].title).toBe('Aggiornamento indipendente di Claude');
 await expect(page.getByRole('button',{name:/Aggiornamento indipendente di Claude/}).first()).toBeVisible();
});

test('una bozza ripresa dopo il riavvio si unisce alle modifiche remote di altre pagine',async({page})=>{
 const cloud=await mockCloud(page),base=structuredClone(cloud.workspace),draft=structuredClone(base);draft.pages[0].title='Bozza recuperata';
 await page.evaluate(({workspace,base})=>localStorage.setItem('cosmomemo.cloud-draft.v1',JSON.stringify({workspace,base,revision:1})),{workspace:draft,base});
 cloud.workspace.pages[1].title='Nuovo contenuto remoto';cloud.workspace.pages[1].revision!++;cloud.revision++;
 await page.reload();await expect(page.getByText('Salvato in Neon',{exact:true})).toBeVisible();
 await expect.poll(()=>cloud.workspace.pages[0].title).toBe('Bozza recuperata');expect(cloud.workspace.pages[1].title).toBe('Nuovo contenuto remoto');
 await expect(page.getByRole('button',{name:'Esporta bozza e ricarica'})).toHaveCount(0);
});
