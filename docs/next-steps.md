# Current milestone and next steps

## Completed foundation

- Independent successor repository, generic product identity and original contributor/publication credits.
- Architecture, migration plan, issue/PR templates and agent instructions.
- Leaflet acceptance recorded in ADR 0001.
- Ignore rules for local credentials, dumps and build outputs.
- Java 25, Spring Boot 4.1.2 and Gradle 9.8.2 starter, committed wrapper and Foojay toolchain provisioning.

## Completed: PostgreSQL and Flyway

Implemented on `chore/postgres-flyway`:

- PostgreSQL 18.6, pinned by official image tag/digest in Compose and Testcontainers.
- Boot-managed Flyway 12.4.0, PostgreSQL JDBC 42.7.14 and Testcontainers 2.0.5.
- PostgreSQL service, named volume, health check and explicit loopback-only development override.
- Local example configuration loaded automatically by the local profile, plus separate external datasource configuration for deployment.
- Flyway-owned `bus_management` schema and initial `buses` table; JPA mapping validation without automatic schema updates.
- Real PostgreSQL tests for startup/migration, no-op migration reruns, checksum drift, JPA persistence and database constraints. Health tests now require the real test database.
- Setup, persistence, backup and troubleshooting instructions in [database-setup.md](database-setup.md).

This foundation has no bus APIs, authentication, application Docker images, frontend or legacy data import. The minimal bus table is groundwork; add other tables and refine feature rules through new migrations as the relevant use cases are implemented. Actual verification evidence belongs in database-setup.md and the task handoff. This task was merged into main before the backend CI work.

## Completed: backend GitHub Actions CI

Implemented on `ci/backend-checks`: `.github/workflows/backend-ci.yml` checks PRs targeting main, pushes to main and manual dispatches. It sets up Temurin Java 25, validates the Gradle wrapper through setup-gradle, caches dependencies, verifies Docker access, runs `clean test bootJar`, and retains HTML/XML test reports for seven days even after test failure. Action references are pinned to verified release commits. Workflow permissions are read-only; PR caches are read-only; superseded runs are cancelled and the job has a timeout.

Local actionlint validation and the exact build command passed (18 tests). The workflow is merged through PR #5; hosted PR and main-branch runs were verified successful. See [backend-ci.md](backend-ci.md). Feature-branch pushes alone do not trigger this workflow.

## Completed: Angular and Material starter

Implemented on `chore/angular-starter` from updated main:

- Angular 22.2.5 with CLI/build 22.2.6, Material/CDK 22.2.6, RxJS 7.8.2, TypeScript 6.0.3, Node 24 and a committed npm lockfile.
- Responsive Material shell, lazy overview/preferences routes and a not-found recovery route.
- Stable Transloco 8.4.0 with bundled English/German/Arabic resources, persistent validated language preference, document language/direction updates and locale formatting previews.
- Eight Vitest checks and 38 desktop/mobile Chromium browser cases, including axe scans, keyboard focus/menu checks and narrow-screen reflow. The frontend works without a backend; business APIs, login, Leaflet and NgRx feature state remain future slices.
- Setup/design/verification in [frontend-starter.md](frontend-starter.md), localization rationale in [ADR 0002](decisions/0002-frontend-localization.md).

The starter is merged into main. Business features and application containers remain future tasks.

## Completed: frontend GitHub Actions CI

Implemented on `ci/frontend-checks` from updated main: pinned checkout/setup-node/upload actions, Node from .nvmrc, npm 11.19.1, lockfile cache, clean install, format/lint/browser-test type/unit/build checks and Playwright Chromium with system dependencies. Reports persist for seven days. Read-only permissions, concurrency cancellation and bounded job/browser timeouts are configured. See [frontend-ci.md](frontend-ci.md).

Merged through PR #7. Hosted PR/main checks passed; run links are recorded in frontend-ci.md. Backend CI remains independent.

## Current task: application Docker images and Compose

Implemented on chore/docker-compose-stack from main 7d30dbe: pinned multi-stage Java 25 and Node/Caddy images, non-root application runtimes, allowlist build contexts, same-origin SPA/API routing and Compose health dependencies. Existing PostgreSQL data configuration and host-development db-only flow are preserved. Local smoke checks verify startup, routes, migration, persistence and database outage/recovery. Optional browser mode runs the existing suite against built files. See [container setup](container-stack.md).

Changes remain unstaged/uncommitted for review. No image registry publication or hosted container checks have been added.

## Next implementation: container GitHub Actions checks

After review/merge, create ci/container-checks. Build both images and run the isolated Compose smoke check on PRs/main, using synthetic credentials and failure diagnostics with bounded retention. Reuse existing source CI and avoid registry publication until a release policy is chosen. Verify hosted execution after the user publishes.

Suggested model/effort: **Sol, High**, for CI/container lifecycle, cache behavior and reliable cleanup. Authentication and bus CRUD follow as separate milestones.

## Following steps toward a runnable stack

1. Review/merge the locally verified container stack.
2. Extend CI to application image builds and container smoke checks.
3. Introduce NgRx Store/Effects/Entity with the first meaningful shared business-state feature.
4. Implement authentication and bus CRUD as separate feature milestones, with API contracts, authorization, validation and end-to-end checks.
5. Add routing/schedules, trip lifecycle, foreground phone location capture, Leaflet tracking/replay and reports incrementally.

Acceptance for the full stack: a documented fresh checkout starts frontend, backend and PostgreSQL, with passing relevant local/hosted checks. No proposed script should be described as available before implementation.

## Database recovery track

Use the user-supplied reference dump as the primary candidate and retain the repository dump for comparison. Identify compatible Oracle original-import tooling, restore in isolation and verify schema/data before migration. Neither dump has yet been restored. Synthetic fixtures keep development independent of private data.

## Git workflow

The successor repository is https://github.com/mohsammarraie/bus-management-system; local `origin` uses SSH. Leave future task changes unstaged and uncommitted for the user to review, commit and push unless explicitly requested otherwise. Keep legacy dumps and inherited credentials outside the successor history. Retain existing branches unless the user authorizes their deletion.
