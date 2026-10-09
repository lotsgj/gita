# Collection player parity matrix

The collection player must pass this matrix before each public release.

| Capability | Automated | Browser verified | Status |
| --- | --- | --- | --- |
| Complete SID inventory and ordering | Node contract | Yes | Pass |
| Sanskrit, English and Kannada equivalence | Node contract | Yes | Pass |
| Shared audio and image resolution | Node contract | Yes | Pass |
| Landing and profile creation | Browser regression | Yes | Pass |
| Direct SID and language URL | Browser regression | Yes | Pass |
| Four-panel Gita-700 rendering | Node + browser | Yes | Pass |
| Three-panel Gita-Yoga rendering | Node + browser | Yes | Pass |
| Gita-Yoga canonical SID and audio composition | Node contract | Yes | Pass |
| Gita-Yoga single-DOM eight-field model | Node + browser | Yes | Pass |
| Gita-Yoga content-language reordering | Browser regression | Yes | Pass |
| Gita-Yoga desktop fit and non-overlap | Browser regression | Yes | Pass |
| Gita-Yoga mobile natural-height stacking | Browser regression | Yes | Pass |
| Gita-Yoga missing-audio fallback | Node + browser | Yes | Pass |
| Audio cue schema, validation and 4,500-record indexing | Node unit + contract | Yes | Pass |
| Previous/next navigation | Browser regression | Yes | Pass |
| Go-to validation and navigation | Browser regression | Yes | Pass |
| Chapter list and keyboard selection | Browser regression | Yes | Pass |
| Language switching | Browser regression | Yes | Pass |
| Help and About dialogs | Browser regression | Yes | Pass |
| Audio association and controls | Node + browser smoke | Yes | Pass |
| Edit, save and language-file export | Node + browser regression | Yes | Pass |
| Gita-Yoga eight-field editing and language-file routing | Unit + structural browser checks | End-to-end writable-folder save pending | Partial |
| Resume by profile | Browser regression | Yes | Pass |
| Profile create, edit, switch, manage and delete | Browser regression | Yes | Pass |
| Mobile portrait/landscape stacking and sticky controls | Browser regression | Yes | Pass |
| Offline reopen | Browser regression | Yes | Pass |
| Dialog labels, control names and mobile overflow | Browser regression | Yes | Pass |
| Collection-folder fallback | Node + browser regression | Yes | Pass |
| Mobile swipe gesture | Browser regression | Yes; physical-device confirmation pending | Pass |
| Fullscreen and popup Escape priority | Browser regression | Yes; native mobile confirmation pending | Partial |
| Pinch zoom in mobile fullscreen | Manual device check | Confirmed on physical mobile | Pass |
| Installed-PWA upgrade on desktop/mobile | Manual installed-app check | Pending | Pending |
| Clarity delivery in deployed build | Adapter tests + deployed network verification | Collection POSTs confirmed; dashboard indexing pending | Pass |

The installed-PWA upgrade remains the post-deployment verification gate for this cutover.
