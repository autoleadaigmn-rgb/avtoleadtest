(()=>{
 'use strict';
 const script=document.currentScript,shop=script?.dataset.shop;
 if(!/^[a-z0-9-]{3,40}$/.test(shop||''))return;
 const base=new URL(script.src);if(base.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(base.hostname))return;
 if(document.querySelector('[data-autolead-widget]'))return;
 const host=document.createElement('div');host.dataset.autoleadWidget='true';
 const shadow=host.attachShadow({mode:'open'}),style=document.createElement('link');
 style.rel='stylesheet';style.href=new URL('/loader.css',base).href;

 const button=document.createElement('button');button.type='button';button.textContent='Chat · test demo';button.setAttribute('aria-expanded','false');
 // A scripts+same-origin sandbox is ineffective for our own frame; cross-site isolation comes from the Worker origin and CSP.
 const frame=document.createElement('iframe');frame.title='AutoLead test receptionist';frame.hidden=true;frame.setAttribute('referrerpolicy','no-referrer');
 const target=new URL('/widget.html',base);target.searchParams.set('shop',shop);target.searchParams.set('parent',location.origin);
 button.addEventListener('click',()=>{if(!frame.src)frame.src=target.href;frame.hidden=!frame.hidden;button.setAttribute('aria-expanded',String(!frame.hidden));button.textContent=frame.hidden?'Chat · test demo':'Close chat';});
 window.addEventListener('message',event=>{if(event.origin!==base.origin||event.source!==frame.contentWindow||event.data?.type!=='autolead-close')return;frame.hidden=true;button.setAttribute('aria-expanded','false');button.textContent='Chat · test demo';button.focus();});
 shadow.append(style,frame,button);document.body.append(host);
})();

