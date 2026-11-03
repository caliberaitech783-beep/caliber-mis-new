# Caliber MIS New

React/Vite frontend with an Express backend, PostgreSQL and scan/OCR integrations. Work in this repository only; the separate `caliber-mis` repository is outside its scope.

```text
src/         Frontend: pages, components, services, styles, hooks and utilities
server/      Backend app, routes, services and domain modules by feature
shared/      Browser-compatible rules and helpers shared across runtimes
scripts/     Build, verification and maintenance tools
test/        Regression tests and fixtures
docs/        Development, operations, screen coverage and historical reference
```

Use Node.js 22 and `npm ci`. Commands:

- `npm run build`: production frontend build.
- `npm test`: regression suite; integration tests need disposable test databases.
- `npm start`: backend via the stable root `server.mjs` entry.
- `npm run local:preview`: isolated synthetic preview at `http://127.0.0.1:4176/preview.html`.
- `npm run local:backend` and `npm run local:ui`: configured local development. Read the development guide before starting integrations.

[Development and architecture](docs/development.md) · [Operations](docs/operations.md) · [Screen coverage](docs/FRONTEND-COVERAGE.md) · [Historical reference](docs/archive.md)

Only validation CI is active. No deployment target is configured for this repository. Historical Azure workflows remain disabled under `docs/reference-workflows/`.
