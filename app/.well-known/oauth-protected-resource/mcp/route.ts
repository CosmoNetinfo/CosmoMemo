import {appOrigin,noStore,resource} from '@/lib/cloud/security';
import {SCOPES} from '@/lib/cloud/oauth';
export async function GET(){return noStore({resource:resource(),authorization_servers:[appOrigin()],scopes_supported:SCOPES,bearer_methods_supported:['header'],resource_name:'CosmoMemo — pagine e memoria'});}
