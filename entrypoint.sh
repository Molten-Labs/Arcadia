#!/bin/sh
# entrypoint.sh — wait for PostgreSQL, then start arcadia-server.
# Migrations are embedded in the binary via sqlx::migrate!() and run
# automatically inside arcadia_db::connect() on first startup.
set -e

MAX_RETRIES=30
RETRY_INTERVAL=2

# Parse host and port from DATABASE_URL
# Handles: postgres://user:pass@host:5432/dbname
#      and: postgresql://user:pass@host:5432/dbname
if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_PORT=${DB_PORT:-5432}

echo "[entrypoint] waiting for PostgreSQL at ${DB_HOST}:${DB_PORT} (up to $((MAX_RETRIES * RETRY_INTERVAL))s)"

i=0
until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge "$MAX_RETRIES" ]; then
    echo "[entrypoint] ERROR: PostgreSQL did not become ready in time" >&2
    exit 1
  fi
  echo "[entrypoint] attempt $i/$MAX_RETRIES — not ready, retrying in ${RETRY_INTERVAL}s..."
  sleep "$RETRY_INTERVAL"
done

echo "[entrypoint] PostgreSQL ready — starting arcadia-server"
echo "[entrypoint] migrations will be applied automatically on first connect"

exec ./arcadia-server
