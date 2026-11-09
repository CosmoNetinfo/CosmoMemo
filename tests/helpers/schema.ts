import {readFileSync,readdirSync} from 'node:fs';
import type {PGlite} from '@electric-sql/pglite';
export async function applySchema(pg:PGlite){
 await pg.exec(readFileSync(new URL('../../db/schema.sql',import.meta.url),'utf8'));
 const migrations=new URL('../../db/migrations/',import.meta.url);
 for(const name of readdirSync(migrations).filter(name=>name.endsWith('.sql')).sort())await pg.exec(readFileSync(new URL(name,migrations),'utf8'));
}
