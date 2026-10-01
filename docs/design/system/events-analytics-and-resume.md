# Events, analytics and resume

**Status:** Current  
**Last updated:** 1 October 2026

## Event bus

The player emits validated, versioned events to a small first-party event bus. Each event receives an event ID, session ID, timestamp, app version, optional local profile IDs, context, and event-specific details. Events are immutable after creation. Adapter failures are isolated so analytics cannot break playback or navigation.

## Adapters

- **Resume** listens to location changes and Home openings, then saves the current screen plus the last meaningful place for each experience and profile.
- **Diksoochi** listens only to the 10-, 30- and 60-second visible verse-engagement thresholds and updates bounded profile-local per-SID aggregates used by Know.
- **Clarity** loads only when a valid build-configured project ID is present. It attaches grouped context and maps approved events to Clarity custom events.
- **Sentry** is an extension placeholder and is not configured as a live monitoring service.

There is no durable analytics event queue in IndexedDB. Clarity receives events through its in-memory browser queue; failed delivery does not grow local storage.

Diksoochi’s aggregates are independent user-state summaries, not queued Clarity events. Brief verse navigation does not create a Know record.

## Privacy context

Clarity receives age band, grouped gender, profile interface language, content language, experience, application version, and display mode. Under-13 ages become unknown; invalid or missing birth dates become missing. Profile form surfaces are masked. Name, exact date of birth, photo, private content, and raw profile identity are not sent.

## Engagement events

Current mappings cover app/profile/experience actions, language and navigation, verse views and time thresholds, and audio start, resume, pause, seek, quartiles, completion, and failure.

PWA mappings cover update available, accepted, dismissed, completed and failed. `app_version` and display mode are initialized as Clarity session tags even before a profile event. PWA lifecycle events may run without profile context and carry only applicable source/target versions plus completion result or failure stage. The same waiting version produces only one available event per page session.

Rachana uses the same bus and Clarity adapter for handbook opening, document views, navigation opening, profile selection, About, Open Gitaverse, and document failures. Its Clarity tags identify `surface=rachana` and the stable documentation route. Markdown content and local profile identifiers are excluded.

## Resume precedence

An explicit `play`, `sid`, or `lang` request wins. Otherwise the chosen/default profile’s saved Diksoochi or experience location is restored. Going to Diksoochi does not erase any experience point: selecting Gita 700 again, for example, restores its last SID and language. Every accepted navigation updates resumable state through the same event path used for analytics.
