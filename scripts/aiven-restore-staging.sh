#!/usr/bin/env bash
# Import one verified Neon custom-format archive into Tahin Spare's EMPTY Aiven staging DB.
# Credentials are supplied only through local PostgreSQL service and pass files.
set -Eeuo pipefail
umask 077

service_file="${PGSERVICEFILE:-$HOME/.config/tahin-spare/aiven-pg-service.conf}"
pass_file="${PGPASSFILE:-$HOME/.config/tahin-spare/aiven-pgpass}"
archive="${1:-}"
if [[ -z "$archive" ]]; then
  echo "Usage: scripts/aiven-restore-staging.sh <fresh-verified-custom-dump>" >&2
  exit 2
fi
service_name="tahin_aiven_staging"

if [[ ! -f "$service_file" || ! -f "$pass_file" ]]; then
  echo "Staging database connection is not configured on this server." >&2
  echo "Create the local PostgreSQL service file and pass file before restoring." >&2
  exit 2
fi
if [[ "$(stat -c %a "$pass_file")" != "600" ]]; then
  echo "Refusing connection file with permissions other than 600." >&2
  exit 2
fi
if [[ ! -r "$archive" ]]; then
  echo "Verified backup archive is unavailable: $archive" >&2
  exit 2
fi

command -v docker >/dev/null || { echo "Docker is required." >&2; exit 2; }
archive_dir="$(cd "$(dirname "$archive")" && pwd)"
archive_name="$(basename "$archive")"

pg_client() {
  docker run --rm --network host \
    -v "$service_file:/run/tahin-pg-service.conf:ro" \
    -v "$pass_file:/run/tahin-pgpass:ro" \
    -e PGSERVICEFILE=/run/tahin-pg-service.conf \
    -e PGPASSFILE=/run/tahin-pgpass \
    -e PGSERVICE="$service_name" \
    postgres:18-alpine "$@"
}

database="$(pg_client psql -XAt -v ON_ERROR_STOP=1 -c "SELECT current_database()")"
if [[ "$database" != "tahinspare_staging" ]]; then
  echo "Safety gate: refusing target database '$database'." >&2
  exit 2
fi

tables="$(pg_client psql -XAt -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")"
if [[ "$tables" != "0" ]]; then
  echo "Safety gate: staging is not empty ($tables existing tables)." >&2
  exit 2
fi

echo "Restoring verified PostgreSQL backup to the isolated Aiven staging database..."
docker run --rm --network host \
  -v "$service_file:/run/tahin-pg-service.conf:ro" \
  -v "$pass_file:/run/tahin-pgpass:ro" \
  -v "$archive_dir:/backup:ro" \
  -e PGSERVICEFILE=/run/tahin-pg-service.conf \
  -e PGPASSFILE=/run/tahin-pgpass \
  -e PGSERVICE="$service_name" \
  postgres:18-alpine pg_restore \
  --no-owner --no-acl --single-transaction --exit-on-error \
  --dbname="service=$service_name" "/backup/$archive_name"

pg_client psql -XAt -v ON_ERROR_STOP=1 -c "
SELECT 'tables=' || (SELECT count(*) FROM pg_tables WHERE schemaname = 'public')
  || ';products=' || (SELECT count(*) FROM products)
  || ';brands=' || (SELECT count(*) FROM brands)
  || ';inbound_emails=' || (SELECT count(*) FROM inbound_emails)
  || ';sent_emails=' || (SELECT count(*) FROM sent_emails)
  || ';followups=' || (SELECT count(*) FROM email_followup_drafts)"
echo "Staging restoration complete. Production Neon configuration was not touched."
