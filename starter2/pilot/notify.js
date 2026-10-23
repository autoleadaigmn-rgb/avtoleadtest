import {problem} from '../src/security.js';

const MAX_ATTEMPTS=5,MAX_WINDOW=23*3600000;
export async function sendResend(job,env,c){
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'starter2/'+c.id+'/'+job.request_id},body:JSON.stringify({from:env.RESEND_FROM,to:[job.recipient],subject:job.subject,text:job.body})});
 if(response.ok){const data=await response.json();if(typeof data.id!=='string'||!data.id)throw Error('PROVIDER_RESPONSE_INVALID');return data.id;}
 const error=Object.assign(Error('PROVIDER_REJECTED'),{retryable:response.status===409||response.status===429||response.status>=500});
 throw error;
}
export async function deliverDue(db,env,c,now,send=sendResend){
 if(env.MODE!=='PILOT'||env.REAL_DATA_APPROVED!=='true'||env.MAIL_TRANSPORT!=='RESEND'||env.PRIVACY_REVIEWED!=='true')throw problem('PILOT_DISABLED',503);
 const due=await db.prepare("SELECT request_id FROM outbox WHERE (state='pending' AND next_at<=?) OR (state='leased' AND lease_until<=?) ORDER BY next_at LIMIT 10").bind(now,now).all();
 const summary={sent:0,retried:0,dead:0};
 for(const row of due.results){
  const token=crypto.randomUUID();
  const job=await db.prepare("UPDATE outbox SET state='leased',lease_until=?,lease_token=?,attempts=attempts+1,first_attempt_at=CASE WHEN first_attempt_at=0 THEN ? ELSE first_attempt_at END WHERE request_id=? AND attempts<? AND ((state='pending' AND next_at<=?) OR (state='leased' AND lease_until<=?)) RETURNING *").bind(now+60000,token,now,row.request_id,MAX_ATTEMPTS,now,now).first();
  if(!job){await db.prepare("UPDATE outbox SET state='dead',last_error='ATTEMPTS_EXHAUSTED' WHERE request_id=? AND attempts>=? AND state!='sent'").bind(row.request_id,MAX_ATTEMPTS).run();summary.dead++;continue;}
  if(now-job.first_attempt_at>=MAX_WINDOW){await db.prepare("UPDATE outbox SET state='dead',lease_until=0,lease_token=NULL,last_error='RECONCILE_MANUALLY' WHERE request_id=? AND lease_token=?").bind(row.request_id,token).run();summary.dead++;continue;}
  try{
   const providerId=await send(job,env,c);
   await db.prepare("UPDATE outbox SET state='sent',provider_id=?,delivered_at=?,lease_until=0,lease_token=NULL,last_error=NULL WHERE request_id=? AND lease_token=?").bind(providerId,now,row.request_id,token).run();summary.sent++;
  }catch(e){
   const dead=e.retryable===false||job.attempts>=MAX_ATTEMPTS;
   await db.prepare("UPDATE outbox SET state=?,next_at=?,lease_until=0,lease_token=NULL,last_error=? WHERE request_id=? AND lease_token=?").bind(dead?'dead':'pending',now+Math.min(3600000,60000*4**(job.attempts-1)),dead?'PROVIDER_REJECTED':'RETRY_PENDING',row.request_id,token).run();summary[dead?'dead':'retried']++;
  }
 }
 return summary;
}
export async function retention(db,now){
 await db.prepare('DELETE FROM requests WHERE expires_at<=?').bind(now).run();
 await db.prepare('DELETE FROM rate_buckets WHERE expires_at<=?').bind(now).run();
 await db.prepare('DELETE FROM deletion_ledger WHERE expires_at<=?').bind(now).run();
}
