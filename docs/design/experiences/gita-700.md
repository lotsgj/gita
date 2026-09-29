# Gita 700

**Status:** Current  
**Last updated:** 29 September 2026

## Purpose

Gita 700 is the current verse study and chanting experience. Its visual treatment is serene and text-first, using warm, restrained panel colors rather than changing background motifs.

## Four panels

For each SID the renderer shows:

1. Sanskrit shloka.
2. Transliteration in the selected language.
3. Meaning in the selected language.
4. Word-by-word meaning in the selected language.

On narrow screens and in mobile fullscreen, all panels form one vertical column. On wider screens the renderer uses its desktop panel arrangement. Text is fitted within panel constraints while preserving intentional line breaks.

## Chapter context

The chapter label and chapter chooser use the chapter identifier and localized name from the language masters without the word “Chapter.” Dhyana follows the same rule as every numbered chapter; it has no hard-coded symbol or name. A chapter-specific outline icon appears beside each label and in the chooser. Beginning and ending records use SIDs such as `6.B` and `6.E`.

## Audio

The experience composes its full Sanskrit chant audio from a reusable audio collection. Playback supports play, pause, seeking, progress, completion, and failure handling. Absence of audio for a row does not prevent the text experience from loading.

## Language

English and Kannada are currently selectable. Sanskrit remains the canonical source panel; the other three panels use the chosen language data. A future global-language enhancement is tracked in [Sampada](../sampada.md).
