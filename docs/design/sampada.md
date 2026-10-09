# Sampada — Treasure trove of Gitaverse enhancements

**Status:** Current  
**Last updated:** 9 October 2026

Sampada keeps both future possibilities and completed enhancements. Items retain their number after completion so decisions and delivery history remain traceable.

| List | Meaning |
| --- | --- |
| **To unfold** | Approved possibilities that are not yet implemented and verified. |
| **Done** | Enhancements that have been implemented, documented and regression-tested. |

## To unfold

### 1. Diksoochi — Able · Use

**Status:** To unfold

**Tag:** Major

Complete the remaining Able and Use dimensions of the calm, profile-specific Gita compass. The Diksoochi landing, embedded experience selection, continuation action and Know dimension are delivered. The remaining dimensions require explicit user input rather than inferred behavior.

Do not calculate one overall score. Present each dimension as a simple, encouraging sentence. When reliable data is unavailable, do not display zero; explain that this part of the relationship will unfold with future activity or experiences.

#### Able

Purpose: **I am becoming comfortable chanting and interpreting the Gita.**

- Let the user self-assess chanting as **Learning**, **With guidance**, or **Independently**.
- Let the user mark **I can explain this in my own words**.
- Never infer chanting or interpretation ability merely from opening content or playing audio.
- Offer **Continue practising**, prioritising a shloka marked Learning or With guidance.
- Empty state: “Your growing ability to chant and interpret shlokas will unfold here as you reflect on your confidence.”

Example:

> You can chant **12 shlokas with guidance** and **5 independently**. You feel able to explain **8 shlokas in your own words**.

#### Use

Purpose: **I can bring the Gita into my life.**

- Let the user connect a shloka with a situation, decision, relationship, habit or difficulty through an optional private reflection.
- On a later visit, allow the outcome **It helped**, **I am still exploring**, or **It did not help in this situation**.
- Offer **Return to my reflections** when application data exists.
- Until life-application experiences are available, state that this dimension will unfold later.
- Empty state: “This part of your Diksoochi will unfold as you connect the Gita with choices, relationships, challenges and everyday life.”

Example:

> You have connected **6 shlokas** with situations in your life. **4 insights felt helpful**, while **2 are still unfolding**.

#### Gentle next step

End with one grounded recommendation, selected in this order:

1. Resume unfinished activity.
2. Continue a shloka marked Learning.
3. Revisit an application awaiting reflection.
4. Continue exploring the current chapter.

Include the reassurance:

> Diksoochi is a personal compass, not a test. Your journey is stored separately for this profile on this device.

#### Suggested delivery order

1. Add the self-assessment controls required for Able.
2. Add private reflection and follow-up experiences required for Use.

### 2. I WISH — Share feedback with Sudhama

**Status:** To unfold

**Tag:** Major

Create a warm, simple feedback feature named **I WISH**. Feedback is addressed to **Sudhama — Krishna’s most helpful friend**.

Make I WISH accessible from the landing page and the player menu. Opening it should show a short invitation such as:

> What do you wish Gitaverse could do for you? Share an idea, a difficulty, or something that would make your Gita journey more meaningful. Sudhama is listening.

Provide two clearly labelled contact actions:

- **Message Sudhama on WhatsApp** — open a configurable WhatsApp number with a short prefilled introduction.
- **Email Sudhama** — open a configurable email address with an I WISH subject and a short message template.

The WhatsApp number and email address must live in editable application configuration rather than being embedded throughout the UI or source modules. Either channel may be hidden when it has not been configured.

The optional prefilled message may include non-personal technical context useful for support, such as app version, experience name, language and current SID. Clearly show this context to the user before opening WhatsApp or email. Do not include the profile name, date of birth, profile photo, private reflections or analytics identifiers.

Example introduction:

> Namaste Sudhama, I wish Gitaverse could…

Keep this as a user-initiated external contact action. Gitaverse should not silently transmit feedback or contact information.

### 4. Garuda — contextual guide

**Status:** To unfold

**Tag:** Major

Create **Garuda**, a simple contextual guide that helps the user understand what is available and what to do next. Guidance should be brief, relevant to the current screen or activity, and dismissible. Garuda should support the user without becoming a chatty or intrusive assistant.

### 5. Make Install app prominent

**Status:** To unfold

**Tag:** Minor

Make **Install Gitaverse** prominently visible when installation is supported and the app is not already installed. Keep it discoverable from the landing experience and provide a clear fallback explanation when the browser requires manual installation steps.

### 6. Choose an audio voice or collection

**Status:** To unfold

**Tag:** Major

Let the user choose the audio voice or collection used for an experience—for example, **Swami Brahmananda**, **Acharini Padma**, and future contributors. Present only collections compatible with the current content and audio purpose, remember the choice for the profile, and fall back clearly when the selected collection has no audio for a particular SID.

### 7. Bhetal — reflect and go deeper

**Status:** To unfold

**Tag:** Major

Create a feature, provisionally named **Bhetal**, that helps the user reflect, question assumptions and go deeper into a shloka or teaching. Its interaction model, relationship with MyGita, and final name will be designed later.

### 8. Sadguru — interpretations from acharyas

**Status:** To unfold

**Tag:** Major

Create **Sadguru**, an experience for studying interpretations from Prabhuji and other respected acharyas. Preserve the source and attribution of every interpretation, let the user choose whose interpretation to explore, and keep commentary distinct from the canonical shloka text and translation.

### 11. Automated verse-content verification

**Status:** To unfold

**Tag:** Major

Create layered verification for the Sanskrit, English and Kannada verse masters. Extend the existing schema and SID checks with required-field completeness, script and character checks, pada alignment, word-by-word structure, duplicate or placeholder detection, and a change report that identifies modified fields and unexpected cross-language edits.

Introduce an approved-source comparison and a separate verification ledger containing language, SID, field, source, review status, reviewer, review date and content hash. A content change should invalidate the previous verification for that field. Structural errors should fail the build; suspicious content should produce a review report; semantic accuracy of meanings and word-by-word explanations should remain human-verified.

Run the validator in GitHub Actions, publish its change report with the build, and document the verification workflow in Rachana when implemented.

### 13. Gita Yoga cue-region playback

**Status:** To unfold

**Tag:** Major

Turn a Gita Yoga composite recording into directly selectable learning regions without modifying or cropping the source audio. Read boundaries from the collection’s validated `cue-purpose.csv` and `cue.csv` files, and show available regions in cue order near the shared audio control.

Marker text should follow the profile’s app language where a translated cue description is available. Selecting a region should start it immediately and stop at its declared end, avoiding a separate select-then-play action. Desktop markers should provide hover help; all markers need keyboard navigation, accessible names, and clear active/progress states.

Missing or invalid cue metadata must not block the full recording, verse text, or navigation. The feature should work with a large complete-Gita cue catalog through the existing indexed lookup rather than scanning all records on every verse.

## Done

### 12. Gita Yoga foundation

**Status:** Done

**Tag:** Major

**Completed:** 9 October 2026

Gita Yoga is a live Vak Shuddhi and guided-chanting experience. It is offered above Gita 700 in **Choose an experience**, while **Continue your journey** still follows the profile’s genuinely last-visited experience and SID.

The renderer provides a responsive three-panel learning view for Sanskrit, Kannada, and English. Desktop fits one Sanskrit panel and two equal language panels between the shared bars without an inner scrollbar; mobile uses a natural-height vertical stack. Preferred content language controls Kannada/English order in both layouts. Eight semantic content fields exist once in the DOM and become the eight unique edit targets, avoiding duplicated responsive views and the overlap they can cause.

The experience composes the reusable AJ Padma and AJ Vijay learning-mode collection where audio is currently available. All canonical SIDs remain present and missing work-in-progress audio does not block content. The collection loader also supports and validates optional cue-purpose and cue files and indexes them efficiently, establishing the data foundation for segment playback.

User-selectable audio collections remain item 6. Visible cue markers and click-to-play learning regions remain item 13.

### 10. Diksoochi foundation and Know

**Status:** Done

**Tag:** Major

**Completed:** 30 September 2026

Diksoochi is the profile landing experience and contains Choose an experience. It presents Know, Able and Use, gives one resume-or-begin recommendation, and uses bounded profile-local engagement aggregates for Know. Ten seconds of visible engagement is the minimum meaningful threshold. Able and Use remain explicit unfolding states until their user-input experiences are delivered.

### 3. Consistent chapter names

**Status:** Done

**Tag:** Minor

**Completed:** 29 September 2026

Every chapter UI now displays the number and chapter name consistently in the selected content language. English and Kannada masters provide the names, including Dhyana, and the interface contains no hard-coded chapter-name exception.

### 9. Global app-language preference

**Status:** Done

**Tag:** Major

**Completed:** 29 September 2026

Every profile now has a mandatory app-language preference, independently of its preferred Gita content language. The app language governs Gitaverse labels, actions, dialogs and messages; content language governs chapter names and verse content. The `lang` URL parameter overrides content only. Existing profiles migrate their earlier language preference to both fields, and analytics records the two dimensions separately.
