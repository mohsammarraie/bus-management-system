# Current milestone and next steps

## Completed foundation

- Independent successor repository, generic product identity and original contributor/publication credits.
- Architecture, migration plan, issue/PR templates and agent instructions.
- Leaflet acceptance recorded in ADR 0001.
- Ignore rules for local credentials, dumps and build outputs.
- Java 25, Spring Boot 4.1.2 and Gradle 9.8.2 starter, committed wrapper and Foojay toolchain provisioning.

## Current task: PostgreSQL and Flyway

Implemented on `chore/postgres-flyway`:

- PostgreSQL 18.6, pinned by official image tag/digest in Compose and Testcontainers.
- Boot-managed Flyway 12.4.0, PostgreSQL JDBC 42.7.14 and Testcontainers 2.0.5.
- PostgreSQL service, named volume, health check and explicit loopback-only development override.
- Local example configuration loaded automatically by the local profile, plus separate external datasource configuration for deployment.
- Flyway-owned `bus_management` schema and initial `buses` table; JPA mapping validation without automatic schema updates.
- Real PostgreSQL tests for startup/migration, no-op migration reruns, checksum drift, JPA persistence and database constraints. Health tests now require the real test database.
- Setup, persistence, backup and troubleshooting instructions in [database-setup.md](database-setup.md).

This foundation has no bus APIs, authentication, application Docker images, frontend or legacy data import. The minimal bus table is groundwork; add other tables and refine feature rules through new migrations as the relevant use cases are implemented. Actual verification evidence belongs in database-setup.md and the task handoff. The user reviews, commits and pushes this task.

## Next implementation: backend GitHub Actions CI

Suggested branch: `ci/backend-checks`, created from updated `main` after this task is reviewed and merged. Add Java 25 setup, Gradle wrapper validation, dependency caching, `clean test bootJar` with Docker available for Testcontainers, bounded test-report retention, and least-privilege workflow permissions. Verify workflow syntax locally; hosted CI remains pending until the user pushes and a run is observed.

Suggested model/effort: **Sol, Medium** for this focused CI configuration task. Increase effort only if runner/Docker integration needs troubleshooting.

## Following steps toward a runnable stack

1. Generate a compatible modern Angular/Material starter with responsive layout, routing and testing. Establish English (en), German (de) and Arabic (ar) resources, a language selector with persisted preference, locale formatting and Arabic RTL from the first UI slice; English is the initial default. Introduce NgRx Store/Effects/Entity with the first meaningful shared-state feature.
2. Add frontend/backend Dockerfiles, extend Compose with application services and readiness checks, and verify the full stack locally. Use Java 25 consistently in backend build/runtime stages.
3. Extend CI to frontend tests, application image builds and container smoke checks.
4. Implement authentication and bus CRUD as separate feature milestones, with API contracts, authorization, validation and end-to-end checks.
5. Add routing/schedules, trip lifecycle, foreground phone location capture, Leaflet tracking/replay and reports incrementally.

Acceptance for the full stack: a documented fresh checkout starts frontend, backend and PostgreSQL, with passing relevant local/hosted checks. No proposed script should be described as available before implementation.

## Database recovery track

Use the user-supplied reference dump as the primary candidate and retain the repository dump for comparison. Identify compatible Oracle original-import tooling, restore in isolation and verify schema/data before migration. Neither dump has yet been restored. Synthetic fixtures keep development independent of private data.

## Git workflow

The successor repository is https://github.com/mohsammarraie/bus-management-system; local `origin` uses SSH. Leave future task changes unstaged and uncommitted for the user to review, commit and push unless explicitly requested otherwise. Keep legacy dumps and inherited credentials outside the successor history. Retain existing branches unless the user authorizes their deletion.
