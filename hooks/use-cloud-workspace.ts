"use client";
import {useCallback,useEffect,useRef,useState,type SetStateAction} from 'react';
import {initial,valid,type Workspace} from '@/lib/workspace';
import {hasEntityConflict,rebaseWorkspace,workspaceChanges} from '@/lib/workspace-changes';

type Mode='loading'|'local'|'locked'|'cloud'|'unavailable';
const LOCAL='spazio.workspace.v1',DRAFT='cosmomemo.cloud-draft.v1';
const request=(url:string,options:RequestInit={})=>fetch(url,{...options,signal:AbortSignal.timeout(15000)});

export function useCloudWorkspace(){
 const [data,rawSet]=useState(initial),[ready,setReady]=useState(false),[mode,setMode]=useState<Mode>('loading');
 const [message,setMessage]=useState(''),[error,setError]=useState(false),[conflict,setConflict]=useState(false),[pending,setPending]=useState(false);
 const [syncing,setSyncing]=useState(false),[syncMessage,setSyncMessage]=useState(''),[syncError,setSyncError]=useState(false),[needsLogin,setNeedsLogin]=useState(false),[refreshToken,setRefreshToken]=useState(0);
 const latest=useRef(data),revision=useRef(0),dirty=useRef(false),conflicted=useRef(false),mounted=useRef(false);
 const base=useRef<Workspace|null>(null);
 const saving=useRef<Promise<boolean>|null>(null),syncRequest=useRef<Promise<boolean>|null>(null);

 useEffect(()=>{
  mounted.current=true;let canceled=false,local=initial;
  try{const text=localStorage.getItem(LOCAL);if(text&&valid(JSON.parse(text)))local=JSON.parse(text);}catch{}
  latest.current=local;rawSet(local);
  void(async()=>{
   try{
    const response=await request('/api/session',{cache:'no-store'});
    if(!response.ok)throw Error('Servizio cloud non disponibile: i dati locali sono conservati.');
    const session=await response.json();if(canceled)return;
    if(!session.configured){setMode('local');return;}
    if(!session.authenticated){setMode('locked');return;}
    const cloud=await request('/api/workspace',{cache:'no-store'});
    if(!cloud.ok)throw Error('Impossibile caricare lo spazio cloud. Nessuna modifica inviata.');
    const snapshot=await cloud.json();
    if(!valid(snapshot.workspace)||!Number.isSafeInteger(snapshot.revision)||snapshot.revision<0)throw Error('Risposta cloud non valida.');
    if(canceled)return;
    revision.current=snapshot.revision;base.current=snapshot.workspace;let next=snapshot.workspace;
    try{
     const saved=localStorage.getItem(DRAFT);
     if(saved){const draft=JSON.parse(saved);if(valid(draft.workspace)&&Number.isSafeInteger(draft.revision)){
      dirty.current=true;setPending(true);
      if(valid(draft.base)&&!hasEntityConflict(draft.base,draft.workspace,snapshot.workspace)){
       next=rebaseWorkspace(draft.base,draft.workspace,snapshot.workspace);
      }else{
       next=draft.workspace;revision.current=draft.revision;base.current=valid(draft.base)?draft.base:snapshot.workspace;
       if(draft.revision!==snapshot.revision){conflicted.current=true;setConflict(true);setMessage('Una bozza locale e la versione cloud modificano lo stesso elemento. Esporta la bozza prima di ricaricare.');}
      }
     }}
    }catch{}
    latest.current=next;rawSet(next);setMode('cloud');
   }catch(e){if(!canceled){setMode('unavailable');setError(true);setMessage(e instanceof Error?e.message:'Cloud non disponibile.');}}
   finally{if(!canceled)setReady(true);}
  })();
  return()=>{canceled=true;mounted.current=false;};
 },[]);

 const setData=useCallback((action:SetStateAction<Workspace>)=>{
  const next=typeof action==='function'?action(latest.current):action;
  latest.current=next;rawSet(next);setSyncMessage('');
  if(mode==='cloud'){dirty.current=true;setPending(true);}
 },[mode]);

 // Autosave and the manual button share one operation, so their PUTs cannot race.
 const savePending=useCallback(():Promise<boolean>=>{
  if(saving.current)return saving.current;
  if(conflicted.current)return Promise.resolve(false);
  if(!dirty.current)return Promise.resolve(true);
  const operation=(async()=>{
   try{
    while(dirty.current&&mounted.current){
     const sent=latest.current;
     const response=await request('/api/workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspace:sent,revision:revision.current,base:base.current})});
     if(response.status===409){conflicted.current=true;setConflict(true);throw Error('Modifiche presenti nel cloud. La tua bozza è conservata: esportala e ricarica prima di unire i contenuti.');}
     if(response.status===401){setNeedsLogin(true);throw Error('Sessione scaduta. Accedi di nuovo per salvare la bozza.');}
     if(!response.ok)throw Error('Cloud non raggiungibile. La bozza resta in questo browser: usa Riprova.');
     const saved=await response.json();
     if(!Number.isSafeInteger(saved.revision)||saved.revision<revision.current||!valid(saved.workspace))throw Error('Risposta cloud non valida. La bozza è conservata.');
     revision.current=saved.revision;
     const next=latest.current===sent?saved.workspace:rebaseWorkspace(sent,latest.current,saved.workspace);
     base.current=saved.workspace;latest.current=next;rawSet(next);
     const unsaved=workspaceChanges(saved.workspace,next);dirty.current=unsaved.pages.length+unsaved.tasks.length>0;
     if(!dirty.current){try{localStorage.removeItem(DRAFT);}catch{}setPending(false);}
     else localStorage.setItem(DRAFT,JSON.stringify({workspace:latest.current,revision:revision.current,base:base.current}));
     setError(false);setMessage('');setNeedsLogin(false);
    }
    return !dirty.current;
   }catch(e){
    setError(true);setMessage(e instanceof Error&&e.name!=='TimeoutError'?e.message:'Salvataggio interrotto o troppo lento. La bozza è conservata: usa Riprova.');return false;
   }finally{saving.current=null;}
  })();
  saving.current=operation;return operation;
 },[]);

 useEffect(()=>{
  if(!ready)return;
  if(mode==='local'||mode==='locked'||mode==='unavailable'){
   try{localStorage.setItem(LOCAL,JSON.stringify(data));if(mode!=='unavailable')setError(false);}
   catch{setError(true);setMessage('Salvataggio locale non riuscito. Esporta un backup.');}
   return;
  }
  if(mode!=='cloud'||!dirty.current)return;
  try{localStorage.setItem(DRAFT,JSON.stringify({workspace:data,revision:revision.current,base:base.current}));}
  catch{setError(true);setMessage('Impossibile conservare la bozza nel browser. Esporta un backup.');}
  if(conflict)return;
  const timer=setTimeout(()=>{void savePending();},800);return()=>clearTimeout(timer);
 },[data,ready,mode,conflict,savePending]);

 const refresh=useCallback((manual=true):Promise<boolean>=>{
  if(mode!=='cloud'||conflicted.current)return Promise.resolve(false);
  if(syncRequest.current)return syncRequest.current;
  if(!manual&&(dirty.current||saving.current))return Promise.resolve(false);
  setSyncing(true);setSyncError(false);if(manual)setSyncMessage('Sincronizzazione in corso…');
  const operation=(async()=>{
   try{
    if(!await savePending()){setSyncMessage('');return false;}
    const startedAtRevision=revision.current;
    const response=await request('/api/workspace',{cache:'no-store'});
    if(response.status===401){setNeedsLogin(true);throw Error('Sessione scaduta. Accedi di nuovo per sincronizzare.');}
    if(!response.ok)throw Error('Sincronizzazione non riuscita. Controlla la connessione e riprova.');
    const snapshot=await response.json();
    if(!valid(snapshot.workspace)||!Number.isSafeInteger(snapshot.revision))throw Error('Risposta cloud non valida. I dati locali sono conservati.');
    // A slow response must never replace edits made while the request was running.
    if(dirty.current||saving.current||revision.current!==startedAtRevision){
     if(manual)setSyncMessage('Nuove modifiche in salvataggio. Riprova la sincronizzazione al termine.');return false;
    }
    if(snapshot.revision<revision.current)throw Error('Risposta cloud non aggiornata. I dati locali sono conservati: riprova.');
    if(snapshot.revision>revision.current){revision.current=snapshot.revision;base.current=snapshot.workspace;latest.current=snapshot.workspace;rawSet(snapshot.workspace);}
    setNeedsLogin(false);setSyncError(false);setRefreshToken(value=>value+1);
    if(manual)setSyncMessage('Sincronizzazione completata.');
    return true;
   }catch(e){setSyncError(true);setSyncMessage(e instanceof Error&&e.name!=='TimeoutError'?e.message:'Sincronizzazione troppo lenta. Riprova.');return false;}
   finally{setSyncing(false);syncRequest.current=null;}
  })();
  syncRequest.current=operation;return operation;
 },[mode,savePending]);

 useEffect(()=>{
  const focus=()=>{if(document.visibilityState==='visible')void refresh(false);};
  window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
  return()=>{window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};
 },[refresh]);
 function retry(){if(mode==='cloud')void savePending();else rawSet({...latest.current});}
 return {data,setData,ready,error,setError,mode,message,conflict,pending,refresh,retry,syncing,syncMessage,syncError,needsLogin,refreshToken};
}
