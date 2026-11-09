"use client";
import {pageKinds,pageStatuses,type Page,type Task} from '@/lib/workspace';

export function ProjectSelect({pages,value,onChange,label}:{pages:Page[];value?:string|null;onChange:(id:string|null)=>void;label:string}){
 return <select aria-label={label} value={value||''} onChange={e=>onChange(e.target.value||null)}><option value="">Nessun progetto</option>{pages.filter(p=>p.kind==='project'&&(!p.deleted||p.id===value)).map(p=><option key={p.id} value={p.id} disabled={p.deleted}>{p.title||'Senza titolo'}{p.deleted?' (nel cestino)':''}</option>)}</select>;
}
export function PageProperties({page,pages,tasks,onChange}:{page:Page;pages:Page[];tasks:Task[];onChange:(patch:Partial<Page>)=>void}){
 const linked=tasks.some(t=>t.project_id===page.id);
 function descendant(candidate:Page){const seen=new Set<string>();let current:Page|undefined=candidate;while(current){if(current.id===page.id)return true;if(seen.has(current.id))return true;seen.add(current.id);current=pages.find(p=>p.id===current?.parent);}return false;}
 return <div className="page-properties">
  <label>Tipo<select aria-label="Tipo pagina" value={page.kind||'note'} onChange={e=>onChange({kind:e.target.value as Page['kind']})}>{Object.entries(pageKinds).map(([key,label])=><option key={key} value={key} disabled={linked&&key!=='project'}>{label}</option>)}</select></label>
  <label>Stato<select aria-label="Stato pagina" value={page.status||'draft'} onChange={e=>onChange({status:e.target.value as Page['status']})}>{Object.entries(pageStatuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
  <label>Sposta in<select aria-label="Pagina genitore" value={page.parent||''} onChange={e=>onChange({parent:e.target.value||null})}><option value="">Livello principale</option>{pages.filter(p=>!p.deleted&&!descendant(p)).map(p=><option key={p.id} value={p.id}>{p.title||'Senza titolo'}</option>)}</select></label>
  {linked&&<small>Scollega le attività per cambiare il tipo del progetto.</small>}
 </div>;
}
export function ProjectTasks({page,tasks,onChange,onAdd}:{page:Page;tasks:Task[];onChange:(id:string,patch:Partial<Task>)=>void;onAdd:()=>void}){
 const linked=tasks.filter(t=>t.project_id===page.id);
 return <section className="project-tasks" aria-label="Attività del progetto"><h2>Attività del progetto <small>{linked.filter(t=>t.status==='Completato').length}/{linked.length}</small></h2>{linked.map(task=><div className="project-task" key={task.id}><input type="checkbox" aria-label={`Completa ${task.title}`} checked={task.status==='Completato'} onChange={e=>onChange(task.id,{status:e.target.checked?'Completato':'Da iniziare'})}/><input aria-label={`Attività ${task.title}`} value={task.title} onChange={e=>onChange(task.id,{title:e.target.value})}/><select aria-label={`Stato ${task.title}`} value={task.status} onChange={e=>onChange(task.id,{status:e.target.value})}>{['Da iniziare','In corso','Completato'].map(s=><option key={s}>{s}</option>)}</select><button onClick={()=>onChange(task.id,{project_id:null})}>Scollega</button></div>)}{!linked.length&&<p>Collega un’attività dalla tabella oppure creala qui.</p>}<button className="outline-button" onClick={onAdd}>Aggiungi attività al progetto</button></section>;
}
