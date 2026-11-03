<!-- Active target: D:\caliber-mis-new; origin: caliberaitech783-beep/caliber-mis-new. Do not modify D:\caliber-mis. Commit and push only when requested by the user. Deployment requires separate authorization. -->

# Caliber MIS New / Pulse-II — project instructions

Read `docs/CLAUDE-CODE-WORKFLOW.md` and `docs/IMPLEMENTATION-HANDOFF.md` before changing this project. They provide setup, deployment, architecture, and user decisions. They are dated context, not a substitute for inspecting current code, tests, and the latest user request.

## Project
- Repository: https://github.com/caliberaitech783-beep/caliber-mis-new
- Branch: `main`. Only validation CI is active in this repository; deployment workflows are archived under `docs/reference-workflows/*.disabled`.
- Reference website: https://pulse-ll.cmll.in (the separate original application).
- This repository has no authorized deployment target. Do not deploy to the original application.
- Actual UI entry: `index.html` -> `src/main.jsx`. Some older README/workflow notes describe obsolete entry points and deployment arrangements.
- React/Vite UI, Express backend (`server.mjs`), PostgreSQL, scan/OCR integrations.
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

## Commands and validation
- Match CI: Node.js 22, `npm ci`, `npm run build`, `npm test`.
- Local isolated backend: `npm run local:backend`; UI in another terminal: `npm run local:ui`.
- Follow the workflow guide before starting local services; integrations may use existing local configuration.
- Use targeted tests during implementation, then the checks required by the current CI workflow.
- Database tests must use a disposable local/test database, never production.

## Release rules
- Stage explicit intended files, not `git add .` in a dirty checkout.
- Only deploy when authorized. A `main` push is a production action.
- Use the checked-in GitHub Actions release workflow. Deploy the complete validated workspace; a dist-only package is insufficient for the server.
- Verify the intended release run, `/api/health`, and `/app-version.txt`. Compare their commit identity with the deployed commit, accounting for squash merges or subsequent releases.
- Report separately what is local, committed, pushed, and verified live. A successful build alone is not a deployment.
- Update the handoff when an implementation changes a durable product rule or release procedure.
