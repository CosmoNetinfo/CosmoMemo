import {randomUUID} from 'node:crypto';
import {hash,resource,secretToken} from './security';
import {store,type Store,type Row} from './store';
export const SCOPES=['pages:read','pages:write','memory:read','memory:write'];
export class OAuthError extends Error {constructor(readonly code:string,message:string,readonly status=400){super(message);}}
export function redirectAllowed(value:string){try{const url=new URL(value);if(url.username||url.password||url.hash)return false;return ['https://claude.ai/api/mcp/auth_callback','https://claude.com/api/mcp/auth_callback'].includes(value)||(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)&&url.pathname==='/callback'&&!url.search);}catch{return false;}}
export function scopes(value:unknown){const result=typeof value==='string'&&value.trim()?value.trim().split(/\s+/):SCOPES;if(result.some(s=>!SCOPES.includes(s)))throw new OAuthError('invalid_scope','Permessi non supportati.');return [...new Set(result)].join(' ');}
export async function registerClient(body:Record<string,unknown>,db:Store=store()){
  if(!Array.isArray(body.redirect_uris)||!body.redirect_uris.length||body.redirect_uris.length>5||body.redirect_uris.some(x=>typeof x!=='string'||!redirectAllowed(x)))throw new OAuthError('invalid_redirect_uri','Sono consentiti i callback di Claude e localhost /callback.');
  if(body.token_endpoint_auth_method&&body.token_endpoint_auth_method!=='none')throw new OAuthError('invalid_client_metadata','Client pubblici con PKCE: usa token_endpoint_auth_method none.');
  const name=typeof body.client_name==='string'?body.client_name.slice(0,100):'Claude';
  const redirects=[...new Set(body.redirect_uris as string[])].sort(),id='cm_'+hash(JSON.stringify([name,redirects]));
  const count=await db.query('SELECT count(*) AS count FROM cm_clients');
  if(Number(count[0].count)>1000)throw new OAuthError('temporarily_unavailable','Troppe registrazioni.',429);
  await db.query('INSERT INTO cm_clients(id,name,redirect_uris,created_at) VALUES($1,$2,$3::jsonb,$4) ON CONFLICT DO NOTHING',[id,name,JSON.stringify(redirects),Date.now()]);
  return {client_id:id,client_name:name,redirect_uris:redirects,token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code'],scope:SCOPES.join(' ')};
}
export type Authorization={client_id:string;redirect_uri:string;challenge:string;scope:string;state:string;resource:string;client_name:string};
export async function authorization(params:URLSearchParams,db:Store=store()):Promise<Authorization>{
  const id=params.get('client_id')||'',redirect=params.get('redirect_uri')||'',challenge=params.get('code_challenge')||'';
  const [client]=await db.query('SELECT * FROM cm_clients WHERE id=$1',[id]);
  if(!client||!(client.redirect_uris as string[]).includes(redirect))throw new OAuthError('invalid_request','Client o indirizzo di ritorno non valido.');
  if(params.get('response_type')!=='code'||params.get('code_challenge_method')!=='S256'||!/^[A-Za-z0-9_-]{43}$/.test(challenge))throw new OAuthError('invalid_request','È richiesto Authorization Code con PKCE S256.');
  if(params.has('resource')&&params.get('resource')!==resource())throw new OAuthError('invalid_target','Risorsa non valida.');
  const state=params.get('state')||'';if(state.length>1024)throw new OAuthError('invalid_request','Stato troppo lungo.');
  return {client_id:id,redirect_uri:redirect,challenge,scope:scopes(params.get('scope')),state,resource:resource(),client_name:String(client.name)};
}
export async function issueCode(auth:Authorization,db:Store=store()){
  const code=secretToken();await db.query('DELETE FROM cm_codes WHERE expires_at<$1',[Date.now()]);
  await db.query('INSERT INTO cm_codes(hash,client_id,redirect_uri,challenge,resource,scope,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[hash(code),auth.client_id,auth.redirect_uri,auth.challenge,auth.resource,auth.scope,Date.now()+300000]);return code;
}
function tokenResult(access:string,refresh:string,scope:string){return {access_token:access,token_type:'Bearer',expires_in:3600,refresh_token:refresh,scope};}
export async function exchange(body:URLSearchParams,db:Store=store()){
  const clientId=body.get('client_id')||'';const [client]=await db.query('SELECT id FROM cm_clients WHERE id=$1',[clientId]);if(!client)throw new OAuthError('invalid_client','Client non valido.',401);
  if(body.has('resource')&&body.get('resource')!==resource())throw new OAuthError('invalid_target','Risorsa non valida.');
  const access=secretToken(),refresh=secretToken(),now=Date.now();
  if(body.get('grant_type')==='authorization_code'){
    const verifier=body.get('code_verifier')||'';if(!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier))throw new OAuthError('invalid_grant','Verificatore non valido.');
    const rows=await db.query(`WITH code AS (DELETE FROM cm_codes WHERE hash=$1 AND client_id=$2 AND redirect_uri=$3 AND challenge=$4 AND resource=$5 AND expires_at>$6 RETURNING *)
      INSERT INTO cm_grants(id,family,client_id,access_hash,refresh_hash,resource,scope,expires_at,refresh_expires_at,created_at)
      SELECT $7,$8,client_id,$9,$10,resource,scope,$11,$12,$6 FROM code RETURNING scope`,[hash(body.get('code')||''),clientId,body.get('redirect_uri')||'',hash(verifier),resource(),now,randomUUID(),randomUUID(),hash(access),hash(refresh),now+3600000,now+30*86400000]);
    if(!rows.length)throw new OAuthError('invalid_grant','Codice scaduto, già utilizzato o non valido.');
    return tokenResult(access,refresh,String(rows[0].scope));
  }
  if(body.get('grant_type')==='refresh_token'){
    const oldHash=hash(body.get('refresh_token')||'');
    const rows=await db.query(`WITH old AS (UPDATE cm_grants SET revoked=true WHERE refresh_hash=$1 AND client_id=$2 AND resource=$3 AND refresh_expires_at>$4 AND revoked=false RETURNING *)
      INSERT INTO cm_grants(id,family,client_id,access_hash,refresh_hash,resource,scope,expires_at,refresh_expires_at,created_at)
      SELECT $5,family,client_id,$6,$7,resource,scope,$8,refresh_expires_at,$4 FROM old RETURNING scope`,[oldHash,clientId,resource(),now,randomUUID(),hash(access),hash(refresh),now+3600000]);
    if(!rows.length){await db.query('UPDATE cm_grants SET revoked=true WHERE family IN(SELECT family FROM cm_grants WHERE refresh_hash=$1 AND client_id=$2)',[oldHash,clientId]);throw new OAuthError('invalid_grant','Token di rinnovo non valido. Ricollega Claude.');}
    return tokenResult(access,refresh,String(rows[0].scope));
  }
  throw new OAuthError('unsupported_grant_type','Grant non supportato.');
}
export async function accessGrant(token:string,db:Store=store()):Promise<Row|null>{const [grant]=await db.query('SELECT * FROM cm_grants WHERE access_hash=$1 AND resource=$2 AND revoked=false AND expires_at>$3',[hash(token),resource(),Date.now()]);return grant||null;}
export async function revoke(token:string,db:Store=store()){await db.query('UPDATE cm_grants SET revoked=true WHERE family IN(SELECT family FROM cm_grants WHERE access_hash=$1 OR refresh_hash=$1)',[hash(token)]);}
