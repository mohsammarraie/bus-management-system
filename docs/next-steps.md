# Foundation status and next milestone

## Completed locally

- Independent successor directory and documentation foundation.
- Generic product identity and original contributor/publication credits.
- Architecture, migration plan, issue/PR templates and agent instructions.
- Leaflet acceptance recorded in ADR 0001.
- Ignore rules for local credentials, dumps and build outputs.

## Next milestone: runnable stack

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

## Pending external setup

No GitHub successor repository or remote is configured by this foundation. Confirm the destination/visibility before first publication. Keep legacy dumps and inherited credentials outside the successor history.
