const $=id=>document.getElementById(id),shop=new URLSearchParams(location.search).get('shop')||'bayline';
let token='',cursor='',busy=false;
async function api(path,body){const r=await fetch('/api/owner/'+encodeURIComponent(shop)+'/'+path,{method:body?'POST':'GET',credentials:'omit',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok)throw Error(d.error);return d;}
function signedOut(){token='';$('requests').replaceChildren();$('inbox').hidden=true;$('logout').hidden=true;$('auth-status').textContent='Signed out. No records are displayed.';}
async function login(t){token=t;try{const {shop:c}=await api('config');$('title').textContent=c.name+' · test inbox';$('inbox').hidden=false;$('logout').hidden=false;$('auth-status').textContent='Authorized for this test shop. Token stays in memory.';await load();}catch(e){signedOut();$('auth-status').textContent='Access denied: '+e.message;}}
async function load(older=false){
 if(busy)return;busy=true;
 try{
  const query=new URLSearchParams({q:$('search').value,status:$('filter').value,limit:'20'});if(older&&cursor)query.set('before',cursor);
  const {requests,nextCursor}=await api('requests?'+query);if(!older)$('requests').replaceChildren();
  for(const r of requests){const card=document.createElement('article');card.className='request';const h=document.createElement('h3');h.textContent=r.payload.name+' · '+r.status;card.append(h);
   for(const text of [r.payload.contact,r.payload.vehicle,r.payload.service,r.payload.issue,r.payload.resolvedTime,'Received '+new Date(r.created_at).toLocaleString(),'Notification: '+r.notification+' · ID: '+r.id]){const p=document.createElement('p');p.textContent=text;card.append(p);}
   const select=document.createElement('select');select.setAttribute('aria-label','Status for '+r.id);for(const value of ['New','Contacted','Scheduled','Closed']){const o=document.createElement('option');o.value=value;o.textContent=value;select.append(o);}select.value=r.status;
   const save=document.createElement('button');save.textContent='Update status';save.onclick=async()=>{save.disabled=true;try{await api('status/'+r.id,{status:select.value,version:r.version});await load();}catch(e){$('status').textContent=e.message;}finally{save.disabled=false;}};
   const erase=document.createElement('button');erase.className='secondary';erase.textContent='Delete fictional request';erase.onclick=async()=>{erase.disabled=true;try{await api('delete/'+r.id,{});await load();}catch(e){$('status').textContent=e.message;}finally{erase.disabled=false;}};
   const actions=document.createElement('div');actions.className='actions';actions.append(select,save,erase);card.append(actions);$('requests').append(card);
  }
  cursor=nextCursor||'';$('more').hidden=!cursor;
  $('status').textContent=requests.length?'Fictional records loaded from the server.':'No matching records.';
 }catch(e){$('status').textContent=e.message;if(['UNAUTHORIZED','FORBIDDEN'].includes(e.message))signedOut();}
 finally{busy=false;}
}
$('logout').onclick=signedOut;$('refresh').onclick=()=>load();$('filter').onchange=()=>load();$('more').onclick=()=>load(true);
let timer;$('search').oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>load(),300);};
$('jobs').onclick=async()=>{try{$('jobs').disabled=true;const r=await api('jobs',{action:'run'});await load();$('status').textContent='Simulation complete: '+JSON.stringify(r)+'. No real email sent.';}catch(e){$('status').textContent=e.message;}finally{$('jobs').disabled=false;}};
if(['127.0.0.1','localhost'].includes(location.hostname)){
 $('local-login').hidden=false;$('local-login').onclick=async()=>{try{const r=await fetch('/local-fixture-token',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw Error('Local fixture server is not running');await login((await r.json()).token);}catch(e){$('auth-status').textContent=e.message;}};
}
const {clientId}=await (await fetch('/auth-config')).json();
if(clientId==='NOT_CONNECTED'||clientId==='starter2-local-client')$('auth-status').textContent='External Google login is not connected. Local lab offers a fictional owner only.';
else {const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.onload=()=>{google.accounts.id.initialize({client_id:clientId,callback:r=>login(r.credential)});google.accounts.id.renderButton($('google-button'),{theme:'outline',size:'large'});};s.onerror=()=>{$('auth-status').textContent='Google sign-in is unavailable.';};document.head.append(s);}
