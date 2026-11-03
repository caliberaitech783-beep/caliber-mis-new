# Current repository destination

All further work belongs only to `D:\caliber-mis-new` (`caliberaitech783-beep/caliber-mis-new`). Source and local frontend changes were copied here without copying Git metadata, dependencies, private local configuration, logs or database files. The historical notes below describe the earlier source checkout; they do not authorize further changes there. Run the commands below from `D:\caliber-mis-new`. No commit, push or deployment has been made.

# Frontend alignment and verification

Updated 3 November 2026. Work remains local and uncommitted. No push, deployment, Azure administration or production mutation was performed.

## Baseline and preserved work

The existing checkout is `D:\caliber-mis`; `D:\caliber-mis-new` was an empty repository and was not populated. The existing checkout was fast-forwarded from `39b0dc9` to fetched `origin/main` at `07b8f46` on `codex/frontend-reference-alignment`. This reuses the current application's React/Vite components, styling, Lucide icons and assets. No new Git commit was created.

The pre-existing `src/employee-id-lookup.jsx` edit was backed up before updating. Its editable-during-lookup input, stopped Enter propagation and IME/repeat checks were reapplied alongside the remote's `scanMode` support. Untracked documents, logs and other files were left in place.

The update includes the current logbook dashboard, Capacity master, VLB-to-ELB stages, equipment aliases, revised trip review and batch deletion/recovery. The local changes additionally fix a dev-startup import boundary: the meter-continuity UI now imports labels/defaults from `meter-continuity-rules.mjs`, rather than a server module that loads Node crypto. Existing server exports remain compatible. Background service siblings now have distinct React keys.

## Maintainable structure

Keep established feature components in `src/` rather than moving the whole application during this task. Browser-safe shared report constants live beside the related domain module. All synthetic-preview code is isolated under `src/preview/`: `fixtures.mjs` owns sample data, `api.mjs` owns the explicit mock API, `main.jsx` bootstraps the separate entry, and `preview.css` styles only its notice. `scripts/preview-guard.mjs` prevents preview API navigations reaching a real backend. Tests live in `test/frontend-preview.test.mjs`.

## Run

Use Node 22 and the existing locked npm dependencies:

```powershell
cd D:\caliber-mis
npm ci
npm run local:preview
```

Open `http://127.0.0.1:4176/preview.html`. The synthetic entry requires Vite development mode `preview` and a loopback host. It imports the real `src/main.jsx` after installing its mock adapter. No password is required or collected for sign-in. Service credential forms are disabled in this entry. Synthetic edits persist in this tab's sessionStorage and survive reload; **Reset demo data** restores fixtures. Closing the tab clears its session data. Do not enter real personal data or service credentials.

The normal `index.html -> src/main.jsx` remains the production entry. Standard local backend work uses the documented `npm run local:backend` and `npm run local:ui` on 4175/4174. That backend was not started here because its existing configuration can load Oracle integrations. Follow `CLAUDE-CODE-WORKFLOW.md` and verify a synthetic local database before backend mutations.

## Mock boundary

The preview supports synthetic dashboard filtering/drilldown, employee creation/editing/search, basic master records, capacity forms, batch creation/open/closed lists, report navigation, manual logbook read/save with revision checks, and empty report/session/audit states. Batch lock is a UI simulation, not proof of the production approval/validation rules. Existing React form validation still runs; the mock is not a replacement for backend business validation.

The adapter never delegates unknown requests to real fetch. Unknown reads and writes return HTTP 501 with an explicit LOCAL MOCK explanation. Vite preview mode removes the normal `/api` proxy and denies direct `/api` navigations. CSP restricts connections. OCR, scanner hardware, scan uploads, production authentication, OTP, Telegram delivery, Oracle/Pulse synchronization, real backups and deletion/recovery are **not simulated as successful**. The normal application retains its existing integrations.

## Coverage checklist

“Reused” means latest remote source is present; it does not mean the route was fully visually verified.

| Area / route | Reference inspection | Implementation reused | Verification / limitation |
| --- | --- | --- | --- |
| Shared MIS login at pulse.cmll.in | Sign-in controls and OTP recovery tab observed | Existing shared sign-in | User completed real login; no mock credential flow |
| `/` Dashboard | Desktop observed | `mis-dashboard`, `log-book-dashboard` | Local dashboard rendered; synthetic filtering/API tests; mobile 390 and tablet 820 checks |
| `login-details` | Register and unsaved Add dialog | Existing main master editor | Real saving not tested; basic local fixture only |
| `employee-master` | Register and Identity editor | `employee-master` | Local synthetic employee saved through UI; other profile tabs reused |
| Equipment master (in-app state) | Register and unsaved form | Existing main master editor | Full reference comparison and all actions pending |
| `capacity-master` | Selectors, approval form/history | `capacity-master` | Synthetic endpoint validation tested; Excel import unverified |
| Region master (in-app state) | Region/site tabs and unsaved form | Existing main master editor | Full per-site visual comparison pending |
| Shift Master (in-app state) | Register and unsaved form | Existing main master editor | Keyboard/date edge cases pending |
| Work Contract / Financial Year / Company (in-app state) | ERP read-only forms and sections | `erp-masters` | Synthetic local company/year views; ERP services disconnected |
| `master-sync` | Navigation observed; complete live screen not verified | `pulse-master-sync` | Unknown services explicitly unavailable; credentials disabled in preview |
| `vlb-create-batch` / `vlb-saved` | Open/Closed/Edit and deleted history | Existing VLB batch components | Local report opened; duplicate open-site conflict tested; no production mutations |
| `vehicle-log-book` / `vlb-manual` | Choices and full continuous form | Existing mode choice, entry workspace and form | Five rows and editable trips observed; responsive fixture checks recorded below |
| `trip-scan` | Setup, batch report and status categories | Existing bulk-card scanning | Detailed live review repeatedly stalled browser inspection; not visually certified |
| Saved VLB detail within batch | Trips, machine summary and original scan | Existing batch-card/saved detail components | Synthetic report navigation; original live image controls only partly inspected |
| `equipment-log-book` / `elb-manual` / `job-scan` | Choices and stage gate | Existing ELB components | Full live entry gated until VLB lock; do not invent unseen layouts |
| `elb-saved` | Not fully inspected | Existing saved-logbook component | Explicitly unverified |
| `vlb-reports` / `elb-reports` | Data/Card Report and batch selectors | Existing report components | Empty synthetic scan reports; populated original scans not supplied |
| Other report categories | Visible noninteractive category labels | Existing operations reports | Account-visible destinations not verified; no invented routes |
| `deletion` | Selection/reason/preview shell | Existing deletion components | No delete/OTP/recovery mutation tested; unavailable in mock |
| `scan-backup` | Manual SSD policy/history shell | Existing scan backup | Preview shows disconnected storage; real copying untested |
| `tickets` | Register and unsaved create dialog | Existing ticket components | Synthetic fixture only; audio/camera/attachments unverified |
| `telegram` | Unconfigured setup; batch-alert permission denial | Existing MIS Telegram | Delivery/OTP unverified and unavailable in mock |
| `user-sessions` | Summary/filter/register shell | Existing session UI | Synthetic empty state; assistance/message actions untested |
| `print-helper` | Setup instructions and absent QZ state | Existing helper UI | No certificate installation or printing |
| `full-backup` / `database` | Loaded status and backup register | Existing MIS administration | Synthetic disconnected status; no real backup created |
| `audit-trail` | Filter/register shell | Existing audit UI | Empty fixture; full populated visual comparison pending |

## Validation record

- Production build passed after the baseline update; final repeat is recorded below.
- Initial full `node --test --test-reporter=dot` completed with three failures: Python 3 command discovery in the Gemini configuration mock test; Windows symlink privilege in release packaging; locked temporary directory in startup-gate cleanup. No production services were used by these tests. Database-gated tests without a disposable database remain unverified.
- Focused preview/API/import-boundary and meter-continuity tests: 9 passed, 0 failed at first verification.
- Browser: local dashboard, employee editor and synthetic employee save, batch report navigation, 390px mobile dashboard/drawer, 820px tablet DOM measurements. No document-level horizontal overflow observed in those dashboard measurements. Reference mobile/tablet layouts remain unverified.
- Build warnings before import-boundary fix included Node crypto browser externalization; the final build must confirm that warning is gone. Existing large chunks and mixed static/dynamic imports may still warn.
- This is source reuse plus local verification, **not a pixel-perfect certification**. Every row marked pending above needs further reference comparison before completion can be claimed.

### Final local checks

- Final production build: passed; no Node crypto externalization warnings. Existing chunk-size and mixed-import warnings remain.
- Focused existing frontend/domain tests: 105 passed, 0 failed. After adding the equipment-fixture regression, the standalone preview suite passed 8 tests.
- Existing responsive harness: all 42 layouts passed across 320, 390, 640, 840, 900 and 1024px. Evidence is in `layout-checks/results.json` and its PNGs. This verifies synthetic fixtures against the real form markup/CSS, not all live routes.
- Additional master navigation smoke check reached Login Details, equipment, capacity, region, shift, work-contract, financial-year and company screens. Sync screens showed explicit mock-unavailable errors. These checks do not certify all form actions.
- Verification used the available Node 24.22.1 runtime on Windows; CI specifies Node 22/Linux. Full CI parity is not claimed. Temporary Playwright/esbuild test tools were installed without changing dependency manifests.
- Browser automation became intermittently unresponsive again during the final manual-save pass. Employee-save verification succeeded earlier; manual VLB save remains UI-unverified. API revision/persistence and real equipment matching are covered by tests.
