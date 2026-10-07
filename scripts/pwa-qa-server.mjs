// Local-only, production-build lifecycle QA. No login, remote writes or test data.
// Copy dist into ignored qa/pwa-A and qa/pwa-B; put A or B in qa/pwa-current.txt.
// This separate origin must never be used for production deployment.
import http from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, extname, sep } from 'node:path'
const root = resolve(process.env.READING_SHELF_PWA_QA_ROOT || 'qa'), port = Number(process.env.READING_SHELF_PWA_QA_PORT || 5185)
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' }
let probes = 0
const monitor = `
const box = document.createElement('details'); box.id='pwa-qa'; box.style='margin:24px;padding:16px;border:1px solid #857B6E';
box.innerHTML='<summary>PWA lifecycle QA (local only)</summary><pre id="pwa-qa-status"></pre><button id="pwa-qa-check">QA: check deployed worker</button><button id="pwa-qa-network">QA: network/cache probe</button>';
document.body.append(box);
const visits=Number(sessionStorage.getItem('pwa-qa-visits')||0)+1; sessionStorage.setItem('pwa-qa-visits',String(visits));
let probeResult='not run';
navigator.serviceWorker.addEventListener('controllerchange',()=>sessionStorage.setItem('pwa-qa-changes',String(Number(sessionStorage.getItem('pwa-qa-changes')||0)+1)));
async function inspect(){
 const regs=await navigator.serviceWorker.getRegistrations(); const reg=regs.find(r=>r.scope===location.origin+'/');
 const names=(await caches.keys()).filter(n=>n.startsWith('reading-shelf-')); let keys=[];
 for(const name of names){ const cache=await caches.open(name); keys.push(...await cache.keys()); }
 const forbidden=keys.filter(k=>new URL(k.url).origin!==location.origin || !/^\\/(?:index\\.html|assets\\/[^/]+\\.(?:js|css)|fonts\\/[^/]+\\.woff2|icons\\/[^/]+\\.(?:png|ico)|manifest\\.webmanifest)$/.test(new URL(k.url).pathname)).length;
 document.getElementById('pwa-qa-status').textContent=JSON.stringify({build:document.querySelector('meta[name="pwa-qa-build"]').content,visits,controller:!!navigator.serviceWorker.controller,waiting:reg?.waiting?.state||'none',registrationCount:regs.length,scope:reg?.scope,controllerChanges:Number(sessionStorage.getItem('pwa-qa-changes')||0),cacheEntries:keys.length,forbiddenCacheEntries:forbidden,probe:probeResult,viewport:innerWidth+'x'+innerHeight,overflow:document.documentElement.scrollWidth>innerWidth},null,2);
}
document.getElementById('pwa-qa-check').onclick=async()=>{const reg=await navigator.serviceWorker.getRegistration('/');await reg?.update();await inspect()};
document.getElementById('pwa-qa-network').onclick=async()=>{
 const a=await fetch('/__pwa-network-probe').then(r=>r.json()),b=await fetch('/__pwa-network-probe').then(r=>r.json());
 let results=[];
 // Anonymous GETs only. No credentials, private cover or user content is used.
 for(const path of ['/auth/v1/health','/rest/v1/books?select=id&limit=0','/rest/v1/profiles?select=id&limit=0','/storage/v1/object/sign/book-covers/pwa-nonexistent?token=invalid']){
  try {const r=await fetch('https://agtkrlpiixniouipwdxr.supabase.co'+path,{credentials:'omit'});results.push(r.status)}catch{results.push('network/CORS failure')}
 }
 probeResult={networkCounterAdvanced:b.counter>a.counter,anonymousSupabaseStatuses:results};await inspect();
};setInterval(inspect,1000);inspect();
`
http.createServer((req,res)=>{
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname
  res.setHeader('Cache-Control','no-store')
  if(pathname==='/__qa-reset.html'){
    res.setHeader('Content-Type','text/html');res.end('<!doctype html><h1>Reset isolated 5185 QA only</h1><button id="reset">Reset disposable QA worker/cache</button><p id="status"></p><script>document.getElementById("reset").onclick=async()=>{for(const r of await navigator.serviceWorker.getRegistrations()){if(r.scope===location.origin+"/")await r.unregister()}for(const n of await caches.keys()){if(n.startsWith("reading-shelf-"))await caches.delete(n)}sessionStorage.removeItem("pwa-qa-visits");sessionStorage.removeItem("pwa-qa-changes");document.getElementById("status").textContent="QA reset complete"}</script>');return
  }
  if(pathname==='/__pwa-qa-monitor.js'){res.setHeader('Content-Type','text/javascript');res.end(monitor);return}
  if(pathname==='/__pwa-network-probe'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({counter:++probes}));return}
  const version=readFileSync(resolve(root,'pwa-current.txt'),'utf8').trim()
  if(!['A','B'].includes(version)){res.writeHead(503);res.end('Invalid QA version');return}
  const folder=resolve(root,'pwa-'+version)
  let path=resolve(folder,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)))
  if(!path.startsWith(folder+sep)){res.writeHead(403);res.end();return}
  // Old immutable assets must remain served across deployment, as documented.
  if(!existsSync(path) && pathname.startsWith('/assets/')) path=resolve(root,'pwa-A','.'+pathname)
  if(!existsSync(path)){res.writeHead(404);res.end('Not found');return}
  let data=readFileSync(path)
  if(extname(path)==='.html') data=Buffer.from(data.toString().replace('</head>', '<meta name="pwa-qa-build" content="'+version+'"></head>').replace('</body>','<script src="/__pwa-qa-monitor.js"></script></body>'))
  res.setHeader('Content-Type',types[extname(path)]||'application/octet-stream');res.end(data)
}).listen(port,'127.0.0.1',()=>console.log('Local production QA: http://127.0.0.1:'+port+' (no business writes)'))
