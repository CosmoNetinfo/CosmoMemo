import {searchAll,type SearchKind} from '@/lib/cloud/search';
import type {SearchMode} from '@/lib/page-content';
import {store,InputError} from '@/lib/cloud/store';
import {AuthError,requireOwner,noStore} from '@/lib/cloud/security';
export const runtime='nodejs';
export async function GET(request:Request){try{
 await requireOwner();const p=new URL(request.url).searchParams,kinds=p.get('kinds')?.split(',');
 if(kinds?.some(k=>!['page','task','memory'].includes(k)))throw new InputError('Ambito di ricerca non valido.');
 return noStore(await searchAll(store(),p.get('q')||'',{mode:(p.get('mode')||'all') as SearchMode,limit:p.has('limit')?Number(p.get('limit')):10,offset:Number(p.get('offset')||0),kinds:kinds as SearchKind[]|undefined,pages:true,memories:true}));
}catch(e){return noStore({error:e instanceof AuthError||e instanceof InputError?e.message:'Ricerca non disponibile.'},e instanceof AuthError?401:e instanceof InputError?400:503);}}
