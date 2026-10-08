const C="gp-cache-v73";
const A=["/","/index.html","/styles.css?v=73","/app.js?v=73","/data.json","/manifest.webmanifest","/assets/naturpark-ammergauer-alpen-logo-transparent.png?v=73","/assets/naturpark-berg-symbol.png?v=73","/assets/warzi-wandern.png?v=73","/assets/warzi-star-badge.png?v=73","/assets/fonts/born-ready.otf?v=73","/impressum.html","/datenschutz.html","/rechtliches.html"];
self.addEventListener("install",e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const u=new URL(e.request.url);
  const isTourGpx=u.origin===location.origin && u.pathname.startsWith("/api/tours/") && u.pathname.endsWith("/gpx");
  if(isTourGpx){
    e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{if(r.ok)caches.open(C).then(c=>c.put(e.request,r.clone()));return r}).catch(()=>cached)));
    return;
  }
  if(u.pathname.startsWith("/api/"))return;
  const networkFirst = u.origin===location.origin && (u.pathname==="/" || u.pathname.endsWith(".html") || u.pathname.endsWith(".js") || u.pathname.endsWith(".css"));
  if(networkFirst){
    e.respondWith(fetch(e.request).then(r=>{if(r.ok)caches.open(C).then(c=>c.put(e.request,r.clone()));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match(u.pathname))));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{
    if(r.ok && u.origin===location.origin){caches.open(C).then(c=>c.put(e.request,r.clone()));}
    return r;
  }).catch(()=>cached)));
});
