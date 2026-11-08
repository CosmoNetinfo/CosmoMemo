import {revoke} from '@/lib/cloud/oauth';
import {noStore} from '@/lib/cloud/security';
export async function POST(request:Request){const text=await request.text();if(text.length>8192)return noStore({error:'invalid_request'},413);try{await revoke(new URLSearchParams(text).get('token')||'');return noStore({});}catch{return noStore({error:'server_error'},503);}}
