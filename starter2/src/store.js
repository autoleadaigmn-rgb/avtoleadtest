import {DAY,FIXTURES,POLICY} from './tenants.js';
import {problem,sha,rate,b64,unb64} from './security.js';
import {resolveAppointmentTime} from '../public/appointment-time.js';
export async function saveRequest(t,input,c,now){
 if(!input||typeof input!=='object'||Array.isArray(input))throw problem('INVALID_REQUEST');
 const fixture=FIXTURES[t.public.id];
 const allowed=['id','session','consent','policy','website',...Object.keys(fixture)];
 if(Object.keys(input).some(k=>!allowed.includes(k)))throw problem('UNKNOWN_FIELD');
 if(input.website!==''||input.consent!==true||input.policy!==POLICY)throw problem('CONSENT_OR_SPAM',400);
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id||''))throw problem('INVALID_ID');
 const payload={};for(const [k,v] of Object.entries(fixture)){if(input[k]!==v)throw problem('FICTIONAL_FIXTURE_ONLY');payload[k]=v;}
 const hash=await sha(JSON.stringify(payload));
 // Retry lookup precedes timing/rate checks; the same persisted receipt is safe to return.
 if(await t.db.prepare('SELECT request_id FROM deletion_ledger WHERE request_id=? AND expires_at>?').bind(input.id,now).first())throw problem('REQUEST_GONE',410);
 const existing=await t.db.prepare('SELECT payload_hash FROM requests WHERE id=?').bind(input.id).first();
 if(existing){if(existing.payload_hash!==hash)throw problem('IDEMPOTENCY_CONFLICT',409);return {receipt:input.id,duplicate:true};}
 if(now-c.iat<1000)throw problem('TOO_FAST',429);
 await rate(t.db,'submit:'+c.sid,5,60000,now);
 await rate(t.db,'shop-submit',30,60000,now);
 const resolved=resolveAppointmentTime(payload.preferredTime,{timeZone:t.public.timeZone,now});
 if(resolved.question)throw problem('TIME_UNRESOLVED');
 const saved={...payload,resolvedTime:resolved.display,timeZone:t.public.timeZone,consentPolicy:POLICY,consentedAt:new Date(now).toISOString()};
 const r=await t.db.prepare('INSERT INTO requests(id,payload_hash,created_at,expires_at,payload) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING RETURNING id').bind(input.id,hash,now,now+t.public.retentionDays*DAY,JSON.stringify(saved)).first();
 // The INSERT trigger makes request+outbox atomic in one SQLite statement.
 if(!r){const row=await t.db.prepare('SELECT payload_hash FROM requests WHERE id=?').bind(input.id).first();if(row?.payload_hash!==hash)throw problem('IDEMPOTENCY_CONFLICT',409);}
 return {receipt:input.id,duplicate:!r};
}
export async function deliverDue(t,env,now){
 if(env.MAIL_TRANSPORT!=='SIMULATED')throw problem('REAL_MAIL_DISABLED',503);
 const due=await t.db.prepare("SELECT request_id FROM outbox WHERE (state='pending' AND next_at<=?) OR (state='leased' AND lease_until<=?) ORDER BY next_at LIMIT 20").bind(now,now).all();
 const summary={sent:0,retried:0,dead:0,recovered:0};
 for(const row of due.results){
  const token=crypto.randomUUID();
  const job=await t.db.prepare("UPDATE outbox SET state='leased',lease_until=?,lease_token=?,attempts=attempts+1 WHERE request_id=? AND attempts<5 AND ((state='pending' AND next_at<=?) OR (state='leased' AND lease_until<=?)) RETURNING *").bind(now+60000,token,row.request_id,now,now).first();
  if(!job){await t.db.prepare("UPDATE outbox SET state='dead',last_error='ATTEMPTS_EXHAUSTED' WHERE request_id=? AND state='leased' AND lease_until<=? AND attempts>=5").bind(row.request_id,now).run();continue;}
  try{
   if(job.attempts<=Number(env.SIMULATE_FAILURES||0))throw Error('SIMULATED_TRANSIENT');
   // Receipt is unique: retry after a crash cannot deliver a second simulated notification.
   const receipt=await t.db.prepare('INSERT INTO simulated_deliveries(request_id,delivered_at) SELECT id,? FROM requests WHERE id=? AND expires_at>? ON CONFLICT(request_id) DO NOTHING RETURNING request_id').bind(now,job.request_id,now).first();
   if(receipt&&env.SIMULATE_CRASH_AFTER_DELIVERY==='true'){summary.recovered++;continue;}
   await t.db.prepare("UPDATE outbox SET state='sent',delivered_at=?,lease_token=NULL,lease_until=0,last_error=NULL WHERE request_id=? AND lease_token=?").bind(now,job.request_id,token).run();summary.sent++;
  }catch{
   const dead=job.attempts>=5;
   await t.db.prepare("UPDATE outbox SET state=?,next_at=?,lease_until=0,lease_token=NULL,last_error='SIMULATED_TRANSIENT' WHERE request_id=? AND lease_token=?").bind(dead?'dead':'pending',now+Math.min(3600000,60000*2**(job.attempts-1)),job.request_id,token).run();summary[dead?'dead':'retried']++;
  }
 }
 return summary;
}
export async function retention(t,now){
 // Delete expired requests before delivering any notifications.
 await t.db.prepare('DELETE FROM requests WHERE expires_at<=?').bind(now).run();
 await t.db.prepare('DELETE FROM rate_buckets WHERE expires_at<=?').bind(now).run();
 await t.db.prepare('DELETE FROM deletion_ledger WHERE expires_at<=?').bind(now).run();
}
export async function listRequests(t,url){
 const rawLimit=Number(url.searchParams.get('limit')||20);if(!Number.isSafeInteger(rawLimit)||rawLimit<1)throw problem('INVALID_LIMIT');
 const limit=Math.min(50,rawLimit);
 const status=url.searchParams.get('status')||'';if(status&&!['New','Contacted','Scheduled','Closed'].includes(status))throw problem('INVALID_STATUS');
 const q=(url.searchParams.get('q')||'').slice(0,100).replace(/[\\%_]/g,'\\$&');
 let before=Number.MAX_SAFE_INTEGER,lastId='';
 if(url.searchParams.get('before')){try{const c=JSON.parse(new TextDecoder().decode(unb64(url.searchParams.get('before'))));if(!Number.isSafeInteger(c.time)||typeof c.id!=='string'||c.id.length>40)throw Error();before=c.time;lastId=c.id;}catch{throw problem('INVALID_CURSOR');}}
 const rows=await t.db.prepare("SELECT r.id,r.created_at,r.status,r.version,r.payload,o.state AS notification FROM requests r LEFT JOIN outbox o ON o.request_id=r.id WHERE (r.created_at<? OR (r.created_at=? AND r.id<?)) AND (?='' OR r.status=?) AND (?='' OR r.payload LIKE ? ESCAPE '\\') ORDER BY r.created_at DESC,r.id DESC LIMIT ?").bind(before,before,lastId,status,status,q,'%'+q+'%',limit+1).all();
 const page=rows.results.slice(0,limit),last=page.at(-1);
 return {requests:page.map(r=>({...r,payload:JSON.parse(r.payload)})),nextCursor:rows.results.length>limit?b64(new TextEncoder().encode(JSON.stringify({time:last.created_at,id:last.id}))):null};
}
