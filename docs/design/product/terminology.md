# Terminology

**Status:** Current  
**Last updated:** 29 September 2026

## Core terms

- **Gitaverse** — the verse- and chanting-centred application.
- **Rachana** — this living design handbook.
- **Sampada** — the treasure trove of approved future enhancements.
- **Experience** — a purposeful presentation of Gita content, such as Gita 700.
- **Player shell** — shared application behavior surrounding an experience renderer.
- **Renderer** — the module that turns a normalized row into an experience-specific layout.
- **Collection** — a reusable, catalogued set of one content type.
- **Composition** — an experience’s references to records in reusable collections.
- **SID** — stable shloka identity in `cid.snum` form. `B` means chapter beginning and `E` means chapter ending.
- **CID** — chapter identifier.
- **SNUM** — the shloka position within a chapter, including `B` and `E`.
- **Profile** — a local, unauthenticated person-specific space on one device.
- **Language master** — a complete SID-aligned verse file for one language.
- **App language** — the profile preference that controls Gitaverse labels, dialogs, actions, and messages.
- **Content language** — the independent language used for chapter names, transliteration, meaning, and word-by-word meaning. It may be overridden by the `lang` URL parameter.
- **Purpose** — the role of a media reference within an experience, such as full Sanskrit chanting.

## Language codes

Use `sa` for Sanskrit, `en` for English, and `kn` for Kannada. Language master columns use semantic names without repeating the language suffix; the filename provides the language context.
