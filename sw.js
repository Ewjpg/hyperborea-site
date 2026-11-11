const CACHE = 'hyperborea-2-1-minami-lore-1';
// Music is requested only when played, rather than downloading every track on arrival.
const CORE = ['./fira-font.css?v=1', './assets/fonts/fira-extra-condensed-italic-700.ttf', './assets/fonts/fira-extra-condensed-italic-800.ttf', './assets/fonts/fira-extra-condensed-italic-900.ttf', './assets/fonts/fira-extra-condensed-normal-700.ttf', './assets/fonts/fira-extra-condensed-normal-800.ttf', './assets/fonts/fira-extra-condensed-normal-900.ttf', './fear-card-world.css?v=3', './fear-card-world.mjs?v=1', './fear-card-model.mjs?v=1', './fear-card-kit.mjs?v=1', './fear-card-organic.mjs?v=1', './fear-card-spatial.mjs?v=1', './fear-card-uncanny.mjs?v=1', './', './index.html', './manifest.webmanifest', './fear.css', './fear-font.css', './fear.js?v=53', './fear-dance.js?v=2', './fear-dance.css?v=2', './fear-experience.js?v=3', './fear-experience.css?v=2', './fear-world.js?v=3', './fear-sound.js?v=3', './fear-darkness-model.mjs?v=1', './fear-stats.js?v=36', './weapon-data.mjs?v=28', './mobile.css', './mobile.js?v=37', './fear-submit.js?v=36', './fear-submit.css', './wahhiyyy.css?v=35', './roster-popout.css', './frog.css?v=34', './frog.js?v=36', './frog-audio.js?v=35', './frog-coin.js?v=35', './players-space.css?v=49', './players-globe.js?v=3', './players-globe.css?v=3', './assets/world-land.png?v=2', './assets/world-borders.json?v=1', './player-foil.js?v=1', './dossier-cover.js?v=2', './dossier-cover.css?v=2', './app-cursor.js?v=2', './app-cursor.css?v=1', './terminal-intro.js?v=3', './hyper-net-config.js?v=3', './hyper-guest.js?v=3', './hyper-net.js?v=5', './hyper-os.js?v=6', './hyper-os.css?v=2', './hyper-net.css?v=5', './assets/pc-hum.mp3?v=1', './terminal-intro.css?v=3', './system-update.js?v=1', './system-update.css?v=1', './versus.js?v=2', './lore.js?v=2', './lore-data.js?v=6', './lore.css?v=3', './lore-novel.js?v=5', './lore-novel.css?v=4', './assets/lore/uozu-shore.webp', './assets/lore/sfx/kids-tokyo.ogg?v=1', './assets/lore/sfx/ball-kick.ogg?v=1', './assets/lore/prologue-shore.webp', './assets/lore/prologue-eh.webp', './assets/lore/prologue-what.webp', './assets/lore/clerk-calm.webp?v=1', './assets/lore/clerk-laugh.webp?v=1', './assets/lore/clerk-open.webp?v=1', './assets/lore/clerk-crossed.webp?v=1', './versus.css?v=1', './sim-match.js?v=1', './sim-match.css?v=1', './player-foil.css?v=1', './assets/frog-cutout.webp', './boot-events.css', './sound-mixer.js?v=10', './sound-mixer.css?v=3', './azure-latch.css?v=1','./tactics.css?v=27', './tactics.js?v=47', './simulation.css?v=32', './simulation.js?v=48', './sim-renderer.js?v=32', './reaction-renderer.js?v=32', './chemistry-rules.js?v=29', './pass-model.js?v=31', './vendor/three.module.min.js', './vendor/three.core.min.js', './boot-events.js?v=27', './assets/boot-crash-icon.png', './wahhiyyy.js?v=58', './kle-experience.css?v=58', './kle-experience.js?v=58', './kle-rubik.js?v=58', './kle-cube-model.mjs?v=57', './wah-puzzle-rain.js?v=35', './wah-audio.js?v=38', './wah-submit.js?v=36', './rating-model.mjs?v=36', './player-ratings.mjs?v=36', './player-ratings.css?v=36', './assets/wahhiyyy-kit-v2.webp', './assets/fear-cutout.png', './assets/bluelock-mark.svg', './icons/icon-192.png', './icons/icon-512.png', './higanbana.mjs?v=4', './higanbana-3d.mjs?v=1', './minami-opening.mjs?v=3', './minami-garden.mjs?v=2', './minami-lycoris.mjs?v=2', './swarggy.js?v=66', './swarggy.css?v=66', './player-identity.css?v=53', './assets/club-qiqi.png?v=1', './profile-overview.js?v=50', './new-players.css?v=52', './new-players.js?v=52', './emiliano-audio.js?v=55', './new-players-cinematic.js?v=52', './assets/emiliano-cutout.png', './assets/yoru-cutout.png', './assets/minami-shin-manga.webp?v=2', './assets/minami-shin-color.webp'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('hyperborea-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if(new URL(event.request.url).pathname.startsWith('/api/')) return;
  // Let the browser handle audio range requests for normal media playback.
  if(event.request.headers.has('range')) return;
  if(event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      if(response.ok) event.waitUntil(caches.open(CACHE).then(cache => cache.put('./index.html', response.clone())));
      return response;
    }).catch(() => caches.open(CACHE).then(cache => cache.match('./index.html'))));
    return;
  }
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request);
    if(cached) return cached;
    const response = await fetch(event.request);
    if(response.ok) event.waitUntil(cache.put(event.request, response.clone()));
    return response;
  }));
});



