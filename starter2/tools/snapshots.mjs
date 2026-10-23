import {FIXTURE,DAY} from '../src/tenants.js';
const fields={requests:['id','payload_hash','created_at','expires_at','payload','status','version'],outbox:['request_id','state','attempts','next_at','lease_until','lease_token','last_error','delivered_at'],simulated_deliveries:['request_id','delivered_at'],deletion_ledger:['request_id','deleted_at','expires_at']};
export async function exportState(db,shop){
 const tables={};for(const table of Object.keys(fields))tables[table]=(await db.prepare('SELECT * FROM '+table).all()).results;
 return {format:1,mode:'TEST_ONLY',shop,exportedAt:Date.now(),tables};
}
export async function exportLedger(db,shop){return {format:1,mode:'TEST_ONLY',shop,exportedAt:Date.now(),deletions:(await db.prepare('SELECT * FROM deletion_ledger').all()).results};}
export async function restoreState(db,snapshot,latestLedger,shop,now=Date.now()){
 if(snapshot.format!==1||snapshot.mode!=='TEST_ONLY'||snapshot.shop!==shop||latestLedger?.shop!==shop||latestLedger.mode!=='TEST_ONLY'||!Array.isArray(latestLedger.deletions)||latestLedger.exportedAt<snapshot.exportedAt)throw Error('INVALID_OR_STALE_RECOVERY_INPUT');
 if((await db.prepare('SELECT count(*) AS n FROM requests').first()).n||(await db.prepare('SELECT count(*) AS n FROM deletion_ledger').first()).n)throw Error('RESTORE_REQUIRES_EMPTY_NEW_DATABASE');
 const removed=new Set(latestLedger.deletions.map(r=>r.request_id));
 const live=new Set();const sql=[];
 for(const r of snapshot.tables.requests){
  const p=JSON.parse(r.payload);for(const [k,v]of Object.entries(FIXTURE))if(p[k]!==v)throw Error('NON_FICTIONAL_BACKUP');
  if(removed.has(r.id)||r.expires_at<=now)continue;
  if(r.expires_at-r.created_at>90*DAY)throw Error('UNSAFE_RETENTION');
  live.add(r.id);sql.push(db.prepare('INSERT INTO requests('+fields.requests.join(',')+') VALUES(?,?,?,?,?,?,?)').bind(...fields.requests.map(k=>r[k])));
 }
 for(const r of snapshot.tables.outbox){if(!live.has(r.request_id))continue;const x={...r};if(x.state==='leased'){x.state='pending';x.next_at=now;x.lease_until=0;x.lease_token=null;}
  sql.push(db.prepare('UPDATE outbox SET '+fields.outbox.slice(1).map(k=>k+'=?').join(',')+' WHERE request_id=?').bind(...fields.outbox.slice(1).map(k=>x[k]),x.request_id));}
 for(const r of snapshot.tables.simulated_deliveries){if(live.has(r.request_id))sql.push(db.prepare('INSERT INTO simulated_deliveries(request_id,delivered_at) VALUES(?,?)').bind(r.request_id,r.delivered_at));}
 const ledger=new Map([...snapshot.tables.deletion_ledger,...latestLedger.deletions].map(r=>[r.request_id,r]));
 for(const r of ledger.values())if(r.expires_at>now)sql.push(db.prepare('INSERT INTO deletion_ledger(request_id,deleted_at,expires_at) VALUES(?,?,?)').bind(r.request_id,r.deleted_at,r.expires_at));
 if(sql.length)await db.batch(sql);
 return {restored:live.size,excludedDeleted:removed.size};
}
