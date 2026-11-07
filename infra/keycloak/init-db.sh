#!/bin/sh
set -eu
# Separate identity database; this also works with an existing application volume.
psql --host=db --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --set=ON_ERROR_STOP=1 <<'SQL'
\getenv kc_password KEYCLOAK_DB_PASSWORD
SELECT format('CREATE ROLE keycloak LOGIN PASSWORD %L', :'kc_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'keycloak')\gexec
SELECT 'CREATE DATABASE keycloak OWNER keycloak'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak')\gexec
SQL
