const $=id=>document.getElementById(id),form=$('request-form');let config,token='',session='',sessionAt=0,requestId=crypto.randomUUID(),busy=false;
const origin=new URLSearchParams(location.search).get('parent');
function status(text){$('status').textContent=text;}
async function request(path,body){const r=await fetch('/api/'+path,{method:body?'POST':'GET',credentials:'omit',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw Error(data.error||'REQUEST_FAILED');return data;}
function resetChallenge(){token='';if(window.turnstile&&window.challengeId!==undefined)turnstile.reset(window.challengeId);}
async function init(){
 try{config=(await request('config')).shop;$('shop-name').textContent=config.name;$('greeting').textContent=config.greeting;$('privacy').href=config.privacyUrl;$('privacy-summary').textContent='I agree to send these details to '+config.name+'. AutoLead stores the request on Cloudflare for up to '+config.retentionDays+' days and sends a notification through Resend. The shop will contact me; no appointment is confirmed.';$('submit').disabled=false;
  const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.onload=()=>{window.challengeId=turnstile.render('#challenge',{sitekey:config.turnstileSiteKey,action:'starter_pilot',cData:config.id,callback:value=>{token=value;},'expired-callback':()=>{token='';},'error-callback':()=>{token='';status('Verification is unavailable. Please retry.');}});};s.onerror=()=>status('Verification is unavailable. Please retry later.');document.head.append(s);
 }catch{status('The shop is not accepting requests right now.');}}
form.addEventListener('submit',async e=>{e.preventDefault();if(busy||!config)return;busy=true;$('submit').disabled=true;try{
 const v=Object.fromEntries(new FormData(form)),date=v.date,time=v.time,preferredTime=date+(time?'T'+time:'');if(!form.elements.consent.checked)throw Error('CONSENT_REQUIRED');if(!v.email&&!v.phone)throw Error('ENTER_EMAIL_OR_PHONE');if(!token)throw Error('COMPLETE_VERIFICATION');
 if(!session||Date.now()-sessionAt>3500000){const d=await request('session',{});session=d.session;sessionAt=Date.now();}
 const wait=Math.max(0,1100-(Date.now()-sessionAt));if(wait)await new Promise(r=>setTimeout(r,wait));
 const result=await request('requests',{id:requestId,session,name:v.name.trim(),email:v.email.trim(),phone:v.phone.trim(),vehicle:v.vehicle.trim(),issue:v.issue.trim(),preferredTime,consent:true,policy:config.policyVersion,website:v.website,turnstileToken:token});
 status((result.duplicate?'Already saved: ':'Saved: ')+result.receipt+'. The shop will review your request. Appointment not confirmed.');$('new').hidden=false;resetChallenge();
 }catch(error){status('Not confirmed: '+error.message+'. You can retry; the same request ID will be used.');resetChallenge();}finally{busy=false;$('submit').disabled=false;}});
$('new').onclick=()=>{requestId=crypto.randomUUID();form.reset();$('new').hidden=true;status('New request. Please review the privacy notice and consent again.');resetChallenge();};
$('answer').textContent='Choose a topic or complete the request below. Responses use the shop’s configured information, not generative AI.';
for(const button of document.querySelectorAll('[data-answer]'))button.onclick=()=>{if(!config)return;const days=['mon','tue','wed','thu','fri','sat','sun'];$('answer').textContent=button.dataset.answer==='services'?'Services: '+config.services.join(', '):button.dataset.answer==='hours'?'Hours in '+config.timeZone+': '+days.map(d=>d.toUpperCase()+' '+(config.weeklyHours[d].map(pair=>pair.join('–')).join(', ')||'closed')).join('; '):'Send a request below. A person at the shop will review it and contact you. An appointment is not confirmed.';};
$('close').onclick=()=>{try{if(new URL(origin).origin===origin)parent.postMessage({type:'autolead-close'},origin);}catch{}};
await init();
