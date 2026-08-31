# Self-hosting with Docker Compose

This app is packaged as an Nginx frontend, an Express API, and a PostgreSQL database.
The database and uploaded source CSVs use named Docker volumes, so restarting or
rebuilding containers does not remove application data.

## Requirements

- Ubuntu 24.04
- Docker Engine with the Compose plugin
- A DNS name pointed at the server if you want HTTPS

## First start

```bash
cp .env.example .env
openssl rand -hex 32
# Put one generated value in POSTGRES_PASSWORD and another in SESSION_SECRET.
# Set ADMIN_EMAIL and ADMIN_PASSWORD to seed the first login account.
docker compose up -d --build
```

Open `http://SERVER_IP:8080` or the port set by `APP_PORT`.
If `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set, the API creates that account
after the database schema is ready. Seeding is idempotent: an existing account
is never overwritten. You can remove `ADMIN_PASSWORD` from `.env` after the
first successful start; keep `ADMIN_EMAIL` set so the app can identify the
administrator. The account and its password remain in the database.

Sign in with the administrator account and click **Users** in the viewer header
to create or delete login accounts and assign roles. Public self-registration
is disabled.

Roles are enforced by the API:

- **Administrator** — manage users and reports
- **Editor** — upload and delete reports
- **Viewer** — read-only access to the shared report archive

The API accepts request bodies up to 10 MB, including CSV uploads sent from the
viewer. Nginx is configured with the same limit for the Docker deployment.
Passwords are salted and hashed before they are stored; the browser receives
only an HTTP-only session cookie.

## AI-system report ingestion

The API also accepts direct report submissions from an AI system. Set
`REPORT_INGEST_API_KEY` in `.env` to a long random value, for example:

```bash
openssl rand -hex 32
```

The machine endpoint is:

```text
POST /api/reports/ingest
Authorization: Bearer REPORT_INGEST_API_KEY
Content-Type: application/json
```

Send the same JSON shape as the browser upload flow:

```json
{
  "name": "ai-generated-report-2026-08-30",
  "content": "ClipID,Air Dates,Host,Guests,...\n..."
}
```

Example:

```bash
curl -X POST "http://SERVER_IP:8080/api/reports/ingest" \
  -H "Authorization: Bearer $REPORT_INGEST_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @report-payload.json
```

The configured `ADMIN_EMAIL` account owns direct submissions in the archive.
The endpoint uses the same CSV parser, persistence transaction, original-file
storage, and 10 MB request limit as the manual upload. Keep the token private
and rotate it by replacing `REPORT_INGEST_API_KEY` and recreating the API
container. The browser upload option remains available at `POST /api/reports`.

## Updates and backups

```bash
docker compose pull
docker compose up -d --build
```

Back up both named volumes. The PostgreSQL volume contains accounts and parsed
clips; the uploads volume contains the original CSV files.

```bash
docker run --rm -v reair_postgres_data:/source -v "$PWD":/backup \
  alpine tar czf /backup/reair-postgres-data.tgz -C /source .
docker run --rm -v reair_report_uploads:/source -v "$PWD":/backup \
  alpine tar czf /backup/reair-report-uploads.tgz -C /source .
```

To stop the stack without deleting data:

```bash
docker compose down
```

Do not use `docker compose down -v` unless you intentionally want to erase
the database and all uploaded reports.

## HTTPS

For a public deployment, place this stack behind Caddy, Nginx Proxy Manager,
Traefik, or another TLS reverse proxy. Forward traffic to the `web` service
on the configured `APP_PORT`; do not expose PostgreSQL publicly.