import {WebStandardStreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {createMcpServer} from '@/lib/cloud/mcp';
import {accessGrant} from '@/lib/cloud/oauth';
import {appOrigin,noStore} from '@/lib/cloud/security';
import {configured,store} from '@/lib/cloud/store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
const allowed=(origin:string|null)=>!origin||[appOrigin(),'https://claude.ai','https://claude.com'].includes(origin)||(process.env.NODE_ENV!=='production'&&/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin));
async function handle(request:Request){
 if(!allowed(request.headers.get('origin')))return noStore({error:'Origine non autorizzata.'},403);
 if(!configured())return noStore({error:'Configura prima il database e l’accesso cloud.'},503);
 try{
  const bearer=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  const grant=bearer?await accessGrant(bearer):null;
  if(!grant)return noStore({error:'invalid_token'},401,{'WWW-Authenticate':`Bearer resource_metadata="${appOrigin()}/.well-known/oauth-protected-resource/mcp"`});
  if(request.method==='GET'||request.method==='DELETE')return new Response(null,{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}});
  const server=createMcpServer(store(),String(grant.scope).split(' '),String(grant.client_id));
  const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true,maxRequestBodySize:1_000_000});
  await server.connect(transport);
  try{const response=await transport.handleRequest(request);response.headers.set('Cache-Control','no-store');return response;}finally{await server.close();}
 }catch{return noStore({error:'Servizio MCP temporaneamente non disponibile.'},503);}
}
export const POST=handle,GET=handle,DELETE=handle;
export function OPTIONS(request:Request){const origin=request.headers.get('origin');if(!allowed(origin))return new Response(null,{status:403});return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin||appOrigin(),'Access-Control-Allow-Methods':'POST, GET, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, MCP-Protocol-Version, MCP-Session-Id','Access-Control-Expose-Headers':'WWW-Authenticate, MCP-Session-Id',Vary:'Origin'}});}
