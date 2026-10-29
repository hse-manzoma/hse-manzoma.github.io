/* network-first service worker + daily push reminders */
const C="hse-v6";
/* الملفات اللي لازم تكون متخزنة عشان المنظومة تفتح وانت مفيش نت */
const SHELL=["./","index.html","supa.js","forms.json","manifest.json","icon-192.png","icon-512.png","icon.svg","rep-logo.png"];
const CDN=["https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js",
           "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil((async()=>{
  const c=await caches.open(C);
  await Promise.all(SHELL.map(async u=>{try{const r=await fetch(u,{cache:"reload"});if(r.ok)await c.put(u,r)}catch(x){}}));
  /* مكتبة Supabase جاية من سيرفر تاني، فبنجيبها no-cors ونخزنها عشان تشتغل أوفلاين */
  await Promise.all(CDN.map(async u=>{try{const r=await fetch(u,{mode:"no-cors"});await c.put(u,r)}catch(x){}}));
})())});
self.addEventListener("activate",e=>e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith("hse-")&&k!==C).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener("fetch",e=>{const r=e.request;const u=new URL(r.url);if(r.method!=="GET")return;
  /* سيرفر تاني (مكتبات CDN والخطوط): الكاش الأول عشان تفتح أوفلاين فوراً */
  if(u.origin!==location.origin){
    if(!/cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|fonts\.(googleapis|gstatic)\.com/.test(u.host))return;
    e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put(r,cp)).catch(()=>{});return res})));
    return;
  }
  e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp)).catch(()=>{})}return res}).catch(()=>caches.match(r).then(m=>m||caches.match("index.html").then(x=>x||caches.match("./")))))});
self.addEventListener("push",e=>{let d={};try{d=e.data.json()}catch(x){d={title:"منظومة السلامة",body:e.data&&e.data.text()}}
  e.waitUntil(self.registration.showNotification(d.title||"منظومة السلامة",{body:d.body||"",icon:"icon-192.png",badge:"icon-192.png",tag:d.tag||"hse",dir:"rtl",lang:"ar",data:{url:d.url||"./"},renotify:true,requireInteraction:true,vibrate:[300,120,300,120,300]}))});
self.addEventListener("notificationclick",e=>{e.notification.close();const url=new URL(e.notification.data&&e.notification.data.url||"./",self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(L=>{for(const c of L){if(c.url.startsWith(self.registration.scope)){c.navigate(url).catch(()=>{});return c.focus()}}return self.clients.openWindow(url)}))});
