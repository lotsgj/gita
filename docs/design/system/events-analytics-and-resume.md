# Events, analytics and resume

**Status:** Current  
**Last updated:** 29 September 2026

## Event bus

The player emits validated, versioned events to a small first-party event bus. Each event receives an event ID, session ID, timestamp, app version, optional local profile IDs, context, and event-specific details. Events are immutable after creation. Adapter failures are isolated so analytics cannot break playback or navigation.

## Adapters

- **Resume** listens to location changes and Home openings, then saves the current screen plus the last meaningful place for each experience and profile.
- **Clarity** loads only when a valid build-configured project ID is present. It attaches grouped context and maps approved events to Clarity custom events.
- **Sentry** is an extension placeholder and is not configured as a live monitoring service.

There is no durable analytics event queue in IndexedDB. Clarity receives events through its in-memory browser queue; failed delivery does not grow local storage.

## Privacy context

Clarity receives age band, grouped gender, profile interface language, content language, experience, application version, and display mode. Under-13 ages become unknown; invalid or missing birth dates become missing. Profile form surfaces are masked. Name, exact date of birth, photo, private content, and raw profile identity are not sent.

## Engagement events

Current mappings cover app/profile/experience actions, language and navigation, verse views and time thresholds, and audio start, resume, pause, seek, quartiles, completion, and failure.

Rachana uses the same bus and Clarity adapter for handbook opening, document views, navigation opening, profile selection, About, Open Gitaverse, and document failures. Its Clarity tags identify `surface=rachana` and the stable documentation route. Markdown content and local profile identifiers are excluded.

## Resume precedence

An explicit `play`, `sid`, or `lang` request wins. Otherwise the chosen/default profile’s saved Home or experience location is restored. Going Home does not erase any experience point: selecting Gita 700 again, for example, restores its last SID and language. Every accepted navigation updates resumable state through the same event path used for analytics.
