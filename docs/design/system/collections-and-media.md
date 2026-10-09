# Collections and media

**Status:** Current  
**Last updated:** 9 October 2026

## Organization

All active content lives under `data/collections`:

```text
data/collections/<type>/collection.csv
data/collections/<type>/<collection>/catalog.csv
data/collections/<type>/<collection>/<content>
data/collections/experiences/<experience>/...
```

Current type registries include verses, audio, images, video, and animations. Registries locate a collection catalog; catalogs locate individual content. Experience files compose those reusable records for an experience-specific purpose.

## Verse masters

The Bhagavad Gita verse catalog points to `master_sa.csv`, `master_en.csv`, and `master_kn.csv`. Each master contains every SID in the same canonical order, even when some content fields are empty.

- Sanskrit: `cid`, `snum`, `sid`, `chapter_name`, `shloka_raw`, `shloka`, `word_by_word`, `meaning`, `word_by_word_meaning`.
- English and Kannada: `cid`, `snum`, `sid`, `chapter_name`, `transliteration`, `meaning`, `word_by_word_meaning`.

`shloka_raw` preserves the unformatted Sanskrit source. `shloka` is the independently maintained presentation value and may contain intentional line breaks for rendering. The player displays `shloka`; it does not automatically regenerate one field from the other during loading or editing.

`#` is prohibited in values because files are hash-delimited. Intentional line breaks are encoded as `\n`. Display line-break markers belong in `shloka`, not `shloka_raw`.

## Media

Media is owned by reusable collections, not by an experience. A catalog uses SID plus order as the unique identity, permitting multiple assets for one SID and reuse across experiences.

The audio registry uses:

```text
collection_id#title#contributor#language#catalog_url#cue_purpose_url#cue_url#attribution#license#source
```

Each audio catalog uses `sid#order#language#audio_url`. Gita 700’s composition uses the purpose-specific fields `chant_full_sa_collection` and `chant_full_sa_order`. Gita Yoga uses `audio_collection` and `audio_order`; its `experience.json` declares those names through `audioBinding.collectionField` and `audioBinding.orderField`. This generic binding lets future experiences define their own composition vocabulary without placing provider paths in a renderer.

Gita 700’s image composition references its chapter icons through the same reusable-collection principle.

## Audio cues

An audio collection may optionally declare both cue files in its registry row:

- `cue-purpose.csv`: `cue_id#language#purpose#description`
- `cue.csv`: `sid#asset_order#cue_order#cue_id#start_ms#end_ms`

The two URLs must be supplied as a pair. The loader validates cue identifiers, ordering, non-overlap, time ranges, asset references, and uniqueness, then builds an index by collection, SID, and asset order. Invalid cue metadata is isolated from ordinary verse and audio loading so the source recording remains usable without segment controls.

The current AJ Padma and AJ Vijay collection does not yet publish cue files. Cue-region display and segment playback are therefore not active. The cue contract has automated fixture coverage, including a 4,500-record performance case, so production cue files can be added without changing the collection model.

Gita Yoga’s composition deliberately contains all canonical SIDs even though its learning-mode audio is still being produced. Blank collection/order values mean that no recording is available for that SID; text rendering and navigation remain available.

## Validation

The loader verifies required headers, unique/aligned SIDs, supported schema versions, catalog references, and media paths before producing normalized rows. HTTP, file chooser, and writable-workspace loading share the same normalization rules.

## Runtime source

A shared collection-source service owns runtime loading. Web and PWA sessions use the deployed relative collection root; file-mode sessions use the folder selected on Home. It caches normalized datasets by experience for the session so player and journey views reuse identical data. Replacing a local folder clears those datasets and revokes their media object URLs. Writable editing remains a separate permission layered over the same collection structure.
