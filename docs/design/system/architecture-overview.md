# Architecture overview

**Status:** Current  
**Last updated:** 4 October 2026

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

## Typography

The player bundles variable Noto Sans fonts for Latin, Devanagari and Kannada. One CSS family selects the appropriate script face by Unicode range, and rendered verse fields carry `sa`, `en` or `kn` language metadata. All player surfaces use this family; Rachana retains its independent documentation typography. A build script embeds the font data in the player font stylesheet so HTTPS, installed PWA and `file://` mode render identically. The generated stylesheet is part of the offline shell; source fonts and SIL Open Font License notices remain deployment assets without being cached a second time.

## Extension points

Add experiences through configuration, compositions, and renderers. Add telemetry or local behavior through event adapters. Add media through reusable type collections rather than embedding provider-specific paths in renderer code.
