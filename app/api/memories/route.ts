import {store,Conflict,InputError} from '@/lib/cloud/store';
import {AuthError,requireOwner,checkOrigin,noStore,readJson} from '@/lib/cloud/security';
export const runtime='nodejs';
export async function GET(request:Request){try{await requireOwner();const params=new URL(request.url).searchParams;return noStore(params.get('export')==='1'?await store().exportMemories(params.get('after')||''):{memories:await store().memories(params.get('q')||'')});}catch(e){return noStore({error:e instanceof AuthError?e.message:'Impossibile leggere la memoria.'},e instanceof AuthError?401:503);}}
async function mutate(request:Request,remove:boolean){try{checkOrigin(request);await requireOwner();const body=await readJson(request,60000);if(typeof body.key!=='string'||!Number.isSafeInteger(body.revision)||body.revision<0||(!remove&&(typeof body.content!=='string'||!Array.isArray(body.tags))))return noStore({error:'Dati della memoria non validi.'},400);return noStore(remove?await store().forget(body.key,body.revision):await store().remember(body.key,body.content,body.tags,body.revision));}catch(e){return noStore({error:e instanceof Error?e.message:'Operazione non riuscita.'},e instanceof AuthError?401:e instanceof Conflict?409:e instanceof InputError?400:503);}}
export const POST=(request:Request)=>mutate(request,false);
export const DELETE=(request:Request)=>mutate(request,true);
