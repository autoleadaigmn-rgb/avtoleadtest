(()=>{
 const script=document.currentScript,base=new URL(script.src);if(base.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(base.hostname)||document.querySelector('[data-autolead-pilot]'))return;
 const host=document.createElement('div');host.dataset.autoleadPilot='true';
 const root=host.attachShadow({mode:'open'}),button=document.createElement('button'),frame=document.createElement('iframe'),style=document.createElement('link');
 style.rel='stylesheet';style.href=new URL('/embed.css',base).href;
 button.type='button';button.textContent='Chat with the shop';
 frame.title='Service request assistant';frame.hidden=true;
 const target=new URL('/widget.html',base);target.searchParams.set('parent',location.origin);
 button.onclick=()=>{if(!frame.src)frame.src=target.href;frame.hidden=!frame.hidden;button.textContent=frame.hidden?'Chat with the shop':'Close assistant';button.setAttribute('aria-expanded',String(!frame.hidden));};
 root.append(style,frame,button);document.body.append(host);
 window.addEventListener('message',e=>{if(e.origin!==base.origin||e.source!==frame.contentWindow||e.data?.type!=='autolead-close')return;frame.hidden=true;button.textContent='Chat with the shop';button.focus();});
})();
