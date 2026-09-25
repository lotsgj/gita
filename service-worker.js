const BUILD_VERSION = '__GITAVERSE_VERSION__';
const SHELL_CACHE = `gitaverse-shell-${BUILD_VERSION}`;
const AUDIO_CACHE = 'gitaverse-audio-v1';
const SHELL_PREFIX = 'gitaverse-shell-';

function scopedUrl(path) {
  return new URL(path, self.registration.scope).href;
}

async function installShell() {
  const manifestResponse = await fetch(scopedUrl(`asset-manifest.json?build=${encodeURIComponent(BUILD_VERSION)}`), { cache: 'no-store' });
  if (!manifestResponse.ok) throw new Error('Could not load the Gitaverse asset manifest.');
  const manifest = await manifestResponse.clone().json();
  if (manifest.version !== BUILD_VERSION) throw new Error('The Gitaverse build and asset manifest do not match.');
  const cache = await caches.open(SHELL_CACHE);
  await cache.put(scopedUrl('asset-manifest.json'), manifestResponse);
  await Promise.all(manifest.precache.map((asset) => {
    return cache.add(new Request(scopedUrl(asset), { cache: 'reload' }));
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(installShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(SHELL_PREFIX) && name !== SHELL_CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function sliceRange(request, response) {
  const range = request.headers.get('range');
  if (!range) return response;
  const match = /^bytes=(\d+)-(\d*)$/i.exec(range);
  if (!match) return new Response(null, { status: 416 });
  const body = await response.arrayBuffer();
  const start = Number(match[1]);
  const end = match[2] ? Math.min(Number(match[2]), body.byteLength - 1) : body.byteLength - 1;
  if (start >= body.byteLength || end < start) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${body.byteLength}` } });
  const headers = new Headers(response.headers);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Length', String(end - start + 1));
  headers.set('Content-Range', `bytes ${start}-${end}/${body.byteLength}`);
  return new Response(body.slice(start, end + 1), { status: 206, statusText: 'Partial Content', headers });
}

async function audioResponse(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const cacheKey = new Request(request.url, { method: 'GET' });
  let response = await cache.match(cacheKey);
  if (!response) {
    try {
      const network = await fetch(request.url, { cache: 'no-store', credentials: 'same-origin' });
      if (!network.ok || network.status !== 200) return network;
      await cache.put(cacheKey, network.clone());
      response = network;
    } catch (_) {
      return new Response('This audio is not available offline yet.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  }
  return sliceRange(request, response);
}

async function shellResponse(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    return await fetch(request);
  } catch (_) {
    if (request.mode === 'navigate') {
      return (await caches.match(scopedUrl('player.html'))) || (await caches.match(scopedUrl('offline.html')));
    }
    throw _;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (/\.(mp3|m4a|ogg|wav)$/i.test(url.pathname)) event.respondWith(audioResponse(request));
  else event.respondWith(shellResponse(request));
});
