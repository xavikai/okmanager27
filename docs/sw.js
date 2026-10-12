// Retira el servei de l'antiga publicació sense esborrar les partides locals.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('hm27-')).map(key => caches.delete(key)));
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: 'window' });
    for (const client of windows) {
      if (!client.url.startsWith(self.registration.scope)) continue;
      const old = new URL(client.url);
      await client.navigate('https://hoquei-manager27.pages.dev/' + old.search + old.hash);
    }
  })());
});
