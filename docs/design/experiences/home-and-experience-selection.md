# Home and experience selection

**Status:** Current  
**Last updated:** 1 October 2026

## Diksoochi landing

After a profile is active, Diksoochi is the application landing experience. A continuously but gently animated Krishna flute replaces the visible page title while a visually hidden heading preserves screen-reader and navigation semantics. Reduced-motion preferences stop the animation. The profile pill stays visible at the upper right.

The page uses the same centred responsive card language as profile setup: the same maximum width, surface, border, radius, shadow and mobile spacing. It prioritizes action in one vertical column: **Continue your journey** appears first, followed by **Choose an experience** and a compact **Your journey** section. Experience choices remain single-column on desktop and mobile. About Gitaverse and installation remain available below it.

Know counts distinct chapters and shlokas only after at least ten seconds of meaningful visible engagement. Brief navigation does not count. When no journey dimension has data, the section says, “Your journey details will be updated here.” Once data exists, only the available dimensions appear as encouraging sentences—for example, “You have explored 2 chapters and 2 shlokas.” The interface does not show Know, Able or Use cards, labels, or zero values. The data model retains those dimensions so Able and Use can appear later when supported by explicit evidence; they are never inferred from time or playback.

The Know sentence includes a **Details** action. It opens a read-only **Your journey** page rather than an experience. Engagements for the same SID are combined across experiences. The list follows canonical Gita order and shows SID, Sanskrit shloka, meaning in the profile’s preferred content language, and a simple **Count** of meaningful engagements. Sanskrit and meaning occupy one line and truncate visually when needed; the complete value remains available as native title text.

People may choose **Cards** or **Table** on desktop and mobile through a compact icon-only segmented control. The inline SVG controls retain translated accessible names, tooltips and pressed states. Cards place SID and count on the first line, followed by Sanskrit and meaning. The table uses Shloka, Sanskrit shloka, Meaning and Count columns and may scroll horizontally on narrow screens. The initial default is table on desktop and cards on mobile; the explicit choice is stored per profile in IndexedDB.

Cards and table rows are selectable disclosure items. Clicking, tapping, pressing Enter or pressing Space expands the selected SID in place to show the complete Sanskrit shloka with its authored line breaks and the complete preferred-language meaning. A table disclosure appears as a full-width row beneath the summary row. Only one SID is expanded at a time; selecting it again collapses it. Switching views preserves the selected and expanded SID, while leaving Your journey clears expansion.

Expanded table disclosures centre the Sanskrit and meaning inside a constrained readable-width area. Card disclosures remain left-aligned.

The list uses roving keyboard focus. Up and Down move between table rows; Home and End move to the bounds. In Cards, Left and Right move to adjacent cards and Up and Down follow the visual grid. Left and Right intentionally do nothing in Table. Escape first collapses an expanded SID and, when none is expanded, returns to the originating view. A visible focus outline, rotating chevron, `aria-expanded`, translated item labels and connected detail regions make the interaction perceivable without adding experience navigation or engagement counts.

The player’s main menu exposes **Your journey — J** immediately after **Diksoochi / Home — A**, and Help documents the shortcut. Opening from Home records Home as the transient origin; opening from the player records the current player view. Back, or Escape when no disclosure is expanded, returns to that origin without rebuilding it. Player SID, language, scroll and fullscreen state therefore remain intact. Audio pauses when Your journey opens from the player and remains paused on return. This origin is session UI state and is not persisted in IndexedDB.

## Choices

The **Choose an experience** section is part of Diksoochi. Gita 700 is selectable and opens the shared player with its renderer. Gita Yoga and Gita Sara are visible as coming-later choices so the intended experience family is understandable without implying they are implemented.

Choosing an experience preserves the profile identifier and preferred content language in application navigation. The profile’s app language governs this interface; `lang` links affect content only. The **Diksoochi / Home** command (`A`) returns from the player to Diksoochi and records it as the resumable location. Direct experience URLs still open the requested experience.

## Collection source

Home establishes one collection source for the rest of the session. Under HTTP, HTTPS and installed-PWA use, Gitaverse automatically uses the deployed relative `data/collections` path. Under `file://`, Home shows a **Local collections** section at the bottom and asks the person to select the repository’s `data/collections` folder. Once ready, the section shows the active folder and offers **Change collections**.

The selected local files, parsed experience datasets and media object URLs are reused by Your journey, Gita 700 and later experiences for the current browser session. Individual views do not show their own folder chooser. Changing the folder on Home releases local media URLs and invalidates parsed data before the replacement is validated. A direct file-mode experience URL retains its requested SID, routes through Home for the collection choice, and continues automatically afterward.

## About

About Gitaverse is available throughout the path from profile setup to the player. It uses the flute as a Krishna-associated visual symbol, links to Gitajyoti and Light of the Self, and displays the deployed application version.
