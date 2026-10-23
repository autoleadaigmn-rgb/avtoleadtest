import {problem,sha,rate} from '../src/security.js';
import {resolveAppointmentTime} from '../public/appointment-time.js';
import {testEnabled} from './config.js';
import {requireTestFixture} from './fixture.js';

const DAY=86400000, uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean=(value,min,max)=>typeof value==='string'&&value===value.trim()&&value.length>=min&&value.length<=max&&!/[<>\u0000-\u001f\u007f]/.test(value);
function validEmail(v){return v===''||typeof v==='string'&&v.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v);}
function validPhone(v){return v===''||typeof v==='string'&&/^[+()\d .-]{10,30}$/.test(v)&&/^\d{10,15}$/.test(v.replace(/\D/g,''));}
export function validateRequest(input,c,now){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['id','session','name','email','phone','vehicle','issue','preferredTime','consent','policy','website','turnstileToken'].includes(k)))throw problem('INVALID_REQUEST');
 if(!uuid.test(input.id||'')||input.consent!==true||input.policy!==c.policyVersion||input.website!==''||!clean(input.name,2,100)||!clean(input.vehicle,2,120)||!clean(input.issue,10,2000)||!clean(input.preferredTime,10,80))throw problem('INVALID_REQUEST');
 if(!validEmail(input.email)||!validPhone(input.phone)||!input.email&&!input.phone)throw problem('INVALID_CONTACT');
 if(!/^20\d{2}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d)?$/.test(input.preferredTime))throw problem('INVALID_TIME');
 const resolved=resolveAppointmentTime(input.preferredTime.replace('T',' at '),{now,timeZone:c.timeZone});if(resolved.question||!resolved.date)throw problem('INVALID_TIME');
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:c.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now)).map(p=>[p.type,p.value]));
 const localToday=Date.UTC(+parts.year,+parts.month-1,+parts.day);
 const days=(Date.parse(resolved.date+'T00:00:00Z')-localToday)/DAY;
 if(!Number.isFinite(days)||days<0||days>90)throw problem('INVALID_TIME');
 return {name:input.name,email:input.email,phone:input.phone,vehicle:input.vehicle,issue:input.issue,preferredTime:input.preferredTime,resolvedTime:resolved.display,timeZone:c.timeZone,consentPolicy:c.policyVersion,consentedAt:new Date(now).toISOString()};
}
export async function verifyTurnstile(token,request,env,c){
 if(typeof token!=='string'||token.length<1||token.length>2048)throw problem('CHALLENGE_REQUIRED');
 let result;try{
  const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET,response:token,idempotency_key:crypto.randomUUID()})});
  if(!response.ok)throw Error();result=await response.json();
 }catch{throw problem('CHALLENGE_UNAVAILABLE',503);}
 if(testEnabled(env)){
  if(result.success!==true||result.metadata?.result_with_testing_key!==true)throw problem('CHALLENGE_FAILED',403);
 }else if(result.success!==true||result.hostname!==new URL(request.url).hostname||result.action!=='starter_pilot'||result.cdata!==c.id)throw problem('CHALLENGE_FAILED',403);
}
export async function savePilotRequest(db,input,claims,env,c,request,now){
 if(testEnabled(env))requireTestFixture(input,c.id);
 const payload=validateRequest(input,c,now),hash=await sha(JSON.stringify({...payload,consentedAt:null}));
 if(claims.shop!==c.id)throw problem('INVALID_SESSION',401);
 if(await db.prepare('SELECT request_id FROM deletion_ledger WHERE request_id=? AND expires_at>?').bind(input.id,now).first())throw problem('REQUEST_GONE',410);
 const existing=await db.prepare('SELECT payload_hash FROM requests WHERE id=?').bind(input.id).first();
 if(existing){if(existing.payload_hash!==hash)throw problem('IDEMPOTENCY_CONFLICT',409);return {receipt:input.id,duplicate:true};}
 if(now-claims.iat<1000)throw problem('TOO_FAST',429);
 await rate(db,'submit:'+claims.sid,5,60000,now);await rate(db,'shop-submit',30,60000,now);
 await verifyTurnstile(input.turnstileToken,request,env,c);
 await rate(db,'shop-submit-day',c.dailyRequestLimit,86400000,now);
 const subject='New service request · '+c.name;
 const body=['A visitor submitted a service request. Appointment not confirmed.','Request ID: '+input.id,'Name: '+payload.name,'Email: '+(payload.email||'—'),'Phone: '+(payload.phone||'—'),'Vehicle: '+payload.vehicle,'Problem: '+payload.issue,'Preferred visit: '+payload.resolvedTime,'Consent: '+payload.consentPolicy+' at '+payload.consentedAt].join('\n');
 const r=await db.prepare('INSERT INTO requests(id,payload_hash,created_at,expires_at,payload,notify_to,email_subject,email_text) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING RETURNING id').bind(input.id,hash,now,now+c.retentionDays*DAY,JSON.stringify(payload),env.OWNER_EMAIL,subject,body).first();
 if(!r){const row=await db.prepare('SELECT payload_hash FROM requests WHERE id=?').bind(input.id).first();if(row?.payload_hash!==hash)throw problem('IDEMPOTENCY_CONFLICT',409);}
 return {receipt:input.id,duplicate:!r};
}
