import assert from 'node:assert/strict';
const base=process.argv[2];
if(!/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/i.test(base||''))throw Error('Explicit workers.dev HTTPS URL required');
async function call(path,{body,origin=base}={}){
 const r=await fetch(base+path,{method:body?'POST':'GET',headers:body?{'content-type':'application/json',origin}:{},body:body?JSON.stringify(body):undefined});
 return {status:r.status,data:await r.json()};
}
const health=await call('/health');assert.equal(health.status,200);assert.equal(health.data.mode,'TEST_ONLY');assert.equal(health.data.realMail,false);assert.equal(health.data.realData,false);
const shops=process.argv[3]?[process.argv[3]]:['bayline','cedar-ridge'];
if(shops.some(shop=>!['bayline','cedar-ridge'].includes(shop)))throw Error('Only fixed fictional shop IDs are allowed');
const receipts={};
for(const shop of shops){
 const c=await call(`/api/shops/${shop}/config`);assert.equal(c.status,200);assert.equal(c.data.shop.fictional,true);assert.equal(c.data.shop.id,shop);
 const s=await call(`/api/shops/${shop}/session`,{body:{parentOrigin:base}});assert.equal(s.status,200);
 await new Promise(r=>setTimeout(r,1150));
 const payload={...c.data.fixture,id:crypto.randomUUID(),session:s.data.session,website:'',consent:true,policy:c.data.shop.policy};
 const saved=await call(`/api/shops/${shop}/requests`,{body:payload});assert.equal(saved.status,201);assert.equal(saved.data.saved,true);assert.equal(saved.data.notification,'simulated-pending');
 const duplicate=await call(`/api/shops/${shop}/requests`,{body:payload});assert.equal(duplicate.status,200);assert.equal(duplicate.data.duplicate,true);assert.equal(duplicate.data.receipt,saved.data.receipt);
 receipts[shop]=saved.data.receipt;
 if(shop==='bayline'){
  const wrong=await call('/api/shops/cedar-ridge/requests',{body:payload});assert.equal(wrong.status,401);
  const arbitrary=await call('/api/shops/bayline/requests',{body:{...payload,id:crypto.randomUUID(),contact:'not-allowed@example.com'}});assert.equal(arbitrary.status,400);
 }
 const owner=await call(`/api/owner/${shop}/requests`);assert.equal(owner.status,503);assert.equal(owner.data.error,'AUTH_NOT_CONNECTED');
}
console.log(JSON.stringify({result:'PASS',mode:'TEST_ONLY',mail:'SIMULATED',shops,receipts,owner:'fail-closed until Google OAuth configured'},null,2));
