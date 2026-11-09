"use client";
import {useState} from 'react';
import type {Page} from '@/lib/workspace';
export function TrashActions({pages,connected,blocked,onRefresh}:{pages:Page[];connected:boolean;blocked:boolean;onRefresh:()=>Promise<unknown>}){
 const [selected,setSelected]=useState<{page_id:string;expected_page_revision:number}[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const trashed=pages.filter(p=>p.deleted);
 async function remove(){if(!selected||blocked)return;setBusy(true);setError('');try{
  const response=await fetch('/api/trash',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pages:selected,confirm_permanent_deletion:true}),signal:AbortSignal.timeout(15000)});const body=await response.json();if(!response.ok)throw Error(body.error||'Cancellazione non riuscita.');setSelected(null);await onRefresh();
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 if(!connected||!trashed.length)return null;
 return <div className="trash-actions">{error&&<p role="alert" className="cloud-error">{error}</p>}{selected?<div className="restore-confirm"><p>Eliminare definitivamente {selected.length===1?'questa pagina':selected.length+' pagine'} dal cestino, comprese le copie nella loro cronologia? Le attività collegate saranno conservate e scollegate. Le nuove pagine nel cestino non vengono incluse.</p><button className="outline-button danger" disabled={busy||blocked} onClick={remove}>{busy?'Eliminazione…':'Conferma eliminazione definitiva'}</button><button disabled={busy} onClick={()=>{setSelected(null);setError('');}}>Annulla</button></div>:<button className="outline-button danger" disabled={blocked} onClick={()=>setSelected(trashed.slice(0,200).map(p=>({page_id:p.id,expected_page_revision:p.revision||1})))}>{trashed.length>200?'Elimina le prime 200 pagine':'Svuota cestino'}</button>}</div>;
}
