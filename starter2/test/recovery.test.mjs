import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLab} from '../tools/lab.mjs';
import {TENANTS,FIXTURES,POLICY,DAY} from '../src/tenants.js';
import {saveRequest,deliverDue,retention} from '../src/store.js';
import {exportState,exportLedger,restoreState} from '../tools/snapshots.mjs';
const setup=async()=>{const lab=await createLab();return {lab,t:{...TENANTS.bayline,db:lab.dbs.bayline}};};
async function save(t,now=Date.now()){const id=crypto.randomUUID();await saveRequest(t,{...FIXTURES[t.public.id],id,website:'',consent:true,policy:POLICY},{iat:now-2000,sid:crypto.randomUUID()},now);return id;}
test('transient notification failure leaves saved inquiry and retries once due',async()=>{
 const {lab,t}=await setup();try{const now=Date.now(),id=await save(t,now),env={MAIL_TRANSPORT:'SIMULATED',SIMULATE_FAILURES:'1'};
  assert.equal((await deliverDue(t,env,now)).retried,1);assert.ok(await t.db.prepare('SELECT id FROM requests WHERE id=?').bind(id).first());
  assert.equal((await deliverDue(t,env,now+1000)).sent,0);assert.equal((await deliverDue(t,env,now+61000)).sent,1);
  assert.equal((await t.db.prepare('SELECT count(*) AS n FROM simulated_deliveries').first()).n,1);
 }finally{await lab.close();}
});
test('crash after delivery is recovered after lease expiry without duplicate delivery',async()=>{
 const {lab,t}=await setup();try{const now=Date.now();await save(t,now);const env={MAIL_TRANSPORT:'SIMULATED',SIMULATE_CRASH_AFTER_DELIVERY:'true'};
  await deliverDue(t,env,now);assert.equal((await t.db.prepare('SELECT state FROM outbox').first()).state,'leased');
  assert.equal((await deliverDue(t,env,now+1000)).sent,0);assert.equal((await deliverDue(t,env,now+61000)).sent,1);
  assert.equal((await t.db.prepare('SELECT count(*) AS n FROM simulated_deliveries').first()).n,1);
 }finally{await lab.close();}
});
test('concurrent delivery processors acquire only one job lease',async()=>{
 const {lab,t}=await setup();try{await save(t);const now=Date.now();await Promise.all([deliverDue(t,{MAIL_TRANSPORT:'SIMULATED'},now),deliverDue(t,{MAIL_TRANSPORT:'SIMULATED'},now)]);
  assert.equal((await t.db.prepare('SELECT count(*) AS n FROM simulated_deliveries').first()).n,1);
 }finally{await lab.close();}
});
test('permanent simulated failure stops after five attempts and request remains visible',async()=>{
 const {lab,t}=await setup();try{const now=Date.now();await save(t,now);for(let i=0;i<5;i++)await deliverDue(t,{MAIL_TRANSPORT:'SIMULATED',SIMULATE_FAILURES:'99'},now+i*3600000);
  const row=await t.db.prepare('SELECT state,attempts FROM outbox').first();assert.equal(row.state,'dead');assert.equal(row.attempts,5);assert.equal((await t.db.prepare('SELECT count(*) AS n FROM requests').first()).n,1);
 }finally{await lab.close();}
});
test('real-mail transport is impossible, even when accidentally configured',async()=>{
 const {lab,t}=await setup();try{await save(t);await assert.rejects(deliverDue(t,{MAIL_TRANSPORT:'SES'},Date.now()),/REAL_MAIL_DISABLED/);assert.equal((await t.db.prepare('SELECT count(*) AS n FROM simulated_deliveries').first()).n,0);}finally{await lab.close();}
});
test('retention deletes expired request, outbox and delivery receipt; preserves recent',async()=>{
 const {lab,t}=await setup();try{const now=Date.now(),old=await save(t,now),recent=await save(t,now);await t.db.prepare('UPDATE requests SET expires_at=? WHERE id=?').bind(now-1,old).run();
  await retention(t,now);assert.equal(await t.db.prepare('SELECT id FROM requests WHERE id=?').bind(old).first(),null);assert.ok(await t.db.prepare('SELECT id FROM requests WHERE id=?').bind(recent).first());assert.ok(await t.db.prepare('SELECT request_id FROM deletion_ledger WHERE request_id=?').bind(old).first());
 }finally{await lab.close();}
});
test('restore requires fresh deletion ledger and cannot resurrect an erased request',async()=>{
 const {lab,t}=await setup(),target=await createLab();try{const keep=await save(t),erase=await save(t);await deliverDue(t,{MAIL_TRANSPORT:'SIMULATED'},Date.now());const snapshot=await exportState(t.db,'bayline');
  await t.db.prepare('DELETE FROM requests WHERE id=?').bind(erase).run();const ledger=await exportLedger(t.db,'bayline');
  await assert.rejects(restoreState(target.dbs.bayline,snapshot,undefined,'bayline'),/INVALID_OR_STALE/);
  await assert.rejects(restoreState(target.dbs.bayline,snapshot,ledger,'cedar-ridge'),/INVALID_OR_STALE/);
  const result=await restoreState(target.dbs.bayline,snapshot,ledger,'bayline');assert.equal(result.restored,1);assert.ok(await target.dbs.bayline.prepare('SELECT id FROM requests WHERE id=?').bind(keep).first());assert.equal(await target.dbs.bayline.prepare('SELECT id FROM requests WHERE id=?').bind(erase).first(),null);
  await assert.rejects(restoreState(target.dbs.bayline,snapshot,ledger,'bayline'),/EMPTY_NEW_DATABASE/);
 }finally{await lab.close();await target.close();}
});
test('aborted outbox trigger causes request INSERT rollback',async()=>{
 const {lab,t}=await setup();try{await t.db.prepare("CREATE TRIGGER fail_test BEFORE INSERT ON outbox BEGIN SELECT RAISE(ABORT,'test failure'); END").run();await assert.rejects(save(t));assert.equal((await t.db.prepare('SELECT count(*) AS n FROM requests').first()).n,0);}finally{await lab.close();}
});
test('Cedar Ridge snapshot restores only its own fictional fixture',async()=>{
 const lab=await createLab(),target=await createLab();
 try{
  const t={...TENANTS['cedar-ridge'],db:lab.dbs['cedar-ridge']};const id=await save(t);
  const snapshot=await exportState(t.db,'cedar-ridge'),ledger=await exportLedger(t.db,'cedar-ridge');
  const result=await restoreState(target.dbs['cedar-ridge'],snapshot,ledger,'cedar-ridge');
  assert.equal(result.restored,1);assert.ok(await target.dbs['cedar-ridge'].prepare('SELECT id FROM requests WHERE id=?').bind(id).first());
  assert.equal(await target.dbs.bayline.prepare('SELECT id FROM requests WHERE id=?').bind(id).first(),null);
 }finally{await lab.close();await target.close();}
});
