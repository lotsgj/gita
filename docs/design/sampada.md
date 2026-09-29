# Sampada — Treasure trove of Gitaverse enhancements

**Status:** Current  
**Last updated:** 29 September 2026

Ideas approved for future implementation. Add new ideas to this list and remove an item after it has been implemented and verified.

## 1. Diksoochi — Know · Able · Use

**Tag:** Major

Create a calm, profile-specific Gita compass rather than a scorecard or competitive analytics dashboard. It should be accessible from the experience-selection page and the player menu, open as a full page, and return the user to the place from which it was opened.

Do not calculate one overall score. Present each dimension as a simple, encouraging sentence. When reliable data is unavailable, do not display zero; explain that this part of the relationship will unfold with future activity or experiences.

### Know

Purpose: **I can find my way through the Gita.**

- Show the number of chapters meaningfully explored and shlokas with which the user has spent meaningful time.
- Optionally show shlokas that are becoming familiar landmarks.
- Count meaningful reading, listening or interaction—not brief navigation through a shloka.
- Offer **Continue exploring**, returning to the last meaningfully visited shloka.
- Empty state: “Your map of the Gita will unfold here as you explore its chapters and spend time with its shlokas.”

Example:

> You have explored **9 chapters** and spent meaningful time with **84 shlokas**.

### Able

Purpose: **I am becoming comfortable chanting and interpreting the Gita.**

- Let the user self-assess chanting as **Learning**, **With guidance**, or **Independently**.
- Let the user mark **I can explain this in my own words**.
- Never infer chanting or interpretation ability merely from opening content or playing audio.
- Offer **Continue practising**, prioritising a shloka marked Learning or With guidance.
- Empty state: “Your growing ability to chant and interpret shlokas will unfold here as you reflect on your confidence.”

Example:

> You can chant **12 shlokas with guidance** and **5 independently**. You feel able to explain **8 shlokas in your own words**.

### Use

Purpose: **I can bring the Gita into my life.**

- Let the user connect a shloka with a situation, decision, relationship, habit or difficulty through an optional private reflection.
- On a later visit, allow the outcome **It helped**, **I am still exploring**, or **It did not help in this situation**.
- Offer **Return to my reflections** when application data exists.
- Until life-application experiences are available, state that this dimension will unfold later.
- Empty state: “This part of your Diksoochi will unfold as you connect the Gita with choices, relationships, challenges and everyday life.”

Example:

> You have connected **6 shlokas** with situations in your life. **4 insights felt helpful**, while **2 are still unfolding**.

### Gentle next step

End with one grounded recommendation, selected in this order:

1. Resume unfinished activity.
2. Continue a shloka marked Learning.
3. Revisit an application awaiting reflection.
4. Continue exploring the current chapter.

Include the reassurance:

> Diksoochi is a personal compass, not a test. Your journey is stored separately for this profile on this device.

### Suggested delivery order

1. Activate Know using trustworthy engagement data already available.
2. Add the self-assessment controls required for Able.
3. Add private reflection and follow-up experiences required for Use.

## 2. I WISH — Share feedback with Sudhama

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

## 3. Consistent chapter names

**Tag:** Minor

Make every chapter UI display the chapter name consistently. Some current surfaces show names while others show only chapter numbers. Use the chapter name in the active language wherever a chapter is identified, with the number retained where it helps orientation.

## 4. Global language preference

**Tag:** Major

Make the profile’s selected language global. Once the user chooses a language, every supported experience and shared application surface should open in that language. An experience may fall back gracefully only when content is unavailable in the chosen language, and should make that fallback clear.

## 5. Garuda — contextual guide

**Tag:** Major

Create **Garuda**, a simple contextual guide that helps the user understand what is available and what to do next. Guidance should be brief, relevant to the current screen or activity, and dismissible. Garuda should support the user without becoming a chatty or intrusive assistant.

## 6. Make Install app prominent

**Tag:** Minor

Make **Install Gitaverse** prominently visible when installation is supported and the app is not already installed. Keep it discoverable from the landing experience and provide a clear fallback explanation when the browser requires manual installation steps.

## 7. Choose an audio voice or collection

**Tag:** Major

Let the user choose the audio voice or collection used for an experience—for example, **Swami Brahmananda**, **Acharini Padma**, and future contributors. Present only collections compatible with the current content and audio purpose, remember the choice for the profile, and fall back clearly when the selected collection has no audio for a particular SID.

## 8. Bhetal — reflect and go deeper

**Tag:** Major

Create a feature, provisionally named **Bhetal**, that helps the user reflect, question assumptions and go deeper into a shloka or teaching. Its interaction model, relationship with MyGita, and final name will be designed later.

## 9. Sadguru — interpretations from acharyas

**Tag:** Major

Create **Sadguru**, an experience for studying interpretations from Prabhuji and other respected acharyas. Preserve the source and attribution of every interpretation, let the user choose whose interpretation to explore, and keep commentary distinct from the canonical shloka text and translation.
