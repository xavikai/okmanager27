/* Service worker: el joc funciona sense connexió un cop instal·lat. Les dades de les jornades (data/) es demanen primer a la xarxa. */
const CACHE="hm27-v6";
const CORE=["./","index.html","firebase-config.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","data/config.json","data/pts/index.json"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin)return;
  const fresh=u.pathname.includes("/data/")||u.pathname.endsWith("/")||u.pathname.endsWith("index.html");
  if(fresh){e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)))}
  else e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{const c=n.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return n})));
});
