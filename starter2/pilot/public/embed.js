(()=>{
 const script=document.currentScript,base=new URL(script.src);if(base.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(base.hostname)||document.querySelector('[data-autolead-pilot]'))return;
 const host=document.createElement('div');host.dataset.autoleadPilot='true';host.style.cssText='position:fixed;right:16px;bottom:16px;z-index:2147483000;font:16px system-ui,sans-serif';
 const root=host.attachShadow({mode:'open'}),button=document.createElement('button'),frame=document.createElement('iframe');
 button.type='button';button.textContent='Chat with the shop';button.style.cssText='border:0;border-radius:999px;background:#182321;color:white;padding:15px 22px;cursor:pointer;box-shadow:0 8px 24px #0003';
 frame.title='Service request assistant';frame.hidden=true;frame.style.cssText='width:min(390px,calc(100vw - 32px));height:min(650px,calc(100vh - 90px));border:0;border-radius:14px;box-shadow:0 8px 24px #0003;background:white;display:block;margin-bottom:10px';
 const target=new URL('/widget.html',base);target.searchParams.set('parent',location.origin);
 button.onclick=()=>{if(!frame.src)frame.src=target.href;frame.hidden=!frame.hidden;frame.style.display=frame.hidden?'none':'block';button.textContent=frame.hidden?'Chat with the shop':'Close assistant';button.setAttribute('aria-expanded',String(!frame.hidden));};
 frame.style.display='none';root.append(frame,button);document.body.append(host);
 window.addEventListener('message',e=>{if(e.origin!==base.origin||e.source!==frame.contentWindow||e.data?.type!=='autolead-close')return;frame.hidden=true;frame.style.display='none';button.textContent='Chat with the shop';button.focus();});
})();
