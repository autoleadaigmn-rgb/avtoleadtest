import {configure} from './shop-config.js';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),shop=params.get('shop'),parentOrigin=params.get('parent');
let flow,state,fixture,config,sessionToken,sessionAt=0,receiptId=crypto.randomUUID(),busy=false;
function message(text,user=false){const p=document.createElement('div');p.className='message'+(user?' user':'');p.textContent=text;$('messages').append(p);$('scroll').scrollTop=$('scroll').scrollHeight;}
function render(result){state=result.state;message(result.text);$('options').replaceChildren();for(const text of result.options||[]){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=()=>talk(text);$('options').append(b);}const review=$('review');review.hidden=state.phase!=='review';review.textContent=review.hidden?'':'Local preview only — nothing sent:\n'+JSON.stringify(state.draft,null,2);}
function talk(text){if(!flow||!text.trim())return;message(text,true);render(flow.respond(state,text,{now:Date.now(),timeZone:config.timeZone}));}
async function api(path,body){const r=await fetch('/api/shops/'+encodeURIComponent(shop)+'/'+path,{method:body?'POST':'GET',credentials:'omit',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw Error(data.error||'REQUEST_FAILED');return data;}
async function init(){
 try{
  ({shop:config,fixture}=await api('config'));configure(config);
  document.documentElement.style.setProperty('--ink',config.colors.primary);document.documentElement.style.setProperty('--green',config.colors.accent);document.documentElement.style.setProperty('--paper',config.colors.background);
  $('shop-name').textContent=config.name;$('shop-hours').textContent=config.hours;
  if(config.logoUrl){const img=document.createElement('img');img.src=config.logoUrl;img.alt=config.name;img.width=48;$('shop-name').before(img);}
  flow=await import('./flow-v2.js');state=flow.initialState();message(flow.welcome.text);$('message').disabled=false;$('chat-send').disabled=false;
 }catch{message('The test shop configuration is unavailable. Intake is closed. Please reload later.');}
}
$('chat-form').onsubmit=e=>{e.preventDefault();const text=$('message').value;$('message').value='';talk(text);};
$('reset').onclick=()=>{if(!flow)return;state=flow.initialState();$('messages').replaceChildren();$('options').replaceChildren();$('review').hidden=true;$('message').value='';message(flow.welcome.text);};
$('close').onclick=()=>{try{if(new URL(parentOrigin).origin===parentOrigin)parent.postMessage({type:'autolead-close'},parentOrigin);}catch{}};
$('consent').onchange=()=>{$('send-test').disabled=!$('consent').checked||busy||!config;};
$('new-test').onclick=()=>{if(busy)return;receiptId=crypto.randomUUID();$('consent').checked=false;$('send-test').disabled=true;$('receipt').textContent='New fictional request. Consent is required again.';};
$('send-test').onclick=async()=>{
 if(busy||!$('consent').checked||!config)return;busy=true;$('send-test').disabled=true;
 try{
  if(!sessionToken||Date.now()-sessionAt>3500000){const data=await api('session',{parentOrigin});sessionToken=data.session;sessionAt=Date.now();}
  // Server-issued session timing is an anti-spam signal, not identity proof.
  const wait=Math.max(0,1100-(Date.now()-sessionAt));if(wait)await new Promise(r=>setTimeout(r,wait));
  const r=await api('requests',{...fixture,id:receiptId,session:sessionToken,website:'',consent:true,policy:config.policy});
  $('receipt').textContent=(r.duplicate?'Existing test receipt: ':'Test saved: ')+r.receipt+'. Notification queued for simulation. No email sent. Appointment not confirmed.';
 }catch(e){$('receipt').textContent='Not confirmed: '+e.message+'. Retry uses the same request ID.';}
 finally{busy=false;$('send-test').disabled=!$('consent').checked;}
};
await init();
