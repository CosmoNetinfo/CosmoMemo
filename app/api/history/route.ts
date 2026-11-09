import {History} from '@/lib/cloud/history';
import {store,Conflict,InputError} from '@/lib/cloud/store';
import {AuthError,requireOwner,checkOrigin,noStore,readJson} from '@/lib/cloud/security';
export const runtime='nodejs';
function failure(e:unknown){return noStore({error:e instanceof AuthError||e instanceof InputError||e instanceof Conflict?e.message:'Cronologia non disponibile.'},e instanceof AuthError?401:e instanceof Conflict?409:e instanceof InputError?400:503);}
export async function GET(request:Request){try{
 await requireOwner();const p=new URL(request.url).searchParams,pageId=p.get('page_id');if(!pageId)throw new InputError('Pagina richiesta.');
 const history=new History(store());
 if(p.has('event_id')){const side=p.get('side')||'after';if(side!=='before'&&side!=='after')throw new InputError('Versione richiesta non valida.');return noStore(await history.pageVersion(pageId,Number(p.get('event_id')),side));}
 return noStore(await history.pageHistory(pageId,p.has('before')?Number(p.get('before')):undefined));
}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 checkOrigin(request);await requireOwner();const b=await readJson(request,2000);
 if(typeof b.page_id!=='string'||!Number.isSafeInteger(b.event_id)||!Number.isSafeInteger(b.expected_page_revision)||b.expected_page_revision<1||(b.side!=='before'&&b.side!=='after'))throw new InputError('Dati di ripristino non validi.');
 return noStore(await new History(store()).restorePageVersion(b.page_id,b.event_id,b.expected_page_revision,b.side));
}catch(e){return failure(e);}}
