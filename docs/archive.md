# Historical reference

These inherited notes describe earlier application and deployment arrangements. They are retained for reference only. They are not instructions to modify caliber-mis or deploy caliber-mis-new. Current code, README, CLAUDE.md and user instructions take priority.

## PROJECT_WORKFLOW.md

## One manual VLB card per tipper per shift, late batch alerts, meter continuity report, Pending in Pulse

A manual VLB save or edit is refused with 409 (`code: duplicate_card`) when another active vehicle card exists for the same site, date, shift and tipper; the message names the existing card. The form then asks for a reason of at least ten characters and resubmits with `duplicateReason`; the server keeps it on the card with `duplicateOf` and writes `card_added_duplicate` to `mis_vlb_batch_audit`. The batch report shows an **Additional card** column only when a batch contains one. Scanned cards are not covered by this rule; they keep their unique index on the printed card number. `vlb-duplicate-card.mjs` holds the rule.

`vlb-batch-alerts.mjs` runs a minute worker (disable with `VLB_BATCH_ALERTS=0`). For every Shift Master row in force today and yesterday it computes the shift end in India time and sends a Telegram message through the MIS outbox when no batch exists two hours after shift end, or the batch is still open six hours after shift end, repeating every two hours until the condition clears. Recipients are the site Project Managers (same lookup as the express OTPs) plus the production head logins from the settings; with neither configured, the site's MIS users. Offsets, reminder interval, production head logins and Pulse administrator logins live in `app_settings` under `vlb_batch_alerts` and are edited on the Telegram Integration page (`/api/vlb-batch-alerts/settings`, `/state`, `/run`). State per alert is kept in `mis_vlb_batch_alert_state`.

**Meter Continuity Report** (Reports → Trips & Productivity, `/api/reports/meter-continuity`) compares each tipper card's opening KMR and HMR with the closing readings of that tipper's previous card, ordered by date and shift, never by save time. Rows are classed match, within tolerance, below previous closing, jump above tolerance, or no previous card; tabs summarise by driver and by tipper. Tolerances default to 2 km and 0.5 h and are set per run. Entry and scanning are unchanged.

Pulse is the only Equipment master and the master sync replaces linked records within a minute, so express transfers and express-created assets are no longer recorded local-only. `pulse-writer.mjs` refuses express requests and OTP completion while `PULSE_WRITE_MODE` is `off` (default) with a message naming the Pulse administrator; `live` calls the Pulse integration endpoints at `PULSE_INTEGRATION_URL` with `PULSE_INTEGRATION_TOKEN` once Pulse provides them. Changes approved earlier and still `local-only` are listed under Pulse Master Sync → **Pending in Pulse** (`/api/pulse-pending`), can be marked applied by an administrator, and are reminded daily at 09:00 by Telegram to the configured Pulse administrator logins.

## Whole VLB batch deletion and recovery

Site batches → Delete prepares an exact list of saved entries, scan uploads and application backup items. Current MIS/VLB and site permissions, a reason, exact approval phrase and delivered WhatsApp OTP are required. Preview/OTP expire after ten minutes; changed records or replacement scope require a fresh preview. Running extraction blocks preparation until it finishes. Mixed-scope uploads or links owned by another record fail closed.

Deletion retains books as inactive rows, moves scan image bytes/references and backup items into a private recovery store, removes active duplicate references, and releases the site/date/shift scope. It does not delete masters or other shifts. Database guards prevent stale uploads into deleted scan batches. The old archive endpoint returns 410 and never hides a batch.

Deleted batches shows the exact 240-hour restore deadline, actor, counts and remaining time. Restore uses current permission and OTP checks. If another active batch occupies the same canonical site/date/shift, the user must explicitly approve deletion of that replacement. Both actions commit in one transaction; any failure preserves the replacement. The replacement receives a fresh 240-hour window. The original card IDs return, with increased revisions, and the restored batch is locked. Reopening follows existing PM/trial policy. Derived cross-shift links are rebuilt from active records; entered loading/unloading times are preserved.

A minute worker expires only batches deleted through this approved workflow. It clears card contents, recovery copies and batch-detail audit payloads; minimal identities/deletion audit remain. Blob cleanup is tracked separately, checks current references and checksum/ETag, and retries safely on storage failures. Restore is blocked at the deadline even if cleanup is pending. Downloaded exports, SSD copies and platform backups remain outside application recovery/deletion. No existing batch is deleted by deploying the feature.

## Operational start: 1 November 2026

MIS operational entry, card lookup, reports, scan queues, duplicate checks and previous-shift links exclude dates before 2026-11-01 for every role. Earlier dates are rejected by manual, scanner and batch APIs, and by the date controls. Historical rows, scans and batches remain stored; this change performs no data cleanup.

VLB saves require an active batch for the same site/date/shift and attach the saved record in the same transaction. Saved VLB navigation opens Site batches. Historical open batches do not occupy current operational slots. New batches retain creator attribution in creator_login, using the serialized user/site checks rather than historical created_by slots. Whole-batch deletion removes its cards from active use with a 240-hour application recovery window; exact preview, reason, approval and WhatsApp OTP are required. The hide-only archive action is discontinued.

# Caliber Pulse project workflow

## Saved VLB batches and card numbering

Vehicle Log Book offers a fourth **Create Batch** card. Select a site, report date and shift to include every saved, unbatched Manual and Scan VLB entry matching that selection. New matching saves join the open batch atomically; permitted card edits update its report snapshot and record before/after values in its audit history. Batch IDs use `CMLL/SASTI OC/30TH -OCT-26/S1/B01`. A site/date/shift has at most one active batch. Closure does not release that scope. An approved complete batch deletion releases it; a replacement gets the next batch sequence and a new identity. Each user may have one open batch across all sites, dates and shifts. Saving cards for a different shift is allowed while the previous shift's batch is open. Site-authorized MIS users and PMs can view existing site batches; only the active owner can close a batch.

Closed batches block both new matching saves and edits to their included cards. The MIS user opens the existing batch and submits a reason using **Request PM approval**. The **Site PM reopening approvals** queue is on Create Batch. The linked employee master must identify the reviewer as an active **Project Manager** assigned to that site; generic Admin labels, Production Managers, other-site managers and self-approval do not qualify. The approved MIS user selects **Reopen approved batch**, adds or corrects cards through VLB Manual/Scan, and closes the same batch again. Approval is for that MIS user and closure revision, is consumed once, and is rechecked against the approver's current PM/site assignment at reopening. Only that MIS user can write during the approved amendment session. Another open batch must be closed first. Each subsequent closure requires a new PM approval.

`vlb-batch-policy.mjs` enforces save/edit membership under the same transaction lock as creation and closure. `mis_vlb_batch_scopes` and a serialized database trigger prevent duplicate batch scopes without removing historical duplicates. Historical duplicate groups are retained and blocked for separate review. Reopening requests live in `mis_vlb_reopen_requests`; creation, additions, edits, PM decisions, reopening and closure are recorded in `mis_vlb_batch_audit`. Current site and VLB menu permissions still apply. No WhatsApp or email messages are sent by this approval flow.

Opened batches offer **Smart Search**, **Actions → Smart Print** and **Generate → PDF/Excel**, using the shared reporting controls and the opened batch's snapshots. Search, selected columns and sorting feed the report exports without changing batch membership. Batch records are stored in `mis_vlb_batches` and `mis_vlb_batch_entries`.

New Manual cards use `VLB_M/29TH-OCT26/S1/001`; new Scan cards use `VLB_S/29TH-OCT26/S1/001`. `mis_vlb_card_counters` assigns separate transactional series per source, card date and shift across sites/users. Scanner previews follow the same source/date/shift counters; final IDs are allocated on save. Existing card IDs, edits to those cards, batch IDs and ELB numbering retain their existing values. Schema changes add new tables without rewriting saved cards.

## Telegram BDMS chatbot

Result lists now provide request-selection buttons and guided follow-ups: maintenance work and daily remarks, recorded lifecycle timestamps, permitted linked requests, permitted vehicle history, and role-appropriate first-trip/MIS details. Back to results and Main menu support navigation. `telegram-bdms-conversation.mjs` stores only selected request/list-query identifiers in conversation context, alongside the language preference. Each detail turn reloads current authorization and scoped records; unknown, archived or newly inaccessible selections are denied. The same engine powers the fictional local trial and authenticated preview.

Menus and typed-query authorization now follow the current BDMS role: Production sees its own requests and first-trip work, Maintenance sees repairs and ageing, MIS sees verification work, managers/administrators see scoped summaries and queues, and permitted General Users get read-only reporting. Queries outside a role's menu are rejected server-side, not merely hidden. Current site assignments still apply to every query across all eight configured BDMS sites. The trial has explicit fictional role/site simulation controls; production users cannot select or impersonate these identities.

The pilot now asks for English or Hindi before accepting a query. Language preference is persisted in `app_settings` under the linked login's `telegram_bdms_chat_language:` key; `/start` and Change language return to the language chooser. The welcome MP3 says “Welcome to Caliber Pulse. Please select your language first, then choose your query” in English and Hindi. Telegram displays it as a tap-to-play audio message, not automatic playback. Expanded menus include site summary, closed requests, first-trip pending, MIS pending and oldest-first breakdown ageing. Record content stays as entered; interface labels use the chosen language.

The read-only private-chat pilot in `telegram-bdms-chatbot.mjs` supports Open breakdowns, Running BD, door/request lookup, pending first-trip/MIS entries and bilingual help. It does not support Accounts, IBOSS, unrestricted AI questions, approvals or write actions. `POST /api/telegram/bdms-chatbot/preview` requires a BDMS session and returns an answer without sending a Telegram message.

The approved release enables the chatbot for connected eligible BDMS users by default. `TELEGRAM_BDMS_CHATBOT_ENABLED=false` disables it. An optional comma-separated `TELEGRAM_BDMS_CHATBOT_PILOT_LOGINS` restricts rollout when set; an empty allowlist admits all eligible linked BDMS users. A private chat with several linked BDMS logins presents explicit /account login choices. The selection is saved per chat and rechecked against current links every turn. /account returns to the chooser; removed links cannot retain access. A single linked login is selected automatically. Notification connections are preserved. Current employee/privilege records are rechecked; Info Pulse site scope and request visibility rules apply, and Production users are further restricted to their own requests. Existing webhook secret checks, account linking, stop handling and group notifications are preserved. Open the existing CALIBER BDMS private Telegram chat and send /start, choose English or Hindi, then use the role-specific menu. Groups continue their existing notification behavior.

This is the maintainer guide for the Caliber Pulse breakdown and fleet-management application. It describes the current source in this repository, the production flow, and the rules that connect users, masters, requests, reports, and deployment.

Production URL: [https://bdms.cmll.in/](https://bdms.cmll.in/)

## 1. What the application does

Vehicle transfers shows the standard **Sync Oracle** button without a date field and retains full-history sync behavior. The protected transfer-sync API still accepts an optional `fromDate` as `YYYY-MM-DD` for explicitly requested one-time syncs; it is inclusive and preserves earlier Oracle transfer records. Equipment Master sync remains unchanged.

Caliber Pulse is a mining-operations portal for:

- equipment and vehicle records;
- regions, sites, hierarchy, OEM, repair-type, privilege, and employee masters;
- production maintenance requests;
- maintenance editing, closing, and deletion;
- MIS verification and first-trip tracking;
- site-wise and OEM WhatsApp report preparation;
- dashboards, reports, and audit-oriented history.

The application has two interfaces:

1. **Super User workspace**: dashboard, masters, WhatsApp Integration, Reports, and Audit Trail.
2. **Mobile User workspace**: a role-specific request workspace for Production User, Maintenance User, or MIS User, plus the configurable menu workspace for General User.

## 2. Architecture at a glance

~~~mermaid
flowchart LR
  Browser[React browser UI] -->|JSON + Bearer token| API[Express server]
  API --> DB[(PostgreSQL / Azure Database for PostgreSQL)]
  API --> Static[dist static assets]
  Git[GitHub branch azure-hosting] --> Actions[GitHub Actions]
  Actions --> Azure[Azure App Service]
  Azure --> API
  Azure --> DB
~~~

### Repository map

| Path | Responsibility |
|---|---|
| `src/main.jsx` | React entry point, login, navigation, dashboards, forms, master pages, request workflow UI |
| `src/style.css` and feature CSS files | Layout, theme, responsive behavior, loaders, charts, import dropzone, privilege and mobile workflow styling |
| `server.mjs` | Express server, database migrations, authentication routes, master CRUD, request workflow routes, static serving |
| `auth-session.mjs` | PostgreSQL-backed session creation and lookup |
| `mobile-access.mjs` | Account type and mobile role normalization plus server-side permission profile |
| `auth-role.mjs` | Login candidate filtering by requested access type |
| `password-auth.mjs` | scrypt password hashing, verification, initial-password setup, public user projection |
| `request-workflow.mjs` | India date/time validation and request state checks |
| `request-correction-policy.mjs` | Allow-listed lifecycle correction fields, evidence validation, snapshots, and correction status rules |
| `src/request-corrections.jsx` | Admin correction submission/application and PM approval workspace |
| `request-equipment.mjs` | Stable equipment selection and equipment-group labels used by the mobile request form |
| `equipment-identity.mjs` | Identity used to upsert duplicate equipment imports |
| `privilege-record.mjs` | Safe merging of duplicate privilege rows |
| `record-batches.mjs` | Splits large master imports into Azure-safe batches |
| `build-site.mjs` | Generates the app version, runs Vite, and writes deployment metadata |
| `.github/workflows/azure-hosting_coalmine-fleet-azure-783.yml` | GitHub Actions build and Azure deployment workflow |
| `test/*.test.mjs` | Node test suite for authentication, permissions, requests, equipment, dashboard metrics, and import helpers |

## 3. Local development

### Prerequisites

- Node.js 20 or newer. The GitHub workflow currently builds with Node.js 22.
- PostgreSQL, normally Azure Database for PostgreSQL in production.
- A `DATABASE_URL` connection string for any database-backed run.

Install dependencies and run the checks:

~~~powershell
npm ci
npm test
npm run build
~~~

Run the Vite development UI:

~~~powershell
npm run dev
~~~

Run the Express server against the generated `dist` directory:

~~~powershell
$env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST:5432/DATABASE"
npm start
~~~

For an isolated loopback PostgreSQL fixture that does not enable TLS, also set
`DATABASE_SSL=false`. Leave it unset in Azure so production continues to use TLS.

`server.mjs` listens on `PORT` when set, otherwise port `3000`. The server serves `dist` when `dist/index.html` exists and otherwise serves the repository root.

## 4. Application startup and data loading

1. The browser loads `index.html`, then `src/main.jsx` mounts `<App />`.
2. The app restores `nerveCenterSession` from `localStorage` or `sessionStorage` if present.
3. The app checks `/api/app-version` every 10 seconds. A changed version clears browser sessions and reloads the login page. This is how a newly deployed UI logs out stale users.
4. The Express process starts listening immediately, then runs PostgreSQL migrations. If migration fails, the server retries every 30 seconds.
5. Successful migration seeds the six repair types once: Breakdown, Accidental, Preventive, Aggregate Repair, Super Structure, and WGM.
6. Each master page calls `GET /api/masters`. Master loaders remain visible until the request completes. The app displays a short data-load toast after a menu loads.

## 5. Authentication and role flow

The login form accepts the employee first name or configured login name, the password, and the selected Super User or Mobile User access type. The server does not trust the browser for the account data:

1. `/api/login` finds matching `Users & employees` records.
2. It filters candidates to the selected access type and verifies either the stored scrypt hash or the initial phone-number password.
3. It resolves the account type from the user record and the assigned mobile role from the matching Privilege record.
4. Mobile roles are limited to `Production User`, `Maintenance User`, and `MIS User`.
5. A PostgreSQL session is created in `auth_sessions`. The session contains the account type, login name, assigned role, and permission flags.
6. If `mustChangePassword` is true, the server creates a short-lived password-change session instead. The user must complete `/api/change-initial-password` before receiving a normal session.

New application users receive their registered phone number as the initial password. `initializeUserCredentials` marks the record for a mandatory first-login password change when a phone number is present. The new password must be at least eight characters and cannot equal the phone number.

### Mobile permissions

Team User location assignment supports multiple site checkboxes in both Add and Edit. **All sites** selects every listed site; clearing an individual checkbox excludes it. The selection is stored as normalized site names separated by ` | ` in `site` (and mirrored in `location` by the form), preserving existing single-site records. All sites is a selection of the current list, so newly added sites require assignment. At least one site is required in the form. Live server checks use `userSiteScope` for requests, equipment, request creation and updates, MIS evidence and verification, and team tickets; stale manager report settings never widen Team User scope. Multi-site users select one assigned site when creating a ticket. Role and menu permissions still apply within the assigned sites.

**General User** is available under **Team User** when adding or editing Users & employees. Its desktop and mobile selectors offer **Dashboard**, **Directory (CD)**, **Masters**, **WhatsApp Integration**, **Requests**, **Reports**, **Audit Trail**, and **Tickets**, with every menu unticked by default. Saved selections, including an empty selection, are retained. Switching another role to General User starts with the empty General User defaults. General User never receives request creation, editing, deletion, closure, or verification permissions. The API checks the union of the configured desktop/mobile menus; dashboard data uses `GET /api/requests?scope=dashboard` and remains site-scoped.

**Directory (CD)** is an optional desktop/mobile menu for every account type. It is never required or selected by default; an administrator must explicitly tick it for each view. Deployment migration `directory_cd_opt_in_v1` removes the former automatic CD selection from existing user records without changing their other menus.


| Mobile role | Request visibility | Create | Edit | Delete | Close | Verify / first trip | Equipment master |
|---|---|---:|---:|---:|---:|---:|---:|
| Production User | Own requests | Yes | No | No | No | No | Read |
| Maintenance User | All requests | No | Yes when `edit` is granted | Yes when `delete` is granted | Yes | No | No |
| MIS User | Closed requests awaiting verification | No | No | No | No | Yes when `verify` is granted | No |
| Super User | All records | Administrative access | Administrative access | Administrative access | Administrative access | Administrative access | Full access |

The UI hides actions that the session does not expose, but the API repeats these checks. Direct browser or API calls cannot elevate a mobile user’s role.

## 6. Super User navigation and master flow

The Super User top bar contains:

- Dashboard;
- Masters menu;
- WhatsApp Integration menu;
- Users & employees is inside Masters;
- Reports;
- Audit Trail;
- day/night theme toggle.

The current Masters entries are Equipment master, Breakdown master, Repair type master, Region master, Vehicle transfers, Hierarchy master, OEM master, Users & employees, and Privilege.

Every generic master supports:

- live loading state;
- search and sortable columns;
- manual Add record form;
- CSV import with template download and drag-and-drop dropzone;
- CSV export;
- Delete all;
- Equipment Master-only filtered deletion with a complete record review, Audit Trail reason, and explicit confirmation;
- row edit and delete where the page exposes actions.

Import behavior is master-specific:

- Users & employees rows get initial credential fields server-side. Incomplete employee-only rows can be stored, while application users without a phone cannot log in until completed.
- Equipment rows use `equipmentIdentity` to update an existing matching row instead of inserting a duplicate.
- Privilege rows are matched by normalized username and duplicate rows are merged safely.
- Large imports are split into batches of 250 in the browser helper.
- CSV headers can use either field keys or displayed labels. Equipment import includes aliases for legacy location, acquired date, chassis, and manufacturer-serial headings.

### Equipment master fields

The current equipment form and table use current location, equipment name, equipment category, equipment group, item name, item specification name, acquisition date, make, model, manufacturer serial number, engine number, chassis number, document status, asset number, and equipment status. Equipment rows also expose edit and delete actions.

### Privilege master fields

Privilege rows are linked to usernames from Users & employees and contain User Group, Super User/Mobile User selection, site selection, and Read, Edit, Delete, Verify, and Print flags. Changes are made inline and saved with the single Save all button in the page header.

## 7. Production request flow

~~~mermaid
sequenceDiagram
  participant P as Production User
  participant UI as Mobile request form
  participant API as Express API
  participant DB as PostgreSQL
  P->>UI: Choose Equipment group
  UI->>API: Load Equipment master
  P->>UI: Select equipment / door number
  UI->>API: Check for an active request on the door or chassis
  API-->>UI: Block immediately when the asset is already off road / under maintenance
  P->>UI: Enter date, time, complaint
  UI->>API: POST /api/requests
  API->>DB: Repeat the active-request conflict check
  API->>DB: Insert Open request with session owner/login
  DB-->>API: Saved request projection
  API-->>UI: Request row
~~~

The first selector in Create Request is **Equipment group**. It displays the Equipment master `group` value and uses the database record ID internally. Selecting a group still fills the matching door, registration, and site values. The request payload keeps the existing `equipment` key for compatibility.

After an equipment or vehicle is selected, the form checks `GET /api/requests/conflict` by normalized door number and chassis. Any request whose status is not `Closed` blocks the form, identifies the existing request in a popup and inline warning, and disables submission. `POST /api/requests` repeats the same check and has no duplicate override, so Production and Maintenance users cannot create a second active request for the same asset.

While submission is in progress, the form pauses background conflict checks and ignores late check responses so a refresh cannot flag the newly created request as its own duplicate. Repeated submit events are blocked immediately. The request list adds the server-confirmed row after a successful POST, and the form closes without waiting for another list refresh. The API acknowledges the committed database transaction before running opening reports and notifications; delivery failures are logged without changing the successful creation response.

The form also supports manual 24-hour `HH:MM:SS` time entry and speech-to-text complaint input in supported Chrome/Edge browsers. The mobile submitted table shows Job reference, Equipment group, Door number, Site location, Days of breakdown, and the existing request fields. Days are calculated from the stored start timestamp and are not a separate database parameter.

## 8. Maintenance and MIS workflow

~~~mermaid
flowchart TD
  Open[Production creates Open request] --> Maint[Maintenance User edits or closes]
  Maint --> InProgress[In progress / Awaiting parts]
  Maint --> Closed[Closed with closing time and maintenance work]
  Closed --> MIS[MIS User verifies closed request]
  MIS --> Verified[Verified, optional first-trip date/time]
~~~

### Maintenance User

- Requests tab lists requests with edit and delete actions according to the assigned Privilege flags.
- After maintenance accepts a request, every dashboard, request table, filter, export and report derives the visible lifecycle from the recorded timestamps: `Accepted` after acceptance and `In progress` after work starts. A stale stored `Open` value must not be displayed once either event has been recorded.
- Maintenance can set the initial ETC and revise that ETC only once. The edit form locks the ETC controls after the revision, and the API enforces the same rule atomically so concurrent or older clients cannot make a second change. Saving an unchanged ETC does not consume the allowance. Existing user ETC-correction audit history is backfilled into the lock marker at startup.
- Close request form links back to the original request and captures closing date, closing time, maintenance work, and status.
- Tippers capture separate HMR and KMR readings at opening and closing. Edit request has one shared **Trip card upload** for the opening readings; Close request has one shared **Trip card upload** for the closing readings. Existing single-meter readings remain associated with their original meter, and missing opening readings can still be filled at closure. Closing readings and uploads remain optional for maintenance updates.
- Request projections include `openingMeterReadings` and `closingMeterReadings` maps keyed by `HMR`/`KMR`, stored in additive JSONB columns. The single `openingMeterReading`/`closingMeterReading` and `meterType` fields remain compatible with older requests and clients. MIS verification pre-fills saved closing readings and preserves the closing trip card.

### Controlled request corrections

Lifecycle records are never edited directly after an entry error. The responsible operational user opens **Request correction**: Production User can request a correction to their own Off Road entry, Maintenance User can request Maintenance acceptance or On Road correction, and MIS User can request MIS verification correction. The user proposes only allow-listed field changes, explains the reason, and attaches a mandatory JPG, PNG, or WebP evidence image. The live maintenance request remains unchanged while the correction is pending.

Project Managers and Production Managers receive an in-app notification and use **Correction approvals** in their manager profile. A manager can approve or reject only corrections belonging to an assigned site, and must record a review remark. Approval does not change the request by itself: it unlocks **Apply approved correction** under **Admin > Request corrections** for Admin and Super Admin. Application re-checks that the original fields have not changed, validates the complete lifecycle timestamp order, updates the request in one database transaction, records timeline corrections, and writes user submission, PM review, and Admin application events to the Audit Trail. Rejected, stale, and unapproved corrections never alter the source request.
- Closed or verified requests cannot be edited through the edit route.
- Delete is a server-side operation and cannot remove a verified request.

### MIS User

- Verify closed requests lists only closed requests that are not already verified.
- Verify form shows the original equipment, door, registration, site, closure, and maintenance details.
- The First trip done checkbox reveals date and `HH:MM:SS` fields.
- Verification is accepted only for an unverified request with status `Closed`.

## 9. Dashboard and reports

Every report tab shows From and To date fields beside the Filter button. These apply inclusive full-day IST ranges immediately, using the same shared report state as the popup. Selecting the first date initializes both ends; clearing either field or choosing Clear dates restores All dates. The Filter popup retains presets and precise time selection, and its applied dates appear in the visible fields. Editing a visible date selects full days again.

Info Pulse breakdown rows include a **Daily updates** button with the saved entry count. It expands a read-only history beneath that row, newest first, showing maintenance notes, delay reasons, author, and IST timestamp. Refresh uses the latest request history; requests without entries show an explicit empty state.

**Ticket Acceptance from Maintenance (Timelinewise)** defaults to entries whose recorded maintenance acceptance is more than 30 minutes after production submission; exactly 30 minutes is excluded. **Show total** restores all entries, including unaccepted requests, and manual PDF, Excel, print, and ZIP exports follow the selected view. Missing, invalid, or reversed timestamps are excluded from the delay view. Submission uses `start`, falling back to `createdAt`. Selecting this report in a role or personal WhatsApp schedule includes the same over-30-minute delay report within the recipient's permitted site and reporting window; the screen toggle does not change scheduled delivery.

**Actions → Columns** supports named table layouts: save the displayed columns in their current order, rename or update a selected layout, delete it, or restore the default columns. Choose a layout in the column dialog and press **Apply**, or select it from the table toolbar's **Layout** dropdown to apply it immediately. Saving a layout does not apply a draft until Apply is chosen; Cancel discards unapplied column edits. Layouts are scoped to the signed-in account and table/column set in this browser, independently of Smart Print layouts and saved report views. They retain column visibility and order; switching layouts leaves filters, sort and date selections unchanged. Resetting a table keeps its named layouts. Shared tables continue to remember the applied column arrangement across refreshes.

Tables with a breakdown-days or elapsed-time column start with **Highest to lowest time taken** selected. Days of breakdown is the primary sort when more than one duration is present; otherwise the first duration column is used. This includes operational workspaces, dashboard and OEM drilldowns, duration reports, and Audit Trail duration. Sorting uses the underlying elapsed time, so equal displayed day counts still order by minutes and missing durations stay last. Users can select lowest-to-highest, another column, or Clear sort; filtering and live row updates retain that choice. Reset table/report restores the descending duration default.

The dashboard opens in **OEM BD**, site-wise across all permitted WCL and NCL sites. Region, Site, From/To, and OEM remain visible while scrolling and in the OEM/full-fleet detail dialog. The Site filter is available for All regions as well. A chart segment sets the corresponding Region, Site, and OEM filters; a site total keeps the selected OEM. OEM legend entries set OEM, while **All total breakdown** and **View full list** retain every current header filter. Changing a header filter updates the chart, open list, title, and counts together, and resets the list's local search/category/group/status filters. Zero-result selections remain empty. Reset restores all permitted regions/sites/OEMs and today's live breakdown view.

Fleet view labels change the chart; the bold count buttons open their matching records. Blank chart/card areas and headings do not open lists. Total shows the current fleet for the selected location/OEM, while OEM breakdown dates include requests overlapping the chosen interval. Counts represent distinct assets; the detail context separately reports request records when an asset has multiple requests. The full list contains a separate table for each matching site, headed by its region, site name, and record count. The repeated Site column is omitted. Each site supports sorting, filtering, print, and export, with row numbers starting at 1 in the displayed order. OEM names appear inside segments with sufficient space; hover or keyboard focus exposes the name, color, site, and exact count for every segment, including small ones.


**Tracking Vehicle Throughput** starts with empty dates and an **All time** period. Selecting either date initially selects that single day; the From/To controls can then extend the inclusive range. Clearing either date or clicking **Reset dates** clears both dates and restores full-history BD movement and live availability, independently of the top-level dashboard date. The panel's Region filter reveals a Site filter limited to that region's authorized sites; changing or clearing Region resets Site. These selections apply to BD totals, the type mix, site tables, availability counts, exports, and linked detail lists. Dated availability is the fleet snapshot at the end of the selected To day (live when To is today). Opening an all-time site's day-wise details starts at its earliest recorded request, without truncating history to one year.

Info Pulse opens as four KPI cards over a single ranked list. BD balance (selected by default) counts every open request in the user's scope that is not idle, closed or verified, once; Critical counts those standing 24 hours or more, Warning those standing 12 to 24 hours, and Open those under 12 hours. Clicking a card narrows the list to that tier and the three tiers add up to the balance. Production users, Production Managers, Admins, and Super Admins also see a fifth **First trip pending** card for vehicles/equipment made on road by Maintenance and still awaiting the Production first-trip entry; other operational roles and non-production managers do not see it. Rows are tinted red, amber or purple by tier. The Filters panel opens collapsed on every screen with a purple blinking border and a "Customise yourself" cue for three seconds (no animation under reduced motion); Show filters expands it. Filters mirror the dashboard record browser: region tabs (WCL/NCL, shown when the scope spans more than one region), Site chips (shown for multi-site scopes) and Equipment / Vehicle chips (KMR requests are vehicles, HMR equipment, older requests classified by group name), each counted within its parent, plus an inclusive Started From/To range in IST with Until today, Today, 7D/14D/30D and All dates presets. The range defaults to Until today (no From, To = today): the BD balance as of now, every open breakdown started on or before today, undated requests included. Reset selection restores that default and every region. The KPI counts, list, record count and captions follow these filters. There is no pagination or drill-down. Rows run longest standing first and show the site, door/registration, equipment group and reference, status, the breakdown reason (with the recorded delay reason beneath it when one exists: the ETC overdue reason, else the latest daily-update delay reason, else the closure delay reason), standing since, down-for time (with a bar relative to the longest-standing breakdown) and the ETC, flagged as overdue or due in. The header trigger badge shows the same BD balance. Existing server-side site scope remains in force. The feed refreshes on request changes and every 30 seconds, displays its last successful refresh time, and distinguishes loading or failed refreshes from a zero balance. Existing impossible same-day AM ETC values that precede the breakdown are interpreted as their PM counterpart only when that 12-hour correction falls after the breakdown; new ETC changes must be later than the server's current time. The existing login-only one-minute display and manual reopening remain unchanged.

Info Pulse's toolbar has an **Export** menu beside Refresh, the same menu as the report tables: Download as PDF, Download as Excel and Smart Print (choose and save the columns to print). It covers every breakdown in the current selection, the selected KPI tier plus the region, site, equipment/vehicle and started-date filters, not only the rows rendered so far, in the same longest-standing-first order with a serial number. The columns are site, equipment/vehicle, equipment group, request ref, status, standing tier, breakdown reason, delay reason (overdue and closure reasons keep their label) with when and by whom it was recorded, standing since, down for, ETC and its overdue/due state, the daily-update count and the latest daily update. The report title carries the tier, place and date captions. The menu and the preparing-file overlay sit above the full-screen panel.

Each Fleet control dashboard section has its own **Export** menu in its header: Download as PDF, Download as Excel and Smart Print. **Smart Print prints the section exactly as it looks on screen**, chart and figures in the screen's Day or Night palette, with the usual paper, printer, pages, sides and copies and no columns to choose. PDF and Excel export the figures that section shows as a table, following that section's own view and filters, and the title names the section, place and period. **Total Fleet** lists every site bar (equipment, vehicles, total fleet, equipment and vehicle breakdowns, BD balance, BD %), each region total and the dashboard total, with a row for fleet whose location matches no chart site so the columns add up; in OEM BD mode it lists each site's breakdowns per OEM with site, region and overall totals. **Daily BD balance** lists each day (opening, BD In, BD Out, closing, idle, net change and change %) and, over more than one day, the selected-period totals. **Tracking Vehicle Throughput** follows its open tab: Site-wise BD Movement exports the site table with its availability count impact, the all-sites total, the four summary cards (whose BD Balance leaves idle out and whose Idle Vehicles counts idle requests) and the BD Type Mix; Availability Count exports the site table and total. **Request Lifecycle** lists the six grouped bars per day and the summary cards. **Breakdown trend** lists each day's recorded breakdowns with a running total and the gap to the daily baseline, then the Recorded and Daily baseline cards. The menus appear once fleet data has loaded, are left out of the whole-dashboard PDF capture and of printed pages, and follow Night mode.

The whole Fleet control dashboard has an **Export dashboard** menu in its banner, and the same menu stays beside the eye toggle when the banner is collapsed. Download as PDF and Smart Print capture the whole dashboard as it is on screen. Download as Excel gives one workbook with a sheet for the KPIs and one per section: Total Fleet (or OEM BD in that view), Daily BD balance as currently shown, both Tracking Vehicle Throughput tabs (BD Movement and Availability Count), Request Lifecycle and Breakdown trend. In the OEM BD view the workbook has the KPIs and the OEM table only.

The Super User dashboard is the mining-operations view. It loads Equipment master, Users & employees, Repair type master, and request data, then derives:

- top-row repair-type cards from the configured Repair type master;
- equipment totals and availability from `dashboard-equipment-metrics.mjs`;
- status counts for operational, maintenance, and breakdown equipment;
- region bars from the current WCL/NCL site list;
- fleet composition by Equipment group, category, or item name;
- request workload by status;
- user totals and a Mobile/Super/Admin drilldown;
- recent breakdown cases.

Reports include request-age highlighting. The shared styles mark requests about one day old yellow, two to four days orange, and more than five days red. The Reports and request tables use the same stored request start time as the Mobile days-of-breakdown value.

The General Report tab also carries the **In and Out Report**, the tabular twin of the dashboard Request Lifecycle graph. `in-out-report.mjs` builds one row per IST calendar day (from the earliest workflow event, capped at 366 days) with vehicles in (opened), vehicles out (maintenance closed, idle excluded), MIS verified, idle vehicles, net movement, the balance still in workshop and awaiting MIS verification at day end, average closure turnaround, and the vehicle and location lists behind each movement. The same module feeds the director bundle (`DIRECTOR_REPORT_TITLES[13]`, General department) and the daily 7 PM operational schedule, so the report can be scheduled, emailed, and downloaded in the reports ZIP like every other report.

## 10. WhatsApp Integration

The WhatsApp Integration menu contains:

1. **Daily site-wise report**: site rows with report-level checkboxes. Selecting a site/report prepares an alert for the selected recipient.
2. **Daily OEM report**: OEM rows with daily and L1/L2/L3/L4 selections, plus WCL/NCL filtering where configured.
3. **WhatsApp alert history**: the last 1,000 prepared alerts, including report type, target, level, recipient, phone, status, and timestamp.

The current implementation prepares and records alerts. The history is stored in `whatsapp_alert_history` and is protected by the Super User guard.

## 11. API reference

All protected calls use `Authorization: Bearer <session-token>`.

| Method | Endpoint | Guard | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Database health and server status |
| GET | `/api/app-version` | Public | Current UI version used for forced refresh/logout |
| POST | `/api/login` | Public | Authenticate and resolve account/role |
| POST | `/api/change-initial-password` | Password-change token | Complete mandatory first-login password change |
| GET | `/api/requests` | Session + read permission | Load request projections |
| GET | `/api/requests/:reference/audio/:kind` | Session + request scope | Load complaint or maintenance audio on demand |
| POST | `/api/requests` | Production + create permission | Create an Open request |
| PATCH | `/api/requests/:reference` | Maintenance + edit permission | Edit an open request |
| PATCH | `/api/requests/:reference/close` | Maintenance + close permission | Save closure details and status |
| DELETE | `/api/requests/:reference` | Maintenance + delete permission | Delete an unverified request |
| PATCH | `/api/requests/:reference/verify` | MIS + verify permission | Verify a closed request and optional first trip |
| GET | `/api/tickets` | Session + ticket scope | Load compact CRM ticket projections |
| GET | `/api/tickets/:reference/media/:kind` | Session + ticket scope | Load ticket audio or attachments on demand |
| GET | `/api/masters` | Session | Load masters. Mobile access is limited to Equipment master |
| POST | `/api/masters/:master` | Super User | Add or import master rows |
| PUT | `/api/masters/:master/:id` | Super User | Edit a master row |
| DELETE | `/api/masters/:master/:id` | Super User | Delete one master row |
| DELETE | `/api/masters/:master/all` | Super User | Delete all rows in a master |
| DELETE | `/api/masters/:master/selected` | Super User | Delete selected filtered Equipment Master rows |
| GET | `/api/whatsapp-alert-history` | Super User | Load prepared alert history |
| POST | `/api/whatsapp-alert-history` | Super User | Record a prepared alert |

Request projections expose the compatibility keys `ref`, `equipment`, `door`, `reg`, `site`, `category`, `complaint`, `start`, `hours`, `status`, `owner`, `requesterLogin`, `closedAt`, `closedBy`, `maintenanceWork`, `verificationStatus`, `verifiedAt`, `verifiedBy`, `firstTripDone`, `firstTripAt`, and `firstTripBy`.

## 12. PostgreSQL data model

`server.mjs` runs idempotent migrations at startup. The main tables are:

- `master_records`: one JSONB row per master record, keyed by `master_name`.
- `maintenance_requests`: request identity, equipment, location, complaint, start/status, closure, verification, first-trip fields, and the `expected_completion_changed_at` marker that enforces one ETC revision per request.
- `auth_sessions`: active bearer sessions and resolved permissions.
- `password_change_sessions`: short-lived mandatory initial-password sessions.
- `app_metadata`: UI-version session invalidation and repair-type seed markers.
- `whatsapp_alert_history`: prepared WhatsApp report history.

The database connection uses `DATABASE_URL` and SSL with certificate verification disabled for the configured Azure PostgreSQL connection. Keep this variable in Azure App Service configuration or a local secret store. Never commit it.

## 13. CI/CD and Azure deployment

The dashboard's Daily BD balance panel offers **View → Every site BD balance**. Choose **All sites** and a From/To period to compare daily closing BD in a grid of site bar charts, including zero-balance sites. Every chart uses the same scale and each bar opens the matching site/date requests. Zero-balance days remain clickable. Period opening, incoming, outgoing, closing and idle counts appear below each graph. Long ranges scroll horizontally within each site graph. Site, region and Shift Master filters continue to apply. Counts open the matching requests for that site and date or period. Smart Export and the dashboard workbook include the site name, daily movements and each site's period totals. **Daily movement chart** restores the combined or single-site chart.

The tracked GitHub workflows run on pushes to `azure-hosting` or `azure-hosting-1.0` and on manual dispatch:

1. Checkout the repository.
2. Install Node.js 22 with npm cache.
3. Run `npm ci`, `npm test`, and `npm run build`.
4. Upload the built repository as an artifact.
5. Log in to Azure using GitHub federated credentials stored as repository secrets.
6. Deploy the artifact to App Service `coalmine-fleet-azure-783` in the Production slot.

`npm run build` creates a new random `APP_VERSION`, builds the frontend to `dist`, writes `dist/app-version.txt`, and writes the static hosting metadata under `dist/.openai`. The server reads the version file and clears all active sessions when it changes.

### Safe release checklist

~~~powershell
npm ci
npm test
npm run build
git diff --check
git status --short
~~~

Commit only intentional source, test, documentation, and workflow files. Do not add `node_modules`, `dist`, deployment ZIPs, `.azure-cli`, or historical `azure-*` folders. Push the branch used by the configured GitHub workflow, then verify:

~~~powershell
Invoke-WebRequest https://bdms.cmll.in/api/health | Select-Object -ExpandProperty Content
~~~

Expected health output contains `"status":"ok"` and `"database":"connected"`.

## 14. Troubleshooting

### Valid login fails with a duplicate session public ID

Reverting the System Administration feature left `auth_sessions.session_public_id` and its unique index in databases where that feature had run. Its old empty-string default makes a second session fail with PostgreSQL `23505` on `auth_sessions_public_id_idx`.

Startup calls `repairLegacySessionDefaults` to set `gen_random_uuid()::text` as the default only when that legacy column exists. Existing sessions, identifiers, permissions, and the unique index are preserved. Fresh databases without the column continue to work. Do not resolve this error by clearing sessions or removing uniqueness.

`test/auth-session-schema.test.mjs` runs a real PostgreSQL regression when `AUTH_SESSION_TEST_DATABASE_URL` is configured (`AUTH_SESSION_TEST_DATABASE_SSL=false` for local PostgreSQL). It uses a temporary table inside a rolled-back transaction, reproduces the legacy failure, and verifies repeat sign-ins, existing-session continuity, and idempotent repair. The Azure build runs it against an isolated PostgreSQL service.

### Login says the account is duplicated

Make the Login name unique in Users & employees for the selected access type. The server rejects ambiguous matches instead of choosing an account at random.

### Mobile login says no assigned role

Set the user’s User type to Mobile User, then set User Group in Privilege to exactly Production User, Maintenance User, or MIS User. Save all privilege changes and sign in again.

### The app shows a server error after deployment

Check `/api/health`, Azure App Service Log Stream, and the GitHub Actions build log. A build can succeed while database initialization is still retrying. Confirm `DATABASE_URL` is present and the PostgreSQL firewall allows the App Service.

Since the transient-failure hardening the app no longer answers a bare `Server error`:

- `server-error-response.mjs` turns database connection drops (PostgreSQL restarts, slot swaps, `ECONNRESET`, SQLSTATE classes 08/57/53/40) into HTTP 503 with `Retry-After: 5` and the message "The server is reconnecting to the database. Please retry in a moment." Route errors that carry a status keep that status and message; anything else is a 500 whose message tells the user to retry or contact the administrator. Every 500 is logged with its method and URL, so search the Log Stream for `[500]`.
- `pool.on('error')` and `process.on('unhandledRejection')` keep the process alive when an idle database connection breaks; before this a single dropped idle connection exited Node and every user saw errors until App Service restarted the container.
- `src/api-transient-retry.mjs` makes the browser wait and retry read-only `/api/` requests that receive 408/425/429/502/503/504 or a dropped connection (about 19 seconds across five attempts, honouring `Retry-After`). Writes are never replayed. A message still reaches the user only when the outage outlasts the retry window.

If a user still reports a server error, the Log Stream line tagged `[500]` names the failing route and stack; fix that route and add a regression test.

### A newly deployed UI is not visible

The browser checks `/api/app-version` and should log out and reload automatically. If a stale tab remains, open the site again and confirm the response headers are not serving an old deployment.

### CSV import fails

Download the master’s CSV template, keep the first row as headings, save as UTF-8 CSV, and import in smaller batches if the file is large. Equipment imports upsert on identity; the same equipment should update rather than create a duplicate row.

### The site loads but no master data appears

Check the authenticated request in the browser network panel and `/api/health`. Super User master APIs require a valid session. Mobile users can only load Equipment master when their role profile grants equipment access.

## 15. Change map for future maintainers

When changing a feature, update the matching source, focused test, and this file if the public flow, role rule, API, database field, or deployment path changes. Run the release checklist before pushing. A change to the UI version is intentional: it forces active sessions to reload so users receive the same interface and permission model.

## 16. Unified WhatsApp delivery and report settings

**Reports → WhatsApp delivery settings** is the central Admin / Super Admin panel for organisation-wide routing, delivery switches, reminders, CRM fallback timing and message templates. It links to **Role default schedules** and **My report schedule**. Every eligible signed-in user, including Admin and Super Admin, also opens **Reports → My report schedule** directly. The separate Admin-menu Report Setting entry and duplicate Hierarchy Master timing editor are removed. Hierarchy Master retains report assignments and site access, with a link back to Reports for timing.

Settings and template-management requests re-resolve the signed-in user's current Users & employees / Privilege profile; a stale administrator session does not grant settings access after demotion. Provider setup and delivery history remain under **WhatsApp Integration → Meta API setup / WhatsApp alert history**.

### Recipient policy and CRM privacy

| Audience | Immediate request alerts, reminders and daily updates | CRM ticket-created / resolved alerts | Scheduled reports |
| --- | --- | --- | --- |
| Production, Maintenance and MIS operational users | All four request-status events and daily maintenance updates at the same assigned site by default, across request categories | Their own tickets only | Assigned fleet reports using their role or personal schedule |
| Managers, including Project / department managers, and Directors | Hard-excluded | Hard-excluded | Reports only, within authorised sites; manager CRM reports include all ticket categories at those sites |
| Admin and Super Admin | Hard-excluded | Hard-excluded | All fleet reports in fresh role defaults, plus CRM reports; saved report selections and schedules remain effective |

The four request-status events are **Opened / Off Road**, **Closed / On Road**, **MIS Verified** and **Marked Idle**. Their default recipient roles are Production supervisor, Maintenance supervisor and MIS supervisor. Operational recipients must match the request's canonical assigned site. Admin, Super Admin, Manager and Director accounts are reports-only and cannot be selected for these immediate alerts or their reminders. A saved WhatsApp number is required, and delivery still obeys the global and message-purpose switches.

Leadership exclusion is enforced in recipient selection and again at immediate delivery; old role selections, generic CRM/daily-update calls and duplicate-login records cannot opt Admin, Super Admin, Manager or Director accounts back in. Classification uses `whatsAppRecipientRole()` rather than treating the legacy Super User account type as Super Admin. Manager/Director job or recognised Director-name classification takes priority over a legacy Admin fallback; a real Super Admin authority remains reports-only for WhatsApp operational events.

**CRM alerts stay private:** ticket creation and resolution notify the operational ticket owner only, not leadership or every operational user at the site. Scheduled Admin, Super Admin and manager CRM reports have a separate authorised-site audience and include all CRM categories, without filtering by the creator's department. This reporting rule does not broaden interactive CRM ticket access. WhatsApp audience selection is separate from the existing in-app notification recipients.

### Delivery controls and defaults

| Control | Default / behaviour |
| --- | --- |
| All WhatsApp delivery | On; covers alerts, reminders, reports, manual sends and password reset OTPs |
| Message types | Scheduled fleet reports, CRM-created/resolved alerts, daily updates, manual reports and OTPs enabled |
| Direct alerts | All four events enabled for the default operational and administrator roles; Manager / Director are not selectable |
| Off Road escalation | One escalation after four hours; configurable from 1–168 hours, using Opened recipients |
| Idle reminder | Repeats hourly; configurable from 1–24 hours, using Marked Idle recipients |
| Quiet hours | Off; editable daily IST window initially 22:00–07:00 |
| Scheduled CRM reports | On; Admin, Manager and Super Admin account types; include empty site reports by default |
| CRM fallback timetable | Every day at 08:00, 15:00 and 20:00 IST; up to six times; applies only when that user has no applicable saved personal schedule |
| Report files | Site-specific PDF and XLSX download links, valid for 14 days |

Turning off Opened or Idle also pauses its corresponding reminder. Existing overdue requests may qualify on the next reminder check after an interval change. Quiet hours suppress non-OTP delivery; immediate event alerts are not queued, while an overdue reminder may qualify later. The global switch also blocks OTPs. Scheduled jobs check every minute while background jobs are running and use a 20-minute delivery grace period; this is not an unlimited replay of missed deliveries. Messages already handed to the provider cannot be recalled.

### Role defaults, My report schedule and legacy timing

| Scope | UI entry | Storage and API |
| --- | --- | --- |
| Organisation role defaults, Admin / Super Admin only | **Reports → WhatsApp delivery settings → Role default schedules** | `app_settings` key `hierarchy_report_schedules`; `GET /api/report-schedule-settings` and `PUT` with `{designations: ...}` |
| Own personal schedule, including administrators | **Reports → My report schedule**, or the link inside delivery settings | `app_settings` key `hierarchy_report_schedule:user:<login>`; `GET /api/report-schedule-settings?scope=personal` and `PUT` at the same URL with `{userSchedule}` |
| Return to defaults | **My report schedule → Use role default** | `PUT /api/report-schedule-settings?scope=personal` with `{resetToDefault: true}` deletes only that login's personal copy |

The explicit `?scope=personal` is essential for administrators: it selects their own schedule instead of editing the organisation's role defaults. The response includes `canManageAll`, permitted designations/reports, `userName`, `userLogin` and `userSchedule`; the latter is null when no personal copy is saved.

Users can select Daily, Weekly or Every N days, edit IST minute slots, add/delete rows and choose from reports assigned to their role. An active row requires a time and a report. Unsupported report selections are dropped on save. Explicit cadence wins over stale weekday/interval fields. The existing Every N days rule remains calendar-based: days N, 2N, etc. of each month; its previous occurrence can therefore be more or less than N days away across a month boundary.

Existing role and personal timings are retained. Before a role is saved centrally, legacy Hierarchy Master `scheduleDays` / `scheduleTimes` are applied and shown as the **effective** role timetable. Saving role defaults marks submitted designations `managedByReportSettings: true`; subsequent delivery uses those central timings instead of legacy Hierarchy Master timing. Hierarchy report assignments and site restrictions continue to apply. Editing a report/site tick in Hierarchy Master is not a second timing editor.

A matching personal schedule replaces the role timetable for that login only. The role Active switch still gates that personal schedule, and recipient/report/site restrictions still apply. Saved personal schedules under a different designation are ignored. Saving one user's schedule never changes another user's timing or the shared role default; removing a report or slot from a saved list does not automatically restore General Reports at 19:00.

For **fleet reports**, use the effective role timetable unless a matching personal schedule replaces it. For **CRM**, a matching saved personal schedule supplies that user's delivery slots and takes priority over the organisation CRM fallback. With no applicable personal copy, CRM uses `crm.days` / `crm.times` (08:00 / 15:00 / 20:00 by default), independently of the role's fleet timetable. A paused or empty applicable personal schedule does not silently fall back to global CRM times. Global CRM controls and authorised-site/account-type checks still apply. Resetting one user's personal schedule restores fleet role defaults and CRM fallback timing for that user only.

**Reports are timed only.** Every event is no longer a selectable frequency, `reportsForHierarchyEvent()` returns no reports, and event-driven sender entry points skip publication. Normalisation folds legacy event-selected report titles into an existing active timed row without changing that row's days or times. Event-only personal copies can inherit current role timing; disabled selections remain disabled, and explicitly paused/empty role timing is not reactivated. Unplaced selections are retained in paused rows for later editing. Removing the UI option alone is not the delivery guard.

### Reporting windows, complete activity and site bundles

For each due delivery, use `[previous scheduled occurrence, current scheduled occurrence)` in IST. The previous occurrence is determined across **all active report rows in the user's effective personal/role timetable**, not independently per row. For example, with one active row at 08:00 and another at 15:00, the 15:00 delivery covers 08:00–15:00 rather than starting at yesterday's 15:00. Rows due at the same occurrence contribute to the same window and their report selections are combined. The end is the scheduled time, not the delayed scheduler run time or the last successful send. Daily minute slots, weekly days and existing calendar intervals must use their actual previous occurrence across midnight, weekends and month boundaries. CRM without a personal schedule uses adjacent occurrences of its fallback timetable.

The activity window is inclusive at the start and exclusive at the end. Activity exactly at a slot boundary belongs to the next window. Include **every case with activity in the window**, even if it opened and closed during that same window; do not use only the current open backlog or discard an opening because the case has since closed.

- Fleet activity includes opening, maintenance acceptance, closure, MIS verification, Idle marking, Idle approval / On Road, first-trip verification and timestamped daily maintenance remarks. Older cases qualify when they have new activity in the window. Cases with no window activity are not repeated as backlog.
- The fleet bundle starts with **All request activity in this window**, then the selected non-empty report tables. The complete activity table prevents status-specific report views from hiding a case that changed status several times. Lifecycle fields are bounded to the window end; fleet master totals in selected reference tables remain current snapshots rather than a historical event ledger.
- CRM includes tickets created or resolved in the window. A ticket created and resolved within the window remains included once with its timestamps. A later resolution must not make an earlier window report the ticket as already resolved.

Fleet and CRM publish **separate bundles for each authorised site and delivery window**. Each fleet site bundle has one PDF containing its report sections and one XLSX workbook containing the corresponding sheets; CRM similarly publishes one PDF and XLSX for that site's ticket activity. Each recipient receives one consolidated WhatsApp message per report family and scheduled window, covering all their selected permitted locations. The message has a bold LOCATIONS heading, the IST window, per-site counts and site-labelled PDF and Excel links. There is no Notes field or extra notes paragraph. Both files are stored in `published_reports` and linked through `/r/<short_code>` for **14 days**. Full case details stay inside the files. No combined multi-site file is substituted for the site-specific links.

Recipient site scope is resolved before publication and intersected with applicable hierarchy restrictions. Managers without an authorised site/region are skipped; a hierarchy row cannot broaden their access. Dispatch claims in `whatsapp_consolidated_report_runs` are scoped by occurrence and recipient (plus the report family/flow/schedule identity), covering all selected locations in one send, and delivery outcomes are recorded in `whatsapp_alert_history`. Repeated scheduler polls deduplicate claims; failed report attempts may retry up to three attempts within the eligible delivery window.

Scheduled Availability Report figures use the exact delivery window, including downtime carried over from incidents already open at the start. Those incidents contribute to interval availability without being repeated as new case activity. Manual month-to-date availability reports retain their existing behavior.

### Version-3 policy migration, reset and persistence

Settings are stored under `app_settings` key `whatsapp_report_settings`. `normalizeWhatsAppReportSettings()` upgrades settings to **version 3**. Pre-version-2 records receive the unified operational defaults. Version-2 records retain valid operational/OEM selections while Admin and Super Admin are removed from immediate-event recipient lists. Scheduled CRM recipients remain unchanged.

The routing migration preserves saved global/event delivery pauses, reminder settings, CRM days/times and empty-report preference, quiet hours, template choices and version-2 channel switches. Role/personal schedules have their separate timed-only normalisation described above. Once version 3 is saved, permitted custom role selections and explicitly disabled generic channels are retained; all leadership immediate-alert exclusions remain enforced. Legacy CRM summary-only/PDF-only/combined formats normalise to linked PDF and XLSX files.

**Reset delivery rules** loads default delivery rules into the draft while preserving existing CRM days/times and all message-template choices; role and personal schedules are stored separately and remain intact. Other delivery controls return to defaults, including delivery switches and reminder/quiet-hour settings. **Save settings** applies that draft. This action is separate from **Use role default**, which removes only the current user's personal schedule.

Delivery-settings saves check `{settings, revision}` under a database advisory lock and return HTTP 409 for a stale revision. Settings writes and template actions are audited. The shared Meta/Fast2SMS sending layer reads the current policy before sending, including a second check after PDF upload; settings read failures cannot bypass the global pause. No settings-panel endpoint sends a WhatsApp test message.

### Provider setup and template purposes

Provider credentials remain under `app_settings` key `meta_whatsapp`, separate from delivery settings; server-held approval snapshots use `whatsapp_template_approvals`. The panel endpoints are `GET /api/report-settings`, `PUT /api/report-settings` with `{settings, revision}`, and `POST /api/report-settings/templates` with `{action: "submit" | "refresh"}`.

To activate wording: choose a purpose and sample/custom text, **Save settings**, **Submit saved template choices**, then **Refresh approval status**. New variants use names derived from purpose and content, preserving existing provider templates. Custom text is limited to 1,024 characters and must retain all numbered placeholders exactly once and in order. Saved wording becomes effective only after its provider status is recorded as APPROVED; pending, rejected or paused choices use the existing standard fallback. Selected custom template submission is explicit. Startup submits missing standard definitions and refreshes approval status; deployment does not send sample messages. Authentication OTP wording remains fixed. Previews use sample data and do not change report contents, recipients, permissions or timing.

The gallery retains **ten samples for all 40 purposes (400 samples)**: 28 named reports from `DIRECTOR_REPORT_TITLES` and 12 consolidated, manual, alert and reminder purposes. Styles include Current standard, Compact summary, Structured detail, Executive brief, Action focused, Team handover, Review checklist, Formal notice, Numbered facts / Report review card, and Status card. **Customise this sample** copies the selected wording into the editor; only saved selected templates are submitted.

**Scheduled site fleet bundles always use `consolidatedRequestReport`, even when only one named report is selected.** Scheduled CRM site bundles use `consolidatedTicketReport`. Named single-report choices remain available for legacy/manual single-report use, with `inherit` resolving to the consolidated style and approval; they do not select the scheduled site-bundle purpose or create per-event report delivery. Manual report sends use the separate `manualReports` purpose. Existing standard/compact/structured wording and provider names remain compatible.

If the provider explicitly rejects an unavailable CRM template (132001), a single-site delivery can fall back to one PDF attachment with its links, while a multi-site delivery falls back to one text message containing all site links. Timeouts, suspensions and policy pauses do not trigger an additional send. Scheduled fleet template failures are recorded for retry rather than becoming per-request text reports. Provider delivery can still fail; inspect **WhatsApp alert history** and the provider connection/approval state.

### Implementation and focused verification

- `whatsapp-recipient-policy.mjs`, `whatsapp-workflow-policy.mjs`, `whatsapp-report-settings.mjs`: common classification, hard exclusions, same-site request routing, switches and version-2 migration.
- `hierarchy-report-flow.mjs`, `report-delivery-window.mjs`: timed-only migration, effective role/personal schedules and previous-occurrence windows. `server.mjs` connects `reportScheduleScope()`, `crmReportGroups()`, `combineReportWindowGroups()`, generic alert routing and the scheduled senders.
- `site-consolidated-report.mjs`, `table-export-pdf.mjs`, `director-report-bundle.mjs`: complete window activity, site notices, PDF sections and XLSX sheets; server publishing creates the expiring links.
- `src/main.jsx`, `src/whatsapp-report-settings.jsx` / `.css`: the Reports settings entry, role-default and personal editors, reset behaviour and Hierarchy Master access-only editing.
- `whatsapp-report-settings-api.mjs`, `whatsapp-template-catalog.mjs`, `whatsapp-template-runtime.mjs`, `meta-whatsapp.mjs`: authorisation/revisions, wording/preview, provider approvals and transport-level policy checks.

Relevant tests include `whatsapp-workflow-policy`, `generic-whatsapp-alerts`, `whatsapp-report-settings`, `whatsapp-report-settings-api`, `hierarchy-report-flow`, `hierarchy-event-delivery`, `user-report-schedules`, `hierarchy-report-scope`, `site-consolidated-report`, `whatsapp-report-delivery`, `table-bundle-pdf`, `xlsx-report-bundle`, `whatsapp-delivery-settings-ui`, `admin-menu-access` and `hierarchy-master-ui` under `test/` (`.test.mjs`). Keep coverage for legacy routing migration without timing/template resets, hard manager/director exclusions, private CRM alerts, cross-row adjacent windows, opened-and-closed-in-one-window cases, personal CRM override isolation, site-specific files, administrator personal scope, provider approval fallback and pauses during media upload.


### WhatsApp message layout and template rollout (September 2026)

Operational WhatsApp templates begin with a bold `SITE` heading on its own line. Each template has separate labelled fields so provider parameter whitespace normalization cannot collapse the entire message. The saved request or ticket supplies the equipment, breakdown category, complaint, repair work, delay/idle reason, CRM priority/resolution, timestamps, meter and first-trip status as applicable. Individual notifications and reminders omit the Next step field. Audio-only details point users to the recording in Caliber Pulse; long prose is summarized, with the request link retained.

Scheduled fleet and CRM reports pass structured site, reporting window, activity count and PDF/Excel links. Each scheduled delivery consolidates all selected permitted locations into one message while retaining site-specific files and the exact interval. Manual reports and WhatsApp share text also lead with the site or an explicit multi-site scope. Account password-reset OTPs retain their authentication format.

Manage wording in **Reports → WhatsApp delivery settings → Message templates**. All prepared styles retain the bold site header; new custom wording must retain that header and every required field. Saved older custom bodies remain available for editing and fall back to the new standard until corrected and approved. Changing layouts does not change recipients, pauses, personal schedules or report permissions.

New provider definitions use immutable `*_site_v3` names for individual notifications and `*_locations_v3` names for consolidated reports. Version-2 structured parameters are translated by field name, removing Notes and Next step without shifting retained fields. The original opened-request call and the new layout both contain nine values; callers supplying already-formatted v3 values must set `context.parameterLayout` to `current`. Startup submits missing standard templates and records the provider statuses; a 15-minute read refresh keeps those statuses current. Existing provider definitions remain unchanged. If Meta explicitly reports a new template unavailable (132001), the sender can use the previous approved template with its original parameter contract until the new layout is accepted. Network errors, provider suspensions and application delivery pauses do not trigger that migration retry. Preview availability is separate from provider approval and delivery history should be checked for actual sends.

### Employee tenure report

The C-Dir menu order is Directory, Employee Tenure Report, then C-Dir Masters. C-Dir Masters has moved out of the main Masters menu and keeps its existing edit permissions. The report follows Directory (CD) menu access. Site, region, department, category and designation filters can be combined; exports contain only the filtered rows and identify the selected filters. It reads the live C-Dir employee roster and includes only named ACTIVE employees with at least three completed calendar months of service. Columns are Employee ID, Employee name, Department, Designation, Joining date and Working tenure (for example 3Y 2M 15D). Counted through defaults to today in India and is included in the report/export title. Minimum-service filters offer 3, 6, 9, 12, 24, 36, 48 and 60 months; each means at least that number of completed months. Former employees, vacancies, future joiners and missing/invalid joining dates are excluded; missing/invalid dates are disclosed as a count. Month-end anniversaries clamp to the last day of the month. The standard report Generate menu provides PDF, Excel and print exports.

### Private C-Dir roster replacements

Approved C-Dir roster replacements can be passed privately through the deployment secret `CDIR_ROSTER_IMPORT_BROTLI_BASE64` (version-1 JSON compressed with Brotli and base64 encoded). Never commit personnel import payloads to source control. The full deployment validates the seven masters, supplies the payload temporarily to production, and verifies the committed SHA-256 revision through `/api/health` before removing the temporary configuration. Remove the deployment secret after the approved import. `cdir-roster-import.mjs` backs up the prior C-Dir rows in the private `cdir_roster_imports` table and replaces only those seven masters in one transaction. The same revision is never applied twice, so later manual edits survive restarts. Directory, tenure reports, filters, exports and birthdays continue to read the live masters. Staging does not apply imports. A recovery operator can restore `previous_records` from the corresponding import revision in a database transaction; unrelated masters and login accounts are outside the replacement scope.

Session policy: all mobile and desktop roles have no inactivity logout. Activity heartbeats update presence only. Sessions retain their existing 30-day maximum lifetime and can still be ended by sign-out, administrator revocation, or account security changes.

Telegram site invitations run in batches of five so large sites do not exceed the HTTP gateway response window. Each recipient is claimed atomically in `app_settings` before contacting Telegram, and the delivery result is saved. Refreshing or continuing skips recorded attempts. Network errors, interrupted sends and failed result persistence remain uncertain and are not automatically resent; explicit provider rejections are shown as failed. Administrators must review these deliveries. The site-group table shows saved invitation counts only for currently assigned connected users. Historical invitations sent before this tracking rollout are not backfilled. Users must tap the private link and request membership; the bot still checks their current site assignment before approval. A counted invitation is not proof of current membership.

### Running BD maintenance handoff

Request polling and report projections omit workflow visit snapshots. Only the authenticated single-request timeline loads `workflowHistory`, stripping legacy embedded audio, photos and trip-card payloads in SQL. New Running BD and reopening snapshots exclude those binary fields; saved originals and earlier snapshots are retained. A bounded, read-only startup measurement records the request count and historical JSON bytes removed from the feed in Audit Trail under **Application performance**. Notification reads retry a PostgreSQL deadlock once; workflow writes are never replayed by that read helper.

Schema setup is fingerprinted independently of the UI version. Staging and production serialize schema installation with a transaction advisory lock, record the fingerprint only after success, and skip unchanged DDL on later restarts. A two-second lock acquisition timeout rolls back blocked migrations for the existing startup retry, preventing them from queueing indefinitely behind live traffic. Version bookkeeping and one-time data seeds still run normally.

Maintenance can choose On road with breakdown (Running BD) alongside normal completion. The vehicle returns to road availability and enters the existing MIS first-trip verification workflow, while its maintenance ticket remains open. Selecting a vehicle with an active ticket requires Same reason or Different reason; both reuse that ticket, and Different reason adds an outstanding issue. Maintenance must mark every recorded issue fixed before final closure or Idle completion. Earlier visits and verification are retained in workflow history. Tracking Vehicle Throughput includes a Running with BD count with the same scoped list drilldown as the other KPIs.

Equipment requests require HMR only for Maintenance Users at opening and closing. KMR remains required for vehicles; saved secondary KMR keys do not turn equipment into a vehicle.

### Admin workshop selected deletion

Admin and Super Admin sessions can select and delete filtered requests in Production, Maintenance, MIS, first-trip, closed-history and Idle tables. Select all filtered covers the complete matching result; the count and review exclude selections hidden by the current filters. The review lists every selected request with equipment, site, status and lifecycle dates and requires an Audit Trail reason before confirmation. Admin deletion includes verified history and Idle records; operational users keep their existing single-record permissions and cannot delete verified or Idle requests. The bulk API removes linked corrections, WhatsApp workflow dispatches and cascading daily remarks in one transaction, locking the selected requests before applying deletion. Equipment Master entries are retained.

### C-Directory visibility

Every signed-in user can browse the complete C-Directory roster through the All tab, including General Users and users at Corporate Office, Nagpur or Head Office, Chandrapur. Office, WCL, NCL and site tabs filter the roster by location. The two primary tabs are All and My Site. All exposes office/WCL/NCL subtabs; My Site starts with all assigned sites selected and exposes individual assigned-site subtabs. Account profiles and operational permissions remain role-specific.

### HR User

Team User includes HR User and HR Manager. Selecting it provides the complete C-Directory, Employee Tenure Report and all C-Dir Masters on desktop and mobile views. HR cannot access unrelated masters or maintenance actions. HR users and HR Managers are exempt from category A contact masking. Only HR users, HR Managers, directors and administrators may edit employee details using the profile edit icon.

### Employee Transfer

C-Directory includes Employee Transfer for HR users, directors, administrators and Project Managers. Employee ID lookup resolves one active C-Dir Employee master record and its contact record; ambiguous IDs or contacts require reconciliation. HR, directors and admins may request from any location; Project Managers may request only from their assigned sites. Each request preserves original and proposed details, source/destination, transfer date, requester, remarks and approval history in the dedicated employee_transfers table, included in the existing full database backup.

Both locations must have an assigned approver. Nagpur and Chandrapur office aliases route to the Team User HR Manager assigned to that office; other sites route to their Project Manager. User location choices include Nagpur and Chandrapur, mapped to the existing corporate/head-office directory records. Request creation and outgoing/incoming bell notifications commit together. Only the source location's assigned approver can approve, followed by the destination location's assigned approver accepting or rejecting. Project Managers cannot approve office requests unless also assigned the HR Manager role for that office. Acceptance atomically updates the employee/contact masters; employee details remain unchanged until then. Changed employee records block acceptance so newer edits cannot be overwritten. Rejections require a reason; duplicate pending requests and repeated acceptance are rejected. Each All, Outgoing, Incoming and History table, employee-detail comparison and approval history uses the shared ReportSection export/PDF/Excel/print controls. Notification clicks resolve a scoped employee transfer target and open the transfer workspace.


### BDMS Assistant screen

BDMS-enabled desktop and mobile headers include BDMS Assistant. Its opening click starts the bilingual welcome audio synchronously; browser playback rejection presents Enable sound. The authenticated dialog uses the existing role/site-scoped chatbot preview endpoint for language selection, menus, detail follow-ups and custom dates. Closing aborts pending requests and pauses audio. Telegram welcome includes a public application link with `?bdmsAssistant=1`; it opens the assistant after normal BDMS sign-in. No Telegram identity is treated as application authentication. Browser restrictions may require one initial sound-enabling tap when opening from Telegram. Accounts and HR profiles are excluded.

Public chatbot entry: https://pulse.cmll.in/join/bdms redirects to the configured Telegram bot with the public bdms start marker. It contains no login or account-link token and grants no request access. New users still connect their own account through Profile -> Connect Telegram. This is a bot chat entry, not a site-group invitation.

### C-Directory deletion approvals

C-Dir → Record Deletion Approvals is available to HR users, HR Managers, directors, admins and Project Managers. Nonadmin employee/contact Master deletion submits an individual approval request and leaves the record in place; bulk deletion is blocked. Admin and Super Admin keep direct deletion. Nagpur/Chandrapur employee or contact records require their assigned HR Manager; other sites require their Project Manager. Contact requests must resolve exactly one employee/location. Pending requests preserve the original record, requester, reason, approver role and decision history in cdir_deletion_requests, which is included in full backups. Rejections require a reason; changed records/locations block stale approvals; transfers and deletions cannot overlap for one employee. Approval, deletion and notifications commit atomically. Deleting an employee does not cascade-delete separate contact records. Registers, record snapshots and history use shared export/PDF/Excel/print controls. Notifications open the scoped deletion approval workspace.

BDMS chatbot report answers include site-wise counts across all matching scoped records before limiting detail rows. Site summary includes each site’s Open, Running BD and Closed totals; dated BD counts and fleet availability include site status breakdowns. Fleet uses current equipment location. Transfers show source-site counts, support tickets show ticket-site totals, and related-request drill-downs include site counts. English/Hindi labels and Production ownership restrictions apply.

BDMS report menus default to the current IST date and display its weekday. Today, Yesterday, Last 7/30 days, Choose dates and Choose day apply across report navigation and drill-down. Telegram supports /date YYYY-MM-DD and /period YYYY-MM-DD YYYY-MM-DD; the web assistant uses its report-date inputs. Weekday selection selects the most recent occurrence. Relative presets roll forward after midnight. Reports label their event-date basis; historical periods show current recorded statuses, while fleet availability remains a clearly labelled live snapshot. Invalid or future ranges leave the previous selection unchanged.

### IBoss report table controls
IBoss masters, transactions, dashboard details (including trade ageing), Report Merge and chatbot result tables use the shared Actions menu and Print/Export. Actions supports columns/order, filters, sorting, saved reports and Reset table. Bank-wise reconciliation and dashboard party lists use these controls too. The account ledger preserves its ERP layout and provides a Report table tab for these controls, narration and creator audit columns. Table filtering, sorting and exports cover loaded records only; use the Oracle search/date/company controls and pagination for the full source. Exports follow the visible filtered/sorted table. Controls open within the active native dialog so they remain accessible in dashboard and ledger pop-ups.

Smart Print automatically fits all columns to page width in landscape for printing and PDF/Excel export. Long reports continue vertically across pages. Browser print scaling has no lower floor, so very wide ageing tables fit without clipping. Excel workbooks define each sheet's complete print area, repeat the title/count/column headings, and use one page wide with automatic page height. Native browser/printer settings can still be overridden by the user.


---

## docs/CLAUDE-CODE-WORKFLOW.md

# Claude Code setup and working flow for Caliber MIS

Prepared 1 November 2026. This guide prepares a second coding environment for the existing project. It does not install Claude Code, sign into accounts, change production data, or deploy anything by itself.

## 1. What Claude needs

Claude Code needs the complete repository, repository instructions, development dependencies, and your own authorized GitHub access. It does not automatically inherit this ChatGPT conversation.

The handoff consists of:
- `CLAUDE.md`: startup instructions Claude reads from the project root.
- `docs/CLAUDE-CODE-WORKFLOW.md`: this setup and release guide.
- `docs/IMPLEMENTATION-HANDOFF.md`: architecture, decisions, and outstanding issues.

The supplied ZIP contains only these documents. It is not a copy of the project or a credentials backup. The GitHub link ending in `/tree/main/test` points to tests; clone the whole repository instead.

## 2. Install and authenticate tools

Install Git for Windows, Node.js 22 LTS, and GitHub CLI using their official installers. Azure CLI is optional for diagnostics: the existing GitHub workflow already handles deployment authentication.

In PowerShell, install Claude Code with the official installer:

```powershell
irm https://claude.ai/install.ps1 | iex
```

Reopen PowerShell and check:

```powershell
git --version
node --version
npm --version
gh --version
claude --version
```

Run `claude` and complete its interactive account sign-in. Use ordinary permission prompts; do not disable permission checks. An Anthropic API key is not necessary if your chosen Claude login provides access. Do not paste credentials into this document or chat.

Official instructions: [Claude Code setup](https://code.claude.com/docs/en/setup), [project memory with CLAUDE.md](https://code.claude.com/docs/en/memory), [Git for Windows](https://git-scm.com/downloads/win), [Node.js](https://nodejs.org/en/download), [GitHub CLI](https://cli.github.com/).

Connect GitHub with the account that has access to the existing repository:

```powershell
gh auth login --hostname github.com --git-protocol https --web
gh auth status
gh auth setup-git
gh repo view caliberaitech783-beep/caliber-mis
```

Follow the browser/device sign-in prompts yourself. Do not use `gh auth token` to share a token. See [GitHub CLI authentication](https://cli.github.com/manual/gh_auth_login).

## 3. Use a separate clone

Recommended: give Claude its own checkout so two tools do not edit the same files concurrently.

```powershell
cd D:\
git clone https://github.com/caliberaitech783-beep/caliber-mis.git caliber-mis-claude
cd D:\caliber-mis-claude
git switch -c codex/claude-first-task
```

The handoff files are currently local in `D:\caliber-mis`; they will not be in a new clone until copied or committed. Copy them:

```powershell
New-Item -ItemType Directory -Force D:\caliber-mis-claude\docs
Copy-Item D:\caliber-mis\CLAUDE.md D:\caliber-mis-claude\CLAUDE.md
Copy-Item D:\caliber-mis\docs\CLAUDE-CODE-WORKFLOW.md D:\caliber-mis-claude\docs\CLAUDE-CODE-WORKFLOW.md
Copy-Item D:\caliber-mis\docs\IMPLEMENTATION-HANDOFF.md D:\caliber-mis-claude\docs\IMPLEMENTATION-HANDOFF.md
```

Alternatively extract the handoff ZIP into the new repository root, preserving its `docs` directory. Review any existing files before replacing them.

You can use `D:\caliber-mis` instead, but first stop other coding work there and inspect uncommitted changes. At handoff preparation, this checkout was at `39b0dc9`, while fetched `origin/main` and observed live release were `11dd199`. The existing edit to `src/employee-id-lookup.jsx` belongs to earlier work and must be preserved. Do not use `git reset --hard` or `git clean` to catch up.

## 4. Run locally

From the new repository root:

```powershell
npm ci
npm run build
npm run local:backend
```

Leave the backend terminal open. In a second terminal:

```powershell
cd D:\caliber-mis-claude
npm run local:ui
```

Open `http://127.0.0.1:4174`. Vite proxies `/api` to the backend on port 4175. The local backend helper manages an embedded PostgreSQL database named `caliber_erp` on port 55432 and stores its local configuration under `%LOCALAPPDATA%\CaliberERP`.

Important local setup details:
- Run only one instance of the local helper across both clones; they share its ports and persistent database.
- Use synthetic test data. Do not copy production connection strings into your local environment.
- The helper disables certain scheduled integrations, but can load existing local Oracle configuration. Inspect `scripts/local-erp.mjs` and your local integration setup before running sync/provision/import actions.
- If local sign-in has never been provisioned, inspect `scripts/provision-local-erp.mjs` first. It is intended for the local `caliber_erp` database with no existing users. Run it only after confirming that target; it writes a private `local-login.txt`. Never commit or share that file.
- The normal server database configuration uses `caliber_mis`; the embedded local helper is a deliberate exception. Do not weaken production database restrictions to make local startup work.
- An example environment file is documentation, not proof that the runtime loads it automatically. Trace the startup script before adding variables.

If a port is occupied or local startup fails, diagnose the process/error; do not kill unrelated applications or point the server at production as a workaround.

## 5. Start Claude with this prompt

```text
Read CLAUDE.md, docs/CLAUDE-CODE-WORKFLOW.md and
docs/IMPLEMENTATION-HANDOFF.md. Inspect git status and the current remote
main branch without overwriting local work. Explain the actual UI/API/
PostgreSQL architecture and GitHub-to-Azure release flow from current code.

Use this repository as the source of truth. Preserve the latest product
decisions, especially batch ownership, manual mismatch deletion, editable
trip counts and stable equipment selections. Tell me which instructions
are historical or conflict with current code before changing behavior.

First investigate the outstanding slow-page/slow-save issue. Measure and
trace the failing polling requests and save path. Do not delete records,
change production configuration, or deploy without my instruction.
```

Launch it from the root:

```powershell
cd D:\caliber-mis-claude
claude
```

You do not need to regenerate `CLAUDE.md` using `/init`; review and extend the supplied instructions as the project evolves. The file supplies context, not an enforced security boundary.

## 6. Repeat this implementation cycle

1. Inspect status, fetch the remote, and work on a task branch based on the intended current baseline. Preserve pending changes.
2. Reproduce the specific user issue. Trace UI handlers, API routes, validation, database writes and existing tests.
3. Make the smallest complete change. Include server-side rules when a UI-only fix would leave persistence incorrect.
4. Run relevant tests, build, and inspect the diff. Do not run database mutation tests against production.
5. Stage explicit files, commit, push the task branch, and open a pull request.
6. Review CI and the diff. Merge/deploy only with authorization; `main` automatically starts production deployment.
7. Watch the release for the exact deployed commit, verify live server/UI versions, and smoke-test the changed behavior.
8. Record the decision and tests in the handoff; report the actual release result.

Examples of checks (choose tests relevant to the change):

```powershell
node --test test/scan-trip-equipment-selection.test.mjs test/trip-equipment-validation.test.mjs test/scan-review-page.test.mjs
node --check server.mjs
npm run build
npm test
git diff --check
git diff --stat
```

The release workflow uses a disposable PostgreSQL 16 service and sets `DELETION_TEST_DATABASE_URL` for database tests and `RELEASE_CHECK_DATABASE_URL` for startup verification. Replicate the current workflow when full parity is needed. Never set these variables to the live database. Tests skipped for missing database configuration are not proof those integrations passed.

For a PR, put the reviewed description in a text file and use:

```powershell
gh pr create --base main --head codex/claude-first-task --title "Describe the actual change" --body-file pr-body.txt
```

Do not commit temporary PR files or unrelated logs. Do not push directly to `main` merely to store documentation.

## 7. GitHub to Azure flow

```text
Task branch -> Pull request -> CI/review -> authorized merge to main
  -> main_caliber-mis-783.yml
  -> Node 22 + locked npm dependencies + pinned OCR model
  -> UI build + tests + server startup/runtime verification
  -> Azure OIDC authentication + existing Gemini configuration step
  -> complete workspace deployed to caliber-mis-783 / Production
  -> live health and UI commit verification
```

Relevant workflows:
- `.github/workflows/ci.yml`: build/test validation.
- `.github/workflows/main_caliber-mis-783.yml`: production release on a `main` push or manual dispatch.
- `.github/workflows/diagnose-mis-deployment.yml`: inspect its current inputs and permissions before diagnostic use.
- `.github/workflows/recover-stalled-mis.yml`: recovery tooling; inspect before use, not a routine deployment shortcut.

The release deploys `package: .`, not just `dist`. The application needs its server and runtime files. An earlier reduced package caused startup failure. Keep the existing `app-assets` output arrangement and release version stamping.

The current release concurrency configuration lets an active deployment finish. Monitor the run for your intended commit rather than assuming the newest run is yours:

```powershell
gh run list --workflow main_caliber-mis-783.yml --limit 10
```

Then use `gh run watch RUN_ID --exit-status`, replacing `RUN_ID` with the verified run ID. See [GitHub run watch](https://cli.github.com/manual/gh_run_watch).

## 8. Azure resources and authentication

These are resource identifiers, not credentials. Recheck them against current configuration before administration.

| Item | Observed value |
| --- | --- |
| Public app | https://pulse-ll.cmll.in |
| App Service | caliber-mis-783 |
| Resource group | coalmine-fleet-maintenance-rg |
| Subscription | 58ca09cf-ab5d-47a8-a438-e1fb2a40d030 |
| Region | Central India |
| App Service plan | ASP-coalminefleetmaintenancerg-b234 |
| Observed plan | P2v3, one instance; recheck before capacity decisions |
| Runtime | Node.js 22 on Linux |
| PostgreSQL host | coalmine-fleet-pg-783.postgres.database.azure.com |
| MIS database | caliber_mis |

For optional interactive diagnostics, use your authorized Azure identity:

```powershell
az login
az account set --subscription 58ca09cf-ab5d-47a8-a438-e1fb2a40d030
az account show --query "{name:name,id:id}" -o table
az webapp show --resource-group coalmine-fleet-maintenance-rg --name caliber-mis-783 --query "{name:name,state:state,host:defaultHostName}" -o table
```

Follow MFA prompts yourself. See [Azure CLI interactive sign-in](https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli-interactively).

The GitHub workflow already references Azure client/tenant/subscription secrets for OIDC and `MIS_GEMINI_API_KEY`. Use the names in the checked-in YAML; do not copy secret values into Claude, commits, screenshots, or documents. Interactive Azure login is separate from GitHub Actions authentication. Do not replace working OIDC with a publish-profile password or loosen PostgreSQL TLS checks.

## 9. Confirm a release

After the release workflow succeeds, check:
- `https://pulse-ll.cmll.in/api/health`: successful status, connected database, intended backend commit.
- `https://pulse-ll.cmll.in/app-version.txt`: intended UI commit.
- The real page/interaction changed by the task, including persistence after reload where appropriate.

Use the actual merged/deployed SHA. A squash merge has a different SHA from its feature branch. If a newer release has already overtaken yours, verify that the desired change is included in that newer commit. A reachable homepage alone does not establish a successful release.

For a faulty release, inspect logs and coordinate a tested corrective commit or reviewed revert through the same pipeline. Reverting application code does not reverse database writes or migrations. Do not restore or delete production data as an automatic rollback step.

## 10. What has been prepared

The local handoff documents and ZIP are ready. No Claude installation, account login, second clone, Git commit, push, production change, or deployment was performed as part of writing this guide.


---

## docs/IMPLEMENTATION-HANDOFF.md

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


---

## docs/release-safety-plan-2026-11-02.md

# Release safety: an operator's work survives any crash, refresh or update

Date: 2 November 2026. Platform: Caliber Pulse-II (MIS), Trip Cards · Scan & Review (VLB), ELB.

## 1. What happened at 17:29

Anoop uploaded 40 Jayant cards on the live site. While the equipment review dialog was open for card 32, the screen was replaced by "This screen could not be displayed". After Refresh, the VLB page opened at "Select site"; selecting Jayant OC showed batch B03 with 0/0 cards. The 40 cards were still on the server, but nothing on screen could reopen the entry they were in.

Three separate faults lined up:

| Fault | Where | Effect |
|---|---|---|
| A JavaScript error while drawing the screen | browser, PR 40 build (live since 17:09) | Whole screen replaced by the error card. The exact error was written only to the browser console, which nobody saw, so it could not be diagnosed afterwards. |
| Re-selecting the VLB batch wipes the entry from the address | `src/vlb-entry-workspace.jsx` | After a refresh the scan page has no entry id, so it opens empty. |
| The scan page shows no list of entries | `src/bulk-card-scanning.jsx` | The operator cannot reopen an existing entry; only the address bar could. |

Context: there is one Pulse-II deployment. Every merge to `main` builds, tests and deploys to production in about 13 minutes and restarts the app for about 4 minutes. Five releases went live between 16:28 and 17:38 while cards were being scanned; a sixth followed at 17:57. There is no second environment, so "test platform first" in earlier plans was never possible.

## 2. The guarantee this plan gives

Cards and corrections live on the server from the moment they are uploaded or edited. The browser only displays them. So the guarantee is: **whatever happens in the browser or on the server, the operator can get back to the same entry, with the same cards, by reopening the page.** With 7 sites and 3 shifts there is no quiet hour, so the system is built to be updated at any hour rather than scheduled around shifts.

## 3. What is built (this release)

| # | Protection | Where | Behaviour |
|---|---|---|---|
| 1 | Browser errors reach the server | `client-error-report.mjs`, `src/client-error-report.mjs`, `src/lazy-feature.jsx`, `src/main.jsx` | Every render error, window error and unhandled promise rejection posts to `POST /api/client-errors` with message, stacks, screen, address, UI version and user. It is written to the server log (Azure log stream) and kept 90 days in `mis_client_errors`; administrators read it at `GET /api/client-errors`. Rate-limited to 20 per user per minute; a page sends at most 25. |
| 2 | The entry reopens on its own | `src/scan-entry-recovery.mjs`, `src/bulk-card-scanning.jsx` | With no entry in the address, the scan page reopens the entry this browser last worked in for the VLB batch (remembered per batch in local storage), otherwise the newest entry with unsaved cards. Cancelled entries never reopen. |
| 3 | The entries are listed | `src/bulk-card-scanning.jsx` | "Scan entries for this batch" shows every entry for the batch's date, site and shift with cards, saved, unsaved and skipped counts; one click opens it. |
| 4 | Refresh keeps the place | `src/vlb-entry-workspace.jsx` | Re-selecting the same VLB batch (which is what a refresh does) keeps entry, card and view in the address. They are cleared only when the operator moves to another batch. |
| 5 | A crash is contained | `src/lazy-feature.jsx`, `src/bulk-card-scanning.jsx` | The equipment review dialog, the duplicates list and the batch report each have their own boundary. If one fails, that panel shows "could not be displayed", with Close and Refresh, and the rest of the screen keeps working. A panel recovers by itself when its card or entry changes. |
| 6 | Uploads survive a restart | `src/scan-upload-retry.mjs`, `src/bulk-card-scanning.jsx` | A card upload that fails because the server is restarting is sent again after 1, 2, 3, 5, 8 and 13 seconds. The server keys every card on the browser's upload key, so a repeat never creates a second card. Read-only polling already retried through restarts. |
| 7 | Server responses are checked | `src/bulk-card-scanning.jsx` | A response without `cards` or `duplicates` (an older or newer server during a deployment) is treated as empty instead of crashing the page. |
| 8 | Content-duplicate rejection is off | `scan-duplicates.mjs`, `bulk-card-scanning.mjs`, `.env.example` | A read card that matches another entry by date, door and card number is **named on the card for review**, not moved out of the entry, until `SCAN_DUPLICATE_CONTENT_REJECT=true`. Both duplicate flags are shown on `/api/health` so their state is verifiable, not assumed. |

Existing protections that stay: the "Update available, refresh when ready" banner (`src/site-update-notice.jsx`) keeps the batch, card and session across the refresh; read-only API calls retry through gateway 502/503/504 (`src/api-transient-retry.mjs`); draft corrections are cached per card revision (`scan-draft-cache.mjs`).

## 4. Operating rules

1. **`main` is live.** A merge is a production release, not a staging step. Nothing is merged that has not passed the full test suite and the release smoke test below.
   Since 2 November 18:40 this is enforced by GitHub branch protection on `main`: changes arrive only through a pull request, the `build` and `logbook-layout` checks must pass on a branch that is up to date with `main`, administrators are not exempt, and force pushes and deletions are refused. A pull request that falls behind `main` is updated (`gh pr update-branch`) and re-checked before it can merge. Documentation-only merges (`docs/`, `*.md`) do not trigger a release, so they never restart the live app.
2. **New behaviour ships off.** Anything that changes what an operator sees on the card board goes behind a flag that defaults off in production. The flag's state is visible on `/api/health`.
3. **Release smoke test, every release, ten minutes:** upload one real PDF; open the equipment review dialog; press F5; confirm the same entry, cards and card reopen; open `/api/health` and confirm `commit` and the flags; open `GET /api/client-errors` and confirm nothing new.
4. **Operators are told.** A release restarts the app for about 4 minutes. During that window uploads pause and resume on their own; the operator sees "Server busy or restarting · card N will be sent again". Nobody needs to stop work, but the WhatsApp group is told before and after.
5. **Diagnose from the server.** When an operator reports a blank panel, the first stop is `GET /api/client-errors` (or the Azure log line "Browser error (render) for <login> …"), not a screen recording.

## 5. Still open

- **A real test platform.** A second Azure web app and PostgreSQL database restored from backup, with `main` deploying there and production deploying from a tag after sign-off. This needs Azure subscription access that the build machine does not have. Until it exists, rules 1 to 3 are the only gate.
- ~~**Direct pushes to `main`.**~~ Closed 2 November 18:40: branch protection now requires a pull request with passing checks (see rule 1). The 17:57 and 18:21 releases were direct pushes; the next attempt is refused by GitHub.
- **The 17:29 error itself** is not identified. If it recurs, protection 1 names it within minutes.

## 6. Release procedure with the test platform (added 2 November 2026, evening)

This section closes the first open item of section 5. `docs/test-platform-setup.md` is the runbook that creates the test platform (a second Azure web app and PostgreSQL server restored from a live backup, with every notification path switched off). Once it has been executed, the workflows in `.github/workflows/` give this release path, and rule 1 of section 4 changes to: **`main` is the test platform; a `release-*` tag plus the owner's approval is live.** Branch protection on `main` stays as it is.

| Step | Who | What happens |
|---|---|---|
| 1. Merge to `main` | Developer, through a pull request with green `build` and `logbook-layout` checks | `Build, test and deploy to the Pulse-II test platform` runs: build, full test suite, release identity and runtime checks, deployment to the test app, health check of the test address for the merged commit with `scheduledJobsEnabled: false`. About 13 minutes. Documentation-only merges do not release. |
| 2. Smoke test on the test site | Operator or developer, ten minutes | The checklist of section 4 rule 3, on the test address: upload one real PDF, open the equipment review dialog, press F5, confirm the same entry, cards and card reopen, open `/api/health` and confirm `commit` and the flags, open `GET /api/client-errors` and confirm nothing new. Note the `commit` value. |
| 3. Tag the tested commit | Owner | The tag names the exact commit the test site served (step 2), never a branch name. |
| 4. Approve the production run | Owner, in GitHub | The production workflow starts from the tag and waits in the `production` environment. GitHub shows **Review deployments** on the run; approve it. The workflow first confirms the environment still requires a reviewer and that the commit is on `main`, then builds, tests and deploys to `caliber-mis-783`. About 13 minutes, with the 4-minute restart of rule 4: tell the WhatsApp group before and after. |
| 5. Health check | Owner | The workflow verifies `https://pulse-ll.cmll.in/api/health` reports the tagged commit and that the served JavaScript matches. Then the smoke test of step 2 on the live site, and `GET /api/client-errors`. |

Tag names are `release-YYYY-MM-DD-N`, N counting from 1 within the day. The exact commands, run from a checkout of the repository (the commit is the forty-character value that `/api/health` on the test site shows):

```bash
git fetch origin main --tags
```

```bash
git tag release-2026-11-03-1 <commit from the test site's /api/health>
```

```bash
git push origin release-2026-11-03-1
```

A plain (lightweight) tag is enough; an annotated tag also works because the workflow reads the commit from the checkout. If `git push` is refused because the tag exists, the day's counter is already used: pick the next N.

Rollback: tag the previous good commit as the next `release-…-N` and approve it; the test platform is not involved, because that commit has already been live. Emergency release without the test platform: **Actions → Release Pulse-II to production → Run workflow**, choose the `main` branch, give the reason; the same approval is required and the reason is kept with the run. Both are exceptions to be written into this document's history, not routine.

What the gate guarantees: production cannot change through a merge, a direct push (refused by branch protection) or a tag alone. A production run that was not approved by the owner stops at its first step, and a tag that points at a commit outside `main` is refused. The test app and the live app have different Azure identities, different GitHub secrets and different concurrency groups, so a test release can neither reach the live app nor delay a live release.


---

## docs/test-platform-setup.md

# Pulse-II test platform: set-up runbook

Date: 2 November 2026. Owner: Mohit Chadda. Platform: Caliber Pulse-II (MIS), live at pulse-ll.cmll.in.

This runbook creates a second, separate copy of Pulse-II in Azure, the **test platform**, and switches the release path so that:

- every merge to `main` is built, tested and deployed to the **test platform** (workflow `.github/workflows/main_caliber-mis-test.yml`);
- **production** (`caliber-mis-783`) is deployed only from a release tag `release-YYYY-MM-DD-N`, or a manual run, and only after the owner approves the run in the GitHub environment `production` (workflow `.github/workflows/main_caliber-mis-783.yml`).

The pull request that adds this runbook also contains the two workflows. The Azure subscription that hosts Pulse-II cannot be reached from the build machine, so every command below is for the owner to run. Nothing in it changes a production app setting or touches the production database; section 12 lists exactly what is read and what is never touched.

Time: about two hours of commands, plus the restore (a few minutes per gigabyte). Section 0 says which commands run in Azure Cloud Shell and which on the laptop.

## 0. Before you start

### Where to run what

| Commands | Where | Signed in as |
|---|---|---|
| `az …` | Azure Cloud Shell (bash) at https://shell.azure.com, in the **Pulse-II subscription** `58ca09cf-ab5d-47a8-a438-e1fb2a40d030`. The `az` on the development machine is signed in to a different subscription; do not use it unless you first run `az login` with the owner account and `az account set --subscription 58ca09cf-ab5d-47a8-a438-e1fb2a40d030`. | Owner (subscription Owner or Contributor plus permission to create app registrations) |
| `gh …` | The laptop (PowerShell), where `gh auth status` shows `caliberaitech783-beep` | Repository administrator |
| `node scripts/…` | The laptop, in the repository folder, Node.js 22, after `npm ci` | — |

Cloud Shell forgets shell variables when it times out. Every `az` block below assumes these are set; paste them again after a timeout:

```bash
SUB=58ca09cf-ab5d-47a8-a438-e1fb2a40d030
RG=caliber-mis-test-rg
LOC=centralindia
PLAN=asp-caliber-mis-test
APP=caliber-mis-test-783
PG=caliber-mis-test-pg-783
PG_ADMIN=caliber_test_admin
REPO=caliberaitech783-beep/caliber-mis
az account set --subscription "$SUB"
```

### Names

| Item | Live (never touched) | Test platform (created here) |
|---|---|---|
| Resource group | `coalmine-fleet-maintenance-rg` | `caliber-mis-test-rg` |
| App Service plan | `ASP-coalminefleetmaintenancerg-b234` (Linux, shared with Pulse) | `asp-caliber-mis-test` (Linux, B2 unless section 2 shows a reason to differ) |
| Web App | `caliber-mis-783` | `caliber-mis-test-783` |
| PostgreSQL server | `coalmine-fleet-pg-783` | `caliber-mis-test-pg-783` (Flexible Server, Burstable B1ms) |
| Database | `caliber_mis` | `caliber_mis` (the name is fixed, see below) |
| Address | https://pulse-ll.cmll.in | `https://caliber-mis-test-783.azurewebsites.net` (or the regional address Azure assigns), optionally https://pulse-test.cmll.in |
| Deployment identity | the app registration behind the GitHub secrets `AZUREAPPSERVICE_*` | app registration `github-caliber-mis-test`, Website Contributor on `caliber-mis-test-rg` only |
| GitHub secrets | `AZUREAPPSERVICE_CLIENTID_…`, `…TENANTID_…`, `…SUBSCRIPTIONID_…`, `MIS_GEMINI_API_KEY` | `AZURE_TEST_CLIENT_ID`, `AZURE_TEST_TENANT_ID`, `AZURE_TEST_SUBSCRIPTION_ID`, optional `MIS_TEST_GEMINI_API_KEY` |
| GitHub environment | `production` (required reviewer: the owner) | `test` (no rules) |

If `caliber-mis-test-783` is taken (section 3 checks), pick another name and set the repository variable `PULSE_TEST_WEBAPP_NAME` in section 6. The workflows read their defaults from these names and refuse to run against `caliber-mis-783` or `pulse-ll.cmll.in` whatever the variables say.

### Three rules the server enforces

1. **The database must be named `caliber_mis`.** `mis-database-config.mjs` refuses any other database name, so a second database on the live server is not possible: the test copy needs its **own server**. This also keeps the test copy's credentials useless against the live server.
2. **`MIS_DATABASE_CONNECTION_MODE` must stay unset on the test app.** The live value `shared-admin` pins every connection to the live server and database; with that setting the test app would refuse to start.
3. **`MIS_SCAN_BLOB_ENABLED` must be `false` (or unset) on the test app.** Hot scan storage in Azure Blob is limited to `caliber-mis-783` in `scan-blob-storage.mjs`; any other app refuses to start with it on.

## 1. Before merging the pull request (10 minutes)

Do this first. After the merge, a production release needs both items; without them the production workflow stops at its first step (no reviewer rule) or at the Azure login (no federated credential). Neither item changes the live app.

### 1.1 The `production` environment with you as the required reviewer

Laptop. Save this as `production-environment.json`:

```json
{
  "wait_timer": 0,
  "prevent_self_review": false,
  "reviewers": [{"type": "User", "id": 313449839}],
  "deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}
}
```

`313449839` is the GitHub user id of `caliberaitech783-beep` (`gh api users/caliberaitech783-beep --jq .id`), the repository administrator. `prevent_self_review` stays `false` because the same person pushes the tag and approves the release. Then:

```bash
gh api --method PUT repos/caliberaitech783-beep/caliber-mis/environments/production --input production-environment.json
```

```bash
gh api --method POST repos/caliberaitech783-beep/caliber-mis/environments/production/deployment-branch-policies -f name='release-*' -f type=tag
```

```bash
gh api --method POST repos/caliberaitech783-beep/caliber-mis/environments/production/deployment-branch-policies -f name=main -f type=branch
```

```bash
gh api repos/caliberaitech783-beep/caliber-mis/environments/production --jq '{rules:[.protection_rules[].type],policy:.deployment_branch_policy}'
```

Expected: `rules` contains `required_reviewers`; the policy has custom branch policies on. The two policies mean only `release-*` tags and `main` (for a manual emergency run) can ever target the environment. The same can be done in the browser: repository **Settings → Environments → production → Required reviewers**.

The production workflow re-checks on every run that the environment still has a required-reviewer rule and refuses to build otherwise, so a rule removed by mistake cannot lead to an unapproved release.

### 1.2 A federated credential for approved production runs

The live deployment identity today has one federated credential, for pushes to `main`. A job that references a GitHub environment presents a different subject, `repo:caliberaitech783-beep/caliber-mis:environment:production`, so the same identity needs one more credential. Cloud Shell:

```bash
az ad app list --all --query "[].{displayName:displayName,appId:appId,objectId:id}" -o table
```

The right registration is the one whose `appId` is the value of the GitHub secret `AZUREAPPSERVICE_CLIENTID_248B6AEDDDF04A74B67402B5BD0DC3EB` (the Azure portal shows it under Web App `caliber-mis-783` → Deployment Center → Settings; the Azure portal created it on 21 October 2026 when the GitHub deployment was set up). Then:

```bash
LIVE_APP_ID=<appId from the table>
LIVE_APP_OBJECT_ID=$(az ad app show --id "$LIVE_APP_ID" --query id -o tsv)
az ad app federated-credential list --id "$LIVE_APP_OBJECT_ID" --query "[].{name:name,subject:subject}" -o table
```

Expected: a credential with subject `repo:caliberaitech783-beep/caliber-mis:ref:refs/heads/main`. Keep it: the `Diagnose MIS deployment` and `Recover stalled MIS App Service` workflows still sign in with it. Add the second one:

```bash
cat > production-environment-credential.json <<'EOF'
{
  "name": "github-production-environment",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:caliberaitech783-beep/caliber-mis:environment:production",
  "description": "Pulse-II production releases approved in the GitHub production environment",
  "audiences": ["api://AzureADTokenExchange"]
}
EOF
az ad app federated-credential create --id "$LIVE_APP_OBJECT_ID" --parameters production-environment-credential.json
```

This adds a sign-in rule to the identity. It changes no role assignment, no app setting and nothing on `caliber-mis-783`.

Cost: nothing. Both items are free.

## 2. Read the live set-up (5 minutes, read-only)

These commands only read. They print no secret values: the settings command lists names only.

```bash
az appservice plan show -g coalmine-fleet-maintenance-rg -n ASP-coalminefleetmaintenancerg-b234 --query "{sku:sku.name,tier:sku.tier,instances:sku.capacity,linux:reserved}" -o table
```

```bash
az webapp config show -g coalmine-fleet-maintenance-rg -n caliber-mis-783 --query "{runtime:linuxFxVersion,startup:appCommandLine,alwaysOn:alwaysOn,http20:http20Enabled,minTls:minTlsVersion,ftps:ftpsState}" -o table
```

```bash
az webapp config appsettings list -g coalmine-fleet-maintenance-rg -n caliber-mis-783 --query "[].name" -o tsv | sort
```

```bash
az postgres flexible-server list --query "[?name=='coalmine-fleet-pg-783'].{resourceGroup:resourceGroup,version:version,sku:sku.name,tier:sku.tier,storageGb:storage.storageSizeGb,publicAccess:network.publicNetworkAccess}" -o table
```

Write down: the plan SKU and tier (the test plan is the same family or one size smaller), the runtime (`NODE|22-lts` expected) and startup command, the PostgreSQL major version (used as `--version` in section 4), and the list of setting names (used in section 5 to decide which non-secret general settings to mirror).

## 3. Create the test resource group, plan and web app (15 minutes)

```bash
az group create --name "$RG" --location "$LOC" --tags purpose=pulse-ii-test-platform
```

Check the app name is free world-wide (`nameAvailable: true`); otherwise choose another and remember to set `PULSE_TEST_WEBAPP_NAME` in section 6:

```bash
az rest --method post --url "https://management.azure.com/subscriptions/$SUB/providers/Microsoft.Web/checknameavailability?api-version=2023-12-01" --body "{\"name\":\"$APP\",\"type\":\"Microsoft.Web/sites\"}" --query "{available:nameAvailable,message:message}"
```

```bash
az appservice plan create --name "$PLAN" --resource-group "$RG" --location "$LOC" --is-linux --sku B2
```

B2 (2 cores, 3.5 GB) is the smallest size that comfortably loads the handwriting OCR model at start-up next to the server; B1 (1.75 GB) is too tight. If section 2 showed a Premium plan for live and you want identical behaviour under load, use the same SKU (for example `P0v3` or `P1v3`); the cost difference is in section 11.

```bash
az webapp create --name "$APP" --resource-group "$RG" --plan "$PLAN" --runtime "NODE:22-lts"
```

```bash
az webapp update --name "$APP" --resource-group "$RG" --https-only true
```

```bash
az webapp config set --name "$APP" --resource-group "$RG" --always-on true --http20-enabled true --min-tls-version 1.2 --ftps-state Disabled
```

If section 2 showed a non-empty startup command for live, copy it: `az webapp config set --name "$APP" --resource-group "$RG" --startup-file "<value>"`. With an empty one Azure runs `npm start`, which starts `server.mjs`.

```bash
az webapp show --name "$APP" --resource-group "$RG" --query "{address:defaultHostName,state:state}" -o table
```

Write down the address: Azure may assign a regional one such as `caliber-mis-test-783-<id>.centralindia-01.azurewebsites.net` instead of `caliber-mis-test-783.azurewebsites.net`. The workflow verifies whichever address the deployment reports, so either is fine.

Sharing the live plan instead (`--plan` pointing at `ASP-coalminefleetmaintenancerg-b234`) costs nothing extra but is not recommended: a test OCR run competes with the live site for CPU and memory on the same instances. If you do it anyway, create the app in `coalmine-fleet-maintenance-rg` and scope the test identity's role in section 6 to the test app resource, not to the group.

## 4. Create the test database server (15 minutes)

```bash
PG_PASSWORD="$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | cut -c1-32)"
echo "$PG_PASSWORD"
```

Store the password in the company password manager now (entry: *Pulse-II test database, caliber_test_admin*). It is alphanumeric, so it needs no URL encoding. Use the major version from section 2 (`16` below):

```bash
az postgres flexible-server create --name "$PG" --resource-group "$RG" --location "$LOC" \
  --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 16 \
  --admin-user "$PG_ADMIN" --admin-password "$PG_PASSWORD" \
  --public-access 0.0.0.0 --backup-retention 7 --yes
```

`--public-access 0.0.0.0` adds the firewall rule that admits Azure services, which is how the test web app reaches the server (the test plan has no VNet integration; the live set-up uses a private subnet, which is more work than a test copy needs). Connections are TLS-only; the app verifies the server certificate.

```bash
az postgres flexible-server db create --resource-group "$RG" --server-name "$PG" --database-name caliber_mis
```

Admit the laptop that will run the restore (find its public address at https://api.ipify.org; Cloud Shell has a different one):

```bash
az postgres flexible-server firewall-rule create --resource-group "$RG" --name "$PG" --rule-name owner-laptop --start-ip-address <laptop public IP> --end-ip-address <laptop public IP>
```

The test connection string, used in sections 5 and 8:

```text
postgresql://caliber_test_admin:<PG_PASSWORD>@caliber-mis-test-pg-783.postgres.database.azure.com:5432/caliber_mis
```

The test copy will hold a full copy of live operational data and password hashes. Treat the server like the live one: no further firewall rules, delete it when the trial ends (section 11).

## 5. Test app settings (10 minutes)

Cloud Shell, with `$PG_PASSWORD` still set from section 4 (otherwise paste it into the `DATABASE_URL` line by hand). The file is deleted right after use so the password does not stay in Cloud Shell storage.

```bash
HOST=$(az webapp show --name "$APP" --resource-group "$RG" --query defaultHostName -o tsv)
cat > test-app-settings.json <<EOF
[
  {"name":"DATABASE_URL","value":"postgresql://${PG_ADMIN}:${PG_PASSWORD}@${PG}.postgres.database.azure.com:5432/caliber_mis","slotSetting":false},
  {"name":"PUBLIC_APP_URL","value":"https://${HOST}","slotSetting":false},
  {"name":"PORT","value":"8080","slotSetting":false},
  {"name":"DISABLE_SCHEDULED_JOBS","value":"true","slotSetting":false},
  {"name":"META_WHATSAPP_DELIVERY_PAUSED","value":"true","slotSetting":false},
  {"name":"TELEGRAM_DELIVERY_PAUSED","value":"true","slotSetting":false},
  {"name":"VLB_BATCH_ALERTS","value":"0","slotSetting":false},
  {"name":"MIS_SSO_MODE","value":"off","slotSetting":false},
  {"name":"PULSE_WRITE_MODE","value":"off","slotSetting":false},
  {"name":"MIS_SCAN_BLOB_ENABLED","value":"false","slotSetting":false},
  {"name":"SCAN_DUPLICATE_FINGERPRINT","value":"false","slotSetting":false},
  {"name":"SCAN_DUPLICATE_CONTENT_REJECT","value":"false","slotSetting":false},
  {"name":"SCAN_DUPLICATE_SKIP_PERCENT","value":"15","slotSetting":false},
  {"name":"SCAN_DUPLICATE_SUSPECT_PERCENT","value":"30","slotSetting":false},
  {"name":"MIS_ENVIRONMENT_LABEL","value":"TEST","slotSetting":false}
]
EOF
az webapp config appsettings set --name "$APP" --resource-group "$RG" --settings @test-app-settings.json --query "[].name" -o tsv
rm test-app-settings.json
```

What each value does on the test platform:

| Setting | Test value | Why |
|---|---|---|
| `DATABASE_URL` | the test server, database `caliber_mis` | The only database the test app can reach. Live uses a Key Vault reference; the test copy keeps a plain app setting (encrypted at rest by App Service). |
| `PUBLIC_APP_URL` | the test address | Links in messages and pages point at the test site. Change it in section 9 if you add `pulse-test.cmll.in`. |
| `PORT` | `8080` | Same as live. |
| `DISABLE_SCHEDULED_JOBS` | `true` | No report schedules, reminders, WhatsApp runs, backups or audit exports from the test copy. `/api/health` must show `scheduledJobsEnabled: false`; the test workflow fails the release otherwise. |
| `META_WHATSAPP_DELIVERY_PAUSED` | `true` | WhatsApp paused. The switch saved in Report settings overrides this one, so section 8 also switches it off inside the restored copy. |
| `TELEGRAM_DELIVERY_PAUSED` | `true` | The BDMS Telegram bot is paused even if a token were ever added. |
| `VLB_BATCH_ALERTS` | `0` | The late-batch Telegram worker and the weekly alias summary run outside the scheduled-jobs switch; this stops them. |
| `MIS_SSO_MODE` | `off` | Sign-in with Pulse hands back to pulse-ll.cmll.in by design, so it cannot serve a second address. The test site uses the Pulse-II sign-in form with passwords set in section 8. |
| `PULSE_WRITE_MODE` | `off` | Express transfers and new assets are recorded locally; nothing is written to Pulse. (`off` is also the default.) |
| `MIS_SCAN_BLOB_ENABLED` | `false` | Required (rule 3). New scan images are stored in the test database. Images that live keeps in Blob storage are not visible on the test platform. |
| `SCAN_DUPLICATE_*` | live defaults | The scan-duplicate flags, visible on `/api/health`. Turn a flag on here first when a go-live plan says "test platform first". |
| `MIS_ENVIRONMENT_LABEL` | `TEST` | Every page, including sign-in, carries the yellow bar "TEST PLATFORM: not the live site. Cards saved here do not reach the live log book." and the browser tab title starts with `[TEST]`, so an operator cannot mistake the test copy for live. Live leaves the setting unset: nothing is shown there and nothing else changes. Reported as `environmentLabel` on `/api/health` and `/api/app-version`. |

**Mirror from live** (names from section 2, values from the Azure portal, none of them secrets): general runtime settings such as `SCM_DO_BUILD_DURING_DEPLOYMENT`, `WEBSITE_NODE_DEFAULT_VERSION` or `SLOW_REQUEST_THRESHOLD_MS` if live has them, and the feature flags `VLB_TWO_STAGE_BATCHES`, `EQUIPMENT_ALIAS_OTP`, `VLB_PM_APPROVAL_TRIAL`, `MIS_GEMINI_HYBRID` with the live values, so the test copy behaves like live until a trial turns one on.

**Never copy to the test app** (secrets, or settings that would reach live systems): `DATABASE_URL` from live, `MIS_DATABASE_CONNECTION_MODE`, `MIS_SCAN_BLOB_ACCOUNT`, `MIS_SCAN_BLOB_CONTAINER`, `META_WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_BUSINESS_ACCOUNT_ID`, `FAST2SMS_WHATSAPP_API_KEY`, `WHATSAPP_PROVIDER`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_DEFAULT_CHAT_ID`, `TELEGRAM_BDMS_CHATBOT_ENABLED`, `TELEGRAM_BDMS_CHATBOT_PILOT_LOGINS`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `TICKET_EMAIL_TO`, `PULSE_INTEGRATION_URL`, `PULSE_INTEGRATION_TOKEN`, `GEMINI_API_KEY` and `MIS_GEMINI_API` (the workflow sets them from the optional test key), `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `QZ_SIGNING_CERTIFICATE`, `QZ_SIGNING_PRIVATE_KEY`, `TENDER_IDENTITY_KEY`, `ORACLE_DB_*`, `NEXUS_ERP_ORACLE_CONFIG`, `BDMS_AUDIT_*`, `CDIR_ROSTER_IMPORT_BROTLI_BASE64`, `MIS_INTEGRATION_KEY_FILE`. Without the mail settings `/api/health` shows `oemEmailSchedule.mailConfigured: false`; without a Telegram token the Telegram pages show "not set up". That is the intended state.

## 6. Test deployment identity and GitHub secrets (10 minutes)

Cloud Shell. The new identity can deploy to, and change settings of, apps in `caliber-mis-test-rg` only.

```bash
TEST_APP_ID=$(az ad app create --display-name github-caliber-mis-test --query appId -o tsv)
TEST_APP_OBJECT_ID=$(az ad app show --id "$TEST_APP_ID" --query id -o tsv)
TEST_SP_OBJECT_ID=$(az ad sp create --id "$TEST_APP_ID" --query id -o tsv)
az role assignment create --assignee-object-id "$TEST_SP_OBJECT_ID" --assignee-principal-type ServicePrincipal \
  --role "Website Contributor" --scope "/subscriptions/$SUB/resourceGroups/$RG"
```

```bash
cat > test-environment-credential.json <<'EOF'
{
  "name": "github-test-environment",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:caliberaitech783-beep/caliber-mis:environment:test",
  "description": "Pulse-II test platform releases from main",
  "audiences": ["api://AzureADTokenExchange"]
}
EOF
az ad app federated-credential create --id "$TEST_APP_OBJECT_ID" --parameters test-environment-credential.json
echo "AZURE_TEST_CLIENT_ID=$TEST_APP_ID"
echo "AZURE_TEST_TENANT_ID=$(az account show --query tenantId -o tsv)"
echo "AZURE_TEST_SUBSCRIPTION_ID=$SUB"
```

The subject names the GitHub environment `test`, which the test workflow references; GitHub creates that environment on the first run. Give it no protection rules.

Laptop: store the three values as repository secrets (they are identifiers, not passwords, but the workflow reads them as secrets like the live ones):

```bash
gh secret set AZURE_TEST_CLIENT_ID --repo caliberaitech783-beep/caliber-mis --body "<AZURE_TEST_CLIENT_ID printed above>"
```

```bash
gh secret set AZURE_TEST_TENANT_ID --repo caliberaitech783-beep/caliber-mis --body "<AZURE_TEST_TENANT_ID printed above>"
```

```bash
gh secret set AZURE_TEST_SUBSCRIPTION_ID --repo caliberaitech783-beep/caliber-mis --body "58ca09cf-ab5d-47a8-a438-e1fb2a40d030"
```

Optional, only if the test platform should run central Gemini extraction: create a **separate** Gemini API key for it in Google AI Studio (never reuse the live key) and store it; the workflow configures the test app with it on every release. Without this secret the step is skipped.

```bash
gh secret set MIS_TEST_GEMINI_API_KEY --repo caliberaitech783-beep/caliber-mis
```

Only if you departed from the default names in section 0:

```bash
gh variable set PULSE_TEST_WEBAPP_NAME --repo caliberaitech783-beep/caliber-mis --body "<web app name>"
```

```bash
gh variable set PULSE_TEST_RESOURCE_GROUP --repo caliberaitech783-beep/caliber-mis --body "<resource group>"
```

Cost: nothing.

## 7. First release to the test platform (20 minutes)

Merge the pull request (its `build` and `logbook-layout` checks must be green). The merge starts **Build, test and deploy to the Pulse-II test platform**. To start it by hand later:

```bash
gh workflow run "Build, test and deploy to the Pulse-II test platform" --repo caliberaitech783-beep/caliber-mis --ref main
```

```bash
gh run list --repo caliberaitech783-beep/caliber-mis --workflow "Build, test and deploy to the Pulse-II test platform" --limit 1
```

The run takes about 13 minutes. Its last step waits up to five minutes for `/api/health` on the test address to report the released commit **and** `scheduledJobsEnabled: false`, then runs the served-JavaScript check against the test address. On this first start the app creates the complete schema in the empty test database. If it stays red, watch the app:

```bash
az webapp log tail --name "$APP" --resource-group "$RG"
```

The run also appears under the repository's **Environments → test** with the test address.

## 8. Copy the live data into the test copy (30 minutes plus restore time)

### 8.1 Export a backup from live

On the live site, as Super Admin: **Full Backup → Export Backup**. Save `bdms-data-<stamp>.ndjson.gz` on an encrypted company drive. (Alternative, from a machine that can reach the live database server: `node scripts/backup-database.mjs --database-url "<live connection string>"` writes the same format into `backups/`; it needs live credentials on that machine, so prefer the Admin page.) The archive contains operational data, password hashes and stored integration credentials; never mail it or leave it on a shared drive.

### 8.2 Restore into the test database

Laptop, repository folder. The test app has run once (section 7), so the tables exist. Keep the connection string in a variable, not in the command history:

```powershell
$env:TEST_DATABASE_URL = "postgresql://caliber_test_admin:<PG_PASSWORD>@caliber-mis-test-pg-783.postgres.database.azure.com:5432/caliber_mis"
```

```powershell
node scripts/restore-database.mjs --input "C:\path\to\bdms-data-<stamp>.ndjson.gz" --database-url $env:TEST_DATABASE_URL --yes
```

The restore empties and refills every table of the backup inside one transaction and rolls back on any mismatch. A warning about tables missing in the target is expected when the backup comes from a newer build than the test app runs; they are created at the next start.

### 8.3 Prepare the copy: remove live credentials, queued messages and sessions; set a test password

A live backup carries the MIS Telegram bot and Pulse connection secrets (encrypted with the live server's key, so unreadable here but still unwanted), queued Telegram messages, the WhatsApp provider token and the stored WhatsApp delivery switch, and every live sign-in session. `scripts/prepare-test-platform-database.mjs` removes all of them in one transaction and refuses to run against `coalmine-fleet-pg-783`. Because synced users carry random MIS passwords and the test site signs in without Pulse, give your own account a test password at the same time:

```powershell
$env:TEST_LOGIN_PASSWORD = "<a test password, at least 8 characters>"
```

```powershell
node scripts/prepare-test-platform-database.mjs --database-url $env:TEST_DATABASE_URL --yes --login <your Login name from Users & employees>
```

```powershell
Remove-Item Env:TEST_LOGIN_PASSWORD
```

The script prints each table it emptied and why. Run it again after every restore.

### 8.4 Restart the test app

```bash
az webapp restart --name "$APP" --resource-group "$RG"
```

Wait two to four minutes, then open `https://<test address>/api/health`: `status: ok`, `database: connected`, `scheduledJobsEnabled: false`, `hotScanStorage.enabled: false`, `oemEmailSchedule.mailConfigured: false`, and `commit` equal to the last test release.

### 8.5 Sign in and give testers passwords

Open the test address. It shows the Pulse-II sign-in form (not Sign in with Pulse). Sign in with your Login name and the test password, open **Users & employees** and set a password for each tester (the set-password control on the user record). Password-reset OTPs do not work on the test platform, which has no WhatsApp or Telegram; set passwords here instead. Tell testers the address is the **test** site: the page looks exactly like live.

## 9. Optional: pulse-test.cmll.in (15 minutes plus DNS propagation)

Without this step the test platform is reachable at the `azurewebsites.net` address from section 3, with a valid certificate, and nothing else is needed. A custom name is easier to tell operators apart from pulse-ll.cmll.in.

```bash
az webapp show --name "$APP" --resource-group "$RG" --query "{address:defaultHostName,verificationId:customDomainVerificationId}" -o table
```

At Hostinger (DNS for cmll.in), add two records, as for `pulse-ll` in `azure-resources.json`:

| Type | Name | Value |
|---|---|---|
| CNAME | `pulse-test` | the `address` printed above |
| TXT | `asuid.pulse-test` | the `verificationId` printed above |

When `nslookup pulse-test.cmll.in` resolves, bind the name and a free managed certificate:

```bash
az webapp config hostname add --webapp-name "$APP" --resource-group "$RG" --hostname pulse-test.cmll.in
```

```bash
az webapp config ssl create --name "$APP" --resource-group "$RG" --hostname pulse-test.cmll.in
```

```bash
THUMB=$(az webapp config ssl list --resource-group "$RG" --query "[?subjectName=='pulse-test.cmll.in'].thumbprint | [0]" -o tsv)
az webapp config ssl bind --name "$APP" --resource-group "$RG" --certificate-thumbprint "$THUMB" --ssl-type SNI
```

```bash
az webapp config appsettings set --name "$APP" --resource-group "$RG" --settings PUBLIC_APP_URL=https://pulse-test.cmll.in --query "[].name" -o tsv
```

Laptop, so the workflow verifies the custom address from now on:

```bash
gh variable set PULSE_TEST_URL --repo caliberaitech783-beep/caliber-mis --body "https://pulse-test.cmll.in"
```

Cost: the managed certificate and the DNS records are free.

## 10. Checks before the team uses it (15 minutes)

1. `https://<test address>/api/health`: `commit` equals the commit of the latest run of the test workflow; `scheduledJobsEnabled: false`; `hotScanStorage.enabled: false`; `oemEmailSchedule.mailConfigured: false`; `environmentLabel: "TEST"`.
2. Telegram Integration page on the test site: not set up (no bot). Report settings: WhatsApp delivery off.
3. The ten-minute release smoke test from `docs/release-safety-plan-2026-11-02.md`, section 4 rule 3, on the test site: upload one real PDF, open the equipment review dialog, press F5, confirm the same entry, cards and card reopen, check `/api/health` and `GET /api/client-errors`.
4. Nothing arrived on live Telegram or WhatsApp while you did this. If anything did, stop the test app (`az webapp stop --name "$APP" --resource-group "$RG"`) and re-run section 8.3.
5. Merge one small change to `main` and watch it reach the test site only: `/api/health` on pulse-ll.cmll.in keeps its previous `commit`.
6. The yellow "TEST PLATFORM: not the live site" bar is visible on the sign-in page and on every page after sign-in, also on a phone, and the browser tab title starts with `[TEST]`. If it is missing, `MIS_ENVIRONMENT_LABEL` was not set in section 5. On pulse-ll.cmll.in there is no bar.

## 11. Costs and switching off

Approximate pay-as-you-go list prices for Central India, before taxes; confirm in the Azure pricing calculator before creating. The resource group is the unit of cost: everything in it can be deleted and recreated from this runbook in about an hour.

| Item | Approximate cost | Note |
|---|---|---|
| App Service plan `asp-caliber-mis-test`, B2 Linux | about US$30 per month | B1 about US$13 but too small for the OCR model; P0v3 about US$60, P1v3 about US$120 if parity with a Premium live plan is wanted. Billed while the plan exists, even when the app is stopped. |
| PostgreSQL Flexible Server B1ms, 32 GB, 7-day backups | about US$15 to US$20 per month | Billed while the server exists; `az postgres flexible-server stop` pauses compute for up to seven days. |
| Entra app registration, federated credentials, role assignment | free | |
| GitHub environments, secrets, Actions minutes | free | Public repository. |
| Managed certificate, DNS records | free | |
| Data transfer | negligible | A full restore moves a few hundred megabytes. |

Total: about US$45 to US$50 per month while the test platform exists.

Pause between trials (keeps the data, keeps most of the cost of the plan):

```bash
az webapp stop --name "$APP" --resource-group "$RG"
az postgres flexible-server stop --name "$PG" --resource-group "$RG"
```

Remove everything when a trial is over (irreversible; restore from a fresh live backup next time):

```bash
az group delete --name "$RG" --yes --no-wait
```

The GitHub secrets, variables, environment `test` and the identity `github-caliber-mis-test` can stay; they cost nothing and are harmless without the resource group. Deleting the group does not touch `coalmine-fleet-maintenance-rg`.

## 12. What this runbook never touches

- **Production app settings.** No command names `caliber-mis-783` except the read-only `show` and `list` commands in section 2, which print names and runtime facts, never values. The test workflow refuses to deploy to `caliber-mis-783` or to verify `pulse-ll.cmll.in` even if a repository variable says so.
- **The production database.** `coalmine-fleet-pg-783` appears only in the read-only `list` in section 2. The restore target is always the test server; `scripts/prepare-test-platform-database.mjs` refuses the live server by name. The live database is read only through the Admin page export.
- **Production secrets.** None is copied. The test identity holds a role in `caliber-mis-test-rg` only. The live identity gets one additional sign-in rule (section 1.2) and nothing else.
- **Operators' phones and chats.** No Telegram, WhatsApp or mail credential exists on the test app; the stored ones are removed from the copy; scheduled jobs, the late-batch worker and WhatsApp delivery are switched off and `/api/health` proves it on every release.
- **Pulse.** The test copy cannot read Pulse masters (its stored connection is removed) and never writes to Pulse (`PULSE_WRITE_MODE=off`). Masters on the test platform are those of the backup.

## 13. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Test workflow fails at *Login to Azure* with `AADSTS70021: No matching federated identity record found` | The federated credential subject does not match. It must be exactly `repo:caliberaitech783-beep/caliber-mis:environment:test` (section 6). |
| Production workflow fails at *Confirm the production environment still requires a reviewer* | Section 1.1 was not done or the rule was removed. Add the required reviewer and start the release again. |
| Production workflow fails at *Login to Azure* with `AADSTS70021` | Section 1.2 was not done: the live identity lacks the `environment:production` credential. |
| Production run is refused with *not allowed to deploy to production due to environment protection rules* | The ref is not a `release-*` tag or `main`. Tag the commit as in `docs/release-safety-plan-2026-11-02.md`, section 6. |
| *Commit … is not on main* | The tag points at a commit that never reached `main` (so the test platform never served it). Tag the commit shown by `/api/health` on the test site instead. |
| App log: `Shared MIS administration requires the approved Azure database server` | `MIS_DATABASE_CONNECTION_MODE` was copied. Delete that setting on the test app (rule 2). |
| App log: `MIS must connect only to the caliber_mis database` | The database in `DATABASE_URL` is not named `caliber_mis` (rule 1). |
| App log: `Scan Blob storage is limited to Pulse-II` | `MIS_SCAN_BLOB_ENABLED` is `true` on the test app (rule 3). |
| `/api/health` is 503 `degraded` | `DATABASE_URL` wrong, or the firewall rule for Azure services is missing (section 4). `az postgres flexible-server firewall-rule list --resource-group "$RG" --name "$PG" -o table` must show the `0.0.0.0` rule. |
| Restore prints *Tables missing in the target database were skipped* | Normal if the backup is newer than the deployed build. Release to the test platform, then restore again if those tables matter. |
| Restore cannot connect from the laptop | The laptop's public address changed; update the `owner-laptop` firewall rule (section 4). |
| Nobody can sign in on the test site | Synced users have random MIS passwords. Run section 8.3 with `--login` for your account, then set passwords for testers in Users & employees. |
| Telegram Integration page shows "temporarily unavailable" | Section 8.3 was not run after a restore; the stored bot secret cannot be decrypted on the test app. Run it and restart. |
| A test release shows up on live, or vice versa | Impossible by construction (separate identities, separate concurrency groups, hard-coded refusals), so first confirm which `/api/health` you are reading. |

## 14. Record the result

1. Replace the `testPlatform` block in `azure-resources.json` with the final names and address (status `configured`).
2. Add the test address and the rule "main is the test platform; a `release-*` tag plus approval is live" to the team's pinned WhatsApp message.
3. Keep the password manager entries: *Pulse-II test database* and, if created, *Pulse-II test Gemini key*.
4. Every future "test platform first" go-live plan (`docs/vlb-elb-batch.md` section 10, `docs/scan-duplicate-go-live-plan-2026-11-02.md`) now has a platform to run on: turn the flag on in the test app's settings (section 5), restore a fresh backup when real recent data matters, and follow `docs/release-safety-plan-2026-11-02.md` section 6 to release.


---

## docs/scan-duplicate-go-live-plan-2026-11-02.md

# Scan duplicates: go-live plan

Date: 2 November 2026. Branch: `fix/vlb-entry-r4`. Platform: Caliber Pulse-II (MIS), Trip Cards · Scan & Review (VLB) and ELB.

## 1. The rule going live

A card is a **duplicate** when the same physical card, for the same card date, site and shift, already exists in any scan entry or saved log book that is not rejected.

- Duplicates are detected **at upload**, before the reader runs, by comparing how the page looks (visual fingerprint), with the exact byte hash kept as a fast first check.
- Duplicates are **never read, never counted, never saved**. They are listed in a Duplicates tile with the original named, and can be restored with one click if the operator disagrees.
- A card the fingerprint cannot decide on is read normally and then checked by **content** (date, door, A-form / job card number) across every entry for that date, site and shift and against saved log books.
- A card is **never dropped silently**. Every system decision is visible on the card status board and reversible.

Worked example: entry B01 holds 40 cards for Majri OB, 01-11-2026, shift I. The operator scans 42 cards again, 40 of them the same paper. Result: "42 cards scanned. 40 duplicates of entry B01 skipped. 2 new cards queued for reading." The Duplicates tile lists the 40 with their original card numbers. Only 2 cards are read.

## 2. Why the current system does not do this

| Check today | Compares | Scope | Gap |
|---|---|---|---|
| Upload (bulk-card-scanning.mjs, POST cards) | SHA-256 of image bytes | All entries | A rescan is never byte-identical, so it passes |
| After reading (checkScanCard) | date + door + card number | Same entry only | Repeats across entries B01 / B02 are invisible |
| At save (log-book.mjs) | date + door + card number against saved records; one manual card per tipper per shift | Saved records only | Fires only once the original is saved, after the repeat was already read |
| Operational date filter (operational-start.mjs) | reader's header date before the entry date | All queries | A misread date hid the card from every check; fixed in this branch, prerequisite for everything below |

## 3. Work items

### Item A. Operational date filter uses the scan-entry date (done, uncommitted)

File: `operational-start.mjs`, test `test/operational-start.test.mjs`.
Order is now: saved log-book date, then scan-entry date, then reader date, then upload date. A misread header shows as a Mismatch card inside its entry instead of vanishing. Regression test covers listing, batch count, mismatch flag and duplicate detection of such a card.

### Item B. Visual fingerprint on every card

New module `scan-fingerprint.mjs`.

1. Decode the uploaded PNG / JPEG / WebP with `@napi-rs/canvas` (already used by `gemini-card-images.mjs`), after the same orientation step the reader uses, so a card fed the other way still matches.
2. Convert to grayscale and compute a difference hash for four fixed regions of the card layout, defined per card type (VLB trip card, ELB job card): header block (date, door, driver, card number), trip grid, machine-wise summary, meter block. Each region: 17 x 16 grid, 256 bits. Whole-page hash is also stored for diagnostics.
3. Store on `mis_scan_cards` as `fingerprint JSONB` (region name to hex string) with a GIN-free plain column and an index on `(batch_id)`; comparison is done in Node over the candidate set, which is small (same date, site, shift).
4. Backfill: a one-off job computes fingerprints for all cards created on or after 1 November 2026, so existing entries (B01) can be matched against. Runs on deploy, idempotent, logged.

Accuracy work before any skipping is enabled:

- Run the hash over every card already in the database. Record the distance between known rescans (same card number, door and date in two entries) and between genuinely different cards for the same shift.
- Pick two thresholds with a clear margin: **skip** (every region within T1 bits) and **suspect** (any region within T2 bits). Starting values T1 = 8, T2 = 20 of 256, to be replaced by measured values. The thresholds live in one place (`scan-fingerprint.mjs`) and are reported in the health endpoint.

### Item C. Duplicate decision at upload

File: `bulk-card-scanning.mjs`, POST `/api/scan-batches/:id/cards`.

Inside the existing transaction, after the byte-hash check:

1. Load candidate cards: non-rejected cards in every entry whose `expected_context` has the same `bookDate`, `location` and `cardShift`, plus cards already posted whose log book is not deleted.
2. Compare fingerprints. Outcomes:
   - **Exact bytes match** (today's path): skipped, `duplicateSkipped:true`, original named. Unchanged.
   - **All regions within T1**: card row is inserted with `status='rejected'`, `review_note='Duplicate of card <ordinal> in entry <name>'`, `duplicate_of=<card id>`. It is not queued for reading. Response: `{duplicateSkipped:true, original:{cardId,batchId,ordinal,bookNo}}` so the client counts it the same way.
   - **Any region within T2** but not all within T1: inserted normally, queued for reading, with `raw_fields.duplicateSuspect={cardId,batchId,ordinal,distance}`.
   - Otherwise: new card, unchanged path.
3. Advisory locks already serialise same-hash uploads; the same lock key is extended to the fingerprint candidate set (lock on date+site+shift) so two concurrent uploads of the same paper cannot both pass.

### Item D. Content check after reading, across entries

File: `bulk-card-scanning.mjs`, `checkScanCard`, and the extraction completion path in `scan-extraction-queue.mjs`.

1. When reading completes, compare date + door (asset id) + card number against non-rejected cards in **every entry** for the same date, site and shift, and against saved log books (existing query, scope widened).
2. If a match is found **and** the card number and door were read with no review flag: auto-reject with `review_note='Duplicate of card <ordinal> in entry <name>'` and `duplicate_of`. Also covers a card that was only a fingerprint suspect.
3. If a match is found but the card number or door is unreadable or flagged for review: keep the card in Needs attention with the error "Possible duplicate of card 7 in entry B01. Confirm the card number and door." Nothing is rejected on uncertain data.
4. The existing same-entry sibling message and the "Card already exists in book no" message remain for anything that reaches save.

### Item E. Duplicates tile and restore

Files: `scan-card-groups.mjs`, `src/bulk-card-scanning.jsx`, GET `/api/scan-batches/:id`.

1. GET returns duplicate cards (today they are filtered out by `review_note`) with `duplicate_of` resolved to `{entryName, ordinal, bookNo, cardId}` and a thumbnail URL for the original.
2. New tile **Duplicates** on the Card status board: "Same card already in another entry · skipped". Count shown as `n/total`; duplicates are excluded from All cards, Review and the batch list counts so the operator's working numbers do not change.
3. Card view for a duplicate shows both images side by side (this scan, original) and a button **Not a duplicate, read this card**. Restore sets `status='queued'`, clears `duplicate_of` and `review_note`, records who restored it in `checked_by`, and queues reading. Restore is audited.
4. Upload notice: "42 cards scanned. 40 duplicates of entry B01 skipped. 2 new cards queued for reading." The notice also names other entries when duplicates come from more than one.
5. The "Checking card headers…" state no longer shows for an entry with no readable cards; it shows "No new cards in this entry" with a link to the entry that holds the originals.

### Item F. Telegram late-batch and batch report

Files: `vlb-batch-alerts.mjs`, `scan-batch-report` modules.
Duplicate cards are excluded from card totals in the batch report and in Telegram batch alerts. The report gains a one-line "Duplicates skipped: n (entries B01, B02)" footer so the count is auditable.

### Item G. Tests (all must pass before deploy)

PostgreSQL-backed (`embedded-postgres`) and PGlite tests:

1. Same 40-card file uploaded twice: 40 skipped by byte hash, 0 read.
2. Rescan fixture: 40 cards re-rendered with 2 px shift, +4% brightness and noise: 40 skipped by fingerprint, 2 new cards read.
3. Rescan at the suspect threshold: card read, then auto-rejected by content check with the original named.
4. Repeat with unreadable card number: held in Needs attention with "Possible duplicate", not rejected.
5. Repeat of a saved card (original posted): skipped, original shows the book number.
6. Two genuinely different cards for the same shift with similar writing density: both kept (uses real anonymised scans from the measured set).
7. Restore: duplicate restored, read, saved; audit row written.
8. Concurrency: the same paper uploaded from two browsers at once yields one card and one duplicate.
9. Misread header date inside a 1 November entry stays listed and counts as a duplicate on rescan (done).
10. Notice text and tile counts in the React component tests.

## 4. Rollout

| Step | Action | Owner | Check |
|---|---|---|---|
| 1 | Merge Item A now (small, safe) and deploy | Dev | Open B01 for Majri OB 01-11 shift I: the two hidden cards appear under Mismatch cards |
| 2 | Build Items B to G on `feature/scan-duplicates`; flag `SCAN_DUPLICATE_FINGERPRINT` default off | Dev | CI green |
| 3 | Deploy with flag off; backfill fingerprints; export distance report | Dev | Report shows clear gap between rescans and different cards |
| 4 | Set thresholds from the report; enable flag on the test platform; operator rescans one real batch | Dev + Anoop | 40 skipped, new cards read, nothing genuine skipped |
| 5 | Enable on production for VLB, then ELB after one full shift without a false skip | Dev + PM | Duplicates tile counts match the paper count |
| 6 | Remove flag after seven clean days | Dev | — |

Rollback: turn the flag off. Cards already marked duplicate stay visible in the Duplicates tile and can be restored; no data is deleted at any step.

## 5. What this does not cover

- A second card written out by hand for the same tipper and shift is not a rescan. It is caught only by the content check (same date, door and card number) or by the one-manual-card-per-tipper-per-shift rule at save.
- Cards for a different date, site or shift than the entry are Mismatch cards, handled by the existing header check, not by this plan.

## 6. Build status (2 November 2026, branch feature/scan-duplicates)

| Item | Status | Where |
|---|---|---|
| A. Date filter uses the scan-entry date | Done, committed on fix/vlb-entry-r4 | operational-start.mjs |
| B. Visual fingerprint | Done. Method changed from the planned difference hash to ink-overlap on a 64-column grid with coarse-to-fine alignment, because the hash flipped on mostly-white paper. Synthetic rescans score 8 or less, different cards 33 or more (skip 15, suspect 30). Backfill runs on server start. | scan-fingerprint.mjs, scan-duplicates.mjs |
| C. Duplicate decision at upload | Done. Exact bytes always; fingerprint only with SCAN_DUPLICATE_FINGERPRINT=true. Duplicates stored as rejected rows with duplicate_of, never queued, not counted for entry space. | bulk-card-scanning.mjs POST cards |
| D. Content check across entries | Done. Certain identity auto-rejected after reading; uncertain held with "Possible duplicate of card N in entry …". | scan-duplicates.mjs, checkScanCard |
| E. Duplicates tile, restore, notice | Done. Tile on the card status board, side-by-side scans, "Not a duplicate, read this card", POST /api/scan-cards/:id/restore-duplicate. | src/scan-duplicate-list.jsx, src/bulk-card-scanning.jsx |
| F. Reports | Done for the batch report footer and batch list counts. Telegram alerts count VLB batch records, not scan rows, so no change was needed. | src/scan-batch-report.jsx |
| G. Tests | 7 new tests across scan-fingerprint.test.mjs and scan-duplicates.test.mjs; the concurrency case (8) could not be written because the test database stubs advisory locks. Covered by the same date/site/shift advisory lock in code; verify on the test platform. | test/ |
| Measurement | scripts/scan-fingerprint-report.mjs prints same-card versus different-card distances per context. Run before step 4 of the rollout. | scripts/ |



## Inherited README

# Caliber MIS

This checkout is **caliber-mis-new**. The active React/Vite entry is `index.html` → `src/main.jsx` → `src/app/App.jsx`. See [Frontend structure](docs/frontend-architecture.md) for folder responsibilities and [Screen coverage](docs/FRONTEND-COVERAGE.md) for inspection limitations.

Use `npm run local:preview` and open `http://127.0.0.1:4176/preview.html` for the isolated synthetic preview. This repository has validation CI only; it has no configured deployment target. Deployment and authentication notes below are inherited reference material, not instructions to deploy this repository.

## Inherited application notes


MIS opens at an explicit sign-in page on every new page load. Sign in with Pulse opens Pulse's existing username-and-password form using `login=1`, including when Pulse is already signed in. After successful authentication, Pulse returns to the empty MIS workspace. MIS does not restore saved browser sessions or automatically start sign-in. The authenticated home contains only a Caliber MIS heading, sign-out control and blank workspace for future features. `index.html` loads `src/mis-entry.jsx`; the inherited Pulse dashboard, menus and background services are not mounted. The separate MIS database remains in place.

The canonical MIS address is `https://pulse-ll.cmll.in`. The previous `pulseii.cmll.in` DNS/certificate binding remains available and forwards browser pages and sign-in callbacks to the canonical address. Existing health/version endpoints remain directly readable on the old hostname.

Pulse's existing authentication service retains its registered `pulseii.cmll.in` callback. MIS forwards that callback to `pulse-ll.cmll.in` with its single-use code/state intact; the host-only sign-in cookie is checked on the new domain. This avoids changing Pulse's authentication backend when renaming MIS.

Independent MIS application based on the existing local Pulse-II MIS workspace: React, Vite, Node.js, Express and PostgreSQL. The entry flow is Pulse → MIS in a new tab at https://pulse-ll.cmll.in → MIS dashboard using shared sign-in. `mis-shared-signin.mjs` implements the authorization-code handoff with S256 PKCE, browser-bound state, short-lived single-use codes and separate MIS sessions. End-to-end production sign-in still requires deployment and private user verification.

## Database isolation

Azure database `caliber_mis` exists on server `coalmine-fleet-pg-783`. It is a separate logical database on shared server infrastructure. Azure connections validate TLS certificates. The owner explicitly approved reusing the existing Pulse database administrator connection on 21 October 2026. In App Service, reuse its existing Key Vault reference and set `MIS_DATABASE_CONNECTION_MODE=shared-admin`; this mode accepts only the approved Azure server, removes connection URL overrides and forces the actual connection to `caliber_mis`, regardless of the source URL's database name. This shares administrator authority across the server; it does not provide the isolation of a restricted database role. No Pulse password is reset.

No Pulse business records, password hashes or local database files are copied. The application creates its own schema on startup. MIS accepts identities authorized by Pulse (MIS User, MIS Manager or eligible administrators), without requiring a separate MIS user password. Pulse sign-out invalidates the linked MIS session on its next authenticated request. HR, Account and Tender identities are excluded. Scheduled background jobs default to disabled.

## Build and run

Use Node.js 22. Run `npm ci`, `npm run build`, then `npm start`. Configure environment settings from `.env.example` through Azure App Service; never commit credentials. Local development also requires a PostgreSQL database named `caliber_mis`.

## Deployment status

Release path since 2 November 2026: a merge to `main` is built, tested and deployed to the **test platform** (`.github/workflows/main_caliber-mis-test.yml`); production `caliber-mis-783` is deployed only from a `release-YYYY-MM-DD-N` tag, or a manual run, after the owner approves the run in the GitHub environment `production` (`.github/workflows/main_caliber-mis-783.yml`). Creating the test platform: `docs/test-platform-setup.md`. Releasing: `docs/release-safety-plan-2026-11-02.md`, section 6.

Azure Web App `caliber-mis-783` uses the existing `ASP-coalminefleetmaintenancerg-b234` Linux plan in Central India and subscription `58ca09cf-ab5d-47a8-a438-e1fb2a40d030`. Its runtime is Node.js 22; `npm start` launches `server.mjs`, which reads `PORT` (configure 8080). No new hosting plan was created. GitHub Actions with Azure OIDC deployed commit `93f20810bd636b51ac77a740da392e3899b22425` successfully in [run 39557861853](https://github.com/caliberaitech783-beep/caliber-mis/actions/runs/39557861853). Deployment success does not establish application health.

DNS and HTTPS for `pulse-ll.cmll.in` were configured and verified on 21 October 2026, using an App Service Managed Certificate and SNI SSL. `PUBLIC_APP_URL=https://pulse-ll.cmll.in`, `DISABLE_SCHEDULED_JOBS=true`, `META_WHATSAPP_DELIVERY_PAUSED=true`, `PORT=8080`, Node 22 and `npm start` are configured. Database schema and production shared sign-in require runtime verification after the connection is available. The MIS app needs its own managed identity, access to the existing database secret and the existing private application subnet. Do not copy unrelated Pulse integrations or settings. HR deployment is outside this application's deployment scope.

Verify `/`, `/api/app-version` and `/api/health` over HTTPS after configuration. The deployment workflow writes `DEPLOYMENT_SHA` into its artifact so health responses can identify the deployed commit. Verify database migrations separately before treating a database connectivity response as proof of complete initialization.

The Pulse login MIS button is reported to target https://pulse-ll.cmll.in in a new tab. Verify the end-to-end shared login flow before declaring the entry ready.

Pulse must deploy the matching shared-sign-in module and set `MIS_SSO_MODE=issuer`. MIS defaults to client mode. For isolated local development only, `MIS_SSO_MODE=off` retains local user authentication. The alternative restricted-role provisioning script remains available if the owner later chooses separate database credentials.

## Shared Pulse credentials

MIS uses the employee's existing Pulse username and password. The MIS tile opens
Pulse's MIS sign-in form, then completes a state/PKCE-bound one-time-code handoff.
No second password is collected. Users & employees > MIS controls access and
per-device menu permissions. The backend retains the central grant and validates
current permissions, password version, central session revocation and seven-day
expiry on requests. Deploy the matching Pulse identity endpoints first.


## Local PaddleOCR scan drafts

Start the Windows local MIS backend and UI with `PADDLEOCR_PYTHON` pointing to the installed PaddleOCR Python environment. In online MIS, open VLB scanning and choose **Connect PC scanner**. The connector can capture paper, read the Desktop scan folder, or read selected PDFs and photos. It waits for local extraction, then transfers each original image and its bounded OCR evidence to the online review queue. No cloud AI API key is required for this path.

The server validates the image hash, dimensions and OCR geometry, then maps fields against online masters. It accepts OCR evidence, never a pre-approved client draft. Unknown dates, readings and trip cells remain blank or flagged. Correct and save the draft, compare the entire original scan, approve the card, then explicitly save the approved batch to the log book. The scanner token cannot approve or post records. Direct browser uploads retain the existing server OCR path; use the PC connector to use local PaddleOCR.
