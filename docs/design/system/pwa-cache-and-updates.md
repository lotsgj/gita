# PWA cache and updates

**Status:** Current  
**Last updated:** 29 September 2026

## Build-time cache manifest

The deployment build inventories the application assets and writes a versioned asset manifest. The service worker uses this manifest to precache the current application shell and data. Changed deployments create a new cache identity; activation removes obsolete Gitaverse caches.

This content-hash/build-version approach lets unchanged URL assets be reused by normal browser and service-worker caching while ensuring changed files—including collection CSV or chapter SVG files—are represented by the new deployment.

## Runtime strategy

Navigation and asset requests use service-worker policies appropriate to the app shell and versioned deployment. The update manager watches registration lifecycle changes and offers an explicit reload when a waiting worker is ready.

## Cache boundaries

The archived `x` tree is neither deployed nor cached. Rachana’s `docs.html`, documentation Markdown, docs CSS/JavaScript, and parser assets are deployed for browser access but deliberately omitted from PWA precache and bypassed by the service worker.

## Storage constraints

Browser storage quotas are device- and browser-controlled, especially on mobile. Gitaverse must not assume all audio can be retained offline. Future downloadable audio packs should use explicit user choice, quota checks, eviction visibility, and graceful streaming fallback.
