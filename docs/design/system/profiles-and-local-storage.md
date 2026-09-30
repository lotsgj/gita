# Profiles and local storage

**Status:** Current  
**Last updated:** 30 September 2026

## Storage model

Profiles and resume locations are stored in the browser’s IndexedDB for the Gitaverse origin. The store supports multiple profiles, incremental numeric IDs, a default profile, profile editing, deletion/management, the current screen, and one resume point per profile and experience.

Diksoochi keeps one aggregate engagement record per profile, experience and SID in `diksoochiEngagement`. It stores chapter identity, first and latest meaningful engagement times, meaningful visit count, and the highest observed engagement threshold. This is bounded summary state, not an analytics event queue. Deleting a profile deletes its Diksoochi records.

Profile photos are device-local data. Each profile stores separate `interfaceLanguage` and `contentLanguage` preferences. Existing profiles are migrated by using their former language value for both fields. Name, exact birth date, gender selection, and photo are never added to page URLs or analytics payloads.

## URL and profile state

`pid` identifies the local profile within application URLs. It is meaningful only on the device and browser storage where that profile exists. Experience and SID make content links addressable. `lang` overrides content language only; interface language is never controlled by a URL.

Opening Diksoochi records it as the current screen but preserves every experience’s last SID, language, and saved time. Selecting an experience from Diksoochi restores that experience’s point. Explicit URL parameters still take precedence. Older single-location records are read as a compatible resume point and are upgraded naturally by later navigation.

## Failure behavior

Profile storage failures are presented as application errors and can emit a non-PII operational event. Gitaverse does not silently replace a required profile with a guest identity.

## Deliberate exclusions

Canonical verse data is not duplicated in IndexedDB. It loads from collection files into memory. Unsaved editor work is not persisted across application closure; writable-folder saves or downloaded masters are the durable authoring outputs.
