# Build, test and deployment

**Status:** Current  
**Last updated:** 29 September 2026

## Source and generated files

Maintainable JavaScript lives under `js/player`, `js/events`, `js/docs`, and shared root modules. `scripts/build-player.mjs` produces `js/player.bundle.js`; `scripts/build-docs.mjs` produces `js/docs.bundle.js`. Generated bundles are deployed with static HTML, CSS, collections, icons, manifest, and service worker.

## Versioning

The application version is `major.minor`. The major value is repository-controlled. GitHub Actions supplies the build identifier in `ddMMMccyy-HHmmss` form and injects deployment configuration such as `CLARITY_PROJECT_ID`. Source pages retain development placeholders; the deployment build writes production values into the output.

## Deployment

GitHub Actions checks out the repository, installs dependencies, runs tests and the deployment build, uploads the generated site artifact, and deploys it to GitHub Pages. GitHub Pages serves the generated artifact rather than the working-tree root. `index.html` routes the bare domain to `player.html`.

The build copies an explicit allowlist and fails if archived `x` content enters output or the asset manifest. Documentation ships for direct browser access but is excluded from PWA precache.

## Regression layers

- Unit tests cover collection normalization, renderer behavior, and event logic.
- Contract tests cover schemas, collection alignment, source isolation, deployment rules, and Rachana integrity.
- Player browser regression exercises the user journey and core interactions.
- Rachana browser regression covers HTTP and `file://`, routing/history, mobile navigation, sanitization, and PWA-cache exclusion.

Run `npm test`, `npm run build`, `npm run test:browser`, and `npm run test:docs-browser` before deployment. The build also performs its own required checks.
