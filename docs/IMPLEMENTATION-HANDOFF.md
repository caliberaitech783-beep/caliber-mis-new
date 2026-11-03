# Implementation handoff — Caliber MIS / Pulse-II

Prepared 1 November 2026. Read current code and tests before implementation. This is a map and decision record, not a claim that every historical request is verified on the current release.

## Baseline and sources of truth

- Working repository: `D:\caliber-mis`.
- GitHub: https://github.com/caliberaitech783-beep/caliber-mis.
- Local HEAD when prepared: `39b0dc936127a717d9411318ab77699fb4a9f849`.
- Fetched remote/main and observed live SHA: `11dd199cc3dee7c104532ba7e425cc71a0f1208e`.
- The local checkout is behind that remote. A fresh clone includes later changes that local source inspection alone will miss.
- Pre-existing uncommitted edit: `src/employee-id-lookup.jsx`; do not overwrite it.
- README and parts of `PROJECT_WORKFLOW.md` contain older BDMS/deployment/batch arrangements. Current entry points, workflows, tests and newer user instructions take priority.

## Architecture map

| Area | Starting files |
| --- | --- |
| Browser entry and main navigation | index.html, src/main.jsx |
| Express APIs and application startup | server.mjs |
| Database selection and safeguards | mis-database-config.mjs |
| Log books and access | log-book.mjs, log-book-access.mjs, mis-application-access.mjs |
| Shared sign-in | mis-shared-signin.mjs |
| Manual entry and keyboard behavior | src/manual-log-book-details.jsx, src/manual-book-date.jsx, src/log-book-enter-navigation.mjs, src/employee-id-lookup.jsx |
| Scan processing and review UI | bulk-card-scanning.mjs, src/bulk-card-scanning.jsx, src/bulk-card-scanning.css |
| OCR/extraction and card interpretation | scan-extraction.mjs, scan-machine-rules.mjs, scan-trip-completion.mjs, scan-trip-estimates.mjs |
| Equipment identity and validation | equipment-identity.mjs, trip-equipment-validation.mjs |
| Site/shift matching | site-location.mjs, shift-master.mjs, scan-batch-context.mjs |
| Review/mismatch/status presentation | src/scan-batch-mismatch-dialog.jsx, src/scan-field-review.mjs, src/scan-report-card-status.mjs |
| Searchable choices | src/smart-select.jsx |
| VLB batch policy and workspace | vlb-batches.mjs, vlb-batch-policy.mjs, vlb-pm-trial.mjs, src/vlb-create-batch.jsx, src/vlb-entry-workspace.jsx |
| New whole-batch deletion/recovery | vlb-batch-deletions.mjs and related schema/UI/tests in current remote |
| Older record deletion code | log-book-deletion-api.mjs, log-book-deletion-scope.mjs; inspect current routes before using |
| Operational cutoff / backups | operational-start.mjs, scan-backup.mjs |
| Build/release/local dev | build-site.mjs, vite.config.*, .github/workflows/, scripts/local-erp.mjs |

Typical flow: sign-in and permissions -> site/date/shift batch -> manual entry or scan/upload -> header and fleet validation -> card corrections and revision checks -> validated atomic save linked to the batch -> reports and batch lifecycle.

Production PostgreSQL stores both VLB and ELB and shared masters. Never treat the whole database as VLB-only. Inspect current tables, foreign keys, document type predicates, batch links, scan revisions, numbering and audit dependencies before planning a data change. The normal MIS database is `caliber_mis`; the local embedded helper uses the explicitly supported `caliber_erp` exception.

## Recent implementation anchors

Use `git show COMMIT` to inspect the actual code/tests; short hashes identify the inspected history, not an instruction to reset the repository.

| Commit | Relevant behavior |
| --- | --- |
| 39b0dc9 | Equipment selection correction: preserve explicit selected equipment identity instead of letting inferred/scanned values replace it. |
| ed69840 | Match loading machines against equipment master; preserve when extending selection behavior. |
| 12f7f09 | Reuse selected trip equipment across vehicle doors. |
| 667cce9 | Report card error colors and issue visibility. |
| 9e9a86c | One open VLB batch per site. Older per-user batch descriptions are stale. |
| b9fa698 | November operational cutoff and batch-only VLB flow. Inspect exact validation for 1 November 2026. |
| 6188c5e | Whole VLB batch deletion, 10-day recovery and atomic restoration. Supersedes parts of older permanent per-record deletion guidance. |
| 242d142 | Eight scan sites. |
| 821910a | Restore site picker and auto-select an open batch. |
| 11dd199 | Upload-progress presentation; latest observed live release at handoff time. |

Current deletion behavior includes a reviewed exact batch scope, verification/OTP, a 240-hour recovery period, and atomic restore/replacement rules. Read the current implementation before offering deletion instructions. Expiry cleanup of deliberately deleted batches is different from automatically deleting newly uploaded mismatched cards.

## Product decisions from the conversation

These preserve the user's latest intent. Confirm implementation against current source and tests; screenshots from older releases are not proof of current behavior.

| Area | Latest intent / important qualification |
| --- | --- |
| Locations | Only one canonical Dudhichua East OC option; preserve correct existing links. |
| Employee ID navigation | Enter fetches/resolves the employee and moves to Shift hour; Enter navigation must skip Driver name. |
| Empty fields | Enter can advance through empty inputs/dropdowns where appropriate. |
| Shift choices | Enter on Shift hour or Shift opens its dropdown; selection advances to the next field. |
| Save shortcut | Ctrl+S uses the application save path with validation and all entered fields. |
| Manual VLB | Five initial trip rows; manually typed book date. Apply current operational cutoff rules. |
| Reject | Reject only the selected card, including blank/unfilled cards; do not reject the entire upload. |
| Review layout | Continuous form rather than Details/Trips/Summary tabs. Historical 60/40 width was followed by later layout changes; current layout/tests determine proportions. |
| Guidance/layout | Guidance near the card heading, readable spacing, bold readable status tiles, wrapping descriptions and multiple rows where needed. |
| Backup | User requested manual backup and removal of intrusive status/Open Backup banners. Distinguish scan backup scheduling from later deletion retention cleanup. |
| Upload context | Require date, site and shift; validate scanned headers against that context for scanner and PDF uploads. |
| Mixed cards | Show mismatched date/site/shift cards separately with details and manual deletion options. Preserve matching cards. |
| Fleet checks | Unregistered or wrong-site machines cannot save until properly registered/transferred and rechecked. Latest request explicitly reversed automatic deletion: hold for review and allow manual deletion. |
| Printed summary | Earlier freeze request was followed by requests to make Trips editable, including printed summary counts. Do not reintroduce read-only trip counts. Preserve equipment-field rules unless separately requested. |
| Review controls | Review button opens equipment/site review; Mismatch cards button beside it opens mismatches. Include access from compact review view. |
| Majri | Shift I 04:00-12:00; II 12:00-20:00; III 20:00-04:00. Keep Day/Night definitions unchanged. |
| Jayant | Shift I 05:00-13:00; II 13:00-21:00; III 21:00-05:00. Keep Day/Night definitions unchanged. |
| Card status | All / okay / attention / blank / error plus wrong door, wrong Caliber ID, wrong HMR, wrong KMR, MWS/TED mismatch. Issue categories can overlap; do not sum them as mutually exclusive cards. |
| Create Batch | One creation action; do not show a second redundant creation step. Respect current existing-open-batch behavior. |
| Smart search | Searchable dropdowns across relevant selectors, preserving keyboard support and stored IDs. |
| Saved VLB | Batch is the entry point for saved VLB records and open/closed/edit details. Preserve records while removing duplicate navigation paths. |
| Report errors | Identify affected card numbers and issues through consistent colors and readable labels. |
| Equipment choice | Selecting VPC3 or another valid master must remain visibly selected and persist; no stale OCR/inference overwrite. |

Historical Dudhichua East OC master request: A 05:00-13:00, B 13:00-21:00, C 21:00-05:00, Day 08:00-20:00, Night 21:00-05:00. This is a transcription of the supplied schedule, including its eight-hour Night entry; inspect the actual current master before changing it and do not silently invent a different time.

## Outstanding performance investigation

The user reported slowness saving records and/or across pages. No performance fix was implemented during the read-only investigation.

Observed at one point, not a continuing health guarantee:
- Homepage about 184 ms; health about 438 ms; app version about 319 ms.
- Health reported the database connected and pool total 10 / idle 9 / waiting 0.
- Azure showed P2v3 with one instance; last-hour about 17.43k requests, average response 2.09 seconds, one HTTP 5xx, 2.8 GB incoming and 81.9 MB outgoing.
- The browser repeatedly logged permission-denied polling requests for remote assistance and session messages. Code inspection found polling around two and three seconds respectively.

Investigate `src/remote-assistance.jsx`, `src/visible-poll.mjs`, and session-message polling in `src/main.jsx`. Stop or back off polling when the user lacks permission, while preserving legitimate session-expiry handling. Confirm exact responses and current code before editing.

Then measure a real save: client request duration, server validation and external lookups, database transaction/query timings, locks, pool wait time and response payload. The observed idle pool and homepage timing do not prove the root cause of slow saves. Deleting VLB records is not an established performance cure. No CPU bottleneck was established.

## Earlier data deletion request

The user requested instructions/PDF for deleting all saved VLB while retaining ELB and masters, not execution. No deletion was performed for that request. The earlier local PDF under `output/pdf/Caliber-MIS-Remove-Saved-VLB-Guide.pdf` described the older implementation; later batch recovery commit `6188c5e` supersedes parts of it. Regenerate any guide from current source and an explicitly confirmed scope. Never execute wholesale SQL based on a historical chat example.

## Maintain this record

For each durable change, record the user-visible behavior, relevant files, tests, commit and verified deployment status. Keep secrets, employee records, scans, local login files, database dumps and transient log output out of handoff documents and commits. Mark decisions as superseded when the user reverses them.


## Frontend alignment — 3 November 2026

The existing checkout was fast-forwarded to `07b8f46` on `codex/frontend-reference-alignment`; no new commit, push or deployment was made. The pre-existing employee lookup edit is preserved with the remote scan-mode behavior. See `FRONTEND-COVERAGE.md` for the route inventory, unverified screens, synthetic preview boundary and validation results. Run `npm run local:preview` and open `/preview.html` on loopback port 4176 for the isolated synthetic UI; normal production entry and backend integrations remain separate. Browser-safe meter-continuity constants were extracted to fix Vite development startup.
