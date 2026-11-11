#!/bin/sh
set -eu
# Only this one-shot container receives the bootstrap administrator password.
psql --host=db --username=deployment_db_admin --dbname=postgres --set=ON_ERROR_STOP=1 <<'SQL'
\getenv app_password POSTGRES_PASSWORD
\getenv kc_password KEYCLOAK_DB_PASSWORD
SELECT format('CREATE ROLE bus_management LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bus_management')\gexec
SELECT format('CREATE ROLE keycloak LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', :'kc_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'keycloak')\gexec
SELECT 'CREATE DATABASE bus_management OWNER bus_management'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'bus_management')\gexec
SELECT 'CREATE DATABASE keycloak OWNER keycloak'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak')\gexec
REVOKE ALL ON DATABASE bus_management FROM PUBLIC;
REVOKE ALL ON DATABASE keycloak FROM PUBLIC;
SQL
