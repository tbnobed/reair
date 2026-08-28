# Re-Air Report Viewer

Self-hosted report review desk for uploading, searching, and reviewing re-air CSV reports.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- `docker compose up -d --build` — build and run the self-hosted frontend, API, and PostgreSQL stack

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/reair-viewer/` — React + Vite frontend
- `artifacts/api-server/` — Express API, auth, CSV parsing, and report persistence
- `lib/db/src/schema/reair.ts` — PostgreSQL schema for users, sessions, reports, and clips
- `lib/api-spec/openapi.yaml` — API source of truth
- `Dockerfile`, `docker-compose.yml`, `docker/nginx.conf` — self-hosted deployment
- `DEPLOYMENT.md` — Ubuntu 24.04 setup, backup, and HTTPS guidance

## Architecture decisions

- Original CSV files are stored under `STORAGE_DIR` and parsed clip metadata is stored in PostgreSQL.
- Self-hosted email/password auth uses salted `scrypt` password hashes and HMAC-backed, database-persisted HTTP-only sessions.
- Docker Compose uses separate Nginx and API containers with PostgreSQL and uploaded reports on named volumes.
- Calendar-only report dates remain `YYYY-MM-DD` strings to avoid timezone drift in the browser.

## Product

- Seed the administrator account from `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then sign in with email/password.
- Upload, index, search, filter, sort, inspect, print, and delete re-air report CSVs.
- Review flagged moments, date-sensitive notes, people, air dates, and synopsis content.
- Persist account, report, and parsed clip data across container restarts.
- Preserve visual and interaction parity with the supplied original HTML viewer: dark rack-style workstation, compact header/filter bars, split clip list/detail pane, amber/cyan flag timeline, and IBM Plex typography.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Keep `POSTGRES_PASSWORD` and `SESSION_SECRET` in the deployment `.env`; do not commit `.env`.
- `docker compose down -v` deletes all report and account data.
- The Dockerfile pins pnpm 10.26.1 because newer pnpm versions can block the esbuild lifecycle script during image builds.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
