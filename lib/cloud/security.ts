import {createHash,createHmac,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {cookies} from 'next/headers';
import {configured,store,type Store} from './store';

export const COOKIE='cosmomemo_session';
export const hash=(value:string)=>createHash('sha256').update(value).digest('base64url');
export const secretToken=()=>randomBytes(32).toString('base64url');
export function same(a:string,b:string){const x=Buffer.from(hash(a)),y=Buffer.from(hash(b));return timingSafeEqual(x,y);}
function signingSecret(){const value=process.env.COSMOMEMO_SESSION_SECRET;if(!value||value.length<32)throw new Error('Segreto sessione non configurato.');return value;}
export function seal(payload:Record<string,unknown>){const text=Buffer.from(JSON.stringify(payload)).toString('base64url');return text+'.'+createHmac('sha256',signingSecret()).update(text).digest('base64url');}
export function unseal(value:string,purpose:string):Record<string,unknown>|null{try{const [text,signature,extra]=value.split('.');if(extra||!text||!signature||!same(signature,createHmac('sha256',signingSecret()).update(text).digest('base64url')))return null;const payload=JSON.parse(Buffer.from(text,'base64url').toString());return payload.purpose===purpose&&payload.exp>Date.now()?payload:null;}catch{return null;}}
export function passwordHash(password:string){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');}
export function verifyPassword(password:string,stored:string){try{const [salt,key]=stored.split(':');return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(key,'hex'));}catch{return false;}}
export function appOrigin(){const url=new URL(process.env.COSMOMEMO_APP_URL||'http://localhost:5173');if(process.env.VERCEL_ENV==='production'&&url.protocol!=='https:')throw new Error('HTTPS richiesto.');return url.origin;}
export const resource=()=>appOrigin()+'/mcp';
export function checkOrigin(request:Request){const origin=request.headers.get('origin');if(origin!==appOrigin())throw new Error('Origine della richiesta non autorizzata.');}
export async function authenticated(db:Store=store()) {if(!configured())return false;const value=(await cookies()).get(COOKIE)?.value;if(!value)return false;const payload=unseal(value,'session');if(!payload)return false;const [owner]=await db.query('SELECT session_version FROM cm_owner WHERE id=1');return Boolean(owner&&payload.version===Number(owner.session_version));}
export async function requireOwner(){if(!await authenticated())throw new AuthError();}
export class AuthError extends Error {constructor(){super('Accedi al tuo spazio cloud.');}}
export async function readJson(request:Request,max=2_100_000){const reader=request.body?.getReader();if(!reader)throw new Error('Corpo della richiesta mancante.');let bytes=0;const chunks:Uint8Array[]=[];while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>max){await reader.cancel();throw new Error('Richiesta troppo grande.');}chunks.push(part.value);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
export function noStore(body:unknown,status=200,headers:Record<string,string>={}){return Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});}
export async function rate(request:Request,action:string,limit=10){const ip=request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')?.split(',')[0]||'local';return store().rateLimit(createHmac('sha256',signingSecret()).update(action+':'+ip).digest('hex'),limit);}
