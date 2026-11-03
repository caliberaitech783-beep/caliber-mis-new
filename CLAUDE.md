<!-- Active target: D:\caliber-mis-new; origin: caliberaitech783-beep/caliber-mis-new. Do not modify D:\caliber-mis. Commit and push only when requested by the user. Deployment requires separate authorization. -->

# Caliber MIS New / Pulse-II — project instructions

Read `README.md` and `docs/development.md` before changing this project. Operational details are consolidated in `docs/operations.md`; dated notes in `docs/archive.md` are reference only. Current code, tests and user instructions take priority.

## Project
- Repository: https://github.com/caliberaitech783-beep/caliber-mis-new
- Branch: `main`. Only validation CI is active in this repository; deployment workflows are archived under `docs/reference-workflows/*.disabled`.
- Reference website: https://pulse-ll.cmll.in (the separate original application).
- This repository has no authorized deployment target. Do not deploy to the original application.
- Actual UI entry: `index.html` -> `src/main.jsx` -> `src/app/App.jsx`. See `docs/development.md` for the current folder layout. Some older README/workflow notes describe obsolete entry points and deployment arrangements.
- React/Vite UI, Express backend (`server/app.mjs`, launched by `server.mjs`), PostgreSQL, scan/OCR integrations.
- Work from the repository root, not its `test` directory.

## Start every task
1. Read repository instructions and `git status --short`; preserve existing uncommitted work.
2. Fetch and inspect the current remote branch before relying on this handoff. Do not reset or overwrite a dirty checkout.
3. Trace the relevant UI, API, data validation, persistence, and existing tests.
4. State the behavior being changed and verify the result with appropriate tests.

Use a separate clone when another coding tool is using this checkout. Use `codex/` branches unless the user requests otherwise. Never silently revert another tool's changes.

## Product and data rules
- Use stable equipment IDs for selections. Do not let OCR guesses overwrite an explicit master selection.
- Preserve site permissions, batch links, revision checks, audit history, numbering, and duplicate prevention.
- VLB records use `vehicle`; ELB records use `equipment` in relevant storage paths. Verify schema before using those predicates.
- Fleet/site mismatches must be held for review with manual deletion options; do not automatically delete them.
- Trip counts must be editable. Historical instructions freezing them were superseded.
- Current batch deletion/recovery behavior supersedes older record deletion guidance. Never delete data merely because the user asks for instructions.
- Do not fabricate scan values or relax validation just to make a card save.
- Do not print secrets, connection strings, login files, access tokens, or full Azure application settings. Never commit them.

## Current VLB entry rules
- Scan and manual batch entry autosave drafts only. Final posting is an explicit atomic batch action; never restore automatic card posting.
- Batch date/site/shift override card headers. Do not restore the Mismatch Cards UI.
- I/II/III: 8 HMR hours and 250 KMR km maximum; Day/Night: 12 hours and 300 km. Equal readings are valid; decreasing readings are not.
- Preserve first unloading-only and last loading-only handovers without synthesizing missing times or requiring a loader on the first unloading-only row.
- PM approval is mandatory for locked edits. Historical trials must not bypass approval.
- Update docs/operations.md for durable rules; do not put credentials or per-task Markdown reports into Git.

## Commands and validation
- Match CI: Node.js 22, `npm ci`, `npm run build`, `npm test`.
- Local isolated backend: `npm run local:backend`; UI in another terminal: `npm run local:ui`.
- Follow the workflow guide before starting local services; integrations may use existing local configuration.
- Use targeted tests during implementation, then the checks required by the current CI workflow.
- Database tests must use a disposable local/test database, never production.

## Repository and release rules
- Keep changes confined to caliber-mis-new; never modify caliber-mis.
- Preserve existing uncommitted work. Stage only intended files.
- Commit and push only when requested; use the identity requested in the session.
- This repository has validation CI only and no configured deployment target. Do not enable archived workflows or deploy to the original application.
- Report local, committed, pushed and live verification separately.
- Update existing development or operations guides when durable behavior changes; avoid separate per-task Markdown reports.
