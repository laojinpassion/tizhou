const CACHE='tizhou-280e1460';
const CORE=['./','./index.html','./manifest.webmanifest','./install.html','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET')return;
  // 安装包等大文件不进缓存，直接交给浏览器下载
  if(/\.(apk|zip|exe|dmg|ipa)$/i.test(new URL(r.url).pathname))return;
  if(r.mode==='navigate'){
    e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp));return res;})
      .catch(()=>caches.match(r).then(h=>h||caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{
    if(res.ok&&new URL(r.url).origin===self.location.origin){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp));}
    return res;})));
});
