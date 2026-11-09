export type Actor={kind:'owner'|'claude'|'unknown';id:string;name:string};
export type Activity={id:number;entity_type:'page'|'task'|'memory';entity_id:string;operation:string;actor:Actor;title:string;revision:number|null;changed_fields:string[];occurred_at:number};
export type ChangeFeed={events:Activity[];since_cursor:number;next_cursor:number;latest_cursor:number;has_more:boolean};
export const operationLabels:Record<string,string>={create:'Creato',update:'Modificato',trash:'Spostato nel cestino',restore:'Ripristinato',delete:'Eliminato'};
export const fieldLabels:Record<string,string>={title:'titolo',blocks:'contenuto',kind:'tipo',status:'stato',parent:'posizione',project_id:'progetto',priority:'priorità',date:'scadenza',content:'contenuto',tags:'tag',deleted:'cestino',favorite:'preferito',icon:'icona',tag:'area'};
