import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const args=process.argv.slice(2),value=name=>args[args.indexOf(name)+1];
if(!args.includes('--app-url')||!args.includes('--vercel-cli'))throw Error('Usa --app-url https://dominio --vercel-cli /percorso/vercel/dist/vc.js');
const origin=new URL(value('--app-url')).origin,cli=resolve(value('--vercel-cli'));
if(!origin.startsWith('https://')||!existsSync(cli))throw Error('URL HTTPS e CLI Vercel valido richiesti.');
const token=process.env.COSMOMEMO_SETUP_TOKEN||randomBytes(32).toString('base64url');
const secret=process.env.COSMOMEMO_SESSION_SECRET||randomBytes(48).toString('base64url');
const entries={COSMOMEMO_APP_URL:origin,COSMOMEMO_SESSION_SECRET:secret,COSMOMEMO_SETUP_TOKEN:token};
let local=existsSync('.env.local')?readFileSync('.env.local','utf8'):'';
for(const [key,val]of Object.entries(entries)){
 const result=spawnSync(process.execPath,[cli,'env','add',key,'--environment','production','--force','--yes',...(key==='COSMOMEMO_APP_URL'?[]:['--sensitive'])],{input:val,encoding:'utf8',windowsHide:true});
 if(result.status!==0){console.error('Configurazione Vercel non riuscita per '+key+'. Nessun valore segreto stampato.');process.exit(1);}
 const pattern=new RegExp('^'+key+'=.*$','m');const line=key+'='+JSON.stringify(key==='COSMOMEMO_APP_URL'?'http://localhost:5173':val);local=pattern.test(local)?local.replace(pattern,line):local+'\n'+line;
}
writeFileSync('.env.local',local+'\n');
const instructions=resolve('..','cosmomemo-accesso.txt');
writeFileSync(instructions,`COSMOMEMO — ATTIVAZIONE PERSONALE\n\nApri ${origin}/login\nCodice di attivazione: ${token}\n\nScegli una password personale di almeno 12 caratteri. Il codice è utilizzabile soltanto prima della prima attivazione. Non pubblicare questo file o il codice su GitHub.\n\nCollegamento Claude: ${origin}/mcp\nIn Claude: Impostazioni > Connettori > Aggiungi connettore personalizzato. Autorizza con la password scelta per CosmoMemo.\n`);
console.log('Configurazione cloud salvata. Istruzioni personali: '+instructions);
