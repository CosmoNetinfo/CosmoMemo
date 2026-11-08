import {appOrigin,noStore} from '@/lib/cloud/security';
import {SCOPES} from '@/lib/cloud/oauth';
export async function GET(){const origin=appOrigin();return noStore({issuer:origin,authorization_endpoint:origin+'/oauth/authorize',token_endpoint:origin+'/oauth/token',registration_endpoint:origin+'/oauth/register',revocation_endpoint:origin+'/oauth/revoke',response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],token_endpoint_auth_methods_supported:['none'],code_challenge_methods_supported:['S256'],scopes_supported:SCOPES});}
