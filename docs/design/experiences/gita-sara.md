# Gita Sara

**Status:** Current  
**Last updated:** 10 October 2026

## Purpose and sequence

Gita Sara offers a deliberately selected path through 135 records: nine Dhyana verses followed by 126 Bhagavad Gita shlokas. `sequence.csv` is authoritative, so navigation, position counts, resume, and direct SID links use the curated order without changing the canonical verse masters.

## Layout

On desktop, the fixed player area contains three equal-width panels: verse text, mixed media, and contemplation questions. The text panel centers the Sanskrit shloka, preferred-content-language transliteration, meaning, and word-by-word meaning. Shloka and meaning receive the strongest visual emphasis.

On mobile, the same three component instances stack in text, media, question order without hidden desktop duplicates. Desktop fits within the player viewport; mobile uses natural vertical scrolling. The renderer retains Gitaverse typography, palette, spacing, radii, focus treatment, navigation, audio, fullscreen, profile, resume, and direct-SID behavior.

## Mixed media

`media.csv` is the cross-type composition and uses `cid#snum#sid#order#media_type#collection#asset_order`. It can interleave images and Google decks in one deterministic sequence. The shared media player selects an image or Google-deck adapter for each item and shows corner navigation only when multiple items exist.

Images may use app-relative collection paths or absolute HTTPS URLs. Unsafe protocols, protocol-relative paths, and root-relative paths are rejected. Relative images participate in local-folder and PWA behavior; external images remain network-dependent. Localized alternative text is required and captions are optional.

Google Slides share URLs are normalized to `/embed` URLs with `rm=minimal`, autoplay disabled, looping disabled, and a stable delay parameter. Google still controls the embedded presentation surface, so Gitaverse cannot guarantee suppression of every provider control.

If a SID has no authored media of either type, the default illustration collection supplies a quiet portrait watercolour transformation scene: a caterpillar on a lower leaf, a central chrysalis and a butterfly moving upward toward soft light. Its misty negative space, faded edges and restrained sage–ivory–indigo palette make it contemplative rather than diagrammatic; it contains no circle, arrows or embedded text. Its caption and alternative text are `TRUTH. REALISE. USE.` in English and `ಸತ್ಯ. ಅರಿವು. ಉಪಯೋಗ.` in Kannada.

## Contemplation player

The question panel reads ordered localized lines. With multiple questions, corner controls move one at a time and the top-right `✦` toggles all-question mode. All-question mode scrolls inside the panel only when needed. With one question, the panel remains in single-question mode and hides `✦` and navigation. Missing authored questions resolve to “What is Truth? What Truth is this shloka pointing at?” or its Kannada equivalent.

## Audio and editing

The 126 numbered shlokas reuse the Swami Brahmananda chanting collection. Dhyana records retain their sequence position with blank audio references. Text rendering and navigation remain complete when audio or authored media is absent.

Edit mode currently exposes the visible verse fields. Mixed media and contemplation data remain read-only in this tranche; their reusable contracts are ready for a later collection editor.

## Verification

Automated contracts verify the exact 135-SID order, unified mixed-media ordering, asset resolution, URL safety, localized metadata, reusable fallbacks, Google URL normalization, and contemplation coverage. Browser regression verifies the equal-width fixed desktop layout, mobile stacking, image/deck switching, caption behavior, question navigation and toggle, preferred-language content, fallback content, audio, file mode, and unchanged Gita 700/Gita Yoga behavior. SID `2.47` is the authored regression fixture.
