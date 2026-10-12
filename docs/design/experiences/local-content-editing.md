# Local content editing

**Status:** Current  
**Last updated:** 10 October 2026

## Entering edit mode

`E` or the menu’s Edit action starts the workflow. In `file://` mode, supported browsers reuse the writable collection folder selected once on Home, so Edit opens immediately. Gitaverse accepts the repository root, `data`, or `data/collections` and resolves the collection root before loading. If the session began with the read-only fallback, or if the web/PWA player has no local handle, Edit asks for a writable folder. This browser-approved handle lets Gitaverse reload collection data and write edits to the relevant collection files.

The fallback, **Edit with downloads only**, supports browsers without writable folder access. Changes exist only in the current browser session; saving a row produces an edited-state reminder and the user downloads the affected `master_<language>.csv` files for manual replacement.

## Editing behavior

Editable fields come from the active renderer rather than a fixed shell list. Gita 700 maps its four visible fields. Gita Yoga maps eight unique semantic fields: Sanskrit shloka and word-by-word text, plus transliteration, meaning, and word meanings for both Kannada and English. Each field has one DOM element and one edit target in every responsive layout.

Gita Sara maps its visible Sanskrit and preferred-language verse fields and edits the selected language's media metadata and contemplation text. It can add, preview, reorder, and remove image, animated-image, and Google-deck associations while preserving reusable collection boundaries. Native video remains deferred.

Save row validates that no value contains `#`, updates only the mapped fields, preserves all other records and fields, and writes only affected language masters. Sanskrit changes go to `master_sa.csv`, Kannada changes to `master_kn.csv`, and English changes to `master_en.csv`. The Sanskrit shloka editor changes the normalized display `shloka`; its archival `shloka_raw` value remains unchanged. Cancel and navigation warn before discarding unsaved changes.

In writable-folder mode, Save row writes directly to local collection files. In download-only mode, closing without download loses saved session edits. A before-unload warning protects dirty or pending-download work.

## Boundaries

Editing is a local authoring workflow; it never pushes to GitHub automatically. Audio, native video, attribution, licensing, and choosing among multiple authoring collections remain future extensions.
