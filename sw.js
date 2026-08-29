/* the offline cache is gone. This file stays only to take the old worker
   off the copies that installed it: it clears the caches, unregisters
   itself and reloads the open windows. Once those copies have picked it
   up it can go too */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.map(k=>caches.delete(k)));
    await self.registration.unregister();
    const wins=await self.clients.matchAll({type:'window'});
    for(const w of wins) w.navigate(w.url);
  })());
});
