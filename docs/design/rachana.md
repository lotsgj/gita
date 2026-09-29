# Rachana — Gitaverse design details

**Status:** Current  
**Last updated:** 29 September 2026

## Purpose

Rachana is the living product and design handbook for Gitaverse. It explains the application as a user experiences it and connects that experience to the data, architecture and operational decisions that make it work.

Rachana has three responsibilities:

1. Describe current, implemented Gitaverse behaviour.
2. Preserve important product and technical decisions.
3. Make the design understandable to both product collaborators and engineers.

Future possibilities belong in [Sampada](sampada.md), not in current-design pages. After an item is implemented, verified and documented in Rachana, it is removed from Sampada.

## Audience

Rachana supports two ways of reading the same authoritative material:

- **Follow the user experience** — understand profiles, navigation, individual experiences, editing, installation and offline behaviour.
- **Understand the system** — understand collections, storage, events, caching, builds and deployment.

These are navigation paths rather than separate descriptions. A behaviour should have one canonical explanation, with other pages linking to it instead of duplicating it.

## Documentation experience

Rachana is available through `docs.html`. It uses a responsive reading layout:

- Desktop displays persistent navigation beside the document.
- Mobile uses a navigation drawer that closes after a page is selected.
- The header provides a direct route back to Gitaverse.
- The header shares the active Gitaverse profile and passes it through the Open Gitaverse route.
- About Gitaverse remains available at the bottom of the navigation.
- The selected page is represented in the URL as `docs.html?page=<route>`.
- Browser Back and Forward move through previously opened documents.
- Missing or unlisted routes show a friendly Document not found state.

Rachana is not linked from the Gitaverse application interface yet. Until that decision is made, it is available through its direct URL.

## Source organization

Markdown is the authoritative source:

```text
docs/
├── navigation.json
├── welcome.md
└── design/
    ├── rachana.md
    └── sampada.md
```

As the handbook grows, current-design pages will be organized into:

```text
docs/design/
├── product/
├── experiences/
├── system/
├── decisions/
└── assets/
```

`docs/navigation.json` is the only navigation manifest. Every readable page has a stable route, title and Markdown path. A document not listed in the manifest cannot be opened through the Rachana viewer.

## Required document metadata

Every navigable design document begins with one top-level title followed by:

```md
**Status:** Current
**Last updated:** 29 September 2026
```

Allowed status values are:

- **Current** — accurately describes the live product.
- **Partial** — describes implemented behaviour while identifying an incomplete area.
- **Superseded** — retained temporarily because another design has replaced it.

The Last updated value records the latest meaningful documentation change. Git history remains the detailed record of who changed what and when.

## HTTP and local-file behaviour

When served over HTTP or HTTPS, the viewer automatically loads `docs/navigation.json` and the selected Markdown document.

When `docs.html` is opened using `file://`, browser security prevents scripts from fetching arbitrary neighboring files. The viewer therefore:

1. Loads as a classic bundled script, avoiding local ES-module restrictions.
2. Asks the user to choose the repository’s `docs` folder.
3. Reads only the files explicitly provided through that browser-approved selection.
4. Keeps those files on the device and does not upload them.

The folder must contain `navigation.json`. An invalid selection produces a clear correction message.

## Markdown rendering and safety

Rachana uses a locally stored version of the Marked parser. It has no content-delivery-network dependency.

Before content is displayed:

- Raw embedded HTML is escaped.
- Rendered elements and attributes are restricted to a small allowlist.
- Unsafe URL protocols such as `javascript:` are removed.
- External links open separately with `noopener noreferrer` protection.
- Internal Markdown links are converted into Rachana routes only when their target is listed in the navigation manifest.
- Local images in `file://` mode are read only from the selected docs folder.

## Build and deployment

The documentation build creates `js/docs.bundle.js` from the local Markdown parser and the maintainable source in `js/docs/viewer.js`.

The deployment includes:

- `docs.html`
- Documentation CSS and JavaScript bundle
- The Markdown navigation and content
- The Markdown parser licence

Documentation files are deliberately excluded from the PWA’s initial precache. The service worker also bypasses Rachana pages, Markdown, styles and scripts instead of handling them through the application cache. Browser navigation therefore loads Rachana through normal browser networking and caching without increasing the installed PWA cache. Rachana remains available through its direct browser URL and local-folder mode; the installed application does not currently provide a route to it.

Rachana reuses Gitaverse’s local profile store, profile UI, About dialog, event bus, and Clarity adapter. Profile surfaces are masked. Documentation events contain the stable Rachana route and grouped profile context, never the profile name, exact birth date, photo, PID, anonymous profile ID, or Markdown content.

## Maintenance rules

When a key product transition occurs:

1. Update the affected Rachana page to describe implemented behaviour.
2. Update its Last updated value.
3. Update navigation if a page was added, moved or removed.
4. Add a short decision record when the reasoning needs to survive future reconsideration.
5. Remove completed items from Sampada after implementation, regression testing and documentation are complete.
6. Run documentation contracts, the production build and the browser regression.

Keep one fact in one canonical location. Use links to connect experience and engineering views instead of copying the same explanation.

## Automated verification

The regular build verifies that:

- The navigation manifest is valid and contains unique, safe routes and paths.
- Every listed Markdown file exists.
- Every page has one title, a valid Status and a valid Last updated date.
- Sampada is reachable under Future possibilities and every item has a Major or Minor tag.
- Required documentation assets are included in deployment but excluded from initial PWA precaching.
- The viewer works over HTTP and `file://`.
- Direct routes, browser history, missing-page handling and mobile navigation work.
- Embedded scripts and unsafe links cannot execute.

## Related implementation

- `docs.html` — documentation shell
- `css/docs.css` — responsive reading interface
- `js/docs/viewer.js` — navigation, loading, routing and safe rendering
- `scripts/build-docs.mjs` — classic viewer bundle
- `scripts/build-deployment.mjs` — deployment and cache boundaries
- `tests/contract/docs.test.mjs` — documentation contracts
- `tests/browser/docs.cjs` — browser regression
