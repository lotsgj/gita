# Architecture overview

**Status:** Current  
**Last updated:** 29 September 2026

## Layers

Gitaverse is a static web application deployed by GitHub Pages:

1. `player.html` supplies the application and dialog structure.
2. Shared CSS supplies the shell, editor, and renderer presentation.
3. `js/player/player-core.js` coordinates routing, profiles, collections, renderer selection, audio, editing, events, resume, and PWA behavior.
4. `js/player/renderers` contains experience-specific rendering.
5. `data/collections` contains canonical text, reusable media catalogs, and experience compositions.
6. Build scripts create browser bundles and a deployment directory.

## Runtime flow

The active profile establishes language and resume context. The requested experience is loaded through registries and catalogs, normalized by SID, and passed to the registered renderer. Shared controls update location, audio, or shell state. Events fan out to independent adapters.

## Isolation

The active application has no dependency on the archived `x` directory. Deployment explicitly rejects `x`. Rachana is delivered beside the app but bypasses service-worker caching.

## Extension points

Add experiences through configuration, compositions, and renderers. Add telemetry or local behavior through event adapters. Add media through reusable type collections rather than embedding provider-specific paths in renderer code.
