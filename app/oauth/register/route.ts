import {configured} from '@/lib/cloud/store';
import {noStore,rate,readJson} from '@/lib/cloud/security';
import {OAuthError,registerClient} from '@/lib/cloud/oauth';
export async function POST(request:Request){try{if(!configured())return noStore({error:'temporarily_unavailable'},503);if(!await rate(request,'register',40))return noStore({error:'temporarily_unavailable'},429);return noStore(await registerClient(await readJson(request,8192)),201);}catch(e){return noStore({error:e instanceof OAuthError?e.code:'invalid_request',error_description:e instanceof OAuthError?e.message:'Richiesta non valida.'},e instanceof OAuthError?e.status:400);}}
