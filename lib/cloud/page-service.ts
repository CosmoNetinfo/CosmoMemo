import {randomUUID} from 'node:crypto';
import type {Page,Workspace} from '../workspace';
import {entityRevision} from '../workspace-changes';
import {Conflict,InputError,type Snapshot,type Store} from './store';

export function pageResult(snapshot:Snapshot,id:string){
 const page=snapshot.workspace.pages.find(page=>page.id===id);
 if(!page)throw new InputError('Pagina non trovata.');
 return {page,revision:entityRevision(page),page_revision:entityRevision(page),workspace_revision:snapshot.revision};
}
export async function readPage(db:Store,id:string,includeDeleted=false){
 const snapshot=await db.snapshot(),page=snapshot.workspace.pages.find(page=>page.id===id&&(includeDeleted||!page.deleted));
 if(!page)throw new InputError('Pagina non trovata.');
 return {snapshot,page};
}
export function expectPageRevision(page:Page,expected:number){
 if(entityRevision(page)!==expected)throw new Conflict({entity_id:page.id,collection:'pages',expected_revision:expected,current_revision:entityRevision(page)});
}
export async function updatePage(db:Store,id:string,expected:number,change:(page:Page,workspace:Workspace)=>Page,includeDeleted=false){
 const {snapshot,page}=await readPage(db,id,includeDeleted);expectPageRevision(page,expected);
 const saved=await db.apply({pages:[{id,expected_revision:expected,document:change(structuredClone(page),snapshot.workspace)}],tasks:[]});
 return pageResult(saved,id);
}
export async function createPage(db:Store,content:Pick<Page,'title'|'icon'|'blocks'|'kind'|'status'>,parent:string|null=null){
 if(parent){const {page}=await readPage(db,parent);if(page.deleted)throw new InputError('Pagina genitore nel cestino.');}
 const page:Page={...content,id:randomUUID(),parent,favorite:false,deleted:false,updated:Date.now()};
 const saved=await db.apply({pages:[{id:page.id,expected_revision:0,document:page}],tasks:[]});
 return pageResult(saved,page.id);
}
