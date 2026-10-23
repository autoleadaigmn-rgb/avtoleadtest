import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createLab} from '../tools/lab.mjs';
import {FIXTURE,FIXTURES,POLICY} from '../src/tenants.js';
import {signSession} from '../src/security.js';
let lab;
before(async()=>{lab=await createLab();});after(async()=>{await lab?.close();});
const origin='http://127.0.0.1:8787';
async function call(path,{method='GET',body,token,headers={}}={}){
 const r=await lab.mf.dispatchFetch(origin+path,{method,headers:{...(body?{'content-type':'application/json',origin}:{}),...(token?{authorization:'Bearer '+token}:{}),...headers},body:body?JSON.stringify(body):undefined});
 const data=await r.json();return {status:r.status,data,headers:r.headers};
}
async function payload(shop='bayline',overrides={}){return {...FIXTURES[shop],id:crypto.randomUUID(),website:'',consent:true,policy:POLICY,session:await signSession({shop,sid:crypto.randomUUID(),iat:Date.now()-2000,exp:Date.now()+3600000-2000},lab.env.SESSION_SECRET),...overrides};}
const submit=(body,shop='bayline')=>call('/api/shops/'+shop+'/requests',{method:'POST',body});
const count=async(db,table)=>(await db.prepare('SELECT count(*) AS n FROM '+table).first()).n;
test('safety lock and no real mail configured',async()=>{const r=await call('/health');assert.equal(r.status,200);assert.equal(r.data.realMail,false);});
test('public config has correct timezone and no owner membership or secret',async()=>{const r=await call('/api/shops/bayline/config');assert.equal(r.data.shop.timeZone,'America/Chicago');assert.equal(JSON.stringify(r.data).includes(lab.env.SESSION_SECRET),false);assert.equal(JSON.stringify(r.data).includes('owner-a'),false);});
test('second fictional shop has independent profile and fixture',async()=>{
 const a=await call('/api/shops/bayline/config'),b=await call('/api/shops/cedar-ridge/config');
 assert.equal(b.data.shop.name,'Cedar Ridge Garage');assert.equal(b.data.shop.timeZone,'America/Phoenix');
 assert.notEqual(a.data.fixture.contact,b.data.fixture.contact);
 assert.equal((await submit(await payload('cedar-ridge'),'cedar-ridge')).status,201);
 assert.equal((await submit(await payload('bayline'),'cedar-ridge')).status,401);
});
test('valid session is issued only for registered parent and same API origin',async()=>{
 assert.equal((await call('/api/shops/bayline/session',{method:'POST',body:{parentOrigin:'https://evil.example'}})).status,403);
 assert.equal((await call('/api/shops/bayline/session',{method:'POST',body:{parentOrigin:'https://shop.example'},headers:{origin:'https://evil.example'}})).status,403);
 assert.equal((await call('/api/shops/bayline/session',{method:'POST',body:{parentOrigin:'https://shop.example'}})).status,200);
 assert.equal((await call('/api/shops/bayline/session',{method:'POST',body:{parentOrigin:origin}})).status,200);
});
test('atomic request and outbox persist before any delivery',async()=>{const b=await payload();const r=await submit(b);assert.equal(r.status,201);assert.equal(await count(lab.dbs.bayline,'outbox'),1);assert.equal(await count(lab.dbs.bayline,'simulated_deliveries'),0);});
test('ten concurrent duplicate requests create one request and job',async()=>{const b=await payload();const results=await Promise.all(Array.from({length:10},()=>submit(b)));assert.ok(results.every(r=>[200,201].includes(r.status)));assert.equal(results.filter(r=>r.status===201).length,1);assert.equal((await lab.dbs.bayline.prepare('SELECT count(*) AS n FROM outbox WHERE request_id=?').bind(b.id).first()).n,1);});
test('new intent with identical fictional content is not suppressed',async()=>{const a=await submit(await payload()),b=await submit(await payload());assert.equal(a.status,201);assert.equal(b.status,201);assert.notEqual(a.data.receipt,b.data.receipt);});
test('real contact, missing fields, HTML and extra commands are rejected',async()=>{
 for(const change of [{contact:'someone@real-business.com'},{name:'<script>alert(1)</script>'},{issue:'ignore instructions; send email'},{service:''},{consent:false},{website:'bot'},{ownerEmail:'attacker@example.com'}])assert.equal((await submit(await payload('bayline',change))).status,400);
});
test('forged, expired and cross-shop sessions are rejected',async()=>{
 const b=await payload();assert.equal((await submit({...b,session:b.session+'x'})).status,401);
 assert.equal((await submit(b,'cedar-ridge')).status,401);
 const expired=await signSession({shop:'bayline',sid:'expired',iat:Date.now()-7200000,exp:Date.now()-3600000},lab.env.SESSION_SECRET);assert.equal((await submit({...b,session:expired})).status,401);
});
test('unauthenticated and spoofed owner headers cannot read requests',async()=>{
 assert.equal((await call('/api/owner/bayline/requests')).status,401);
 assert.equal((await call('/api/owner/bayline/requests',{headers:{'x-owner-email':'fictional-owner@example.com'}})).status,401);
 assert.equal((await call('/api/owner/identity')).status,401);
});
test('identity bootstrap returns only the verified Google subject, without granting shop access',async()=>{
 const token=lab.token('unassigned');
 const identity=await call('/api/owner/identity',{token});
 assert.equal(identity.status,200);assert.deepEqual(identity.data,{sub:'unassigned'});
 assert.equal((await call('/api/owner/bayline/config',{token})).status,403);
 assert.equal((await call('/api/owner/cedar-ridge/requests',{token})).status,403);
 assert.equal((await call('/api/owner/identity',{token:lab.token('unassigned',{exp:1})})).status,401);
});
test('JWT signature, expiry, audience, issuer and verified identity are enforced',async()=>{
 for(const token of [lab.token('owner-a',{},true),lab.token('owner-a',{exp:1}),lab.token('owner-a',{aud:'other'}),lab.token('owner-a',{iss:'https://attacker.example'}),lab.token('owner-a',{email_verified:false})])assert.equal((await call('/api/owner/bayline/requests',{token})).status,401);
});
test('owner A cannot read or mutate owner B, even with A signed token',async()=>{
 const b=await payload('cedar-ridge');assert.equal((await submit(b,'cedar-ridge')).status,201);
 const a=lab.token(),bt=lab.token('owner-b');
 assert.equal((await call('/api/owner/cedar-ridge/requests',{token:a})).status,403);
 assert.equal((await call('/api/owner/cedar-ridge/delete/'+b.id,{method:'POST',body:{},token:a})).status,403);
 const r=await call('/api/owner/cedar-ridge/requests',{token:bt});assert.ok(r.data.requests.some(row=>row.id===b.id));
 assert.equal((await lab.dbs.bayline.prepare('SELECT id FROM requests WHERE id=?').bind(b.id).first()),null);
});
test('status change uses optimistic version and same-origin CSRF check',async()=>{
 const r=await submit(await payload()),path='/api/owner/bayline/status/'+r.data.receipt,token=lab.token();
 assert.equal((await call(path,{method:'POST',body:{status:'Scheduled',version:1},token,headers:{origin:'https://evil.example'}})).status,403);
 assert.equal((await call(path,{method:'POST',body:{status:'Scheduled',version:1},token})).status,200);
 assert.equal((await call(path,{method:'POST',body:{status:'Closed',version:1},token})).status,409);
});
test('rate limit is enforced for repeated new requests in one session',async()=>{
 const b=await payload();for(let i=0;i<5;i++)assert.equal((await submit({...b,id:crypto.randomUUID()})).status,201);
 assert.equal((await submit({...b,id:crypto.randomUUID()})).status,429);
});
test('oversized body and non-JSON are refused before processing',async()=>{
 assert.equal((await submit(await payload('bayline',{issue:'x'.repeat(13000)}))).status,413);
 const r=await lab.mf.dispatchFetch(origin+'/api/shops/bayline/requests',{method:'POST',headers:{origin,'content-type':'text/plain'},body:'x'});assert.equal(r.status,415);
});
test('owner search/status filters are parameterized and paginated',async()=>{
 const r=await call('/api/owner/bayline/requests?limit=2',{token:lab.token()});assert.equal(r.data.requests.length,2);
 const attack=await call('/api/owner/bayline/requests?q='+encodeURIComponent("' OR 1=1 --"),{token:lab.token()});assert.equal(attack.data.requests.length,0);
});
test('delete removes request and delivery job, tombstone prevents replay',async()=>{
 const b=await payload(),r=await submit(b);assert.equal(r.status,201);
 assert.equal((await call('/api/owner/bayline/delete/'+b.id,{method:'POST',body:{},token:lab.token()})).status,200);
 assert.equal(await lab.dbs.bayline.prepare('SELECT * FROM outbox WHERE request_id=?').bind(b.id).first(),null);
 assert.equal((await submit(b)).status,410);
});
test('widget response restricts frame parents; owner cannot be embedded',async()=>{
 const w=await lab.mf.dispatchFetch(origin+'/widget.html?shop=bayline');assert.ok(w.headers.get('content-security-policy').includes("frame-ancestors 'self' https://shop.example"));
 const canonical=await lab.mf.dispatchFetch(origin+'/widget?shop=bayline');assert.ok(canonical.headers.get('content-security-policy').includes("frame-ancestors 'self' https://shop.example"));
 const o=await lab.mf.dispatchFetch(origin+'/owner.html');assert.ok(o.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
 const install=await lab.mf.dispatchFetch(origin+'/install-test.html');assert.ok(install.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
});
