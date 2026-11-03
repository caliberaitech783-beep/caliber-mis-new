# Development and architecture

The current backend structure is described below. Frontend and local-environment details retained later in this guide may refer to historical paths; use the current source tree.

## Cleanup verification — 3 November 2026

295 root modules were relocated: 121 browser-reachable modules and their dependencies to shared/, and 174 backend modules (including the app) to server/. Root `.mjs` files dropped from 297 to 3. The 25 root/docs Markdown guides were consolidated into 6; the asset font README remains separate. Consolidation reduces clutter and repeated guidance; it does not remove Git history or materially change text storage.

Production build, 42 responsive layouts, backend startup against a fresh disposable PostgreSQL database, release staging with the relocated runtime modules, and 24 focused regression checks passed. The source audit found no module-logic changes beyond relative paths and the backend repository-root anchor.

The broad suite ran 3,305 tests: 3,279 passed, 19 skipped and 7 failed. Two obsolete source-path expectations were corrected and passed on recheck. Five previously documented failures remain: Python3 discovery, Windows symlink permissions, Windows temporary-directory locking, and two inherited checks for Azure workflows already archived in this repository. Database-gated tests were not enabled in the broad run; the separate startup check used only a disposable local database. Local logs and layout screenshots are retained under `.local/backend-cleanup/`.

No commit, push or deployment was performed for this cleanup. The original caliber-mis checkout was not accessed or modified.

## Current backend layout

`server.mjs` remains the stable npm/startup entry and imports `server/app.mjs`. The Express application, middleware, initialization and background scheduling remain together in that file to preserve existing behavior. Existing registration modules live in `server/routes/<feature>/`, IO and external integrations in `server/services/<feature>/`, and backend rules in `server/domain/<feature>/`. This cleanup relocates modules; it does not rewrite the application's routes or persistence.

`shared/<feature>/` contains browser-compatible modules reachable from the frontend and their dependencies. Frontend-only helpers remain in `src/utils/`. Keep Node-only modules and secrets out of shared code. Direct imports use real relative paths, with no compatibility copy per moved file.

Asset URLs for fonts, logos, directory data and OCR scripts are rebased from each module's new location. The backend resolves its repository root independently of the launch directory. The release staging allowlist includes server/ and shared/, and development fallback UI versions hash shared sources as well as src/.

The root keeps only `server.mjs`, `build-site.mjs` and `vite.config.mjs` as JavaScript module entry/config files. Module count remains focused on maintainability rather than arbitrary merging. Source-level test fixtures use `test/helpers/source-file-map.json` for historical dynamically constructed filenames; runtime code imports current paths.

## Documentation

README is the short entry point. This guide contains setup and architecture; operations.md retains feature and support instructions; FRONTEND-COVERAGE.md records inspected and unverified screens. archive.md combines dated project/release notes and is explicitly historical. CLAUDE.md remains at the root so coding tools can discover project instructions. The font README remains beside its assets.

## ERP-LOCAL.md

# CALIBER ERP local application

Start the persistent database and backend with `npm.cmd run local:backend`, then start the UI in a second terminal with `npm.cmd run local:ui`. Open http://127.0.0.1:4174/.

PostgreSQL runs at 127.0.0.1:55432, database caliber_erp. The backend runs at 127.0.0.1:4175. Database files and private generated credentials are stored in %LOCALAPPDATA%/CaliberERP, outside OneDrive and this repository. The launcher uses a clean environment with scheduled jobs disabled and no production integration credentials.

A one-time independent local administrator was created during setup. Its login details are in %LOCALAPPDATA%/CaliberERP/local-login.txt. The provisioning script refuses to replace existing users and is never run at startup. It is not a copied Pulse account.

Pulse migration is pending: no .ndjson.gz backup or configured production database connection was found. Source-defined default records and the new local administrator exist locally. Pulse users, password hashes, privileges and saved settings have NOT been imported. Provide the actual export to restore those into this independent database. Do not copy live sessions or activate production integrations in the local environment.

The login uses the supplied CALIBER ERP logo, Enterprise Resource Planning subtitle and a single MIS sign-in option. It opens the real database-backed application. The older standalone browser prototype remains at /mis.html for reference.

The source copy is based on Pulse commit ec45fdb and has no production Git remote. erp.cmll.in DNS, hosting and HTTPS are not configured.

## One-way Pulse master sync

Admin > Pulse Master Sync connects Equipment master, Region master and Shift Master to https://pulse.cmll.in. Use an authorized Pulse Admin/Super Admin with complete access to the three masters. The local backend fetches every 60 seconds while it is running; visible master pages independently refresh every 60 seconds (so an already-open page may take up to about two minutes to show a source edit). Sync now is available on the connection page.

Source sessions are kept under Local AppData/CaliberERP/pulse-master-session.json; passwords are never saved. A Pulse session can expire or be revoked, requiring reconnect. Only login uses POST to Pulse; master reads use GET. No API call writes master changes back to Pulse. Local write APIs reject changes to these masters while the connector is connected. Existing local IDs are retained using pulse_master_links. Source deletions remove only mapped copies; unrelated local records are preserved. Invalid responses and transaction failures retain the last good data. An empty response with no recognized master groups is rejected rather than treated as an instruction to delete every copy.

This connector currently requires completing the Pulse sign-in on its local setup screen. Initial master copying and a live-source update check cannot be verified until it is connected. Other integrations remain disabled.

## Verified sync and streamlined Masters menu

On 18 October 2026 the failed initial sync was repaired by matching Shift Master on site, shift code and effective-from date. Users & employees was added to the same one-way sync. Verification matched 1,571 equipment records, 18 shift records and 445 employee/user records against Pulse, with no field differences (excluding local credential fields). Nexus also keeps its independent local administrator. A subsequent automatic timer run completed successfully.

Pulse returns no persisted Region master rows through the master API; both app copies display the WCL/NCL code-defined defaults. Persisted Region entries added in Pulse are included by the sync.

Pulse does not expose password hashes through its masters API. Employee data is copied without importing source credentials. Existing local passwords are preserved; new mirrored users receive an unavailable random password hash so phone-number fallback cannot become a login. A local administrator may set their password through the protected password endpoint. The source username/password is still never retained by this connector.

The Nexus Masters menu now contains only Users & employees, Equipment master, Region master and Shift Master.

## MIS log book forms from the supplied workbook

Vehicle Log Book and Equipment Log Book now open database-backed forms based on the two sheets in Vehicle_Log_Book finel_new.xlsx. Fields include location, document type, book date, generated book number, shift hours, site-specific shift, asset, employee/operator and available employee ID. Vehicle books add KMR/HMR, A Form number, optional timed trip rows, overnight time gaps, record/trip counts and the hours summary. Equipment books use HMR readings and remarks. Totals correctly subtract opening readings from their corresponding closing readings; several supplied Excel formulas referenced the wrong cells.

Entries are stored in mis_log_books in the independent local database. Book numbers are generated on save; edit revisions prevent overwriting another edit; request keys prevent duplicate save retries. Saved entries can be searched, opened and edited. Current log book APIs use the existing Admin/Super Admin protection and expose only the employee name/ID fields needed for these forms, never employee phone numbers or password hashes.

Work Order master and Pulse breakdown-hours integration are not yet available. Wo.Cont. is shown as unconnected, and BD/availability/idle hours remain unavailable rather than defaulting to zero. Caliber ID appears only where an employee ID exists in the current employee master.

Verification saved both form types through the browser, edited a vehicle entry, confirmed a 20-minute overnight trip gap, then removed only the two temporary verification entries. The original workbook was read without changes.

## ERP master sync, Financial Year, Company and glass sidebar

- Masters now includes Work Contract master (stored as `Work Order master`), Financial Year master and Company master. These pages are available to existing Admin/Super Admin sessions.
- The Oracle integration performs `SET TRANSACTION READ ONLY` and explicit SELECT queries. It never changes the ERP database. Work Contract fields, job rows, taxes, attachment attributes, materials, equipment and employee categories are mapped from the source tables. The first verified copy contained 53 contracts, 5 years and 46 companies.
- ERP copies refresh every five minutes while `local:backend` is running, including on startup; visible master pages refresh every minute. `Masters → Sync all masters` covers both Pulse and Oracle; individual ERP pages offer Sync ERP.
- Sync is transactional. Existing local IDs are retained. Failed or empty/incomplete snapshots retain the last good copy. Source records that disappear are marked missing, retained for history and omitted from log-book lookups. Local imports are retained across syncs.
- Oracle credentials are encrypted with Windows user protection in `%LOCALAPPDATA%/CaliberERP/oracle-erp-protected.json`, outside the project and OneDrive. Only the signed-in Windows user can decrypt the password. The startup runner passes the decrypted connection to the backend environment; it is never included in browser bundles or API responses.
- Log-book Wo.Cont. dropdowns now load the synced contracts by location; both forms save the selected master ID and number. Pulse BD hours are still pending.
- Existing generic masters retain the original Pulse CSV Import and Print/Export (including Smart Print, PDF and Excel) controls. Source-managed Pulse records remain read-only while connected. ERP master pages provide CSV/JSON import review, export and the same Smart Print interface. Imports add local records and reject duplicates; they never overwrite source-owned ERP records.
- Work Contract attachments show source attribute/file metadata. Local uploads up to 10 MB are stored separately in the local database and can be downloaded; sync does not overwrite local attachments. The inspected source attachment rows had no binary file data.
- Financial Year captures code, begin/end dates and remark. Company includes identity, office/works addresses, city/state names, registration, coordinates, division and responsible-for-TDS fields.
- Sidebar styling now uses translucent Caliber purple/red gradients, background blur, glass borders and highlighted active items. Existing navigation, search, pin and mobile drawer behavior remain.
- Verification: live Oracle reads and repeated copy operations returned 53/5/46; local APIs and log-book options returned the corresponding records. The Jayant 26-27 contract's security/APSD/diesel values and job quantity/rate/amount match the screenshots. Smart Print opens correctly. Build passed; full suite 2,564 passed, zero failed, seven skipped. Subsequent focused sync/log-book tests passed after adding city/state labels.

## Bulk Trip Card / Job Card scanning

Open MIS → Trip Card Bulk Scan or Job Card Bulk Scan, or use Bulk scan cards on the respective log-book form. Supports batches up to 120 cards, multipage PDFs and PNG/JPG/WEBP/BMP images. Document-scanner software must save the PDF/images first; the browser does not control a scanner driver directly. Choose one page per card, or two consecutive pages for front/back. A missing back page is blocked for approval. PDFs are rasterized locally; the per-card PNG used for OCR is retained with the record. Standard PDF fonts and English OCR data are bundled locally. No scanned documents are sent to external OCR or vision services.

Local Tesseract OCR extracts labelled fields and simple trip rows. Exact master matches are proposed; ambiguous/unreadable values remain blank. Recognition of handwriting and unfamiliar card layouts has not been validated on actual user cards and may require substantial manual correction. Every card always requires explicit human checking. The OCR engine score is not an accuracy guarantee.

Review cards alongside their scan, fix fields, add missing trip rows, save/recheck, and approve or reject individually. All required log-book fields, door/category/location/shift/employee/contract selections, readings and duplicate scans/card numbers are checked on the server. A card with no trip rows requires explicit confirmation. Editing a saved draft removes its approval. Unsaved edits block switching cards or batch posting until saved/discarded.

Upload approved opens a review summary. Confirmation writes one log book per approved card inside one transaction, after revalidating current masters and duplicates. Repeated posting is idempotent and returns the same book numbers. Scanned records retain card/batch/reviewer metadata and a View source scan button; metadata survives later log-book edits. Rejected and unapproved cards are excluded. Source scans and review progress survive backend restarts. OCR jobs interrupted by restart are requeued.

Storage: mis_scan_batches, mis_scan_cards and existing mis_log_books in the private local PostgreSQL database. Admin/Super Admin access only. No Oracle/Pulse writes are performed. Logging in uses the existing independent local account in %LOCALAPPDATA%/CaliberERP/local-login.txt.

Verification: 50-card transactional import, duplicate retry prevention, stale master rollback, manual approval gating, both log-book types, source linkage after editing, and local OCR all tested. A synthetic PDF for each type was rendered, read by real local OCR, reviewed and posted through the running API; only those exact synthetic verification records were subsequently removed. Build passed. Full suite: 2,566 passed, 0 failed, 7 skipped. Browser UI inspection was blocked by browser security policy; no visual preview verification was claimed.

## Brother ADS-3100 and Desktop PDF Scan tab (19 Oct 2026)

The bulk scan screen now has Scan, Upload files and Review cards tabs. The Scan tab lists Windows WIA scanners and can acquire all loaded feeder pages through the local backend, 300 DPI single-sided (up to 120 pages). Scans are stored in the private local scanner folder, assembled into a downloadable PDF, copied into a review batch and queued for OCR. No log books are posted by scanning. Hardware enumeration and the Brother driver connection were verified; a physical feeder run was not performed by the agent. Duplex PDFs can still be scanned with Brother software and uploaded with two pages per card.

Read all PDFs from scan folder reads every PDF directly from the configured Desktop / scan folder, without selecting/uploading files individually. Original PDFs remain unchanged. Content hashes and stable page IDs avoid repeated imports. Progress is recorded in local_scan_jobs and local_scan_files. These routes are enabled only by the local runner, protected by existing administrator authentication, and use a fixed input folder/private output root.

Direct links: /?page=trip-scan and /?page=job-scan. A batch, card and review filter may be supplied using their query parameters; only the two scanner page names are accepted for initial navigation.

The three actual Desktop PDFs were imported as 22 review cards into batch dd7d9315-9635-4fae-9367-41998475b373. Manual visual inspection found cards 1–6 blank templates (1–3 upside down), and cards 7–22 handwritten filled Trip Cards. Local OCR did not reliably populate required fields on the handwritten layout. Review notes and blocking missing-field checks are shown. All 22 were left for manual checking: zero approvals and zero Vehicle Log Books created. Inspection results are saved privately at %LOCALAPPDATA%/CaliberERP/scan-inspection/desktop-manual-review.json.

Scanner service recovery: empty proxy responses during local startup previously appeared as Unexpected end of JSON input. Responses now produce a readable reconnect message and automatic status retries every 10 seconds, preserving scanner selection. A successful retry clears the connection error and defaults to Brother ADS-3100 when present. Device-driver errors remain visible separately. The local status API was checked successfully through both ports 4174 and 4175.


## Scanner OCR repair (19 October 2026)
Brother WIA may return BMP bytes despite a requested PNG format and .png filename. Scanner ingestion and OCR now decode the actual bytes and re-encode a white-background PNG; PDF download uses the same normalization. Saved failed cards were normalized and requeued without approval or posting. Existing manually reviewed drafts were retained. Review errors are collapsed so the form remains reachable; card-specific discrepancy notes stay visible. Tesseract is still unreliable for handwriting: no inferred master identity or ambiguous date/reading should be accepted without manual review. Latest three-card batch has provisional visual transcriptions, explicit employee/shift discrepancies, a trip-summary count mismatch, and ambiguous date/KMR fields left blank.


## Vehicle Log Book sheet revision
Vehicle form uses the requested two-column field order and display label Vehicle Log Book (internal VLB code and number series retained). System date defaults in India time. Work Order is auto-selected only for one location/date match; ambiguous matches require selection. Site Master names are included with synced site options. Meter differences, trip count, and overnight trip GAP remain calculated. Pulse BD hours are fetched server-side through the existing authorized connection, clipped to the selected shift, idle-only requests excluded, overlapping intervals merged. Availability = shift − BD; running = HMR difference; idle = shift − running − BD. Unavailable sources stay null; negative idle is shown with a review warning. Manual saves refetch and retain the calculated source snapshot. The source is Pulse’s active maintenance-request feed (archived requests are not included). Vehicle direct link: /?page=vehicle-log-book.


## Employee Master and Login Details
The visible Users & employees menu and page title are now Login Details; the existing authentication master key is retained to preserve accounts, sessions and permissions. Employee Master is separate and admin-protected, imported read-only from Employee Master Report.xlsx: 19,871 unique Employee IDs, displayed as Caliber ID. Three cached ERP employee rows were merged in place, preserving local references; 19,868 rows added. The source workbook is unchanged. Register uses 50-row pagination, search and location filters; profiles retain the report details, edit/new entry, CSV/JSON import, filtered export and Smart Print. Driver ID lookup reads the imported Employee Master first, with the existing read-only Oracle lookup as fallback. Importing employee records never creates login accounts. Spreadsheet intermediates are private under LOCALAPPDATA/CaliberERP, not committed to the repository.


## Per-master synchronization
Sync all masters is a single table of Login Details, Employee Master, Equipment, Region, Shift, Work Contract, Financial Year and Company, each with source, local row count, last successful manual sync, error and Sync button. Pulse handles login/equipment/region/shift; existing Oracle connection handles contracts/years/companies and employee identity/name/location. Individual buttons update only the selected local master. Sync all runs all eight and reports per-master results without hiding failures. Employee sync merges by Caliber ID and preserves spreadsheet-only profile fields and local IDs, retains missing local rows, rejects empty/duplicate source snapshots, and never writes to Oracle. Individual Pulse sync retains local passwords. Source-specific scheduled jobs continue unchanged. Manual sync history lives in mis_master_sync_state. Tested live all eight sources, including Employee Master growth from 19,871 imported rows to 19,883 local rows. Region source currently returns zero. Direct link: /?page=master-sync.


## Trip Card rules — 20 October 2026
New Vehicle Log Books have fixed VLB document type and CAL/VLB/ddmmyy/0001 series, incremented transactionally per book date in a new series counter; equipment series and existing book numbers are retained. Both manual and batch saves use the same insert function. Book dates prefer a readable scan date; missing dates use the India system date and carry a review warning, with manual edits allowed. Work contracts auto-match a unique location/date-valid source record. Driver identity matches the Employee Master Caliber ID or employee code exactly.
Marked I/II/III corresponds to 8 hours (05–13,13–21,21–05); Day/Night corresponds to 12. Marked source shift is retained separately from Shift Master selection; mismatched or ambiguous source/master times require review. Known colour Trip Card images can detect a unique blue tick in the three boxes; grayscale, ambiguous and other templates fall back to manual confirmation. Tesseract handwriting still requires checking.
Extraction reads labelled and tabular KMR/HMR values, Form A and numbered trip rows. Numeric machine labels such as 25 normalize to V25; detail trips produce a machine-wise summary. A read or manually entered printed summary is compared against detail totals, and differences block batch approval/posting. Original scan and OCR text remain retained. The three prepared review drafts were updated with detected marks and visually verified printed summaries, without approving or saving log books.


## VLB shift segment
New Vehicle Log Book numbers now include the selected card/master shift: CAL/VLB/DDMMYY/S1/0001. I→S1, II→S2, III→S3, Day→D, Night→N. Existing master labels A/B/C resolve to the corresponding I/II/III code when a marked card shift is unavailable. Unknown shifts are rejected before saving. Existing book numbers and equipment numbering are retained. The existing date-based transaction counter continues across shifts. Both manual saves and approved batch uploads share this formatter.


## Workbook field mapping revision — 21 October 2026
Vehicle_Log_Book finel_witf details.xlsx was read without modifying it. Its Vehicle and Equipment tabs now define the current rules, superseding earlier formulas: work order defaults to the newest eligible order date for the location; I/II/III map to A/B/C Shift Master identities; missing master/time differences stay visible for review; scan mode is without-time when detail rows have no loading/unloading times. M + No columns combine to labels such as V65 or T88.
Trip GAP is the current loading time minus the previous row’s unloading time (first row null), with midnight rollover. Loading-to-unloading duration is retained separately as durationMinutes. Availability = closing HMR − opening HMR. Idle = shift hours − working HMR; BD is an independent Pulse value and is not subtracted again. These meter calculations remain available if Pulse is unavailable. Normal and batch saves retain these formulas; batch posting fetches Pulse BD when available. Manual/scan views display the updated calculations and machine totals. Existing saved records are not renumbered or rewritten automatically.


---

## docs/frontend-architecture.md

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

CSS remains centralized in `styles/`. Its import order is preserved, including final responsive, night-theme and no-motion overrides. API contracts, URLs and authentication behavior are unchanged. Backend and shared modules now live under server/ and shared/. The alternate `app/mis-entry.jsx` remains available but is not the active HTML entry.

## Verification and migration

`test/helpers/source-file-map.json` records every old-to-new frontend path. Source-inspection regression fixtures use that map through `test/helpers/frontend-source.mjs` when constructing historical filenames dynamically; runtime imports always use their real current paths. The undefined-name test recursively checks nested frontend modules.

Run `npm run build`, `node --test`, and (with Playwright and esbuild installed) `node scripts/verify-logbook-layout.mjs`. The layout harness uses synthetic records and production components/CSS.

Live screen inspection status remains in `FRONTEND-COVERAGE.md`; a passing build or synthetic preview does not verify restricted screens, real authentication, external services or production data.

## Validation on 3 November 2026

- Production Vite build: passed (existing chunk-size and mixed static/dynamic-import warnings remain).
- Responsive component harness: 42/42 layouts passed, 320–1024px, including scan rows, corrections, recovery, VLB, ELB and saved records.
- Final focused regressions: 68 passed, 1 unrelated deployment check skipped, 0 failed. Includes preview isolation, combobox interaction, scanning review, lazy screens, themes, banners and the recursive undefined-name check.
- Relocated-module audit: no changes beyond relative paths (App additionally has its bootstrap moved to main.jsx).
- Broad regression run: 3,279 tests, 3,247 passed, 19 skipped and 13 failures. Eight source-fixture/path/key expectations were corrected and passed on recheck. Five failures remain outside the refactor: Python3 discovery for Gemini configuration, Windows symlink permission, Windows startup-test temporary-directory locking, and two inherited checks expecting archived Azure workflow files under `.github/workflows/`. No workflows were restored or enabled.

Local logs and responsive screenshots are retained under `.local/frontend-refactor/` (ignored by Git). Real service credentials and restricted live screens were not verified during this structural refactor. No commit, push or deployment was performed for this change.
