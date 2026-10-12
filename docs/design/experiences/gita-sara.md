# Gita Sara

**Status:** Current  
**Last updated:** 12 October 2026

## Purpose and sequence

Gita Sara offers a deliberately selected path through 135 records: nine Dhyana verses followed by 126 Bhagavad Gita shlokas. `sequence.csv` is authoritative, so navigation, position counts, resume, and direct SID links use the curated order without changing the canonical verse masters.

The worked [catalog-to-player example](../system/catalog-to-player.md#gita-sara) shows how that curated sequence joins canonical verse text to illustrations, contemplation questions, decks, and audio.

## Layout

On desktop, the fixed player area contains three equal-width panels: verse text, mixed media, and contemplation questions. The text panel centers the Sanskrit shloka, preferred-content-language transliteration, meaning, and word-by-word meaning. Shloka and meaning receive the strongest visual emphasis.

`Q` or the shared-menu **Questions (On/Off)** item hides and restores the contemplation panel. No question-visibility control occupies a content panel. The default three-panel view remains equal thirds. In two-panel view, the media panel retains exactly the same one-third width and height it had in three-panel mode, while the verse absorbs the removed question-panel space. This preserves image, animation and deck framing without per-asset crop rules. The wider verse panel uses bounded desktop targets of 36px for Sanskrit, 28px for meaning, 20px for transliteration and 18px for word-by-word meaning; the fit-to-panel guard scales individual fields down only when needed. The question data remains loaded, so restoring it is immediate. The selected view is stored per profile in IndexedDB and survives verse navigation, fullscreen, reload and later visits. Mobile retains full-width vertical panels and its established font scale rather than stretching the page with larger text.

On mobile, the same three component instances stack in text, media, question order without hidden desktop duplicates. Desktop fits within the player viewport; mobile uses natural vertical scrolling. The renderer retains Gitaverse typography, palette, spacing, radii, focus treatment, navigation, audio, fullscreen, profile, resume, and direct-SID behavior.

## Mixed media

`media.csv` is the cross-type composition and uses `cid#snum#sid#order#media_type#collection#asset_order`. It can interleave images and Google decks in one deterministic sequence. The shared media player selects an image or Google-deck adapter for each item and shows corner navigation only when multiple items exist.

Images may use app-relative collection paths or absolute HTTPS URLs. Unsafe protocols, protocol-relative paths, and root-relative paths are rejected. Relative images participate in local-folder and PWA behavior; external images remain network-dependent. Localized alternative text is required and captions are optional. Illustrations continue to fill their panel with the approved centered `cover` treatment. Because the media panel has invariant dimensions when Questions is toggled, its scale, crop and focal position remain identical without a second image layer. Google Decks receive the same dimensional stability.

Google Slides share URLs are normalized to `/embed` URLs with `rm=minimal`, autoplay disabled, looping disabled, and a stable delay parameter. Google still controls the embedded presentation surface, so Gitaverse cannot guarantee suppression of every provider control.

The illustration catalog contains only real assets. Local WebP files use `<sid>-<order>.webp`, for example `1.1-1.webp`, and every catalog row has aligned English and Kannada metadata. A shloka without an illustration association has no composition row; the renderer supplies the shared default illustration. That default is a quiet portrait watercolour transformation scene: a caterpillar on a lower leaf, a central chrysalis and a butterfly moving upward toward soft light. Its caption and alternative text are `TRUTH. REALISE. USE.` in English and `ಸತ್ಯ. ಅರಿವು. ಉಪಯೋಗ.` in Kannada.

## Contemplation player

The question panel reads ordered localized lines and displays their sequence number in both single-question and all-question modes. With multiple questions, corner controls move one at a time and the top-right `✦` toggles all-question mode. All-question mode left-aligns the numbered questions and scrolls inside the panel only when needed. With one question, the panel remains in single-question mode and hides `✦` and navigation. Missing authored questions resolve to “What is Truth? What Truth is this shloka pointing at?” or its Kannada equivalent.

## Audio and editing

The 126 numbered shlokas reuse the Swami Brahmananda chanting collection. Dhyana records retain their sequence position with blank audio references. Text rendering and navigation remain complete when audio or authored media is absent.

Edit mode covers all three panels and follows the renderer's language visibility: because Gita Sara displays one content language at a time, it edits only that language's media metadata and contemplation text. Missing locale content stays blank instead of inheriting another language. Language-independent media type, source URL/file, and Deck title remain editable. Verse fields retain the shared inline editor.

The media panel manages one ordered mixed-media draft for images, animated GIFs, and Google Decks. Cards are collapsed to their preview until selected; only one card is expanded at a time. The active card exposes its fields and a compact top-right pill for moving earlier, moving later, or removing the association. New cards open immediately. Adding local media requires selecting a WebP or GIF; the asset is written before its catalog and composition references. Removing an association deletes its composition rows but retains the reusable catalog asset and physical file. No blank placeholder is written because `sequence.csv` alone owns experience membership and order. Retained local media keeps its resolved browser URL across later row saves and rerenders. Downloads-only mode exports the same changed files.

The question panel uses the same single-open card pattern. A collapsed card shows the selected-language question; its expanded state edits that language and provides the shared reorder/remove pill. Empty locale text is valid. Removing every authored media item or question is valid and restores the shared fallback at playback. Unsaved-change warnings, external-change conflict detection, `#` validation, and the download reminder are shared with the verse editor. Native video is reserved in the media contract but deliberately not offered by the editor until playback, captions, audio coordination, caching, and size policy are designed.

## Verification

Automated contracts verify the exact 135-SID order, unified mixed-media ordering, asset resolution, URL safety, localized metadata, reusable fallbacks, Google URL normalization, contemplation coverage, collection-table writes, local binary-asset writes, and the two/three-panel renderer state. Browser regression verifies the equal-width fixed desktop layout, persisted 60/40 question-hidden layout, mobile stacking, image/deck switching, caption behavior, question navigation and toggles, edit controls, preferred-language content, fallback content, audio, file mode, and unchanged Gita 700/Gita Yoga behavior. SID `2.47` is the authored regression fixture.
