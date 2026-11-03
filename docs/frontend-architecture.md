# Frontend structure

All work for this reorganization is confined to `caliber-mis-new`. The original `caliber-mis` checkout is outside its scope.

```text
src/
  main.jsx             React bootstrap and application-wide wrappers
  app-version.js       Build-generated version metadata
  app/                 Application orchestration and alternate MIS entry
  pages/               Screens grouped by business area
  components/          Reusable UI and feature components
  services/            API, browser IO, polling, uploads, printing and preview fixtures
  hooks/               Shared React hooks and context
  styles/              Existing global and feature CSS
  utils/               Pure models, formatting, validation and calculations
  preview/main.jsx     Opt-in synthetic preview bootstrap
```

Pages and components are grouped by feature (such as logbooks, scanning, reports and accounts). Shared UI lives under `components/ui`; application navigation lives under `components/layout`. The services and utils subfolders follow the same feature boundaries. Import concrete modules directly; there are no barrel exports or new dependencies.

`main.jsx` mounts the error boundary, environment banner, update notice and App. `app/App.jsx` retains the existing state, routing, permissions and coupled legacy screen logic. This refactor relocates existing modules and separates the bootstrap; it does not claim to have decomposed all legacy logic. Future extractions should move coherent behavior together with its dependencies.

CSS remains centralized in `styles/`. Its import order is preserved, including final responsive, night-theme and no-motion overrides. API contracts, URLs and authentication behavior are unchanged. Root server/domain modules remain in place; their imports of relocated shared frontend helpers now point to the new paths. The alternate `app/mis-entry.jsx` remains available but is not the active HTML entry.

## Verification and migration

`frontend-file-map.json` records every old-to-new frontend path. Source-inspection regression fixtures use that map through `test/helpers/frontend-source.mjs` when constructing historical filenames dynamically; runtime imports always use their real current paths. The undefined-name test recursively checks nested frontend modules.

Run `npm run build`, `node --test`, and (with Playwright and esbuild installed) `node scripts/verify-logbook-layout.mjs`. The layout harness uses synthetic records and production components/CSS.

Live screen inspection status remains in `FRONTEND-COVERAGE.md`; a passing build or synthetic preview does not verify restricted screens, real authentication, external services or production data.

## Validation on 3 November 2026

- Production Vite build: passed (existing chunk-size and mixed static/dynamic-import warnings remain).
- Responsive component harness: 42/42 layouts passed, 320–1024px, including scan rows, corrections, recovery, VLB, ELB and saved records.
- Final focused regressions: 68 passed, 1 unrelated deployment check skipped, 0 failed. Includes preview isolation, combobox interaction, scanning review, lazy screens, themes, banners and the recursive undefined-name check.
- Relocated-module audit: no changes beyond relative paths (App additionally has its bootstrap moved to main.jsx).
- Broad regression run: 3,279 tests, 3,247 passed, 19 skipped and 13 failures. Eight source-fixture/path/key expectations were corrected and passed on recheck. Five failures remain outside the refactor: Python3 discovery for Gemini configuration, Windows symlink permission, Windows startup-test temporary-directory locking, and two inherited checks expecting archived Azure workflow files under `.github/workflows/`. No workflows were restored or enabled.

Local logs and responsive screenshots are retained under `.local/frontend-refactor/` (ignored by Git). Real service credentials and restricted live screens were not verified during this structural refactor. No commit, push or deployment was performed for this change.
