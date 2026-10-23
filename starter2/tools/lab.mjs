// Local-only harness. This module is never bundled into the Worker or public assets.
import {Miniflare} from 'miniflare';
import {generateKeyPairSync,sign,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve(import.meta.dirname,'..');
export async function createLab({bindings={},persist=false,migrate=true}={}){
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const jwk={...publicKey.export({format:'jwk'}),kid:'local-fixture-key',alg:'RS256',use:'sig'};
 const env={MODE:'TEST_ONLY',MAIL_TRANSPORT:'SIMULATED',INTAKE_ENABLED:'true',SESSION_SECRET:randomBytes(48).toString('hex'),GOOGLE_CLIENT_ID:'starter2-local-client',OWNER_MEMBERSHIPS:JSON.stringify({'owner-a':['bayline'],'owner-b':['bayline-isolation']}),...bindings};
 const mf=new Miniflare({
  modules:true,scriptPath:resolve(root,'build/worker.mjs'),compatibilityDate:'2026-07-30',
  d1Databases:{BAYLINE_DB:'bayline-local',ISOLATION_DB:'isolation-local'},d1Persist:persist,
  bindings:env,
  outboundService:async req=>{
   if(req.url==='https://www.googleapis.com/oauth2/v3/certs')return Response.json({keys:[jwk]});
   throw Error('OUTBOUND_NETWORK_DISABLED_IN_LAB');
  },
  serviceBindings:{ASSETS:async req=>{
   const path=new URL(req.url).pathname==='/'?'/index.html':new URL(req.url).pathname;
   if(!/^\/[a-z0-9.-]+$/.test(path))return new Response('Not found',{status:404});
   try{const data=await readFile(resolve(root,'public','.'+path));const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};return new Response(data,{headers:{'Content-Type':types[extname(path)]||'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}
  }}
 });
 const dbs={bayline:await mf.getD1Database('BAYLINE_DB'),'bayline-isolation':await mf.getD1Database('ISOLATION_DB')};
 try{if(migrate){const sql=await readFile(resolve(root,'migrations/0001_initial.sql'),'utf8');const statements=sql.split(/\n(?=CREATE |PRAGMA )/).map(s=>s.trim()).filter(Boolean);for(const db of Object.values(dbs))await db.batch(statements.map(s=>db.prepare(s)));}}catch(e){await mf.dispose();throw e;}
 function token(sub='owner-a',overrides={},wrongKey=false){
  const now=Math.floor(Date.now()/1000);const h=Buffer.from(JSON.stringify({alg:'RS256',kid:jwk.kid})).toString('base64url');
  const p=Buffer.from(JSON.stringify({iss:'https://accounts.google.com',aud:env.GOOGLE_CLIENT_ID,sub,email:'fictional-owner@example.com',email_verified:true,iat:now,exp:now+3600,...overrides})).toString('base64url');
  const key=wrongKey?generateKeyPairSync('rsa',{modulusLength:2048}).privateKey:privateKey;
  return h+'.'+p+'.'+sign('RSA-SHA256',Buffer.from(h+'.'+p),key).toString('base64url');
 }
 return {mf,dbs,env,token,root,async close(){await mf.dispose();}};
}
