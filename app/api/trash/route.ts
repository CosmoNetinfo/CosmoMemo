import {Trash} from '@/lib/cloud/trash';
import {store,Conflict,InputError} from '@/lib/cloud/store';
import {AuthError,requireOwner,checkOrigin,noStore,readJson} from '@/lib/cloud/security';
export const runtime='nodejs';
function failure(e:unknown){return noStore({error:e instanceof AuthError||e instanceof InputError||e instanceof Conflict?e.message:'Cestino non disponibile.'},e instanceof AuthError?401:e instanceof Conflict?409:e instanceof InputError?400:503);}
export async function GET(request:Request){try{await requireOwner();const p=new URL(request.url).searchParams;return noStore(await new Trash(store()).list(Number(p.get('limit')??50),Number(p.get('offset')??0),p.has('older_than_days')?Number(p.get('older_than_days')):undefined));}catch(e){return failure(e);}}
export async function POST(request:Request){try{checkOrigin(request);await requireOwner();return noStore(await new Trash(store()).empty(await readJson(request,40000)));}catch(e){return failure(e);}}
