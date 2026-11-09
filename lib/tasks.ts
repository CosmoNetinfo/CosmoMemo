import type {Workspace} from './workspace';
import {matchesSearch,normalizeText,searchTerms} from './page-content';
export type TaskFilters={project_id?:string;status?:string;priority?:string;tag?:string;query?:string;limit?:number;offset?:number};
export function listTasks(workspace:Workspace,input:TaskFilters={}){
 const limit=input.limit??100,offset=input.offset??0,terms=searchTerms(input.query||'');
 const projects=new Map(workspace.pages.map(p=>[p.id,p.title]));
 const all=workspace.tasks.filter(t=>(!input.project_id||t.project_id===input.project_id)&&(!input.status||t.status===input.status)&&(!input.priority||t.priority===input.priority)&&(input.tag===undefined||normalizeText(t.tag)===normalizeText(input.tag))&&(!terms.length||matchesSearch(t.title+' '+t.tag+' '+(t.project_id?projects.get(t.project_id)||'':''),terms)));
 return {tasks:all.slice(offset,offset+limit),total:all.length,limit,offset,next_offset:offset+limit<all.length?offset+limit:null};
}
