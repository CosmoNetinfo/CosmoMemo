import {History} from '@/lib/cloud/history';
import {store,InputError} from '@/lib/cloud/store';
import {AuthError,requireOwner,checkOrigin,noStore,readJson} from '@/lib/cloud/security';
export const runtime='nodejs';
function failure(e:unknown){return noStore({error:e instanceof AuthError||e instanceof InputError?e.message:'Novità non disponibili.'},e instanceof AuthError?401:e instanceof InputError?400:503);}
export async function GET(request:Request){try{
 await requireOwner();const p=new URL(request.url).searchParams;
 return noStore(await new History(store()).changes('owner:web',true,p.has('since_cursor')?Number(p.get('since_cursor')):undefined));
}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 checkOrigin(request);await requireOwner();const b=await readJson(request,1000);
 return noStore(await new History(store()).markSeen('owner:web',b.cursor));
}catch(e){return failure(e);}}
