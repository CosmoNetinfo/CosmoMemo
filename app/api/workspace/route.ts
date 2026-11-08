import {store,Conflict,InputError} from '@/lib/cloud/store';
import {AuthError,requireOwner,checkOrigin,noStore,readJson} from '@/lib/cloud/security';
export const runtime='nodejs';
export async function GET(){try{await requireOwner();return noStore(await store().snapshot());}catch(e){return noStore({error:e instanceof AuthError?e.message:'Impossibile caricare lo spazio cloud.'},e instanceof AuthError?401:503);}}
export async function PUT(request:Request){try{checkOrigin(request);await requireOwner();const body=await readJson(request);if(!Number.isSafeInteger(body.revision)||body.revision<0)return noStore({error:'Versione richiesta.'},400);return noStore(await store().save(body.workspace,body.revision));}catch(e){return noStore({error:e instanceof Error?e.message:'Salvataggio non riuscito.'},e instanceof AuthError?401:e instanceof Conflict?409:e instanceof InputError?400:503);}}
