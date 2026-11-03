# Operational guides

## BACKUP.md

# Caliber Pulse backup and restore guide

Caliber Pulse disaster recovery requires four independent backup layers. A database file alone cannot rebuild the complete service.

| Recovery layer | What must be protected | Current method |
|---|---|---|
| PostgreSQL application data | Requests, users, masters, tickets, audit records, sessions, report rules, and integration settings | Admin > Backup Schedule; Admin > Export Backup; `scripts/backup-database.mjs` |
| Application code and Git history | Source code, every deployed commit, branches, tags, and required untracked working files | GitHub plus `scripts/backup-local.ps1` |
| Azure infrastructure | App Service, PostgreSQL server, Front Door, DNS/hostnames, slots, networking, and environment-setting names | Azure resource inventory maintained by the administrator |
| Credentials and external providers | Database, Oracle, email, Meta WhatsApp, Fast2SMS, GitHub, and Azure credentials; provider account ownership | Company password manager and each provider's recovery controls |

## Admin backup pages

- **Backup** shows recovery coverage and the last 100 backup operations.
- **Export Backup** creates a complete compressed PostgreSQL archive and asks where to save it on the administrator's computer.
- **Import Backup** checks the whole archive before restore. Only a Super Admin can restore, exact confirmation is required, and Caliber Pulse creates a safety backup first.
- **Backup Schedule** controls weekdays, a 12-hour IST schedule, protected storage folder, retention days, and maximum stored files.

Scheduled application backups are stored below `BACKUP_STORAGE_ROOT`. The default is `backups/` on Windows and `/home/data/bdms-backups` in Azure App Service. Set `BACKUP_STORAGE_ROOT` to a mounted persistent volume when a different protected server location is required. Folder names entered in the UI are kept inside this root.

Every database export is streamed row-by-row to compressed NDJSON, checked with SHA-256, and recorded in `backup_runs`. The file is not stored as one large database value, preventing the earlier `Invalid string length` failure.

## Complete local recovery set

Run from the project folder in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup-local.ps1
```

Choose another destination when required:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup-local.ps1 -Destination "D:\Caliber Pulse-Backups"
```

The local set contains:

| File | Purpose |
|---|---|
| `app-repository.bundle` | Complete Git repository, including branches and history |
| `app-source-<commit>.zip` | Source of the currently checked-out commit |
| `app-working-folder.zip` | Working files such as `work/` and `outputs/`; secrets, `.git`, `node_modules`, and `dist` are excluded |
| `bdms-data-<stamp>.ndjson.gz` | Every PostgreSQL public table in the portable Caliber Pulse format |
| `bdms-database-<stamp>.dump` | Optional native archive when `pg_dump` is installed |
| `table-counts.json`, `manifest.json`, `SHA256SUMS.txt` | Row-count and file-integrity evidence |

The database connection is read from `-DatabaseUrl`, the `DATABASE_URL` environment variable, or a git-ignored `.env` file. It is never printed or placed in the backup set.

## Restore

Use **Admin > Import Backup** for a checked application restore, or restore from the command line:

```bash
node scripts/restore-database.mjs --input bdms-data-<stamp>.ndjson.gz --database-url "postgres://..." --yes
```

The command-line restore empties and refills every included table inside one transaction. It refuses incomplete files and rolls back if a row count does not match.

For a native archive:

```bash
pg_restore --no-owner --no-privileges --clean --if-exists --dbname "postgres://..." bdms-database-<stamp>.dump
```

Restore the application repository with:

```bash
git clone app-repository.bundle coalmine-fleet-maintenance
```

Then recreate or repair the Azure resources from the maintained infrastructure inventory, re-enter secret values from the company password manager, point `DATABASE_URL` at the restored database, and deploy the required Git commit.

## Operating controls

1. Confirm a scheduled backup reaches `Completed` every day.
2. Export the latest archive to an encrypted company-controlled drive at least weekly.
3. Run `scripts/backup-local.ps1` after major releases and store one copy away from the application server.
4. Keep at least one off-site encrypted copy and one offline copy.
5. Test a restore into a separate database every quarter and compare its table counts with the manifest.
6. Never email or publicly share an unencrypted database archive. It contains operational data, password hashes, and integration credentials stored by the application.


---

## CARD-MACHINE-RULES.md

# Card machine notation

The written type/number is interpreted using the section of the card. Matching
is case-insensitive and accepts spaces, dots, slashes and hyphens. `No.` and
`Number` labels are optional. The written number is retained; padded and
unpadded forms can match only when they identify one master record.

| Trip Card header | Vehicle |
|---|---|
| V / Volvo | Volvo |
| E / Eicher | Eicher |
| S / Scania | Scania |
| H / Haulpak / Haulpak Dumper | Haulpak Dumper |

| Trip Card body M + No., and Job Card header | Equipment series/type |
|---|---|
| V / VPC / Volvo | VPC |
| T / TPC / Eicher | TPC |
| S / SPC / Scania | SPC |
| L / LPC / Haulpak / Haulpak Dumper | LPC |
| D / Dozer | Dozer |
| G / Grader | Grader |
| PL / Pay Loader / PayLoader | Pay Loader |
| H / Hydra | Hydra |

The PC series names follow the supplied tables; the full brand aliases above
follow the user's corresponding body-letter mappings. In particular, H means
Haulpak in a vehicle header and Hydra in an equipment/body field.

Examples: `V P C / 019`, `vpc No. 019` and `V19` can identify the same equipment;
`PL 05` and `Pay Loader 05` can identify the same pay loader. A value with no
machine number or no M/type prefix is not guessed.

Header linkage uses the correct vehicle/equipment category and selected site.
Loading rows and machine summaries resolve aliases to the same unique Equipment
Master label. Chassis/model data cannot replace an explicit, different door.
Missing and ambiguous matches remain review issues and cannot be automatically
saved or approved through the scan API. Existing legacy identifiers are still
accepted when they match an explicit master record.

The OCR prompt asks for literal single-letter, multi-letter and full-word input.
The application applies the mapping; the original OCR text, original Gemini
response, image and literal header text remain available. Existing saved
logbooks and already stored scan drafts are not migrated. New extractions use
machine notation version 1 plus body-rule version 2. For new scans H means Hydra; existing drafts without body-rule version 2 retain the earlier H-to-LPC interpretation. Explicitly edited loading rows retain their card’s rule version. No masters,
images or saved business records are created or changed by deployment.

## Saved equipment aliases (card label to Pulse record)

A driver may write a machine on the card as a label Pulse does not use, for
example body `L21` for the Pulse record `DEMO21-00179`. The pair of written
label and Pulse record is an alias, stored in `mis_equipment_aliases` against
the Equipment master id (a Pulse-II overlay; Pulse itself is never written).
An active alias rides on the asset as `cardAliases`, so the written label
resolves to that record wherever the matcher runs: scan and PDF review,
auto-save validation, the Pulse fleet hold ("Equipment missing or not at this
site"), manual VLB and ELB entry, batch stages, extraction header linking and
every later batch. The row shows "Written: L21 · Identified: LPC · No. 21 ·
mapped by saved alias". Saved logbooks are never rewritten; reports resolve
text-only rows through the matcher and the alias table at read time.

### The mismatch box and the OTP rule (EQUIPMENT_ALIAS_OTP)

With `EQUIPMENT_ALIAS_OTP=1` every card-versus-Pulse mismatch is resolved
through the mismatch box and an OTP. The box opens by itself when a scan or PDF
extraction finishes, before card 1, and can be reopened from the review bar
("Equipment mapping"). It works category by category (tipper headers, trip body
equipment, ELB job card headers) and pair by pair: left, the Pulse equipment at
this site not found on any card; right, the written machines not found in
Pulse with row and card counts. Suggestions are ranked by the written number
and never applied automatically. Pairing applies the choice to the batch's
unsaved cards at once as a card-only selection, so saving and locking continue;
only permanence waits. Manual entry offers the same pairing from the door field
when a typed machine has no match.

One OTP per pair. The first route is the equipment mapping approver (an
administrator setting, seeded login NITISH) by Telegram only, with no WhatsApp
fallback; "Resend" is always available after a wrong or lapsed code under the
one-request-per-minute rule, and five wrong entries lock a code. The second
route, "Emergency OTP to site PM", is always visible; the reviewer chooses a
reason (on leave, unwell, not answering, other) and the site Project Managers
receive the code by Telegram, then WhatsApp. PM self-approval is allowed.
Either approval makes the pair permanent and cancels the live code on the other
route. Revoking an alias uses the same two routes. Without the flag the pair is
active at once on the reviewer's choice, and an administrator revokes directly.
When the flag is switched on, aliases that were saved without approval return
to pending and the box offers them again.

### Standing rules

The alias follows the asset, not the site: it answers only at the asset's
current Pulse location and needs no new OTP after a transfer. A written label
may never shadow a real door: creating one that already names another asset's
door at the same site is refused, and on every Pulse snapshot an alias whose
key is now a real door of the same asset is retired silently, while one that
another asset at the site now carries as a real door is suspended, reported by
Telegram to the approver and the MIS managers, and shown again in the box for a
new OTP; meanwhile the matcher reports the key as ambiguous. Creating,
approving, suspending, retiring and revoking are written to the alias history
and the audit trail. The Equipment master shows an ALIAS column with route,
approver and date on hover and a revoke action; an administrator list per site
with full history and the approver setting sits below the table. A weekly
Telegram line to the approver and the MIS managers counts approvals by route
and site and PM self-approvals. Held cards are rechecked whenever an alias
changes.


---

## GEMINI-SCANNING.md

# Pulse-II Gemini card scanning

VLB Scan and ELB Scan use `gemini-3.1-flash-lite` with one successful extraction request per captured card. The request contains the original image and three detail views from that same capture. Transient transport/quota failures have bounded retries; there is no provider/model substitution when Gemini is enabled.

The Pulse-II deployment workflow configures `GEMINI_API_KEY` and `MIS_GEMINI_API=true` on **caliber-mis-783** only. The existing encrypted GitHub Actions secret is `MIS_GEMINI_API_KEY`. Key material is never included in a response, homepage, browser storage, repository, or deployment log. Users reuse the server configuration. The local Windows setup can continue using its current-user DPAPI key.

PDF/image uploads go directly to the server extraction queue. USB scanning requires the local Windows WIA connector: it captures images and transfers them to the online queue, without a duplicate local Gemini call. The connector enumerates available scanners without a Brother preference. A compatible installed WIA driver is required; other brands still need physical capture testing.

VLB retains header, HMR/KMR, machine summary and individual trip rows. ELB retains equipment/operator/job-card/HMR fields and does not invent vehicle rows or KMR. Submitting a VLB through ELB produces a specific wrong-page error. Original responses and reported token usage remain separate from manual edits. Cache entries are scoped by image, type, model and prompt revision. The user-confirmed S1NN door separator is rendered S/NN; the original response remains available server-side.

The review view initially shows missing, invalid or flagged fields. Show all values reveals the complete editable form. Hidden values remain in the full draft saved by the existing API. Human confirmation, validation, approval and final upload remain required. VLB/ELB records and counts remain separate. Existing manual forms and formulas are unchanged.

Release checks include focused tests, npm test and npm run build. Real VLB scans were visually compared locally, including 68 trip-time cells across two cards. This is not a human-approved accuracy benchmark, and no real ELB job-card sample was available for an accuracy measurement. Detail views increase input-token usage. Physical scanning requires testing on the actual installed scanner/driver.

Queue behaviour: online Gemini scanning uses two card workers with atomic PostgreSQL claims. Request starts (including retries) share the four-second rate gate; at most eight distinct images are admitted by the reader. A transient failure retries once, with the reason shown on the card. Identical in-flight images share one API request. The original scan and all extraction fields remain unchanged; model response latency can still vary. Per-response elapsed time, total retry time, attempt count and reported token usage are retained in extraction metadata.

HTTP 402 is a non-transient Google AI project billing rejection. Enable billing for the project that owns the configured key, or replace the `MIS_GEMINI_API_KEY` GitHub Actions secret with a key from a billed project and redeploy. The failed card image is retained; use **Retry OCR** after billing/key configuration is healthy. Repeated retries before that change cannot succeed and are intentionally not automatic.


---

## MIS-ADMIN-SUPPORT.md

# Pulse-II MIS administration and support

The MIS sidebar has exactly five Admin entries: User Sessions, Print helper,
Full Backup, Audit Trail and Database. Tickets and Telegram Integration are
separate working menus available to MIS users.

## Permissions

Separate MIS credentials carry a generic `Admin` label, which does not grant
these administrative functions. The trusted identity issuer's **Login Details**
(`Users & employees`) permission identifies an MIS administrator. Both the
browser and backend check this capability. Existing account assignments are not
changed. Existing non-MIS administrator authentication is retained.

User Sessions and Audit Trail provide inspection, history and report exports.
MIS does not expose the existing session force-close, log deletion, automatic
clean-up or database restore controls. Database shows the local MIS database
connection and active log-book/scan counts.

## Backups

Full Backup creates a stored, checksummed database recovery file and provides
authenticated downloads. It does not invoke backup pruning. The recovery file
contains all database tables, including scan references; original Blob images
are separate. The page links to the existing verified scanned-card SSD backup
workflow. Keep the protected integration encryption key separately for recovery
of encrypted integration settings. This feature does not change retention or
start a backup automatically.

## Tickets

Users can create and track their own tickets, including attachments and audio.
MIS enforces assigned sites on submission; users without an assignment can file
a ticket under `Not assigned`. Entry-only accounts cannot resolve tickets or
open another user's ticket/media. Authorized MIS admins can resolve tickets.
Resolution notices and acknowledgement remain in the application. MIS ticket
events do not trigger Pulse's legacy WhatsApp or email fan-out.

## Telegram setup

1. Open `https://pulse-ll.cmll.in/?page=telegram` as an MIS admin.
2. Create a dedicated MIS bot using Telegram BotFather. A bot whose webhook is
   assigned to another application is rejected rather than taking it over.
3. Enter its token in the password field, enable notifications, and save. The
   token is persisted in the existing AES-GCM integration secret store and is
   never returned in status responses, browser storage, or audit payloads.
4. Choose **Connect my Telegram**, open the generated link and press Start in
   Telegram. The link expires after 10 minutes and can be consumed only once
   from an authenticated private Telegram chat.
5. To receive admin ticket alerts privately, copy the chat ID shown on your
   connected account into Admin chat ID and save. Alternatively enter the MIS
   admin group's chat ID after adding the bot there. Send a test message using
   the explicit button.

Ticket-created alerts go to the configured admin chat. Resolution alerts also
go to the creator's linked private chat. Delivery uses a durable outbox, batches
of at most five, authenticated webhooks and retry backoff (five attempts).
The integration stays inactive until an admin supplies and enables a bot.

The webhook is fixed to `https://pulse-ll.cmll.in/api/mis-telegram/webhook` and
uses Telegram's secret-token header. No Pulse-I configuration is changed.


---

## SCAN-HOT-SSD-BACKUP.md

# New scanned cards: Hot Blob storage and SSD copies

Only scans uploaded after activation use the private `scanned-cards` container in
the Central India Standard LRS account `cmllmisscans78320261029`. Every upload
explicitly selects Hot. No lifecycle tier movement or expiry is configured.
Existing cards, database image bytes, folder archives and saved logbooks are not
migrated, overwritten or removed.

The app's system-assigned identity accesses this container. Account-key access
and public Blob access are disabled. Production settings are:

```
MIS_SCAN_BLOB_ENABLED=true
MIS_SCAN_BLOB_ACCOUNT=cmllmisscans78320261029
MIS_SCAN_BLOB_CONTAINER=scanned-cards
```

New uploads are conditional creates, followed by a SHA-256 read-back check.
Only then is the Blob reference inserted into a scan record. PostgreSQL keeps
the image hash, reference, byte count and upload time; new records have a null
database image. Failed uploads create no scan record and can be retried with the
same upload ID. A failed database commit can leave a retained Blob; no automatic
cleanup is permitted. Existing database image reads remain supported.

The backup clock starts with the first new Blob-backed scan. Day 60 makes
days 1–30 eligible; day 90 makes days 31–60 eligible. Ranges are half-open and
measured as fixed 30-day intervals from that first upload. Overdue ranges queue
oldest first. Completing a copy does not change or remove cloud content.

An in-app reminder checks due ranges at sign-in, window focus and hourly while
the app is open. It is not an email, WhatsApp message or background Windows job.
Users must open the app, choose their SSD folder in desktop Chrome or Edge, keep
the drive connected and keep the backup page open. The website cannot verify
that a chosen folder is physically on an SSD, so the user must choose the correct
drive. At 10,000 cards/day, allow roughly 128 GB per 30-day block at the recent
measured average, plus metadata and SSD filesystem overhead.

A backup snapshots the eligible new scan references, review details and saved
logbook values without updating those source records. Files are copied one card
at a time in pages of 100, avoiding loading the complete month's images into RAM.
The browser hashes each downloaded image and rereads each SSD file before
recording verification. Saved values and extraction details are separate JSON
files; a manifest identifies the range and counts. Existing files with matching
hashes are reused. Conflicting files are never overwritten. All files are
rechecked when a pending run is retried, even if an earlier receipt was saved.
Only full-site administrators with backup access can export the complete range.

No restore/import, deletion, cloud expiry or tier changes are part of this feature.
Hot storage continues to grow after each SSD copy. Protect the SSD and its
backup JSON files as operational data.


---

## SCAN-PERFORMANCE.md

# Scan review improvements

The PC connector sends original PNG bytes as transferable ArrayBuffers and
uploads them as `image/png`, avoiding base64's approximately one-third size
overhead. It prepares one following page while awaiting the current upload's
acknowledgement; uploads remain ordered with at most two page buffers in flight.
The authenticated endpoint retains its 12 MB / 20 megapixel limits, stable upload
IDs and duplicate protection, and continues accepting existing JSON/base64 clients.
Images are not resized or recompressed. Transfer time still depends on internet
upload speed and server/database response time; extraction is a separate stage.

Capture timing is measured from the local scanner/import job creation to its completion, before upload and Gemini extraction. The UI retains pages, mode and duration with each draft. Old batches have no recorded capture duration.

Detected error percentage counts completed cards with missing/invalid fields, validation conflicts or extraction failures, once per card. Pending and rejected cards are excluded; routine meter handwriting confirmations are excluded. API/extraction failures are also shown separately. This is a validation indicator, not measured transcription accuracy.

Caliber employee ID lookup appears before the header fields, subject to the existing show-only-corrections setting. Extracted values remain in the complete save payload.

Upside-down support uses the same captured original plus overlapping full-height detail columns in both 0 and 180 degree orientations within one Gemini 3.1 Flash Lite request. Original scans remain unchanged. Detail views use high-quality JPEG to limit transfer size. No physical rescan or alternate provider is used. More views can increase latency and token usage. Human review remains required, especially for faint handwriting.

Real-card check (2026-10-24): the same retained VLB card and a 180-degree copy each returned 16 rows, identical literal trip times, date 2026-10-19, door S/14, employee 18861, and the four previously human-confirmed meter values. Gemini reported 7,199 tokens / 22.1 seconds upright and 6,873 tokens / 14.8 seconds inverted. Raw name punctuation, shift formatting, and blank equipment-cell interpretations varied; reconciliation and human review remain necessary. Shift hours and a separate printed total were missing. This is one-card verification, not an overall accuracy measurement.

## PDF upload and extraction pipeline (30 October 2026)

Browser PDF uploads now reuse the first counted PDF for rendering, retain at
most one pre-counted document, and prepare one next card during the current
ordered upload. Already-rendered single PDF pages keep their original PNG bytes;
paired pages and photo inputs retain the existing composition/resolution rules.
Uploads use the binary image endpoint, with metadata in the request header,
rather than JSON/Base64. Full batch validation no longer runs after each page;
background polls coalesce and a fresh batch read runs when uploading finishes.

Repeated master-record reads share a request-local cache during batch validation.
Card checks, permissions and writes are never cached across requests. PNG
normalization and JPEG detail-view encoding use the native asynchronous encoder;
the original scan and full-resolution detail views are retained.

Gemini and server extraction allow three concurrent cards while retaining the
shared four-second request-start gate (at most 15 starts/minute), bounded queue,
retry checks and duplicate suppression. Local non-Gemini OCR remains single
worker by default. This improves batch throughput without changing model or
creating extra extraction calls. Single-card AI latency and network upload speed
still depend on the provider and connection.

A synthetic local two-card image-preparation check retained byte-identical JPEG
detail images. Preparation took 361 ms before and 216 ms after, and the largest
observed event-loop gap fell from 170 ms to 14 ms. These are local preparation
measurements, not an end-to-end production latency guarantee.

## Grayscale WebP scan storage (2 November 2026)

Every new card image is stored as grayscale WebP. The byte sniffing shared by the
browser, the PC connector and the server (`public/scan-image-type.mjs`) recognises
PNG, JPEG and WebP; the upload endpoint, Blob keys (`.webp`), archive and SSD
backup filenames, deletion manifests and the original-scan download follow the
detected type. Existing PNG and JPEG cards are unchanged and still open.

Browser PDF and image uploads render at most 1700 x 2267 px (about 200 dpi on A4)
and encode a grayscale WebP at quality 0.8, falling back to grayscale JPEG where
the browser has no WebP encoder. A WebP that is already within size is uploaded
byte for byte; JPEG inputs are re-encoded. On the synthetic sample page the
rendered output fell from 873 KB (colour JPEG q0.9) to 217 KB.

The local Windows scanner service encodes each WIA page or rendered PDF page once,
natively, as grayscale WebP with a 2400 px long edge (quality 80, stepping down
to stay under 500 KB) before it is retained and queued. The WIA script requests
grayscale from the driver; drivers that refuse keep colour and the service converts.
The connector sends an already-prepared page without decoding it again and only
compresses legacy PNG pages, using the canvas grayscale filter instead of a
per-pixel loop. Full-resolution scanner originals and the per-job PDF are
unchanged on the PC. The published connector package still carries the older
compression code until a new version is packaged.

Gemini receives the stored image in its own format plus six detail views encoded
as WebP (quality 82) instead of JPEG quality 95, which cuts the request body to
roughly a third. Token usage depends on image dimensions, not bytes, so this
reduces upload time rather than model latency. The synthetic 300 dpi page
measured 7.75 MB as colour PNG and 174 KB as grayscale WebP; real paper has less
noise and compresses further. These are local measurements, not production
accuracy results; human review remains required.


---

## SCAN-REVIEW-GROUPS.md

# Batch card review

For VLB, consecutive populated detail rows with blank equipment cells inherit
the last clear equipment written above. An unreadable equipment cell or a gap
in printed trip numbers stops continuation. A wholly missing machine summary
is calculated from complete detail rows; a missing summary name is resolved
only when the detail rows identify one machine, and missing counts use matching
detail totals. Explicit written counts and unreadable summary fields remain
for human review. Derived assignments/counts carry provenance in the draft;
the original image and literal Gemini extraction remain available. Calculated
summaries follow detail edits, while explicitly edited summaries are retained.
Completion runs on the server's extraction result and on explicit detail-trip
edits. It never runs in an independent effect against a draft being loaded:
such an effect could overwrite a newly extracted draft with stale blank state.
Use Re-read unapproved cards to recover a retained scan whose draft was affected;
the existing re-extraction merge preserves nonempty manual corrections.
No card is approved or posted automatically.

The left status buttons show counts per card against the entire batch. Orange means data complete, brown means specific validation issues, human confirmation, or manual entries remain, and red means failed/rejected/blank cards. Queued and reading cards are pending, not blank. The middle list is filtered by the chosen category; the right panel contains that selected card's values and original scan.

Orange is readiness, not verified transcription accuracy. Every card must still be explicitly approved. Save all appears only when all cards are complete and approved, with no unsaved corrections. The server locks the batch and validates exact membership, approval revisions, master data, duplicate checks and each card before committing the entire save. Partial saves are rejected. Draft autosave and browser recovery are retained. Online drafts use the existing MIS server storage; these are not exclusively local drafts.

After Save all, Pulse-II archives original PNGs and saved-values.json (full saved values, original extraction, human reviewer and log book references) in its persistent App Service /home volume:

/home/data/caliber-mis/scanned-cards/Trip Card/YYYY-MM-DD/location/batch-id

ELB uses Job Card instead. Date is each card's book date; a batch spanning locations/dates is split into folders. Site folder names are sanitized and suffixed with a stable short hash to avoid collisions. No Gemini key is included. This is an Azure App Service file archive, not a separate Blob Storage account.

An archive failure does not undo already committed log books or report them as unsaved. The UI provides Retry folder archive, and retries reuse the same saved records without duplicating log books. Local test mode cannot enable Azure archiving. Human checks are not automatically marked complete.


---

## docs/bd-ageing-report.md

# BD Ageing Report

Open **Reports → BD Ageing Report** (also available from the Reports page).

Only authenticated logins `MOHITCHADDA`, `MANISHCHADDA`, `RAHULCHADDA`, and
`THAKUR@1990` may access this report. Login matching follows the application's
case-insensitive convention. Display names, permissions checkboxes, and admin
roles do not grant access. The API independently checks the allowlist before
loading records and disables response caching.

Age is exact elapsed time from the recorded breakdown start, not creation or
acceptance time, calculated using one server timestamp per refresh:

- 2–4 days: 48 hours inclusive to 96 hours exclusive.
- 4–6 days: 96 hours inclusive to 144 hours inclusive.
- More than 6 days: strictly greater than 144 hours.

Under-two-day requests and invalid/future starts are omitted. The existing open
breakdown definition excludes closed, verified, and idle requests. Archived and
globally retired requests are excluded. Each user's existing Info Pulse site
scope is retained. Rows show oldest first within each group.

This is a read-only report. Refresh reloads current status and ageing. One table
has All ageing, 2–4 days, 4–6 days and More than 6 days tabs. Region and dependent
site filters narrow the existing authorized data; changing region resets site.
Tab counts respect the location filters. The same filtered rows feed the table
and existing export controls. Search and column selection remain available.
It does not change request workflows, scheduled reports or other users' access.


---

## docs/cdir-employee-edit.md

# C-Dir employee editing

Open an employee profile in C-Dir, then choose **Edit employee details**.
Existing Admin/Super Admin accounts and the exact authenticated login
`MAHAKDUDANI` can use this editor. Other directory users remain read-only.
The exception does not grant access to Masters, user permissions, passwords,
creation or deletion.

The editor loads the exact employee master record ID, not a name lookup.
Employee ID remains read-only. Employee details and associated contact details
are saved in one transaction, only on Save changes. Cancel leaves them unchanged.
The directory reloads after saving and an Audit Trail entry records changed fields.
Contact fields are shared across placements with the same employee ID.

Concurrent edits return a conflict instead of overwriting a newer record.
Ambiguous contact matches and unsafe name-only shared identities must be
reconciled in Masters before editing. Existing C-Dir master permissions and
the global read-only directory browsing workflow are unchanged.


---

## docs/equipment-alias-otp-spec.md

# Equipment alias by OTP: final draft for go-live

Date: 2 November 2026. Scope: VLB (trip card) and ELB (job card) in Pulse-II MIS Workspace.
Status: approved rules, ready to build. Build on the test platform first.

## 1. Problem

Drivers write a machine on the card as a letter and a number, for example body `L21`.
The equipment master in Pulse may call the same machine something else, for example
`DEMO21-00179`. The matcher reads `L21` as LPC 21 and finds no such door at the site,
so the row (or the whole card, for a tipper header) goes on hold. Today the reviewer
picks the machine from the dropdown by hand, on every row, on every card, every day.

## 2. Rules (standing, "for life")

1. Every card-versus-Pulse mismatch of every kind is resolved through the mismatch
   box and an OTP. Kinds: tipper from the trip card header, equipment from the trip
   card body, equipment from the ELB job card header.
2. The box opens by itself as soon as a scan or PDF extraction finishes, before card 1.
   For manual VLB or ELB entry it opens when the operator leaves a machine field that
   does not match.
3. The box works category by category, and inside a category pair by pair. It shows one
   pair at a time. When that pair is approved it vanishes and the next appears. Order:
   tipper headers first, then trip body equipment, then ELB headers.
4. Left side: Pulse equipment at this site not found on any card. Right side: card
   machines not found in Pulse. Suggestions are ranked by the written number but are
   never applied automatically.
5. One OTP per pair. The first approver is always Nitish Kumar Tiwari, login `NITISH`,
   C.ID 5431, by Telegram only. No WhatsApp fallback for him.
6. "Resend to NITISH" is always available after a mistyped or lapsed code, with no cap
   beyond one request per minute. Five wrong entries lock a code; resend issues a new one.
7. "Emergency OTP to site PM" is always visible as a backup. The reviewer decides when
   Nitish cannot be reached (on leave, unwell, asleep, not answering) and must choose a
   reason. It goes to the Project Manager(s) of the batch site, Telegram first then
   WhatsApp, as the release 4 PM OTP does. PM self-approval is allowed.
8. Either approval makes the pair permanent. Approval on one route cancels the live
   code on the other, so a pair is never approved twice.
9. The approved alias follows the asset, not the site. Once `L21` is mapped to
   `DEMO21-00179` at one mine, it applies wherever Pulse places that asset later, with
   no new OTP.
10. The alias appears on the equipment master record in Pulse-II as an ALIAS, so it is
    part of the system and not a scan-screen secret.
11. A written key may never shadow a real door. The real-time check in section 7
    enforces this on every Pulse snapshot.
12. Nothing blocks go-live. A pair is applied to the open batch at once as a card-only
    selection, before any OTP. Saving and locking continue. Only permanence waits.
13. Saved logbooks are never rewritten. Aliases apply to unsaved rows and to reports at
    read time.
14. Revoking an alias uses the same two OTP routes and leaves saved rows untouched.
15. Every create, approve, emergency approve, suspend, retire and revoke is written to
    the batch audit trail and to the alias history.

## 3. The box

```
Equipment mismatch · trip cards vs Pulse
DCH (East) · 01-11-2026 · Shift I (A) · Batch VLB-DCHE-0111-A · 38 cards scanned
Category 1 of 3 · Tippers (trip card header) · 1 pair pending

PULSE TIPPERS AT THIS SITE,              | CARD TIPPERS
NOT FOUND ON ANY CARD                    | NOT FOUND IN PULSE
-----------------------------------------+------------------------------------------
DEMO732-00211  Volvo · at site since ... | V 732  read as Volvo No. 732 · 3 cards

Pair: DEMO732-00211 ⇄ V 732 (3 cards)
applied to this batch · OTP sent to NITISH 14:02
[••••••] [Approve]   [Resend to NITISH]   [Emergency OTP to site PM…]

[Skip this pair]                                       [Skip category]
```

Behaviour:

- Clicking one row on the left and one on the right forms the pair and applies it to
  the batch immediately. "Send OTP to NITISH" is then the primary button.
- On approval the pair vanishes with a one-line confirmation and the next pair in the
  same category appears. When the category is empty the next category opens. When all
  categories are empty the box closes and card review starts.
- "Skip this pair" leaves the rows on the existing per-row dropdown. "Skip category"
  does the same for all pairs in it. The box can be reopened from the review bar.
- Inside a card, a mapped row shows the resolved name with the line
  "Written: L21 · Identified: LPC · No. 21 · mapped by alias (approved by NITISH)".
- The left column lists only equipment whose current Pulse location is this site.
  Equipment that Pulse places at another site stays in the existing transfer hold.
- For ELB headers the left column also shows model and last known meter, because the
  header drives hours and meter readings for that machine.

## 4. The OTP message

```
Caliber Pulse: Equipment mapping approval
Mohit asks to map written machine L21 (LPC · No. 21) to DEMO21-00179 at DCH (East).
Seen on 9 rows across 4 cards in VLB-DCHE-0111-A (01-11-2026, Shift I A).
OTP 482913, valid 10 minutes. Share it only if you approve. Reading out this code is
your approval and is recorded in the batch audit.
```

The emergency message adds "NITISH could not be reached: <reason>".

## 5. Data

New table `mis_equipment_aliases`:

| column | meaning |
|---|---|
| id | uuid |
| equipment_id | Pulse equipment id the alias belongs to |
| kind | `vehicle` or `equipment` |
| written_key | normalised key, for example `LPC21`, `V732` |
| written_text | what was on the card, for example `L21` |
| status | `pending`, `active`, `suspended`, `retired`, `revoked` |
| created_from_batch | batch id, book (`vlb` or `elb`) and site at creation |
| requested_by | MIS login |
| otp_id | approval OTP row |
| approval_route | `nitish` or `site_pm` |
| emergency_reason | required when route is `site_pm` |
| nitish_otp_count | OTPs sent to NITISH before approval |
| approved_by, approved_at | who and when |
| suspended_reason | set by the real-time check |
| revoked_by, revoked_at, revoke_otp_id | revoke history |

Unique: one active alias per (kind, written_key) within the asset's current site.
Two assets may carry the same written key only while they are at different sites.

`mis_vlb_approval_otps` gains purpose `map_equipment` and `revoke_alias`, a
`reference_id` for the alias, and a `route` column.

Trip rows gain `equipmentSource: 'alias'` beside the existing `master-selection` and
OCR sources, with `equipmentNotation {original, resolved}` kept as today.

Settings: "Equipment mapping approver", one login, seeded `NITISH`. Changing it is an
administrator settings edit, not a release.

## 6. Matching

`matchCardMachine` keeps its door index and adds an alias index per kind. For a written
key it returns, in order:

1. the real door at the site, if exactly one;
2. the active alias whose asset is currently at the site, if exactly one;
3. `ambiguous` if a real door and an alias, or two aliases, both answer;
4. `not-found` otherwise.

Validators (`scanEquipmentMatchIssues`, `validateTripEquipment`) accept alias matches so
auto-save and lock are not blocked. Re-reading unsaved cards and reopening a batch apply
current aliases to unsaved rows only.

## 7. Real-time checks on every Pulse snapshot

The fleet sync already runs about once a minute. On each snapshot, for every active
alias:

- Redundant: the asset now has a real door equal to the written key. Retire the alias
  with an audit line. No message.
- Shadowing: another asset at the same site now has a real door equal to the written
  key (rename, new arrival, or the aliased asset transferred into a site that already
  has that door). Suspend the alias at once. The matcher reports the key as ambiguous so
  no card resolves silently. Telegram to NITISH and the MIS manager naming both records.
  The box shows the pair again with the note "also matches real door at this site";
  resolving it is a new OTP.
- Transfer with no collision: nothing to do. The alias follows the asset.

## 8. Equipment master in Pulse-II

The equipment master view in Pulse-II shows an ALIAS column listing active aliases for
each record, with route, approver and date on hover, and a revoke action that uses the
same OTP routes. The alias table is Pulse-II data keyed by Pulse equipment id; Pulse
snapshots do not overwrite it.

Pulse itself (pulse.cmll.in, separate repository) has no alias field and Pulse-II must
never write master records there. Phase 2 is a "card label" field in Pulse fed from this
table, after which Pulse becomes the only source. Until then Pulse-II holds the alias.

## 9. Reports

All grouping moves from the written name to the equipment id, with the written text as
a secondary column. Rows that carry only text (manual entries, legacy logbooks) are
resolved through the matcher and alias table at report time; stored rows are not
changed. Rows that still cannot be resolved stay as their own flagged line. Touched:

- the machine-wise summary block on the card,
- the batch report,
- the meter continuity report,
- the ELB hours reports.

Verify each against a month of real data on the test platform before production.

## 10. Admin and oversight

- Alias list per site: active, suspended, retired, revoked, with full history.
- Weekly Telegram line to NITISH and the MIS manager: mappings approved, by route, by
  site, and how many emergency approvals were self-approved.
- Rules section added to `CARD-MACHINE-RULES.md` so the behaviour is documented in the
  repository.

## 11. Prerequisites before go-live

1. NITISH links Telegram from his own Pulse-II login on the test platform bot, then on
   production. No administrator can do this for him. Until linked the box reports it and
   only the emergency route works.
2. Each site has at least one Project Manager assigned, as the release 4 OTP requires.
3. Test platform run: two VLB batches and one ELB batch with planted mismatches of all
   three kinds, one pair approved by NITISH, one by emergency PM, one revoked, one
   transfer to a site with a colliding door.

## 12. Build order

1. Alias table, matcher integration, validators, with tests.
2. OTP purposes, Telegram-only delivery for the approver, PM emergency route, resend.
3. Box on VLB scan and PDF review, sequential by category and pair.
4. ELB header and manual entry.
5. Real-time snapshot checks and Telegram warnings.
6. Equipment master ALIAS column and revoke.
7. Reports regrouped by equipment id.
8. Admin list, weekly summary, rules document.

Feature flag `EQUIPMENT_ALIAS_OTP`, off in production until the test platform run passes.

## 13. Build notes (2 November 2026)

Built on branch `feature/equipment-alias-otp`. Deviations from the data section:
the alias OTPs live in their own table `mis_equipment_alias_otps` (purpose,
route, reference to the alias) instead of `mis_vlb_approval_otps`, because that
table requires a batch id and manual-entry mappings have none. Alias history is
`mis_equipment_alias_history`. The approver setting is `app_settings` key
`equipment_alias_approver`. Phase 2 (Pulse card-label field) is unchanged.


---

## docs/manpower-reports.md

# Manpower, shift performance and OT reports

Open **Reports → Manpower & OT** in Pulse-II. The three views are **Manpower by Category**, **Shift Performance** and **OT & Multiple Duties**. Existing Reports permissions and assigned-site scope apply. The read-only endpoint is `GET /api/reports/manpower`; it uses the same session, administration and current site checks as saved operational reports.

Select up to 31 days, site, shift, saved batch, employee or equipment. Source records are active saved VLB/ELB cards dated from 1 November 2026, joined to synced equipment, employee and effective shift masters. Pending scans are excluded. Empty batches are selectable but contribute no assignments. Open batches are labelled and can change. Deleted books and deleted/archived batch memberships are excluded. Make/model classifications reflect the current synced master; numeric codes without names appear in Data Review.

Manpower counts distinct equipment and employees within each date/site/shift/category/make/model group. An employee changing equipment can occur in more than one category, so category employee counts are not additive. Details retain door, employee ID, mapped Caliber ID, assignment status, saved card, source batch and remarks. Employee names are never identity keys. Unresolved or conflicting IDs remain visible for correction.

Performance groups a resolved employee by site, operational date and shift. Several valid cards or vehicles in one shift remain one duty. Asset and batch filters select a duty; its full contributing cards remain visible. Exact repeated records and possible repeated measurement cards are omitted and listed for review. Conflicting overlaps, invalid meters and excessive aggregate HMR produce unavailable performance totals, never inflated numbers. Trip totals use existing cross-shift trip handovers. No combined hours across shifts appear in the performance view.

The separately approved OT flags are:

| Pattern | Flag |
| --- | --- |
| Shift 1 → Shift 2; Shift 2 → Shift 3 | Red when effective schedules are consecutive |
| Shift 3 → next day’s Shift 1 | Red when the date-aware schedules are consecutive |
| Shift 1 and Shift 3 without Shift 2 | Orange when a scheduled gap exists |
| All three shifts | Red takes priority |
| Missing/ambiguous schedule, conflicting start or other shift pattern | Review |

OT loads one adjoining day on both sides of the chosen range, subject to the operational cutoff and site authorization. Shift, vehicle and batch filters select events without discarding linked duties. Same-day and overnight events can share a duty; event hours must not be summed across rows. Written RED/ORANGE/REVIEW reasons are included in screen, print and exported data. Scheduled times are IST. Actual employee clock-in/out and attendance are unavailable in the current logbook source. HMR hours are machine performance, not attendance or payable OT. Payable OT hours/rates/rounding, required manpower, shortages and relief staffing are outside this release.

The new calculation and API tests cover approved patterns, midnight boundaries, date-effective schedules, duplicate cards, IDs, empty batches, vehicle changes, incomplete data and access scope. `test/manpower-report-postgres.test.mjs` exercises the actual SQL and HTTP handler in an isolated schema when `DELETION_TEST_DATABASE_URL` points to the local test `caliber_mis` database; the existing CI/release workflow provides this database. Run `npm test` and `npm run build` before release.


---

## docs/production-reports.md

# Capacity and processed-batch production reports

Open **Masters → Capacity master** as an authorized administrator with Equipment master access. Select a make and model, enter the approved capacity in CUM/trip, its effective date and an approval reference. No sample workbook capacities are seeded. A pair must exist with a resolved make/model in Equipment master. Missing or numeric make codes need a master correction first.

Approvals are immutable versions. An initial approval may cover the operational start, 1 November 2026. Subsequent versions must be later than today, the previous version and every processed batch date. This prevents a routine edit from changing earlier quantities. Historical approval errors require a separately reviewed data correction; the screen does not overwrite history. There is no automatic body-variant assumption: if a make/model has different approved body capacities, resolve that distinction in the master before using a common capacity.

1. Create the site/date/shift VLB batch and save the actual scanned or manual cards.
2. Check doors, driver IDs, trip counts and linked loading machine numbers. Save each machine's ELB for its shift, including zero work where applicable.
3. Use **Save & lock batch**. A closed active batch is the processed checkpoint. Open, reopened, empty, stale or duplicate batch membership blocks the new reports.
4. Open **Reports → Trips & Productivity → Day-wise Door Number Report** or **Day-wise Machine Number Report**. Select Site, Date and Shift-wise or Day-wise; select a shift for Shift-wise. If both three-shift and Day/Night schedules exist, choose the applicable daily schedule.
5. Select **Show report**. A day report requires a processed, nonempty VLB batch for every active shift in that schedule. Missing capacities, unresolved loading machines, missing ELBs for productive machines, duplicate asset/shift cards and unresolved trip handovers produce correction messages without report rows or exports.

Quantity is approved tipper capacity × completed trips. Machine quantity is the sum of those tipper loads; the excavator's capacity is never multiplied by tipper trips. Door and machine trip/quantity totals must reconcile. Cross-shift trips count once in the completion shift; their loading cards must also belong to a processed batch. Machine hours are ELB closing minus opening HMR, once per machine/shift, independent of trip row count. Source BD/idle inconsistencies remain visible for review. Employee combined-duty hours remain in the existing OT report.

The report includes current site fleet rows. A dash and a coverage message mean a saved card is absent; zero means a card explicitly records zero completed trips. Locking a batch certifies processing of its saved cards, not attendance or fleet completeness. Fleet assignment history is not invented. Prior saved cards without make/model snapshots use the current equipment master mapping; newly saved cards capture that mapping. Review old cards if master identity changed.

Print/Excel/PDF use the shared ReportSection controls only after generation checks pass. Generation timestamp and batch closure revisions identify the snapshot. Reopening blocks subsequent generation. Previously downloaded files remain historical copies and do not update automatically. No cards, capacity approvals, payroll rates or OT amounts are fabricated by deployment.

Implementation: `shared/reports/production-report.mjs` (calculation/gates), `server/routes/reports/production-report-api.mjs` (scoped repeatable-read query and append-only capacity approvals), and the two React views. Only additive capacity schema is introduced. Existing VLB/ELB registers and manpower/OT reports keep their behavior. Automated tests cover mixed capacities, separate shifts, handovers, duplicate/stale/open batches, missing ELB/capacities, schedule ambiguity, authorization, PostgreSQL queries and concurrent capacity approvals.


---

## docs/request-archival.md

# Reversible request archival

Nothing is archived by deployment or startup. An authenticated Admin/Super Admin
must explicitly preview and execute the operation. Managers and operational users
cannot archive or restore.

The currently authorized scope is fixed in `server/services/requests/request-archive.mjs`:

- Every site and request status.
- Actual `created_at` strictly before September 30, 2026, 00:00 Asia/Kolkata
  (`2026-09-29T18:30:00Z`). September 30 is excluded.
- No `verified_at` and neither verification status nor request status is Verified.
  Inconsistent records carrying either verification marker are conservatively kept.

## Operations

Use the application's existing authenticated session and normal CSRF protection.
Never expose session credentials or database credentials in a script or chat.

1. `GET /api/request-archives/preview` returns the exact references, count and token.
2. `POST /api/request-archives` with JSON `{ "token": "<preview token>", "reason": "<reason>" }`.
   A changed preview is rejected, not silently expanded. Record the returned batch ID.
3. `GET /api/request-archives` lists retained batch audit records.
4. To undo, `POST /api/request-archives/<batchId>/restore`. The whole batch is restored
   atomically, or rejected if a conflicting newer active vehicle request exists.

The request rows, files, remarks and all existing histories remain in place.
Only archive metadata changes. Active feeds, dashboards, counts, conflict checks,
reminders and operational detail access exclude archived requests. A database
trigger blocks edits and deletion of archived requests, including stale-tab writes.
Restoration retains the archive audit and returns requests to their unchanged state.
Existing site/role visibility rules still apply after restoration.

No permanent-delete endpoint is introduced. Do not use existing delete/reset actions
to perform an archive. Take and verify a normal database backup before a production
archive. Confirm live feed exclusion and archive count after the operation.


---

## docs/vlb-elb-batch.md

# Two-stage VLB + ELB batch — implementation draft

Status: final draft for the test platform, not yet built. Date: 1 November 2026. Target: test platform first, live Pulse-II only after team sign-off (section 10).

## 1. Goal

One batch per site, date and shift carries both the tipper cards (Vehicle Log Book, VLB) and the loading-machine cards (Equipment Log Book, ELB). The batch closes only when every machine that loaded tippers in that shift has its own ELB card saved in the same batch. The VLB trip rows are the single source of truth for "which machine loaded how many trips"; no separate trip count is asked on the ELB side.

## 2. Decisions taken

| Topic | Decision |
|---|---|
| Trip cross-check between VLB and ELB | Not required. VLB trips per machine are trusted as correct. ELB closure only proves the machine was logged. |
| Equipment master authority | Pulse (pulse.cmll.in) is the only Equipment master. Pulse-II holds no master of its own; it reads Pulse through the existing automatic one-way sync. Transfers and new equipment approved by OTP in Pulse-II must land in Pulse, see section 6. |
| Zero trips, Working | Allowed only with working hours greater than zero. A machine with zero trips and zero hours cannot be Working; it must be saved as maintenance, no operator, breakdown or not in use. |
| Machine identity | `V19`, `VL19`, `VPC 019`, `VPC-019` are the same machine. Reconcile on the resolved Equipment master id, never on the written label. |
| Asset from another site | Hold the card, never reject it, and never ask an OTP for VLB or ELB entry itself. The card waits until the asset is transferred to this site in the Equipment master. From the entry screen the operator can raise an express transfer: one OTP sent to the PM of the site where the asset currently shows in Pulse completes the transfer instantly. Applies to any door: tipper, loader, dozer, grader. |
| Equipment not in the master at all | New purchase. The operator creates it from the entry screen; one OTP to the PM of the entering site approves the creation and the card proceeds. Not a general master shortcut; only from an open batch. |
| One open batch per site | Kept. A site runs up to three shifts a day; the previous shift's batch must be closed before the next one opens. Existing trigger `mis_vlb_one_open_site_guard` is unchanged. |
| Machine-wise report | Build it. After closure, the batch report shows per machine: trips loaded (VLB), hours worked (ELB HMR), trips per hour. |
| ELB stage covers the whole fleet | Every machine booked at the site in Pulse appears, not only the loaders. Trips are filled automatically from VLB. Each machine gets a shift status: working, breakdown, maintenance, no operator, not in use. |
| ELB entry style | One small dialog per machine with Next, Previous, Skip and auto-save. Only hours, status and breakdown details are typed. |
| ELB outside a batch | Not allowed (2 November 2026). ELB Manual and ELB Scan open from the same site batch picker as VLB and show the editor only when the selected batch is at the ELB stage. The server refuses an ELB whose site, date and shift have no batch, or whose batch still has VLB open, with the same 409 as a standalone VLB. Standalone ELB saving is discontinued; with the flag off the old behaviour returns. |
| Go-live | Test platform first with a feature flag; live on Pulse-II only after team sign-off. |
| Reopen and Unlock VLB by OTP (added 2 November 2026) | The site PM may approve a batch reopening, or an Unlock VLB, by reading out an OTP to the MIS user by phone instead of signing in. On-screen approval stays available. A PM who is also the MIS requester may approve their own reopening request on screen; the audit records both roles. |

## 3. Batch lifecycle

Today a batch has one lifecycle field, `closed_at`. Replace it with an explicit stage; `closed_at` stays and is set only on the last transition so existing reports, reopen requests and the PM trial keep working.

| Stage | What is allowed | Transition |
|---|---|---|
| `vlb_open` | Add, correct, delete VLB cards (manual, scan, PDF upload). ELB entry is disabled for this batch. | **Lock VLB** by the batch owner. Blocked while any VLB card is awaiting a transfer or has unresolved machine labels. |
| `elb_open` | VLB cards are frozen. The full site fleet list opens, trips pre-filled from VLB. Work through machines one by one in the stepper dialog, or scan/upload ELB cards. | **Close batch** by the batch owner. Blocked by the checks in section 5. |
| `closed` | Everything frozen. Reports and exports run. `closed_at` set, `closure_revision + 1`. | **Reopen** via the existing reopen request and PM approval, given on screen or by the PM's OTP (section 6, last part). Reopen returns the batch to `elb_open`; a second explicit "Unlock VLB" action, by the PM on screen or by the MIS user with the PM's OTP, returns it to `vlb_open` and clears the machine snapshot. |

Batch creation sets `stage='vlb_open'`. The "one open batch per site" guard treats `vlb_open` and `elb_open` both as open, which it already does because `closed_at IS NULL` in both.

## 4. Schema changes (additive only)

```sql
ALTER TABLE mis_vlb_batches ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'vlb_open'
  CHECK (stage IN ('vlb_open','elb_open','closed'));
ALTER TABLE mis_vlb_batches ADD COLUMN IF NOT EXISTS vlb_locked_at TIMESTAMPTZ;
ALTER TABLE mis_vlb_batches ADD COLUMN IF NOT EXISTS vlb_locked_by TEXT;
UPDATE mis_vlb_batches SET stage='closed' WHERE closed_at IS NOT NULL AND stage='vlb_open';

-- Machines expected at closure, frozen at Lock VLB time.
CREATE TABLE IF NOT EXISTS mis_vlb_batch_machines(
  batch_id UUID NOT NULL REFERENCES mis_vlb_batches(id),
  asset_id BIGINT NOT NULL,                -- Equipment master id
  machine_label TEXT NOT NULL,             -- display label as written, e.g. VPC-019
  trips INTEGER NOT NULL,
  source_cards INTEGER NOT NULL,           -- how many VLB cards named this machine
  PRIMARY KEY (batch_id, asset_id));

-- Every machine booked at the site when VLB locked, with the ELB progress for the shift.
CREATE TABLE IF NOT EXISTS mis_vlb_batch_fleet(
  batch_id UUID NOT NULL REFERENCES mis_vlb_batches(id),
  asset_id BIGINT NOT NULL,
  door TEXT NOT NULL, equipment_name TEXT NOT NULL, equipment_group TEXT,
  trips INTEGER NOT NULL DEFAULT 0,        -- from mis_vlb_batch_machines, 0 when not named
  shift_status TEXT CHECK (shift_status IN ('working','working_partial_breakdown','breakdown','maintenance','no_operator','not_in_use')),
  draft JSONB,                             -- auto-saved dialog fields before validation passes
  logbook_id BIGINT REFERENCES mis_log_books(id),
  saved_at TIMESTAMPTZ, saved_by TEXT, skipped BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (batch_id, asset_id));

-- ELB cards belonging to the batch. Mirrors mis_vlb_batch_entries for vehicle cards.
CREATE TABLE IF NOT EXISTS mis_elb_batch_entries(
  batch_id UUID NOT NULL REFERENCES mis_vlb_batches(id),
  logbook_id BIGINT PRIMARY KEY REFERENCES mis_log_books(id),
  snapshot JSONB NOT NULL);
CREATE INDEX IF NOT EXISTS mis_elb_batch_entries_batch ON mis_elb_batch_entries(batch_id);

-- Express transfer OTPs, one live OTP per Vehicle transfers record.
CREATE TABLE IF NOT EXISTS mis_vehicle_transfer_otps(
  id UUID PRIMARY KEY,
  transfer_id BIGINT NOT NULL,             -- master_records id of the Vehicle transfers record
  batch_id UUID REFERENCES mis_vlb_batches(id),
  asset_id BIGINT NOT NULL,
  requested_by TEXT NOT NULL, requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_to TEXT[] NOT NULL,                 -- source-site PM logins that received the OTP
  otp_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','used','expired','cancelled')),
  used_at TIMESTAMPTZ, approved_by TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS mis_vehicle_transfer_one_live_otp ON mis_vehicle_transfer_otps(transfer_id) WHERE status='sent';

-- New equipment requested from an entry screen, pending the site PM's OTP.
CREATE TABLE IF NOT EXISTS mis_equipment_create_requests(
  id UUID PRIMARY KEY,
  batch_id UUID REFERENCES mis_vlb_batches(id),
  site TEXT NOT NULL, door TEXT NOT NULL,
  draft JSONB NOT NULL,                    -- the Equipment master fields entered
  card_draft JSONB,                        -- the VLB/ELB card waiting on this asset
  requested_by TEXT NOT NULL, requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_to TEXT[] NOT NULL, otp_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','used','expired','cancelled')),
  approved_by TEXT, used_at TIMESTAMPTZ, equipment_id BIGINT);
CREATE UNIQUE INDEX IF NOT EXISTS mis_equipment_create_one_live ON mis_equipment_create_requests(site,door) WHERE status='sent';
-- Site holds are not stored as a status. A card records data.siteHolds at save time and the
-- batch re-evaluates each held asset against the current Equipment master on every read.
```

`mis_vlb_batch_audit` records every transition: `vlb_locked`, `vlb_unlocked`, `elb_card_added`, `site_hold_recorded`, `express_transfer_requested`, `express_transfer_completed`, `site_hold_cleared`, `equipment_create_requested`, `equipment_created_express`, `batch_closed` (keep `saved_and_locked` as the action name for compatibility with existing audit consumers).

## 5. Lock VLB and Close batch checks

### Lock VLB (`vlb_open` → `elb_open`)

1. Batch must have at least one VLB card.
2. No VLB card in the batch may be awaiting a transfer (section 6).
3. Every trip row's `equipmentName` must resolve to exactly one Equipment master id through the existing card machine rules (`CARD-MACHINE-RULES.md`, `resolveTripEquipment`). An unresolved label blocks the lock and names the card and row.
4. Build the machine snapshot: group trip rows by resolved asset id, sum `tripCount`, count source cards. Insert into `mis_vlb_batch_machines`. The snapshot is stored, not recomputed, so a later correction cannot silently change what ELB is checked against; correcting VLB after this point requires Unlock VLB, which deletes and rebuilds the snapshot.
5. Build the fleet list: every equipment-kind Equipment master record at this site, into `mis_vlb_batch_fleet`, with trips copied from the snapshot.
6. Set `stage='elb_open'`, `vlb_locked_at`, `vlb_locked_by`. Audit `vlb_locked` with the snapshot and fleet count.

### ELB stage: the whole site fleet, one machine at a time

When VLB locks, the ELB stage does not start from a blank form. It starts from the full list of equipment booked at this site in Pulse, not only the machines that loaded tippers. Dozers, graders, drills, water tankers and machines standing in maintenance all appear, because the shift record must say what every machine did, including nothing.

**Building the list**

- Source: every record in the Pulse-synced Equipment master whose current site is the batch site and whose kind is equipment (`assetBookKind`), at the moment VLB is locked. Pulse is the only authority for which machine is booked where; Pulse-II keeps no fleet of its own. The list is stored with the batch as `mis_vlb_batch_fleet` so a later master change does not alter what the shift was asked to account for.
- Each row carries trips loaded, filled automatically from the machine snapshot. Machines not named on any tipper card show zero trips.
- A machine named on tipper cards but not booked at this site is already handled by the awaiting-transfer rule; it appears in the list with a transfer badge once the transfer completes.
- The list is ordered: machines with trips first, by trips descending, then the rest by door number. A header shows progress: `7 of 23 machines saved`.

**One dialog per machine**

The operator works through the list in a stepper dialog rather than opening a separate ELB form for each machine:

- The dialog shows the machine, its trips loaded (read-only, from VLB), the tipper cards that named it, and the previous shift's closing HMR as the proposed opening HMR.
- The operator enters: shift status, operator or driver (from the employee master, optional when the status is no operator), opening HMR, closing HMR, breakdown hours with reason, idle hours, job card number, remark. Working HMR, availability and idle are calculated the same way the ELB form does today.
- **Shift status** is a required choice and drives the rules:

  | Status | Meaning | Required | Allowed trips |
  |---|---|---|---|
  | Working | Machine ran this shift | operator, opening and closing HMR, working HMR greater than zero | any |
  | Breakdown | Under breakdown for the whole shift | breakdown hours = shift hours, reason | must be 0 |
  | Maintenance | Planned maintenance or service | reason or job card number | must be 0 |
  | No operator | Fit but nobody to run it | none | must be 0 |
  | Not in use | Parked, no requirement | none | must be 0 |
  | Working, partial breakdown | Ran part of the shift | operator, HMR, breakdown hours less than shift hours, reason | any |

  A machine with trips loaded cannot be saved as anything but Working or Working, partial breakdown. The dialog says why: `VPC-019 loaded 42 trips on 5 tipper cards this shift.` A machine with zero trips may be Working, which is normal for a dozer or grader, but only when closing HMR minus opening HMR is greater than zero. Zero trips and zero hours is not a working machine: the dialog refuses Working and asks the operator to choose maintenance, no operator, breakdown or not in use, with the reason that status needs. The batch report then counts that machine under the chosen category.
- Breakdown hours already recorded in Pulse for that machine and shift are shown next to the field, as the ELB form shows them today, so the operator can accept or override them. Overrides are kept with a reason.
- **Next** saves the current machine and opens the next unsaved one. **Previous** goes back to the last saved machine for correction. **Skip** leaves a machine unsaved and moves on; skipped machines are listed in the header and must be completed before closure.
- **Auto-save**: every field change is written to a draft row for that machine after a short pause, so a dropped connection or a closed laptop at 2 am loses nothing. Returning to the batch reopens the dialog at the first machine that is not fully saved. A draft that fails validation stays a draft and is shown in amber in the list.
- Saving a machine in the dialog creates or updates its ELB record in `mis_log_books` with `book_type='equipment'`, exactly as a manual ELB does today, and links it in `mis_elb_batch_entries`. Scan and upload of ELB cards still work; a scanned card for a machine fills that machine's row and marks it saved.

**Closure rule, restated**

Close batch requires an ELB row with a shift status for every machine in the batch fleet list, not only for the loaders. A machine left blank blocks closure by name. The old rule "every loading machine has an ELB" is now a special case of this one, and it is where the trip consistency check lives: a loading machine saved as anything other than Working is refused at save time, so it cannot reach closure.

**Scope of the fleet list**

- Tippers do not appear here. They are the VLB side.
- Machines transferred into the site during the shift join the list when the transfer completes. Machines transferred out before VLB lock are not in the list.
- A machine that genuinely should not be on the list, because it left the site weeks ago and the master is wrong, is saved as Not in use with the remark, and the mismatch is flagged in the batch report for a master correction.

### Close batch (`elb_open` → `closed`)

1. Every row in `mis_vlb_batch_fleet` has a saved ELB with a shift status. Missing machines block closure; loaders are listed first with their trip count, e.g. `VPC-019 loaded 42 trips, no ELB saved`, then the rest by door number. Every row in `mis_vlb_batch_machines` is in the fleet list or has completed a transfer, so the loader rule is covered by this one.
2. No ELB card in the batch is awaiting a transfer.
3. Duplicate ELB for the same asset in the same batch blocks closure (same rule the production report already applies).
4. Set `stage='closed'`, `closed_at=NOW()`, `closure_revision+1`. Audit.

The production reports (`shared/reports/production-report.mjs`) already refuse to run when a productive machine has no ELB. After this change that condition cannot occur for a closed batch, so the report gate becomes a safety net rather than the place the operator first learns about it.

## 6. Asset from another site, or from no site

### Principle

Pulse is the only Equipment master. Pulse-II reads it through the automatic one-way sync and never keeps a competing fleet list. Any change to where an asset is booked, or to which assets exist, has to end up in Pulse, otherwise the next sync would show the old picture again. The OTP flows below therefore do two things: they record the approval in Pulse-II, and they carry the change to Pulse.

VLB and ELB entry never need an OTP. The only thing that needs approval is moving an asset from one site to another in the master, and that approval belongs to the PM of the site where the asset currently shows in Pulse. So the batch does not "release" anything. A card whose asset belongs elsewhere simply waits until the asset is transferred to this site. The OTP is a fast way to complete that transfer from the entry screen, and it works the same for any door: tipper, loader, dozer, grader, hydra.

### Detection during entry

Today `resolveLogBookData` rejects a card whose asset's `currentLocation` differs from the card location (`The selected asset is assigned to a different location.`), and the scan path blocks with `Equipment not assigned to this site`. Both change from reject to hold. The check covers:

- the tipper door on a VLB card,
- every loading machine named in VLB trip rows,
- the machine door on an ELB card.

### Hold behaviour

- The card is saved and linked to the batch with `data.siteHolds = [{assetId, assetSite}]` recorded at save time.
- The hold is not a stored status that someone clears. On every batch read, Lock VLB and Close batch, the server re-checks each held asset against the current Equipment master. The moment the master says the asset is at this site, the hold is gone and the card is a normal card. That is why one transfer clears every card naming that asset, in this batch and in any later batch.
- A held card is excluded from the machine snapshot, Lock VLB, Close batch and reports while the hold stands.
- Lock VLB and Close batch are blocked while any held card exists. The message is per asset, with cards and trips attached: `Awaiting transfer: VPC-019 from NIGAHI (2 cards, 17 trips), V-104 from NIGAHI (1 card)`.
- The batch page shows an **Awaiting transfer** panel, one row per asset, with the asset's current site, the cards attached, the state of any transfer already in progress, and the **Express transfer (OTP)** button.

### Express transfer by OTP

The existing Vehicle transfers workflow (`shared/people/vehicle-transfer-workflow.mjs`, routes in `server.mjs`) runs in three steps: source PM approval, destination MIS verification, destination PM acceptance. Today completion updates `currentLocation` only in the Pulse-II synced copy, which the sync then preserves. With Pulse as the sole master, completion must instead write the new site to Pulse and let the sync bring it back, for the normal workflow as well as the express one. The express path is the same workflow with the three steps collapsed into one OTP:

1. The operator at the entering site presses **Express transfer (OTP)** on the asset row. If a transfer for this asset is already pending in the normal workflow, the panel shows its stage and offers to send the OTP for that record instead of creating a second one, since the workflow allows only one pending transfer per asset.
2. The server creates a Vehicle transfers record: source = asset's current master site, destination = batch site, transfer date = batch date, equipment fields copied from the master, remarks `Express transfer requested from VLB/ELB batch <name>`, status `Awaiting source approval`. The requesting user must be an MIS user or manager with the destination site in scope, which is the same rule as a normal submission.
3. The server finds the PM(s) of the **source** site through the existing `vehicleTransferPmLogins` lookup, generates a six-digit OTP, stores its hash with a ten-minute expiry against the transfer record, and sends one message per source PM, Telegram when linked, otherwise WhatsApp:

   ```
   Caliber Pulse: vehicle transfer approval
   VPC-019 is being logged at JAYANT OC but is assigned to NIGAHI.
   Transfer VT-...: NIGAHI -> JAYANT OC, date 01-11-2026
   Requested by <operator>, batch CMLL/JAYANT OC/1ST-NOV-26/S1/B02
   OTP 482913, valid 10 minutes. Share it only if you release VPC-019 to JAYANT OC.
   ```

   If no source PM has a linked Telegram chat or registered mobile, the request is refused with "Source site PM has no Telegram or mobile registered" and the transfer stays in the normal workflow for approval on screen.
4. The source PM shares the OTP with the operator by voice or message. The operator enters it on the asset row. Five wrong attempts or ten minutes kill the code; the transfer record remains and a new OTP can be requested after one minute.
5. On a correct OTP the server completes the transfer in one transaction: source approval recorded as the PM who received the OTP, destination MIS verification recorded as the requesting MIS user, destination acceptance recorded as `Express OTP transfer` with the requesting user's login, status `Completed`. The site change is then written to Pulse through an authorised transfer endpoint on Pulse, and the synced copy in Pulse-II updates on the next sync cycle, within a minute. Until Pulse confirms, the transfer shows `Sent to Pulse` and the held cards stay held; the batch page retries and shows an error if Pulse rejects it. Audit entries are the same as the three normal steps, each tagged `expressOtp: true`.
6. The destination site PM receives an informational Telegram that the asset has joined their site by express transfer. They are not asked to approve; if the asset should not be there, they raise a transfer back.
7. The batch re-reads the master, the hold disappears, and every card naming that asset, including its ELB when it arrives, is a normal card. No further action on the batch.

### Alignment with the Vehicle transfers OTP note

`docs/vehicle-transfer-otp-approval.pdf` and `docs/vehicle-transfer-otp-flowchart.pdf` propose OTP approval inside Masters > Vehicle transfers for the two PM stages, Release and Accept, keeping the four-stage chain. This draft reuses that design rather than inventing a second one:

- The express transfer raised from a batch is a normal transfer record. Its OTP is the **Release OTP** of that note, sent to every PM of the source site; the first valid code wins.
- Same controls everywhere: six random digits, hash only, single use, ten-minute expiry, five wrong attempts, one request per minute, requester and approver both recorded. The request button is available only to an MIS user or manager of the site concerned.
- Delivery channel: the note uses WhatsApp, the batch discussion asked for Telegram. The OTP sender tries the PM's linked Telegram first and falls back to WhatsApp when a mobile number is registered. If neither exists the button is hidden and the PM approves by logging in.
- Difference, by decision in the batch discussion: the express path completes the transfer on the Release OTP alone. Destination MIS verification is the requesting user, and destination PM acceptance is recorded as implied because the destination is the site asking. The note's separate Accept OTP remains available as a per-site setting for sites that want their PM to approve inbound express transfers too.
- The OTP fields, routes and audit lines are shared code in the transfer module, so building the note's proposal and this express path is one piece of work, not two.

### Why one OTP is enough

The source PM is the person giving the asset away, so that is the approval that matters. The requesting user is already the destination MIS, which covers verification. Destination PM acceptance exists in the normal workflow to stop assets being pushed onto a site unwanted; in the express case the destination is the site asking for it, so acceptance is implied and recorded, not skipped. If a site wants its PM to approve inbound express transfers too, that is a per-site switch that sends a second OTP to the destination PM before completion. It is listed as an option, not built in this draft.

### Normal transfer still works

Nothing in the batch depends on the express path. A transfer raised and approved the usual way clears the hold the same way, because the hold is re-evaluated against the master. An MIS administrator who cannot reach the source PM uses the normal workflow's approval screens as today.

### Dependency on Pulse: two write endpoints

Today the Pulse connector only reads masters; `ERP-LOCAL.md` records that no API call writes master changes back to Pulse. Both OTP flows need Pulse to accept two authorised writes: complete a vehicle transfer, and create an equipment record. These are small additions on the Pulse side, protected by the same service credential the sync uses plus the OTP approval record as evidence. They must be built and tested on the Pulse test instance before the Pulse-II test platform can exercise the OTP flows end to end. Until they exist, the test platform runs the OTP flows against a stub that updates the synced copy only, clearly labelled, so the batch flow itself can still be trialled.

### New equipment that exists at no site

A newly bought tipper or machine may reach the site before anyone has created it in the Equipment master. Its door number resolves to nothing, so the card can neither be saved against an asset nor held against another site. The entry screen handles this in place:

1. When a door or machine label on a manual, scanned or uploaded card matches no Equipment master record, the field shows **Not in Equipment master** with a **Create new equipment** button. The card itself is kept as a draft and is not saved until the asset exists.
2. **Create new equipment** opens a short form, prefilled from the card where possible: door number, category (tipper, excavator, dozer, grader, hydra, pay loader, as in `CARD-MACHINE-RULES.md`), make, model, registration number, chassis number, site = the batch site, and the first HMR/KMR reading from the card. Chassis or registration is mandatory, because that is the key the Pulse master sync later uses to link the record. Door number alone is not enough.
3. The server checks the Equipment master for the same chassis, registration or door at any site. A match anywhere means this is a transfer case, not a new asset, and the screen switches to the express transfer flow of the previous section. Only a genuinely unknown asset continues.
4. The server stores the draft equipment record in a pending table, generates a six-digit OTP with a ten-minute expiry, and sends it by Telegram to the PM of the **entering** site, since no other site owns the asset:

   ```
   Caliber Pulse: new equipment approval
   <operator> wants to add V-212 (Volvo FMX 460, chassis MC2..., reg MH40 ...) to JAYANT OC.
   Reason: card in batch CMLL/JAYANT OC/1ST-NOV-26/S1/B02.
   OTP 517204, valid 10 minutes. Share it only if this is a genuine new asset at your site.
   ```

5. The operator enters the OTP. On success the equipment record is created in Pulse through an authorised equipment-creation endpoint, with `currentLocation` = batch site and `createdVia: express-otp`, the approving PM and operator recorded. The next sync brings it into Pulse-II, the pending draft card is saved against the new asset id and linked to the batch, and an audit entry `equipment_created_express` is written. The card is now a normal card with no hold.
6. If the PM has no linked Telegram, the request is refused with "Site PM has not linked Telegram" and the asset must be created by an administrator through Masters as today.

Guard rails:

- The record is created in Pulse, never only in Pulse-II. If the Pulse endpoint is unavailable the request is refused with a clear message and the asset must be created in Pulse by its administrator as today; the draft card is kept for retry.
- Capacity for production reports comes from the make/model pair in the Capacity master. A new make/model still needs its capacity approved there; the batch can close without it, the production report will ask for it.
- One pending new-equipment request per door per site at a time. Same OTP controls as transfers: ten minutes, five attempts, one request per minute. The draft form is kept so the operator does not retype.
- Express creation is allowed only from a VLB or ELB entry screen with an open batch. It is not a general master-entry shortcut.

### PM approval by OTP for reopen and Unlock VLB (added 2 November 2026)

Both batch controls that need the site PM can now be approved by phone, with the same OTP engine and the same controls as the express transfer: six digits, hash only, ten minutes, five wrong attempts, one request per minute, single use. On-screen approval is unchanged and remains available; the OTP is a faster alternative, not a replacement.

**Reopen a closed batch.** In the reopen dialog the MIS user types the reason and presses *Request reopen OTP*. The server creates (or reuses) the same reopening request the screen uses, then sends the code to every current Project Manager of the batch site on Telegram, or WhatsApp when Telegram is not linked. The message names the batch, the site, date and shift, the requester and the reason, and says that reading out the code is the approval. The MIS user phones the PM, enters the code, and the request is marked approved (`decided_by` = the first PM the code went to, `decision_note` = "Approved by OTP sent to pm1, pm2"). The server then reopens the batch at once for that MIS user, exactly as the Reopen button would. If the reopen itself is blocked, for example another batch is open at the site, the approval is kept and the Reopen button works once the blocker is cleared. The OTP button is hidden while the owner-authorized PM trial is active, because no approval is needed then.

**Unlock VLB.** At the machine stage the batch owner or any MIS user sees *Unlock VLB (PM OTP)* next to the PM-only *Unlock VLB*. They type the reason, request the code, phone the PM and enter it. VLB unlocks with the usual effect (machine snapshot cleared, stage back to `vlb_open`); the audit entry `vlb_unlocked` carries `via: otp`, the PM logins the code went to, and the reason.

**Self-approval.** A user who is both the site PM and the MIS requester may approve their own reopening request on screen. The earlier block was removed on the owner's instruction; the audit still shows the same login as requester and approver.

**Storage and routes.** Table `mis_vlb_approval_otps` (purpose `reopen` or `unlock_vlb`, reopen request id, reason, requester, PM logins, hash, expiry, attempts, status). Routes: `POST /api/vlb-batches/:id/approval-otp {purpose, reason}`, `POST /api/vlb-batches/:id/approval-otp/:otpId/verify {otp}`, `GET /api/vlb-batches/:id/approval-otp`. The batch detail returns `approvalOtps` (the requester's live codes, so a reload resumes the entry) and `canRequestUnlockOtp`. Only the user who requested a code can enter it, and only against the batch it was issued for.

## 7. Machine-wise batch report

Available on a closed batch from the existing **View report** button, as a second section after the card list, and as part of the batch PDF/Excel.

| Column | Source |
|---|---|
| Machine | `mis_vlb_batch_machines.machine_label` and asset door |
| Trips loaded | `mis_vlb_batch_machines.trips` |
| Tipper cards | `source_cards` |
| Opening HMR / Closing HMR / Hours worked | the machine's ELB card in `mis_elb_batch_entries` |
| Trips per hour | trips ÷ hours worked, blank when hours is zero |
| Breakdown / idle hours | ELB card fields already captured |
| Transferred this shift | yes when the machine, or any tipper card that fed it, was held and cleared by a transfer completed on the batch date; the tooltip names the transfer number and approving PM |

A footer row totals trips and hours. Machines with zero trips appear below the line grouped by shift status: working, breakdown, maintenance, no operator, not in use. A second footer gives the fleet summary for the shift: total machines, working, down, idle. Day-wise totals across the three shifts already belong to the Day-wise Machine Number Report; this section is the shift-level view.

## 8. UI changes on Create Batch

- The batch card shows a two-step indicator: **1 VLB** and **2 ELB**, with the current stage highlighted and counts (cards saved, machines expected, machines with ELB).
- Stage `vlb_open`: buttons Manual, Scan, Upload (VLB) and **Lock VLB**. ELB buttons are visible but disabled with the hint "Lock VLB first".
- ELB menu: **ELB Manual** and **ELB Scan** show the site batch picker first. Until the selected batch is at the ELB stage the editor stays closed with the message "Lock VLB in batch … before entering ELB cards".
- Stage `elb_open`: VLB buttons become view-only. The fleet list is shown with trips and progress, **Start / Continue machines** opens the stepper dialog at the first unsaved machine, Scan and Upload remain for ELB cards, and **Close batch** replaces today's **Save & lock batch**.
- The stepper dialog: machine header with trips and source cards, shift status buttons, HMR and hours fields, Pulse breakdown hours shown beside the field, Previous / Skip / Next, and an auto-save indicator.
- Door and machine fields that match no master record show **Create new equipment**, which runs the new-equipment OTP flow in place.
- An **Awaiting transfer** panel lists held assets with current site, cards and trips attached, any pending transfer, and the **Express transfer (OTP)** / **Enter OTP** controls. Held cards show an Awaiting transfer badge naming the asset.
- Batch list status column shows `VLB open`, `ELB open`, `Closed` instead of `OPEN`/`CLOSED`.

## 9. Server work, in order

1. `server/domain/logbooks/vlb-batch-policy.mjs`: schema additions, `stage` helpers, snapshot builder, closure checks, hold helpers. Pure functions with unit tests for: label resolution (V19 = VPC 019), missing machine, other equipment ignored, held card blocking, duplicate ELB.
2. `vlb-batch-fleet.mjs`: fleet list builder at lock, `GET /api/vlb-batches/:id/fleet`, `PUT /api/vlb-batches/:id/fleet/:assetId/draft` (auto-save), `POST /api/vlb-batches/:id/fleet/:assetId` (validate, write ELB log book, link), shift-status rules with tests for the trips-versus-status refusal.
3. `server/routes/logbooks/vlb-batches.mjs`: new routes `POST /api/vlb-batches/:id/lock-vlb`, `POST /api/vlb-batches/:id/unlock-vlb` (PM), rename close semantics to run section 5 checks, `GET /api/vlb-batches/:id/machines`.
4. `server/routes/logbooks/log-book.mjs`: equipment books link into the batch when an `elb_open` batch matches; site mismatch produces a hold instead of a 400 for both kinds. Scan path: `scanFleetBlockingMessage` becomes a hold warning rather than a save block.
5. New `server/routes/people/vehicle-transfer-express.mjs`: OTP table, `POST /api/vehicle-transfers/express` (create or reuse pending transfer, send OTP to source PMs), `POST /api/vehicle-transfers/:id/express-otp` (verify and complete all three steps in one transaction), informational Telegram to the destination PM. Site-hold evaluation lives in `server/domain/logbooks/vlb-batch-policy.mjs` and runs against the current Equipment master on every batch read.
6. New `server/routes/masters/equipment-create-express.mjs`: pending table, `POST /api/equipment/express` (duplicate check across all sites, draft, OTP to entering-site PM), `POST /api/equipment/express/:id/otp` (create master record, save waiting card, link to batch). Reuse the OTP hashing and attempt rules from the transfer module.
7. Report: machine section in `shared/scanning/scan-batch-report.mjs` and the batch PDF/Excel.
8. Feature flag `VLB_TWO_STAGE_BATCHES` read per request, on by default, `0` turns the two-stage flow off without a redeploy.
9. Migration note: batches already closed before deployment get `stage='closed'` and no machine snapshot; the machine section shows "Not available for batches closed before two-stage processing".

## 10. Rollout: test platform first, live later

Nothing in this draft goes to the live Pulse-II site (pulse-ll.cmll.in) until the team has used it and agreed. The sequence:

1. **Feature flag.** All two-stage behaviour sits behind a server setting `VLB_TWO_STAGE_BATCHES`, on by default. `0` returns the site to single-step Save & lock batch with no schema change beyond the additive tables. The flag is read per request, so it can be switched without a redeploy. Decision on 1 November 2026: go live for all users directly.
2. **Pulse test instance.** The two write endpoints are added to a test copy of Pulse first. The Pulse-II test platform syncs from that copy, so express transfers and new equipment can be exercised end to end without touching the live Pulse master.
3. **Test platform.** A separate deployment with its own URL and its own PostgreSQL database, restored from a recent live backup through the existing Backup page export, so the team sees their real sites, fleet and employees. It connects to Pulse masters read-only exactly as the local ERP setup documents in `ERP-LOCAL.md`. Telegram OTPs go through a separate test bot and a test PM group, never the live PM chats. WhatsApp and email delivery are disabled. The page header carries a visible TEST banner.
4. **Team trial.** Site MIS users run real shifts in parallel: the live site as today, the test site with the two-stage flow, for an agreed number of days. Items checked: time per shift to complete the fleet dialog, how often transfers and new-equipment OTPs are needed, machine checklist accuracy against the scanned cards, and whether closure messages are understandable to the operator.
5. **Sign-off list.** The trial ends with a written list of changes from the team. Those are built and re-tested on the test platform. Only then is the flag turned on for the live site, one site first, then all.
6. **Rollback.** Turning the flag off returns the live site to single-step batches at once. Batches closed under the two-stage flow stay closed and readable; batches mid-stage are shown as open for the old Save & lock button.

## 11. Out of scope for this draft

- Trip count entered on the ELB card and any VLB-vs-ELB trip comparison.
- A per-site switch requiring a second OTP from the destination PM before an express transfer completes.
- Any OTP on VLB or ELB entry, locking or closing. Those actions need none. OTPs exist only for moving an asset between sites and for creating an asset that exists nowhere.
- Editing an existing Equipment master record from the entry screen. Only creation of a genuinely unknown asset is covered.
- Changing the three-shift / one-open-batch rule.

## 12. Build status and test platform switches

Built on branch `feature/vlb-elb-two-stage` (1 November 2026). Server modules: `server/services/logbooks/vlb-two-stage.mjs` (flag, schema, pure rules), `server/domain/logbooks/vlb-batch-stages.mjs` (lock, fleet, stepper save, ELB linking, closure checks), `server/services/auth/otp-approval.mjs` and `server/domain/auth/otp-delivery.mjs` (shared OTP controls, Telegram first then WhatsApp), `server/routes/people/vehicle-transfer-express.mjs`, `server/routes/masters/equipment-create-express.mjs`. Tests: `test/vlb-two-stage.test.mjs`, `test/express-otp.test.mjs`, `test/vlb-two-stage-ui.test.mjs`.

| Switch | Value on the test platform | Live default |
|---|---|---|
| `VLB_TWO_STAGE_BATCHES` | unset (on) | on for all users from 1 November 2026; set `0` to fall back to single-step Save & lock batch |
| Pulse write endpoints | not available yet; the writer records `pulseWrite.mode = local-only` on each express transfer and new asset | same |
| OTP delivery | Telegram via the MIS bot linked chats, WhatsApp fallback through the approved authentication template | same code, different bot and numbers |

The feature is on by default. Setting  on the App Service turns it off without a redeploy: the new tables stay but unused, the new routes answer 409, and the batch API returns to the single-step shape. That is the rollback.

Open items before go-live: the two Pulse write endpoints (section 6), a per-site option for a destination-PM OTP, and the team's change list from the trial.

2 November 2026: PM approval by OTP for batch reopening and Unlock VLB added (`server/services/logbooks/vlb-approval-otp.mjs`, `src/components/logbooks/vlb-approval-otp.jsx`), self-approval of a reopening request allowed for a PM who is also the requester. Tests: `test/vlb-approval-otp.test.mjs`, `test/vlb-approval-otp-ui.test.mjs`. No new switch: it is available wherever the OTP delivery is configured, which it is on live.
