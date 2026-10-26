/* network-first service worker + daily push reminders */
const C="hse-v5";
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith("hse-")&&k!==C).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener("fetch",e=>{const r=e.request;const u=new URL(r.url);if(r.method!=="GET"||u.origin!==location.origin)return;
  e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp)).catch(()=>{})}return res}).catch(()=>caches.match(r).then(m=>m||caches.match("./"))))});
self.addEventListener("push",e=>{let d={};try{d=e.data.json()}catch(x){d={title:"منظومة السلامة",body:e.data&&e.data.text()}}
  e.waitUntil(self.registration.showNotification(d.title||"منظومة السلامة",{body:d.body||"",icon:"icon-192.png",badge:"icon-192.png",tag:d.tag||"hse",dir:"rtl",lang:"ar",data:{url:d.url||"./"},renotify:true,requireInteraction:true,vibrate:[300,120,300,120,300]}))});
self.addEventListener("notificationclick",e=>{e.notification.close();const url=new URL(e.notification.data&&e.notification.data.url||"./",self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(L=>{for(const c of L){if(c.url.startsWith(self.registration.scope)){c.navigate(url).catch(()=>{});return c.focus()}}return self.clients.openWindow(url)}))});
