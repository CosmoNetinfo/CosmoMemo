import {expect,type Page} from '@playwright/test';
import {initial,type Workspace} from '../../../lib/workspace';
import {entityRevision,hasEntityConflict,normalizeWorkspace,rebaseWorkspace,workspaceChanges} from '../../../lib/workspace-changes';

export async function mockCloud(page:Page){
 const state={workspace:normalizeWorkspace(structuredClone(initial)),revision:1,memories:[] as {key:string;content:string;tags:string[];revision:number;updatedAt:number}[],failRead:0,failSave:0,holdRead:null as null|{started:()=>void;wait:Promise<void>},events:[] as string[]};
 await page.route('**/api/session',route=>route.fulfill({json:{configured:true,initialized:true,authenticated:true}}));
 await page.route('**/api/memories?**',route=>route.fulfill({json:{memories:state.memories}}));
 await page.route('**/api/workspace',async route=>{
  const method=route.request().method();state.events.push(method);
  if(method==='GET'){
   if(state.failRead){const status=state.failRead;state.failRead=0;await route.fulfill({status,json:{error:'Errore simulato'}});return;}
   const snapshot={workspace:structuredClone(state.workspace),revision:state.revision};
   const hold=state.holdRead;state.holdRead=null;if(hold){hold.started();await hold.wait;}
   await route.fulfill({json:snapshot});return;
  }
  if(method==='PUT'){
   if(state.failSave){const status=state.failSave;state.failSave=0;await route.fulfill({status,json:{error:'Errore simulato'}});return;}
   const body=route.request().postDataJSON() as {workspace:Workspace;revision:number;base?:Workspace};
   const base=body.base||state.workspace;
   if(body.base?hasEntityConflict(base,body.workspace,state.workspace):body.revision!==state.revision){await route.fulfill({status:409,json:{error:'Conflitto'}});return;}
   const changes=workspaceChanges(base,body.workspace),next=rebaseWorkspace(base,body.workspace,state.workspace);
   for(const collection of ['pages','tasks'] as const){for(const change of changes[collection]){const entity=next[collection].find(item=>item.id===change.id),old=state.workspace[collection].find(item=>item.id===change.id);if(entity)entity.revision=old?entityRevision(old)+1:1;}}
   state.workspace=next;if(changes.pages.length+changes.tasks.length)state.revision++;
   await route.fulfill({json:{workspace:state.workspace,revision:state.revision}});return;
  }
  await route.fulfill({status:405});
 });
 await page.goto('/');await expect(page.getByText('Salvato in Neon',{exact:true})).toBeVisible();
 return state;
}
