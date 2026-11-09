export type Block={id:string;type:string;text:string;checked?:boolean;language?:string;indent?:number;number?:number};
export type Page={id:string;title:string;icon:string;parent:string|null;favorite:boolean;deleted:boolean;updated:number;blocks:Block[];revision?:number};
export type Task={id:string;title:string;status:string;priority:string;date:string;tag:string;revision?:number};
export type Workspace={version:1;pages:Page[];tasks:Task[]};
export const uid=()=>globalThis.crypto.randomUUID();
export const types=[['text','Aa','Testo'],['h1','H₁','Titolo grande'],['h2','H₂','Titolo medio'],['h3','H₃','Titolo piccolo'],['h4','H₄','Titolo 4'],['h5','H₅','Titolo 5'],['h6','H₆','Titolo 6'],['numbered','1.','Elenco numerato'],['todo','☑','Lista di attività'],['bullet','•','Elenco puntato'],['quote','❞','Citazione'],['callout','☀','In evidenza'],['code','</>','Codice'],['divider','—','Divisore']];
const b=(id:string,type:string,text:string):Block=>({id,type,text});
const base=Date.UTC(2026,10,8,12);
export const initial:Workspace={version:1,pages:[
{id:'welcome',title:'Benvenuto nel tuo Spazio',icon:'🌱',parent:null,favorite:true,deleted:false,updated:base+4000,blocks:[b('w1','h2','Una pagina, infinite possibilità.'),b('w2','text','Questo è il tuo spazio personale per raccogliere pensieri, organizzare progetti e dare forma alle idee. Puoi modificare tutto quello che vedi: basta un clic sul testo.'),b('w3','callout','I contenuti si salvano in questo browser. Esporta un backup dalle impostazioni per conservarli anche altrove.'),b('w4','h2','Comincia dalle piccole cose'),b('w5','todo','Scrivi la tua prima idea'),b('w6','todo','Crea una pagina tutta tua'),b('w7','todo','Esplora i modelli e i tuoi progetti'),b('w8','h2','Un editor che segue i tuoi pensieri'),b('w9','text','Premi Invio per un nuovo blocco. Scrivi / per scegliere titoli, liste e citazioni. Trascina la maniglia a sinistra per riordinare i blocchi.'),b('w10','quote','Non devi avere tutto chiaro. Basta fare spazio alla prossima idea.')]},
{id:'ideas',title:'Il giardino delle idee',icon:'💡',parent:null,favorite:true,deleted:false,updated:base+3000,blocks:[b('i1','text','Un posto per le intuizioni improvvise e i progetti che non hanno ancora un nome.'),b('i2','h2','Semi da piantare'),b('i3','bullet','Un piccolo progetto creativo per il fine settimana'),b('i4','bullet','Una newsletter sulle cose che imparo'),b('i5','bullet','Riorganizzare il mio angolo di lavoro'),b('i6','callout','Nessuna idea è troppo piccola per stare qui.')]},
{id:'week',title:'La mia settimana',icon:'🗓️',parent:null,favorite:false,deleted:false,updated:base+2000,blocks:[b('s1','h2','Ciò che conta questa settimana'),b('s2','todo','Ritagliare un’ora per il progetto personale'),b('s3','todo','Leggere un capitolo del libro sul comodino'),b('s4','todo','Fare una passeggiata senza telefono'),b('s5','h2','Una cosa da ricordare'),b('s6','text','Lascia un po’ di spazio anche agli imprevisti.')]},
{id:'reading',title:'Appunti e ispirazioni',icon:'📚',parent:null,favorite:false,deleted:false,updated:base+1000,blocks:[b('r1','h2','La mia piccola biblioteca'),b('r2','text','Parole, letture e incontri che mi hanno lasciato qualcosa.'),b('r3','h2','Da approfondire'),b('r4','bullet','Come costruire abitudini che durano'),b('r5','bullet','Il valore del tempo senza impegni')]}
],tasks:[{id:'t1',title:'Dare forma alla prossima idea',status:'In corso',priority:'Alta',date:'2026-11-12',tag:'Creatività'},{id:'t2',title:'Organizzare gli appunti',status:'Da iniziare',priority:'Media',date:'2026-11-15',tag:'Personale'},{id:'t3',title:'Pianificare la settimana',status:'Da iniziare',priority:'Bassa',date:'2026-11-09',tag:'Personale'},{id:'t4',title:'Creare il mio primo Spazio',status:'Completato',priority:'Media',date:'2026-11-08',tag:'Personale'}]};
export function valid(value:unknown):value is Workspace {
 if(!value||typeof value!=='object')return false;const d=value as Workspace;
 if(d.version!==1||!Array.isArray(d.pages)||!Array.isArray(d.tasks)||d.pages.length>10000||d.tasks.length>10000)return false;
 const revisionValid=(v:number|undefined)=>v===undefined||(Number.isSafeInteger(v)&&v>=1);
 const pages=new Map<string,Page>();
 for(const p of d.pages){
  if(!p||typeof p.id!=='string'||pages.has(p.id)||typeof p.title!=='string'||typeof p.icon!=='string'||(p.parent!==null&&typeof p.parent!=='string')||typeof p.favorite!=='boolean'||typeof p.deleted!=='boolean'||!Number.isFinite(p.updated)||!Array.isArray(p.blocks)||!revisionValid(p.revision))return false;
  pages.set(p.id,p);const ids=new Set<string>();
  for(const b of p.blocks){if(!b||typeof b.id!=='string'||ids.has(b.id)||!types.some(t=>t[0]===b.type)||typeof b.text!=='string'||(b.checked!==undefined&&typeof b.checked!=='boolean')||(b.language!==undefined&&(typeof b.language!=='string'||b.language.length>80||/[\r\n`~]/.test(b.language)))||(b.indent!==undefined&&(!Number.isInteger(b.indent)||b.indent<0||b.indent>12))||(b.number!==undefined&&(!Number.isInteger(b.number)||b.number<1)))return false;ids.add(b.id);}
 }
 for(const p of d.pages){const seen=new Set([p.id]);let parent=p.parent;while(parent){if(seen.has(parent)||!pages.has(parent))return false;seen.add(parent);parent=pages.get(parent)!.parent;}}
 const ids=new Set<string>();
 return d.tasks.every(t=>{if(!t||typeof t.id!=='string'||ids.has(t.id)||![t.title,t.tag,t.date].every(x=>typeof x==='string')||!['Da iniziare','In corso','Completato'].includes(t.status)||!['Alta','Media','Bassa'].includes(t.priority)||!revisionValid(t.revision))return false;ids.add(t.id);return true;});
}
export {pageToMarkdown as markdown} from './markdown';
