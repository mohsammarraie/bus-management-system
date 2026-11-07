# PostgreSQL and Flyway setup

## What is implemented

The host-run Spring Boot backend connects to PostgreSQL in Docker. Flyway applies the schema; Hibernate validates the JPA mapping. Compose also provides the backend/frontend images; see [container setup](container-stack.md). The db-only commands below remain for host-run development. Business endpoints, login and legacy data import are later tasks.

PostgreSQL **18.6-bookworm** is pinned by the same official image digest in `compose.yaml` and `PostgresTestConfiguration`. Update both references together and rerun database tests and Compose smoke checks when updating the image. Spring Boot 4.1.2 manages Flyway **12.4.0**, PostgreSQL JDBC **42.7.14** and Testcontainers **2.0.5**. No database extension is required for this foundation.

## Start the development database and backend

Prerequisites: Java 25, Docker Engine and Docker Compose v2. The following commands use Bash and start from the repository root. Copy the example only when `.env` does not already exist; edit your local copy as needed:

```bash
cp -n .env.example .env
docker compose -f compose.yaml -f compose.dev.yaml config --quiet
docker compose -f compose.yaml -f compose.dev.yaml up -d --wait db
cd backend
./gradlew bootRun --args='--spring.profiles.active=local'
```

Compose reads the root `.env` for interpolation. The Spring Boot `local` profile now imports that same file with `spring.config.import`; no manual shell exports are required. Start from `backend/` or the repository root, including when configuring an IDE working directory. Imports check the parent and current directory, with the current-directory file taking precedence; keep the shared `.env` at the repository root and avoid a second copy in `backend/`. Process environment variables override imported values.

The shared file uses the plain `KEY=value` format from `.env.example`, compatible with Compose and Java properties. Avoid shell `export` statements, quoted values, backslash escapes and variable expansion in this file because the parsers differ. For credentials requiring those characters, provide environment variables or the deployment configuration instead. The file import is enabled only by the `local` profile; external-datasource execution remains separate.

The example credentials are for local development only. They are not copied into the application JAR. The base Compose file requires a password and publishes no database port; the explicit development override binds PostgreSQL to `127.0.0.1:5433` by default. The application HTTP port defaults to 8080; set `PORT=8081` if needed. Future application containers will connect to `db:5432`, rather than the host's loopback address.

From another terminal, `curl --fail http://localhost:8080/actuator/health` should return HTTP 200 with `"status":"UP"`. Database connectivity contributes to overall health. When the connection fails after startup, overall health returns HTTP 503/DOWN without connection details, and recovers when the database is reachable again. Failed migrations or invalid entity mappings prevent successful startup.

To run the packaged JAR, keep the same root `.env` and select Java 25:

```bash
cd backend
./gradlew bootJar
java -jar build/libs/bus-management-system-backend-0.0.1-SNAPSHOT.jar --spring.profiles.active=local
```

Run either bootRun or the JAR at a time on the chosen HTTP port.

## External database configuration

Without the `local` profile, supply the standard Spring environment variables:

- `SPRING_DATASOURCE_URL`: `jdbc:postgresql://<host>:<port>/<database>`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`

Use the deployment environment's connection and TLS settings. The local Compose bootstrap user has administrative privileges inside its development database; deployment-specific migration/runtime roles are a later configuration decision. Avoid putting real credentials in command history, source files or images.

## Schema ownership and first migration

Flyway creates its configured `bus_management` schema and records applied versions/checksums in `bus_management.flyway_schema_history`. `V1__create_buses.sql` creates the initial bus table:

| Column | Meaning / initial rule |
|---|---|
| `id` | PostgreSQL-generated bigint identity; callers do not allocate IDs |
| `registration_number` | Required, 1–32 characters, no surrounding whitespace; exact, case-sensitive uniqueness |
| `capacity` | Required positive integer |
| `active` | Required, defaults to true; lifecycle changes follow with fleet CRUD |
| `version` | JPA optimistic-lock version, defaults to zero |

This is new fleet groundwork, not a recovered Oracle schema. The Java constructor also rejects blank/whitespace-padded registration numbers and nonpositive capacity. Legacy identifier mapping and cleanup rules remain part of the separate import plan. No demo users, production records or legacy dumps are loaded by migrations.

Flyway is the only schema writer. `spring.jpa.hibernate.ddl-auto=validate` verifies mappings; `spring.sql.init.mode=never` prevents parallel schema.sql/data.sql initialization, open-in-view is disabled, and Flyway clean is disabled. Hibernate validation alone does not verify every check/unique constraint: integration tests exercise those rules directly.

After a migration is applied to a shared database, add `V2__...sql` for changes rather than editing V1. Startup validates applied checksums and applies pending migrations. A second startup with no new versions is a no-op; do not use baseline/repair to hide unexplained drift.

## Tests

From `backend/`:

```bash
./gradlew clean test bootJar
```

Docker must be available. Tests start their own temporary PostgreSQL 18.6 container with the same pinned digest as Compose. `@ServiceConnection` supplies generated connection details to Spring Boot and Flyway, so tests need no `.env`, local profile or pre-existing development database. They fail rather than silently skip when Docker is unavailable.

The 18 test cases cover migration from an empty database, safe reruns, checksum drift detection, JPA/generated-ID persistence, registration/capacity constraints and real HTTP health/management exposure. Transactional test data rolls back. An altered V1 used to test checksum validation exists only in test resources. Results are in `backend/build/reports/tests/test/`.

## Stop, restart and persistence

Stop Spring Boot with Ctrl+C. From the repository root:

```bash
docker compose -f compose.yaml -f compose.dev.yaml down
# Later:
docker compose -f compose.yaml -f compose.dev.yaml up -d --wait db
```

The named `postgres_data` volume survives normal `down` and container replacement. PostgreSQL 18 stores data under `/var/lib/postgresql/18/docker`; mount the named volume at `/var/lib/postgresql`, as the official image requires.

`down --volumes` deletes this Compose project's database volume and all its databases. Use it only for an intentional disposable-development reset. Changing `.env` credentials does not update users/passwords in an existing volume: image initialization settings apply only to an empty data directory. Change existing database credentials explicitly or reset only disposable data.

Major PostgreSQL upgrades require a supported dump/restore or pg_upgrade process; changing the image tag alone does not upgrade an existing data directory. Review release notes for minor updates as well. A persistent volume is not a backup.

## Backup and restore to a separate database

With the database running, from the repository root. These commands expand database settings inside the container, so the host shell does not need exported variables:

```bash
mkdir -p local-data/backups
docker compose -f compose.yaml -f compose.dev.yaml exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  > local-data/backups/bus-management.dump
```

Restore into a new, empty database, keeping the current application database intact:

```bash
docker compose -f compose.yaml -f compose.dev.yaml exec -T db \
  sh -c 'createdb -U "$POSTGRES_USER" bus_management_restore'
docker compose -f compose.yaml -f compose.dev.yaml exec -T db \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d bus_management_restore --exit-on-error' \
  < local-data/backups/bus-management.dump
```

Check restored table counts and Flyway history before selecting the restored database through the datasource URL. Store important backups outside the Docker host as appropriate. `local-data/` and dump files are ignored by Git and must stay out of later Docker build contexts.

## Troubleshooting

- Docker unavailable: start the daemon and ensure your user can access it. On this machine the Docker snap requires host runtime-directory access, so sandboxed agent checks may need the approved command boundary; normal terminal commands use the host environment.
- Port 5433 occupied: change `POSTGRES_PORT` in the root `.env` and recreate the development container. Testcontainers uses separate dynamic ports.
- Missing `POSTGRES_PASSWORD` or authentication failure despite a successful DBeaver connection: verify the root `.env` exists, the `local` profile is active, and the working directory is the repository root or `backend/`. Check for stale process/IDE environment variables overriding the file. Rebuild the JAR after configuration changes; an older JAR will still require manual exports. Do not run the local profile with production credentials.
- Connection refused: check `docker compose -f compose.yaml -f compose.dev.yaml ps` and `logs db`, then confirm the selected profile and host port.
- Authentication fails after editing `.env`: an existing volume retains its database users and password.
- Checksum/schema validation fails: inspect the migration history and changes; do not enable Hibernate update or automatically repair the history.

## Verification

Verified locally on Java 25.0.4.1 with Docker Engine 29.8.0:

- `./gradlew --no-daemon clean test bootJar`: **18 tests passed**, zero failures, errors or skips; executable JAR built.
- Compose configuration validated; a fresh isolated PostgreSQL 18.6 volume became healthy.
- Local-profile bootRun and external-datasource packaged JAR startup returned HTTP 200/UP.
- A user startup failure was reproduced: copying `.env` without exporting its values caused password authentication failure in the old setup. Supplying the file values via environment variables made the connection succeed.
- After adding local-profile config imports, a new clean build passed all 18 tests. bootRun from `backend/`, the rebuilt JAR from `backend/`, and the rebuilt JAR from the repository root all returned HTTP 200/UP with every `POSTGRES_`/`SPRING_` variable removed from the child environment. The copied root `.env` alone supplied local connection settings; private values were not printed or modified.
- Repeated application startup left one successful V1 migration in Flyway history.
- Stopping PostgreSQL produced HTTP 503/DOWN with internal details hidden; restarting it on the same host port restored HTTP 200/UP.
- Recreating the database container preserved a synthetic bus and Flyway history in the named volume; the packaged JAR started successfully afterwards.
- Compose and Testcontainers image tag/digest references match. Temporary smoke-test containers, network and volume were removed; the normal development project was not started or reset.

The [backend GitHub Actions workflow](backend-ci.md) is merged and has verified successful hosted PR/main runs. Raw Oracle dumps have not been imported. Backup/restore commands are documented above; a backup restoration rehearsal was not part of these checks.

## Official references

- [PostgreSQL version policy](https://www.postgresql.org/support/versioning/)
- [Official PostgreSQL Docker image and PGDATA layout](https://hub.docker.com/_/postgres)
- [Boot external configuration and extensionless file imports](https://docs.spring.io/spring-boot/reference/features/external-config.html)
- [Boot database initialization](https://docs.spring.io/spring-boot/how-to/data-initialization.html)
- [Boot Testcontainers service connections](https://docs.spring.io/spring-boot/reference/testing/testcontainers.html)
- [Flyway PostgreSQL module](https://documentation.red-gate.com/flyway/reference/database-driver-reference/postgresql-database)
