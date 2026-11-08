import nextEnv from '@next/env';
import {neon} from '@neondatabase/serverless';
import {readFileSync} from 'node:fs';
nextEnv.loadEnvConfig(process.cwd());
const url=process.env.DATABASE_URL||process.env.POSTGRES_URL;
if(!url)throw new Error('Configura DATABASE_URL nel file .env.local o nell’ambiente.');
const sql=neon(url),schema=readFileSync(new URL('../db/schema.sql',import.meta.url),'utf8');
for(const statement of schema.split(';').map(s=>s.trim()).filter(Boolean))await sql.query(statement);
console.log('Schema CosmoMemo pronto. Nessun dato esistente sovrascritto.');
