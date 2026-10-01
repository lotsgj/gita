# Collections and media

**Status:** Current  
**Last updated:** 1 October 2026

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

Media is owned by reusable collections, not by an experience. Gita 700’s audio composition references a collection and order for the `chant_full_sa` purpose; its image composition references chapter icons. A catalog uses SID plus order as the unique identity, permitting multiple media records for one SID.

## Validation

The loader verifies required headers, unique/aligned SIDs, supported schema versions, catalog references, and media paths before producing normalized rows. HTTP, file chooser, and writable-workspace loading share the same normalization rules.

## Runtime source

A shared collection-source service owns runtime loading. Web and PWA sessions use the deployed relative collection root; file-mode sessions use the folder selected on Home. It caches normalized datasets by experience for the session so player and journey views reuse identical data. Replacing a local folder clears those datasets and revokes their media object URLs. Writable editing remains a separate permission layered over the same collection structure.
