# Install, offline and updates

**Status:** Current  
**Last updated:** 29 September 2026

## Installation

Gitaverse exposes Install when the browser reports that installation is available. The web app manifest supplies application identity, theme, display mode, and icons. Installation availability varies by browser and operating system.

## Offline experience

The service worker precaches the deployed application shell and collection assets selected by the build manifest. Previously cached app content can open without a network connection. Runtime audio behavior still depends on whether a requested file has been cached and on browser storage limits.

Rachana documentation is intentionally outside the PWA cache boundary. It opens as a normal browser navigation and does not increase installed-app cache size.

## Updates

Every deployment has an application version and asset manifest. When a new service worker is installed, the application announces that a new Gitaverse version is ready. Accepting the update activates it and reloads the application. Desktop browsers may surface the notice only after the installed app is closed and reopened because service-worker lifecycle timing is browser-controlled.

See [PWA cache and updates](../system/pwa-cache-and-updates.md).
