#!/bin/sh
# entrypoint.sh — wait for PostgreSQL, then start arcadia-server.
# Migrations are embedded in the binary via sqlx::migrate!() and run
# automatically inside arcadia_db::connect() on first startup.
set -e

MAX_RETRIES=30
RETRY_INTERVAL=2

if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] ERROR: DATABASE_URL is not set" >&2
  echo "[entrypoint] On Railway: add a PostgreSQL plugin to your project." >&2
  echo "[entrypoint] Railway will automatically set DATABASE_URL for all services." >&2
  exit 1
fi

# Parse host and port from DATABASE_URL.
# Handles Railway formats:
#   postgres://user:pass@monorail.proxy.rlwy.net:PORT/railway
#   postgresql://postgres:pass@postgres.railway.internal:5432/railway
#   postgres://user:pass@host:port/db
# Strip scheme
_url="${DATABASE_URL#postgres://}"
_url="${_url#postgresql://}"
# Strip user:pass@ prefix
_hostport="${_url#*@}"
# Everything before the first /
_hostport="${_hostport%%/*}"
# Split host and port
DB_HOST="${_hostport%:*}"
DB_PORT="${_hostport##*:}"
# Fallback if no port found
case "$DB_PORT" in
  ''|"$DB_HOST") DB_PORT=5432 ;;
esac

echo "[entrypoint] waiting for PostgreSQL at ${DB_HOST}:${DB_PORT} (up to $((MAX_RETRIES * RETRY_INTERVAL))s)"

i=0
until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge "$MAX_RETRIES" ]; then
    echo "[entrypoint] ERROR: PostgreSQL at ${DB_HOST}:${DB_PORT} did not become ready in time" >&2
    echo "[entrypoint] Check that your Railway PostgreSQL plugin is running and DATABASE_URL is correct." >&2
    exit 1
  fi
  echo "[entrypoint] attempt $i/$MAX_RETRIES — not ready, retrying in ${RETRY_INTERVAL}s..."
  sleep "$RETRY_INTERVAL"
done

echo "[entrypoint] PostgreSQL ready — starting arcadia-server"
echo "[entrypoint] migrations will be applied automatically on first connect"

exec ./arcadia-server
