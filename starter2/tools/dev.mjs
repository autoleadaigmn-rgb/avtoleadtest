import './build.mjs';
import {createServer} from 'node:http';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createLab} from './lab.mjs';
await mkdir('.local',{recursive:true});
const lab=await createLab({persist:resolve('.local/d1')});
const port=8787;
const server=createServer(async(req,res)=>{
 try{
  if(req.headers.host!==`127.0.0.1:${port}`){res.writeHead(403).end('Loopback host required');return;}
  if(req.url==='/local-fixture-token'){
   if(req.method!=='POST'||req.headers.origin!==`http://127.0.0.1:${port}`){res.writeHead(403).end();return;}
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({token:lab.token()}));return;
  }
  const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>16384){res.writeHead(413).end();return;}chunks.push(c);}
  const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v&& !['host','cf-connecting-ip'].includes(k))headers.set(k,Array.isArray(v)?v.join(','):v);
  headers.set('cf-connecting-ip','127.0.0.1');
  const r=await lab.mf.dispatchFetch(`http://127.0.0.1:${port}${req.url}`,{method:req.method,headers,body:chunks.length?Buffer.concat(chunks):undefined});
  res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));
 }catch{res.writeHead(500).end('Local lab error');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}/ — fictional data / simulated mail / no cloud resources`));
const hostServer=createServer((req,res)=>{
 if(req.headers.host!=='127.0.0.1:8790'||req.method!=='GET'){res.writeHead(403).end();return;}
 const head='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fictional third-party repair site</title><link rel="stylesheet" href="http://127.0.0.1:8787/style.css"><body><main><p class="eyebrow">Local cross-origin installation test</p><h1>A fictional repair shop website.</h1><p>The website is on port 8790. The independent widget and API are on port 8787. No client project was copied.</p>';
 const tail='</main></body></html>';
 const html=req.url==='/responsive'?head+'<h2>320 px widget viewport</h2><iframe title="320 pixel widget test" width="320" height="650" src="http://127.0.0.1:8787/widget.html?shop=bayline&amp;parent=http%3A%2F%2F127.0.0.1%3A8790"></iframe><h2>390 px widget viewport</h2><iframe title="390 pixel widget test" width="390" height="650" src="http://127.0.0.1:8787/widget.html?shop=bayline&amp;parent=http%3A%2F%2F127.0.0.1%3A8790"></iframe>'+tail:head+'<p>The single-line loader adds the chat button.</p><script async src="http://127.0.0.1:8787/loader.js" data-shop="bayline"></script>'+tail;
 res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src http://127.0.0.1:8787; style-src http://127.0.0.1:8787; frame-src http://127.0.0.1:8787; object-src 'none'"}).end(html);
});
hostServer.listen(8790,'127.0.0.1',()=>console.log('Cross-origin host: http://127.0.0.1:8790/ ; responsive harness: /responsive'));
async function stop(){server.close();hostServer.close();await lab.close();process.exit(0);}process.once('SIGINT',stop);process.once('SIGTERM',stop);
