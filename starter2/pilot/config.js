import {problem} from '../src/security.js';

const origin=value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.origin===value&&u.pathname==='/'?value:null;}catch{return null;}};
const email=value=>typeof value==='string'&&value.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
export function shopConfig(env){
 let c;try{c=JSON.parse(env.SHOP_CONFIG||'');}catch{throw problem('SHOP_NOT_CONFIGURED',503);}
 const keys=['id','name','logoUrl','services','weeklyHours','timeZone','contact','colors','greeting','siteOrigin','privacyUrl','retentionDays','dailyRequestLimit','turnstileSiteKey','policyVersion'];
 if(!c||typeof c!=='object'||Array.isArray(c)||!keys.every(k=>Object.hasOwn(c,k))||Object.keys(c).some(k=>!keys.includes(k)))throw problem('SHOP_NOT_CONFIGURED',503);
 let privacyOrigin;try{privacyOrigin=new URL(c.privacyUrl).origin;}catch{throw problem('SHOP_NOT_CONFIGURED',503);}
 if(!/^[a-z0-9-]{3,40}$/.test(c.id)||typeof c.name!=='string'||c.name.trim().length<3||c.name.length>100||!origin(c.siteOrigin)||!/^https:\/\//.test(c.privacyUrl)||privacyOrigin!==c.siteOrigin)throw problem('SHOP_NOT_CONFIGURED',503);
 try{new Intl.DateTimeFormat('en-US',{timeZone:c.timeZone}).format();}catch{throw problem('SHOP_NOT_CONFIGURED',503);}
 if(!Array.isArray(c.services)||!c.services.length||c.services.length>20||c.services.some(s=>typeof s!=='string'||s.length>80)||!Number.isSafeInteger(c.retentionDays)||c.retentionDays<1||c.retentionDays>90||!Number.isSafeInteger(c.dailyRequestLimit)||c.dailyRequestLimit<1||c.dailyRequestLimit>100)throw problem('SHOP_NOT_CONFIGURED',503);
 if(c.logoUrl&&(!/^https:\/\//.test(c.logoUrl)||c.logoUrl.length>500))throw problem('SHOP_NOT_CONFIGURED',503);
 if(!c.colors||Object.keys(c.colors).sort().join()!=='accent,background,primary'||Object.values(c.colors).some(v=>!/^#[0-9a-f]{6}$/i.test(v))||typeof c.greeting!=='string'||c.greeting.length>500||!c.greeting.trim()||!c.contact||Object.keys(c.contact).sort().join()!=='email,phone'||!email(c.contact.email)||typeof c.contact.phone!=='string'||c.contact.phone.length>40||/[\r\n<>]/.test(c.name+c.greeting))throw problem('SHOP_NOT_CONFIGURED',503);
 if(!c.weeklyHours||['mon','tue','wed','thu','fri','sat','sun'].some(d=>!Array.isArray(c.weeklyHours[d])||c.weeklyHours[d].some(pair=>!Array.isArray(pair)||pair.length!==2||!pair.every(v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v))||pair[0]>=pair[1])))throw problem('SHOP_NOT_CONFIGURED',503);
 if(!/^[a-zA-Z0-9_-]{10,100}$/.test(c.turnstileSiteKey)||!/^https:\/\//.test(c.privacyUrl)||!/^[a-z0-9-]{4,80}$/.test(c.policyVersion))throw problem('SHOP_NOT_CONFIGURED',503);
 return c;
}
export function privateConfig(env){
 const c=shopConfig(env);
 if(!email(env.OWNER_EMAIL)||!email(env.RESEND_FROM)||typeof env.OWNER_SUB!=='string'||!/^\d{10,30}$/.test(env.OWNER_SUB)||typeof env.GOOGLE_CLIENT_ID!=='string'||!/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(env.GOOGLE_CLIENT_ID)||typeof env.TURNSTILE_SECRET!=='string'||env.TURNSTILE_SECRET.length<16||typeof env.RESEND_API_KEY!=='string'||!env.RESEND_API_KEY.startsWith('re_')||typeof env.SESSION_SECRET!=='string'||env.SESSION_SECRET.length<32)throw problem('PILOT_NOT_CONFIGURED',503);
 return c;
}
export function pilotEnabled(env){return env.MODE==='PILOT'&&env.REAL_DATA_APPROVED==='true'&&env.MAIL_TRANSPORT==='RESEND'&&env.PRIVACY_REVIEWED==='true';}
