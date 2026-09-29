# Profiles and local storage

**Status:** Current  
**Last updated:** 29 September 2026

## Storage model

Profiles and resume locations are stored in the browser’s IndexedDB for the Gitaverse origin. The store supports multiple profiles, incremental numeric IDs, a default profile, profile editing, deletion/management, the current screen, and one resume point per profile and experience.

Profile photos are device-local data. Name, exact birth date, gender selection, and photo are never added to page URLs or analytics payloads.

## URL and profile state

`pid` identifies the local profile within application URLs. It is meaningful only on the device and browser storage where that profile exists. Experience, SID, and language parameters make content links addressable; profile selection resolves local personalization.

Opening Home records Home as the current screen but preserves every experience’s last SID, language, and saved time. Selecting an experience from Home restores that experience’s point. Explicit URL parameters still take precedence. Older single-location records are read as a compatible resume point and are upgraded naturally by later navigation.

## Failure behavior

Profile storage failures are presented as application errors and can emit a non-PII operational event. Gitaverse does not silently replace a required profile with a guest identity.

## Deliberate exclusions

Canonical verse data is not duplicated in IndexedDB. It loads from collection files into memory. Unsaved editor work is not persisted across application closure; writable-folder saves or downloaded masters are the durable authoring outputs.
