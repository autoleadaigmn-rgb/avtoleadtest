export const DAY = 86400000;
export const POLICY = 'starter2-test-2026-10-v1';
const bayline = {
 id:'bayline', name:'Bayline Auto Care', fictional:true, city:'Houston, TX',
 logoUrl:'', timeZone:'America/Chicago',
 colors:{primary:'#182321',accent:'#d7fa75',background:'#f8faf6'},
 contact:{email:'service@example.com',phone:'+1 713-555-0100',address:'Fictional Houston location — not a real business'},
 hours:'Monday–Friday 8 AM–6 PM; Saturday 9 AM–1 PM; Sunday closed. America/Chicago.',
 weeklyHours:{mon:[['08:00','18:00']],tue:[['08:00','18:00']],wed:[['08:00','18:00']],thu:[['08:00','18:00']],fri:[['08:00','18:00']],sat:[['09:00','13:00']],sun:[]},
 services:['Oil & filter change','Brake inspection','Tire service','Engine diagnostics','Routine maintenance','Advisor review'],
 greeting:'Welcome to the fictional Bayline Auto Care. I can explain services and prepare a test request. I use rules, not generative AI. An appointment is not confirmed.',
 privacyUrl:'/privacy.html', retentionDays:90, policy:POLICY, mode:'TEST_ONLY'
};
// Only public presentation goes into config. Owner membership lives in a separate server variable.
export const TENANTS = {
 bayline:{binding:'BAYLINE_DB',public:bayline,parents:['https://shop.example','http://127.0.0.1:8787','http://127.0.0.1:8790']},
 'bayline-isolation':{binding:'ISOLATION_DB',public:{...bayline,id:'bayline-isolation',name:'Bayline Auto Care — Isolation Test',timeZone:'America/Los_Angeles'},parents:['https://other.example','http://127.0.0.1:8787','http://127.0.0.1:8790']}
};
export const FIXTURE = Object.freeze({name:'Alex Demo',contact:'alex@example.com',vehicle:'2019 Toyota Camry',issue:'Brakes squeal when stopping',service:'Brake inspection',preferredTime:'Next weekday morning'});
export function tenantFor(env,id) {
 const t=Object.hasOwn(TENANTS,id)?TENANTS[id]:null;
 if(!t || !env[t.binding]) throw Object.assign(Error('NOT_FOUND'),{status:404});
 validateConfig(t.public);
 return {...t,db:env[t.binding]};
}
export function validateConfig(c) {
 if(!c.fictional || c.mode!=='TEST_ONLY' || !/^[a-z0-9-]{3,40}$/.test(c.id))throw Error('UNSAFE_CONFIG');
 new Intl.DateTimeFormat('en-US',{timeZone:c.timeZone}).format();
 if(!c.name?.trim() || !c.greeting?.trim() || !c.services.length || c.services.length>20)throw Error('BAD_CONFIG');
 if(c.logoUrl && !/^https:\/\//.test(c.logoUrl))throw Error('BAD_LOGO');
 for(const v of Object.values(c.colors))if(!/^#[a-f0-9]{6}$/i.test(v))throw Error('BAD_COLOR');
 for(const day of ['mon','tue','wed','thu','fri','sat','sun']) {
  if(!Array.isArray(c.weeklyHours[day]))throw Error('BAD_HOURS');
  for(const [a,b] of c.weeklyHours[day])if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(a)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b)||a>=b)throw Error('BAD_HOURS');
 }
 return c;
}
