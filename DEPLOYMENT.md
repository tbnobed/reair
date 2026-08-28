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
first successful start; the account and its password remain in the database.
Users must be created by an administrator; public self-registration is disabled.
Passwords are salted and hashed before they are stored; the browser receives
only an HTTP-only session cookie.

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