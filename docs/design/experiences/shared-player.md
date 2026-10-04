# Shared player

**Status:** Current  
**Last updated:** 4 October 2026

## Persistent frame

The top bar shows the active chapter at left, a large SID in the center, the main menu, and the profile pill. Current position within the complete record set appears between the top bar and the first panel. The bottom control bar stays available on mobile and contains Go to, audio playback with seeking and elapsed/total time, and fullscreen.

## Navigation

Users can select a chapter, go directly to an SID, or move to adjacent records. Desktop keyboard shortcuts include arrows, `G`, `C`, `L`, `A`, `P` or Space, `F`, `H`, `K`, `M`, `E`, and Escape. The menu supports arrow-key movement and Enter. Chapter cards support keyboard selection. Mobile horizontal swipes move between verses.

## Dialog and fullscreen behavior

Escape closes an open dialog before leaving fullscreen. Desktop uses browser fullscreen. Mobile uses native fullscreen when supported; panels remain vertically stacked in portrait and landscape, with pinch zoom retained where the browser permits it.

## Shared capabilities

The shell supplies content-language choice, chapter and SID routing, audio controls, profile access, About, Help, local editing entry, install/update notices, events, and resume. Every shell label and message follows the profile’s app language; renderer content follows the independently selected content language. Renderers supply their own panel layout and editable field mapping.

The complete player uses bundled Noto Sans faces for English, Sanskrit and Kannada. Script-specific faces are selected without changing the common visual family, and are available offline with the application shell.

See [Gita 700](gita-700.md) for the current renderer.
