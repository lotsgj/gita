# Gita Yoga

**Status:** Current  
**Last updated:** 9 October 2026

## Purpose

Gita Yoga supports **Vak Shuddhi through guided Gita chanting**. It brings the Sanskrit verse, its word-by-word form, Kannada and English transliterations, meanings, and word meanings into one learning view. The experience is available from Diksoochi and appears above Gita 700 in **Choose an experience**.

## Layout

On desktop, three panels fit between the persistent top bar and bottom audio controls without creating an inner renderer scrollbar:

1. The upper Sanskrit panel places Sanskrit word-by-word text across the first row. Below it, three columns show the Sanskrit shloka, the preferred content-language transliteration, and the other transliteration.
2. The lower-left panel shows the preferred content language’s meaning and word meanings.
3. The lower-right panel shows the other language’s meaning and word meanings.

The two lower panels share one fixed-height row. Text fitting keeps authored content inside the available panel areas. On mobile, the same content nodes form a natural-height vertical stack: Sanskrit shloka, Sanskrit word-by-word text, preferred-language content, and then the other language. The page scrolls normally when that stack is taller than the viewport.

The panels use the same serene background palette as Gita 700. No visible field labels are added to the learning surface.

## One semantic field, one element

The renderer creates eight unique content elements: Sanskrit shloka and word-by-word text, plus transliteration, meaning, and word meanings for each of Kannada and English. CSS grid placement moves these same elements between desktop and mobile layouts. It does not maintain separate visible and hidden copies of verse data.

This rule prevents duplicate edit targets, stale mirrored content, and accessibility repetition. The three colored panel surfaces are presentation-only background layers.

## Language behavior

The profile’s preferred content language determines which of Kannada and English appears first. Changing content language immediately reorders the same content elements in desktop and mobile layouts. App language remains separate and governs shared labels and messages.

## Audio

Gita Yoga currently composes the reusable **Bhagavad Gita Learning Mode** collection by AJ Padma and AJ Vijay. Each available asset is one composite recording; the player does not crop or rewrite the source file. Because the collection is work in progress, some SIDs intentionally have no audio reference. Those verses still render normally and the shared audio control remains unavailable for that SID.

The data layer is ready for optional cue metadata. A collection can declare a cue-purpose file and a cue file as a pair, and the loader validates and indexes their records by SID and asset order. The user-facing cue regions and click-to-play segment behavior have not yet been delivered; they remain in [Sampada](../sampada.md).

## Editing

Edit mode exposes all eight semantic fields exactly once. Saving routes Sanskrit changes to `master_sa.csv`, Kannada changes to `master_kn.csv`, and English changes to `master_en.csv`, while preserving unrelated columns and records. Editing the displayed Sanskrit shloka does not alter its archival `shloka_raw` value.

## Verification

Automated contracts verify canonical SID alignment, experience composition, partial-audio behavior, and cue schemas. Browser regression verifies the three-panel desktop layout, mobile stacking, content-language reordering, unique content nodes, non-overlapping columns, fixed desktop renderer height, audio resolution, and safe rendering when audio is absent.
