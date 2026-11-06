# Foundation status and next milestone

## Completed locally

- Independent successor directory and documentation foundation.
- Generic product identity and original contributor/publication credits.
- Architecture, migration plan, issue/PR templates and agent instructions.
- Leaflet acceptance recorded in ADR 0001.
- Ignore rules for local credentials, dumps and build outputs.

## Backend starter: implemented on chore/backend-starter

Spring Boot 4.1.2, Java 25 and Gradle 9.8.2 are pinned. The Foojay toolchain resolver reuses an installed JDK 25 or provisions one when needed. The backend has a health endpoint and real HTTP tests for health and management endpoint exposure. See [backend-starter.md](backend-starter.md) for setup and validation details. No database or application features are added in this task.

## Immediate next implementation: PostgreSQL and Flyway

Suggested branch: `chore/postgres-flyway`. Target PostgreSQL 18, with an exact supported image version/digest selected during implementation and reused in local development and integration tests. First verify Docker daemon access and the Boot-managed PostgreSQL/Flyway dependency versions. Include Flyway's PostgreSQL-specific module; the official PostgreSQL 18 image mounts persistent storage at `/var/lib/postgresql`. Add the PostgreSQL driver and persistence dependencies, explicit Flyway SQL migrations, local example connection configuration and a PostgreSQL Compose service. Establish PostgreSQL Testcontainers integration tests proving startup/migration and schema constraints, without importing the private Oracle dump. Keep Hibernate schema auto-update disabled.

Completion evidence: database becomes healthy, migrations work on an empty database and rerun safely, backend health reflects connection state, and PostgreSQL integration tests pass. Merge the reviewed backend starter branch into `main` before creating that task branch.

Suggested model/effort: **Sol, High** for persistence, migration and container integration. Astra is unnecessary for routine setup; use it for unresolved schema/domain design or concurrency problems when they arise.

## Subsequent milestone: complete runnable stack

1. Verify compatible stable releases of Boot 4, Java, Gradle, Angular, Material, NgRx Store, Node and PostgreSQL. Record the exact choices.
2. Generate a minimal Boot/Gradle backend with health endpoint, PostgreSQL connection and Flyway schema migration.
3. Generate the Angular starter with Material layout, routing and initial testing; introduce feature NgRx Store state with the first meaningful feature.
4. Add frontend/backend Dockerfiles, PostgreSQL service, Compose, health checks and example configuration.
5. Run a clean build and a Compose startup/health/proxy smoke test locally.
6. Add GitHub Actions for backend/frontend checks, image builds and the container smoke test. Verify workflow configuration locally; report hosted CI as pending until pushed and actually run.
7. Add the development/start/test commands to README and AGENTS.md.

Acceptance: a documented fresh checkout starts the frontend, backend and PostgreSQL, with passing relevant local checks. Login and bus CRUD follow as separate feature milestones.

## Database recovery track

Use the user-supplied reference dump as the primary candidate and retain the repository dump for comparison. Identify compatible Oracle original-import tooling, restore in isolation and verify the schema/data before migration. Neither dump has yet been restored. Recovery can proceed alongside the starter; synthetic fixtures keep development independent of private data.

## GitHub publication

The user created the successor repository at https://github.com/mohsammarraie/bus-management-system and authorized the initial push. The local `origin` uses `git@github.com:mohsammarraie/bus-management-system.git`. The initial foundation and documentation correction were published and subsequently squashed into one foundation commit on `main`. All future task changes are left unstaged and uncommitted for the user to review, commit and push unless explicitly requested otherwise. Keep legacy dumps and inherited credentials outside the successor history.
