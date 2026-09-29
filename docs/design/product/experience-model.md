# Experience model

**Status:** Current  
**Last updated:** 29 September 2026

## Model

Gitaverse separates the shared application shell from individual learning experiences. The shell owns profiles, experience selection, common navigation, language, fullscreen, help, editing entry, audio controls, installation, updates, analytics, and resume. A registered renderer owns the panels and presentation rules of an experience.

## Current experiences

**Gita 700** is live. It presents four panels for the Sanskrit shloka, transliteration, meaning, and word-by-word meaning.

**Gita Yoga** and **Gita Sara** appear as future choices but do not yet have active renderers. Their media and panel designs can differ while reusing the shell.

## URL contract

The application entry is `player.html`. Important query parameters are:

- `play=gita-700` — open an experience.
- `sid=6.7` — open a stable verse directly.
- `lang=kn` — choose Kannada content; English content is `en`. Interface language always comes from the profile.
- `pid=<number>` — identify the selected local profile.

An explicit URL location takes precedence over a saved resume location. Otherwise, the selected profile can return to its most recently recorded home or experience location.

## Extending the model

A new experience supplies configuration and composition data under `data/collections/experiences`, then registers a renderer. Reusable text and media remain in their type-specific collections. See [Collections and media](../system/collections-and-media.md).
