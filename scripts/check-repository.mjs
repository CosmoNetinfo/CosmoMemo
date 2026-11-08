import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:20_000_000,windowsHide:true});
const files=git('ls-files','-z').split('\0').filter(Boolean);
const prohibited=files.filter(file=>/(^|\/)\.env(?:\.|$)/.test(file)&&!file.endsWith('/.env.example')&&file!=='.env.example'||/(^|\/)cosmomemo-accesso\.txt$|\.(?:pem|key)$/i.test(file));
if(prohibited.length)throw Error('File riservati tracciati da Git: '+prohibited.join(', '));
const keys=['DATABASE_URL','POSTGRES_URL','PGPASSWORD','POSTGRES_PASSWORD','COSMOMEMO_SESSION_SECRET','COSMOMEMO_SETUP_TOKEN'];
const secrets=keys.map(key=>process.env[key]).filter(value=>value&&value.length>=12);
if(process.env.DATABASE_URL){try{const password=decodeURIComponent(new URL(process.env.DATABASE_URL).password);if(password.length>=12)secrets.push(password);}catch{}}
const violations=[];
function inspect(data,name){
 if(secrets.some(secret=>data.includes(secret)))violations.push({file:name,reason:'credenziale server configurata'});
 const urls=data.match(/postgres(?:ql)?:\/\/[^\s"'`<>]+/g)||[];
 for(const value of urls){try{const url=new URL(value);if(url.password&&!(url.hostname==='host'&&url.username==='user'&&url.password==='password'))violations.push({file:name,reason:'URL database con password'});}catch{}}
}
for(const file of files)if(existsSync(file)&&!file.endsWith('.png'))inspect(readFileSync(file,'utf8'),file);
if(process.argv.includes('--history')){
 const objects=git('rev-list','--objects','--all').trim().split('\n');
 for(const object of objects){const index=object.indexOf(' ');if(index<0)continue;const sha=object.slice(0,index),name=object.slice(index+1);if(git('cat-file','-t',sha).trim()!=='blob'||name.endsWith('.png'))continue;inspect(git('cat-file','-p',sha),'cronologia:'+name);}
}
if(violations.length){console.error('Controllo fallito. Valori riservati non stampati.');for(const item of violations)console.error(item.file+' — '+item.reason);process.exit(1);}
console.log('Controllo completato: nessuna credenziale server configurata rilevata nei file '+(process.argv.includes('--history')?'o nella cronologia verificata.':'tracciati.'));
