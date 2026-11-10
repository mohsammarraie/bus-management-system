#!/bin/sh
set -eu

if [ "$#" -ne 0 ]; then
    echo "Usage: sh scripts/seed-demo-data.sh" >&2
    exit 2
fi

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

# Use the running database container's settings; no host psql or password export.
docker compose -f "$ROOT/compose.yaml" exec -T db \
    sh -c 'exec psql -X --set=ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
    < "$ROOT/infra/demo/buses.sql"
