import {TENANTS,FIXTURE,tenantFor} from './tenants.js';
import {problem,readJson,sameOrigin,signSession,session,rate,sha,owner} from './security.js';
import {saveRequest,deliverDue,retention,listRequests} from './store.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8'}});
function headers(response,ancestors="'none'"){
 const r=new Response(response.body,response);
 r.headers.set('Cache-Control','no-store');r.headers.set('X-Content-Type-Options','nosniff');
 r.headers.set('Referrer-Policy','strict-origin-when-cross-origin');r.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 r.headers.set('Cross-Origin-Opener-Policy','same-origin-allow-popups');
 if(!r.headers.has('Content-Security-Policy'))r.headers.set('Content-Security-Policy',`default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; connect-src 'self' https://accounts.google.com; frame-src https://accounts.google.com 'self'; style-src 'self' https://accounts.google.com/gsi/style; img-src 'self' https:; frame-ancestors ${ancestors}; base-uri 'none'; object-src 'none'; form-action 'none'`);
 return r;
}
async function handle(request,env){
 if(env.MODE!=='TEST_ONLY'||env.MAIL_TRANSPORT!=='SIMULATED')throw problem('TEST_SAFETY_LOCK',503);
 const url=new URL(request.url),now=Date.now();
 if(url.pathname==='/health'&&request.method==='GET')return json({ok:true,mode:'TEST_ONLY',realMail:false,realData:false});
 if(url.pathname==='/auth-config'&&request.method==='GET')return json({clientId:env.GOOGLE_CLIENT_ID||'NOT_CONNECTED'});
 const match=url.pathname.match(/^\/api\/(shops|owner)\/([a-z0-9-]+)\/([a-z-]+)(?:\/([0-9a-f-]+))?$/);
 if(!match){
  if(request.method!=='GET'||url.pathname.startsWith('/api/'))throw problem('NOT_FOUND',404);
  if(url.pathname==='/widget.html'){
   const t=tenantFor(env,url.searchParams.get('shop'));
   return headers(await env.ASSETS.fetch(request),t.parents.join(' '));
  }
  return env.ASSETS?env.ASSETS.fetch(request):json({error:'NOT_FOUND'},404);
 }
 const [,area,id,action,rid]=match,t=tenantFor(env,id);
 if(area==='owner'){
  await owner(request,env,id,now);
  await rate(t.db,'owner',120,60000,now);
  if(request.method==='GET'&&action==='requests'&&!rid)return json(await listRequests(t,url));
  if(request.method==='GET'&&action==='config')return json({shop:t.public});
  if(request.method!=='POST')throw problem('NOT_FOUND',404);
  sameOrigin(request);const body=await readJson(request,2048);
  if(action==='jobs'&&!rid){if(body.action!=='run')throw problem('INVALID_ACTION');await retention(t,now);return json(await deliverDue(t,env,now));}
  if(action==='delete'&&rid){
   const r=await t.db.prepare('DELETE FROM requests WHERE id=? RETURNING id').bind(rid).first();return json({deleted:!!r});
  }
  if(action==='status'&&rid){
   if(!['New','Contacted','Scheduled','Closed'].includes(body.status)||!Number.isSafeInteger(body.version))throw problem('INVALID_STATUS');
   const r=await t.db.prepare('UPDATE requests SET status=?,version=version+1 WHERE id=? AND version=? RETURNING version').bind(body.status,rid,body.version).first();
   if(!r)throw problem('NOT_FOUND_OR_CONFLICT',409);return json({ok:true,version:r.version});
  }
  throw problem('NOT_FOUND',404);
 }
 if(request.method==='GET'&&action==='config')return json({shop:t.public,fixture:FIXTURE});
 if(request.method!=='POST')throw problem('NOT_FOUND',404);
 sameOrigin(request);
 const body=await readJson(request);
 if(action==='session'){
  if(typeof body.parentOrigin!=='string'||!t.parents.includes(body.parentOrigin)||Object.keys(body).some(k=>k!=='parentOrigin'))throw problem('EMBED_ORIGIN_DENIED',403);
  // Trusted Cloudflare metadata in production. A missing IP shares the same conservative bucket.
  const ip=request.headers.get('cf-connecting-ip')||'unknown';
  const ipKey=await sha((env.SESSION_SECRET||'')+':'+Math.floor(now/86400000)+':'+ip);
  await rate(t.db,'ip-session:'+ipKey,20,60000,now);await rate(t.db,'shop-session',120,60000,now);
  const claims={shop:id,sid:crypto.randomUUID(),iat:now,exp:now+3600000};
  return json({session:await signSession(claims,env.SESSION_SECRET),expiresAt:claims.exp});
 }
 if(action==='requests'){
  if(env.INTAKE_ENABLED!=='true')throw problem('INTAKE_PAUSED',503);
  const c=await session(body.session,env.SESSION_SECRET,id,now);
  const receipt=await saveRequest(t,body,c,now);
  return json({...receipt,saved:true,notification:'simulated-pending',appointmentConfirmed:false},receipt.duplicate?200:201);
 }
 throw problem('NOT_FOUND',404);
}
export default {
 async fetch(request,env){
  try{return headers(await handle(request,env));}
  catch(e){return headers(json({error:e.status?e.message:'INTERNAL_ERROR',retryable:[429,503].includes(e.status)},e.status||500));}
 },
 async scheduled(_event,env,ctx){
  if(env.MODE!=='TEST_ONLY'||env.MAIL_TRANSPORT!=='SIMULATED')return;
  ctx.waitUntil((async()=>{for(const id of Object.keys(TENANTS)){const t=tenantFor(env,id);await retention(t,Date.now());await deliverDue(t,env,Date.now());}})());
 }
};
