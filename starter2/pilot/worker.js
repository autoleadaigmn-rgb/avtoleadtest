import {problem,readJson,sameOrigin,signSession,session,rate,sha,googleIdentity} from '../src/security.js';
import {listRequests} from '../src/store.js';
import {shopConfig,privateConfig,pilotEnabled,testEnabled} from './config.js';
import {testFixture} from './fixture.js';
import {savePilotRequest} from './intake.js';
import {deliverDue,retention} from './notify.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8'}});
function wrap(response,frameOrigin){
 const r=new Response(response.body,response);r.headers.set('Cache-Control','no-store');r.headers.set('X-Content-Type-Options','nosniff');r.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
 r.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');r.headers.set('Cross-Origin-Opener-Policy','same-origin-allow-popups');
 r.headers.set('Content-Security-Policy',`default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client https://challenges.cloudflare.com/turnstile/v0/api.js; connect-src 'self' https://accounts.google.com https://challenges.cloudflare.com; frame-src https://accounts.google.com https://challenges.cloudflare.com; style-src 'self' https://accounts.google.com/gsi/style; img-src 'self' https: data:; frame-ancestors ${frameOrigin}; base-uri 'none'; object-src 'none'; form-action 'self'`);
 return r;
}
async function authorized(request,env,now){const sub=await googleIdentity(request,env,now);if(sub!==env.OWNER_SUB)throw problem('FORBIDDEN',403);await rate(env.PILOT_DB,'owner',120,60000,now);}
async function handle(request,env){
 const url=new URL(request.url),now=Date.now();
 if(url.pathname==='/health'&&request.method==='GET')return json({ok:true,enabled:pilotEnabled(env),testOnly:testEnabled(env),mail:pilotEnabled(env)?env.MAIL_TRANSPORT:'DISABLED'});
 if(!pilotEnabled(env)){
  if(request.method==='GET'&&!url.pathname.startsWith('/api/')&&env.ASSETS)return env.ASSETS.fetch(request);
  throw problem('PILOT_DISABLED',503);
 }
 const c=privateConfig(env),db=env.PILOT_DB;if(!db)throw problem('PILOT_NOT_CONFIGURED',503);
 if(url.pathname==='/api/config'&&request.method==='GET')return json({shop:c,testOnly:testEnabled(env),testFixture:testEnabled(env)?testFixture(c.id):null});
 if(url.pathname==='/auth-config'&&request.method==='GET')return json({clientId:env.GOOGLE_CLIENT_ID});
 if(url.pathname==='/api/session'&&request.method==='POST'){
  sameOrigin(request);const body=await readJson(request,1024);if(Object.keys(body).length||!env.SESSION_SECRET)throw problem('INVALID_SESSION');
  const ip=request.headers.get('cf-connecting-ip')||'unknown',key=await sha(env.SESSION_SECRET+':'+Math.floor(now/86400000)+':'+ip);
  await rate(db,'ip-session:'+key,20,60000,now);await rate(db,'shop-session',120,60000,now);
  const claims={shop:c.id,sid:crypto.randomUUID(),iat:now,exp:now+3600000};return json({session:await signSession(claims,env.SESSION_SECRET),expiresAt:claims.exp});
 }
 if(url.pathname==='/api/requests'&&request.method==='POST'){
  sameOrigin(request);const body=await readJson(request,8192);const claims=await session(body.session,env.SESSION_SECRET,c.id,now);
  const saved=await savePilotRequest(db,body,claims,env,c,request,now);
  return json({...saved,saved:true,notification:'queued',appointmentConfirmed:false},saved.duplicate?200:201);
 }
 if(url.pathname.startsWith('/api/owner/')){
  await authorized(request,env,now);const action=url.pathname.slice('/api/owner/'.length);
  if(action==='requests'&&request.method==='GET')return json(await listRequests({db},url));
  if(action==='config'&&request.method==='GET')return json({shop:c});
  if(action==='health'&&request.method==='GET')return json({notifications:(await db.prepare("SELECT state,count(*) AS count FROM outbox GROUP BY state").all()).results,oldestPending:(await db.prepare("SELECT min(next_at) AS time FROM outbox WHERE state='pending'").first()).time});
  if(request.method!=='POST')throw problem('NOT_FOUND',404);sameOrigin(request);const body=await readJson(request,2048);
  if(action==='jobs'&&body.action==='run'){await retention(db,now);return json(await deliverDue(db,env,c,now));}
  const status=action.match(/^status\/([0-9a-f-]+)$/),deletion=action.match(/^delete\/([0-9a-f-]+)$/);
  if(status){if(!['New','Contacted','Scheduled','Closed'].includes(body.status)||!Number.isSafeInteger(body.version))throw problem('INVALID_STATUS');const row=await db.prepare('UPDATE requests SET status=?,version=version+1 WHERE id=? AND version=? RETURNING version').bind(body.status,status[1],body.version).first();if(!row)throw problem('NOT_FOUND_OR_CONFLICT',409);return json({ok:true,version:row.version});}
  if(deletion){const row=await db.prepare('DELETE FROM requests WHERE id=? RETURNING id').bind(deletion[1]).first();return json({deleted:!!row});}
  throw problem('NOT_FOUND',404);
 }
 if(request.method==='GET'&&!url.pathname.startsWith('/api/')&&env.ASSETS)return env.ASSETS.fetch(request);
 throw problem('NOT_FOUND',404);
}
export default {
 async fetch(request,env){let frame="'none'";const route=new URL(request.url).pathname;try{if(request.method==='GET'&&['/widget','/widget.html'].includes(route))frame="'self' "+shopConfig(env).siteOrigin;return wrap(await handle(request,env),frame);}catch(e){return wrap(json({error:e.status?e.message:'INTERNAL_ERROR',retryable:[429,503].includes(e.status)},e.status||500),frame);}},
 async scheduled(_event,env,ctx){if(!pilotEnabled(env))return;ctx.waitUntil((async()=>{try{const c=privateConfig(env);await retention(env.PILOT_DB,Date.now());await deliverDue(env.PILOT_DB,env,c,Date.now());}catch{/* Cloudflare errors are surfaced in Worker logs; never log request payloads. */}})());}
};
