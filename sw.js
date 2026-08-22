const CACHE='sudoku-v8';
const FILES=[
  './','./index.html','./manifest.webmanifest',
  './css/base.css','./css/home.css','./css/game.css','./css/modals.css','./css/mobile.css',
  './js/engine/core.js','./js/engine/grade.js','./js/engine/modes.js',
  './js/engine/numerator.js','./js/engine/kakuro.js','./js/engine/worker.js',
  './js/app/i18n.js','./js/app/store.js','./js/app/ui.js','./js/app/preview.js',
  './js/app/board.js','./js/app/game.js','./js/app/home.js','./js/app/main.js',
  './icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png'
];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(
    caches.match(e.request).then(hit=> hit || fetch(e.request).then(res=>{
      const copy=res.clone();
      caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
      return res;
    }).catch(()=>caches.match('./index.html')))
  );
});
