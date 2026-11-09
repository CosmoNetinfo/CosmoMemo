import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const keys=['DATABASE_URL','POSTGRES_URL','PGPASSWORD','POSTGRES_PASSWORD','COSMOMEMO_SESSION_SECRET','COSMOMEMO_SETUP_TOKEN','COSMOMEMO_READ_TOKEN'];
const secrets=keys.map(key=>process.env[key]).filter(value=>value&&value.length>=12);
function inspect(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())inspect(path);else{const data=readFileSync(path,'utf8');if(secrets.some(secret=>data.includes(secret)))throw Error('Un valore riservato è presente nel bundle pubblico. Rilascio da interrompere.');}}}
inspect('.next/static');console.log('Controllo bundle pubblico completato: nessuna credenziale server trovata.');
