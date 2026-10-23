const te = new TextEncoder();
export const problem=(code,status=400)=>Object.assign(Error(code),{status});
export function b64(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
export function unb64(s){if(!/^[a-zA-Z0-9_-]+$/.test(s))throw problem('INVALID_TOKEN',401);return Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));}
export async function sha(s){return b64(await crypto.subtle.digest('SHA-256',te.encode(s)));}
async function hmac(secret){if(!secret||secret.length<32)throw problem('NOT_CONFIGURED',503);return crypto.subtle.importKey('raw',te.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function signSession(claims,secret){const raw=b64(te.encode(JSON.stringify(claims)));return raw+'.'+b64(await crypto.subtle.sign('HMAC',await hmac(secret),te.encode(raw)));}
export async function session(token,secret,shop,now){
 try{
  if(typeof token!=='string'||token.length>2048)throw Error();
  const [raw,sig,extra]=token.split('.');
  if(extra||!await crypto.subtle.verify('HMAC',await hmac(secret),unb64(sig),te.encode(raw)))throw Error();
  const c=JSON.parse(new TextDecoder().decode(unb64(raw)));
  if(c.shop!==shop||!c.sid||c.exp<=now||c.iat>now||c.exp-c.iat>3600000)throw Error();
  return c;
 }catch(e){if(e.status===503)throw e;throw problem('INVALID_SESSION',401);}
}
export async function readJson(request,max=12288){
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw problem('JSON_REQUIRED',415);
 if(+(request.headers.get('content-length')||0)>max)throw problem('BODY_TOO_LARGE',413);
 const reader=request.body?.getReader();if(!reader)throw problem('INVALID_JSON');
 const chunks=[];let size=0;
 while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>max){await reader.cancel();throw problem('BODY_TOO_LARGE',413);}chunks.push(r.value);}
 const bytes=new Uint8Array(size);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length;}
 try{const value=JSON.parse(new TextDecoder().decode(bytes));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}catch{throw problem('INVALID_JSON');}
}
export function sameOrigin(request){if(request.headers.get('origin')!==new URL(request.url).origin)throw problem('ORIGIN_DENIED',403);}
export async function rate(db,key,limit,windowMs,now){
 const bucket=key+':'+Math.floor(now/windowMs);
 const r=await db.prepare('INSERT INTO rate_buckets(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(bucket,now+windowMs*2).first();
 if(r.count>limit)throw problem('RATE_LIMIT',429);
}
let keyCache;
export async function googleIdentity(request,env,now=Date.now()){
 if(!env.GOOGLE_CLIENT_ID||env.GOOGLE_CLIENT_ID==='NOT_CONNECTED')throw problem('AUTH_NOT_CONNECTED',503);
 try{
  const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
  if(!token||token.length>8192)throw Error();
  const [h,p,s,extra]=token.split('.');if(extra)throw Error();
  const header=JSON.parse(new TextDecoder().decode(unb64(h)));
  const c=JSON.parse(new TextDecoder().decode(unb64(p)));
  if(header.alg!=='RS256'||typeof header.kid!=='string')throw Error();
  if(!['https://accounts.google.com','accounts.google.com'].includes(c.iss)||c.aud!==env.GOOGLE_CLIENT_ID||(c.azp&&c.azp!==env.GOOGLE_CLIENT_ID)||c.email_verified!==true||typeof c.sub!=='string'||!c.sub||!Number.isFinite(c.exp)||!Number.isFinite(c.iat)||c.exp*1000<=now||c.iat*1000>now+30000||(c.nbf&&c.nbf*1000>now))throw Error();
  if(!keyCache||keyCache.until<now||!keyCache.keys.some(k=>k.kid===header.kid)){
   const r=await fetch('https://www.googleapis.com/oauth2/v3/certs',{redirect:'manual'});if(!r.ok)throw Error();
   const data=await r.json();if(!Array.isArray(data.keys))throw Error();keyCache={keys:data.keys,until:now+300000};
  }
  const jwk=keyCache.keys.find(k=>k.kid===header.kid&&k.kty==='RSA');if(!jwk)throw Error();
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,unb64(s),te.encode(h+'.'+p)))throw Error();
  return c.sub;
 }catch{throw problem('UNAUTHORIZED',401);}
}
export async function owner(request,env,shop,now){
 const sub=await googleIdentity(request,env,now);
 let memberships;try{memberships=JSON.parse(env.OWNER_MEMBERSHIPS||'{}');}catch{throw problem('AUTH_NOT_CONFIGURED',503);}
 if(!Object.hasOwn(memberships,sub)||!Array.isArray(memberships[sub])||!memberships[sub].includes(shop))throw problem('FORBIDDEN',403);
 return sub;
}
