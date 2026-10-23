import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveAppointmentTime as resolve} from '../public/appointment-time.js';
import {TENANTS,validateConfig} from '../src/tenants.js';
test('relative date follows each shop local day, not UTC or visitor timezone',()=>{
 const now=new Date('2026-10-24T06:00:00Z');
 assert.equal(resolve('tomorrow at 9 AM',{now,timeZone:'America/Chicago'}).date,'2026-10-25');
 assert.equal(resolve('tomorrow at 9 AM',{now,timeZone:'America/Los_Angeles'}).date,'2026-10-24');
});
test('DST gap and repeated clock hour ask for clarification',()=>{
 const now=new Date('2026-01-01T12:00:00Z'),timeZone='America/Chicago';
 assert.match(resolve('2026-03-08 at 2:30 AM',{now,timeZone}).question,/does not exist/);
 assert.match(resolve('2026-11-01 at 1:30 AM',{now,timeZone}).question,/occurs twice/);
 assert.equal(resolve('2026-11-01 at 9 AM',{now,timeZone}).date,'2026-11-01');
});
test('ambiguous numeric dates, missing AM PM and invalid timezone are not guessed',()=>{
 const now=new Date('2026-01-01T12:00:00Z');
 for(const value of ['04/05/2026','tomorrow around 9','Monday or Tuesday'])assert.ok(resolve(value,{now}).question);
 assert.ok(resolve('tomorrow',{now,timeZone:'not/a-zone'}).question);
 assert.throws(()=>validateConfig({...TENANTS.bayline.public,timeZone:'not/a-zone'}));
});
test('business configuration rejects executable logo, bad colors and overnight hours',()=>{
 const c=TENANTS.bayline.public;
 assert.throws(()=>validateConfig({...c,logoUrl:'javascript:alert(1)'}));
 assert.throws(()=>validateConfig({...c,colors:{primary:'red'}}));
 assert.throws(()=>validateConfig({...c,weeklyHours:{...c.weeklyHours,mon:[['18:00','08:00']]}}));
});
