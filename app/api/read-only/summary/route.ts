import {createSummaryHandler} from '@/lib/cloud/read-only-summary';
import {store} from '@/lib/cloud/store';

export const runtime='nodejs';
export const dynamic='force-dynamic';
// Lazy connection, no snapshot(), rateLimit(), session or cookie APIs.
export const GET=createSummaryHandler((sql,params)=>store().query(sql,params));
