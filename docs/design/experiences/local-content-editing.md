# Local content editing

**Status:** Current  
**Last updated:** 29 September 2026

## Entering edit mode

`E` or the menu’s Edit action starts the workflow. The preferred mode asks the user to choose the repository’s `data/collections` folder. This browser-approved folder handle lets Gitaverse reload collection data and write edited verse text to the relevant language master file.

The fallback, **Edit with downloads only**, supports browsers without writable folder access. Changes exist only in the current browser session; saving a row produces an edited-state reminder and the user downloads the affected `master_<language>.csv` files for manual replacement.

## Editing behavior

The four visible fields are editable. Save row validates that no value contains `#`, updates only the mapped fields, preserves all other records and fields, and writes only affected language masters. The Sanskrit panel edits the normalized display `shloka`; its archival `shloka_raw` value remains unchanged. Cancel and navigation warn before discarding unsaved changes.

In writable-folder mode, Save row writes directly to local collection files. In download-only mode, closing without download loses saved session edits. A before-unload warning protects dirty or pending-download work.

## Boundaries

The editor currently covers visible verse text fields. Image, audio, video, and other catalog editing are future extensions. Editing is a local authoring workflow; it never pushes to GitHub automatically.
