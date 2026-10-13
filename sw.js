/* Service worker: el joc funciona sense connexió un cop instal·lat. Les dades de les jornades (data/) es demanen primer a la xarxa. */
const CACHE="hm27-v35";
const CORE=["./","index.html","firebase-config.js","install.js","installation-stats.js","cloud-manager.js","exit-save.js","manual-save.js","app-updates.js","app-exit.js","travel-costs.js","manifest.webmanifest","audio/ice-management.mp3","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/apple-touch-icon.png","data/config.json","data/pts/index.json"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin||u.pathname.startsWith("/api/"))return;
  const fresh=e.request.mode==="navigate"||u.pathname.endsWith(".js")||u.pathname.includes("/data/")||u.pathname.endsWith("/")||u.pathname.endsWith("index.html");
  if(fresh){e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)))}
  else e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{const c=n.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return n})));
});
