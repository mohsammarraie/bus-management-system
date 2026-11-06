# Foundation status and next milestone

## Completed locally

- Independent successor directory and documentation foundation.
- Generic product identity and original contributor/publication credits.
- Architecture, migration plan, issue/PR templates and agent instructions.
- Leaflet acceptance recorded in ADR 0001.
- Ignore rules for local credentials, dumps and build outputs.

## Immediate next implementation: backend starter

Suggested branch: `chore/backend-starter`. Scope: verify a stable Spring Boot 4 release and compatible Java/Gradle versions, generate the Java backend and wrapper, add a minimal health endpoint and focused startup/HTTP check, and document verified build/run commands. Do not add business features yet. Keep the starter database-independent until the next PostgreSQL step; do not add persistence dependencies that prevent this stage from starting.

Suggested model/effort: **Sol, Medium** for this bounded starter. Increase to High only if dependency, toolchain or environment problems require deeper diagnosis. There is no reason to start with Extra High for routine scaffolding.

Completion evidence: backend compiles, relevant tests pass, executable JAR starts and health endpoint responds. The user reviews the unstaged diff and uses the supplied commit message; no automatic commit/push.

The next step after that is PostgreSQL + Flyway + integration testing, for which **Sol, High** is a reasonable starting point. These are recommendations to help the user select a model before each task, not automatic model changes.

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
