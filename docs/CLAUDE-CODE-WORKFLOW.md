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
