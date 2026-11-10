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
- PostgreSQL service, named volume, health check and loopback-only database access in both local modes.
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

## Completed: application Docker images and Compose

Implemented on chore/docker-compose-stack from main 7d30dbe: pinned multi-stage Java 25 and Node/Caddy images, non-root application runtimes, allowlist build contexts, same-origin SPA/API routing and Compose health dependencies. Existing PostgreSQL data configuration and host-development db-only flow are preserved. Local smoke checks verify startup, routes, migration, persistence and database outage/recovery. Optional browser mode runs the existing suite against built files. See [container setup](container-stack.md).

The container stack is merged through PR #8. Image registry publication remains unconfigured.

## Completed: container GitHub Actions checks

Implemented on ci/container-checks from main 9668044: separate image build/Compose smoke workflow with read-only permissions, pinned actions, timeouts, synthetic data and seven-day bounded diagnostics. Reuses the existing smoke scenario without duplicating unit/browser suites. See [container-ci.md](container-ci.md). Merged through PR #9; the container workflow passed its PR run. The Keycloak foundation is merged through PR #12; verify hosted runs individually. Angular account integration is merged through PR #13; verify hosted runs individually. Theme changes require their own hosted run after publication.

## Completed: Keycloak authentication foundation

Merged through PR #12 (main 118df5d): Keycloak 26.8.2, separate identity database/user, reproducible local realm, passenger signup and backend-managed OIDC/PKCE with session/CSRF endpoints and role filters. Keycloak owns credentials; no app password table or email service is added. See [ADR 0003](decisions/0003-backend-managed-keycloak-login.md) and [setup](authentication-setup.md).

## Completed: Angular account integration

Implemented on feat/angular-account-integration: localized Login/Sign up/Log out and account controls; in-memory signal/RxJS state; session/CSRF initialization; native form logout through Keycloak; role-specific navigation and guards; retryable connection errors, denied access and expired-session handling. Account, administration and driver pages display real identity/access information and explicitly upcoming business tools. No business API or profile administration is added. See [authentication setup](authentication-setup.md#angular-account-integration) for design, reading order, tests and limits. Merged through PR #13 (main d780982).

## Completed: Keycloak login theme

Implemented on feat/keycloak-login-theme: a native bus-management theme inheriting keycloak.v2, CSS matching the frontend palette/forms, localized branding, existing bus icon and a thin digest-pinned identity image. No authentication templates or new frontend framework are introduced. See [theme setup and maintenance](keycloak-theme.md) for existing-realm activation and upgrade guidance.

Real identity checks cover login/registration and error states in en/de/ar, keyboard/password controls, RTL, overflow and axe scans; host-run Angular/backend flows are also checked. The existing HTTP container smoke verifies the theme CSS is served without adding Chromium to Container CI. The user has merged the theme branch and updated main. Hosted results must still be checked from an observed run.

## Completed: saved application and identity appearance

Implemented on `feat/theme-preferences`: Preferences has localized, keyboard-operable Light/Dark/System radio controls. A validated cosmetic cookie saves the browser choice and shares it between Angular and Keycloak across localhost ports. Material and identity palettes use paired light/dark roles; System responds to live device changes. No backend, authentication protocol, database schema, new dependency or profile API change is needed.

See [appearance preference and reading order](keycloak-theme.md#appearance-preference). Relevant verification includes preference restore/invalid/blocked storage behavior, desktop/mobile light/dark accessibility, and real identity forms in all three languages. The user merged this feature through PR #15 (main f50b8bc); inspect hosted results individually.

## Current task: backend bus CRUD

Implemented on `feat/backend-bus-crud`: ADMIN-only list/read/create/update/delete, bounded pagination, stable whitelisted sorting, registration search/active filtering, validated DTOs, optimistic version checks and safe problem-detail codes. The existing V1 table is used without changing an applied migration. Tests cover actual PostgreSQL constraints, rollback, roles/CSRF and concurrent writes. Container smoke now exercises the API using real Keycloak sessions. See [API contract, examples and code reading order](buses-api.md).

Changes remain unstaged/uncommitted for user review; hosted Backend/Container CI awaits publication. The old manufacturer's/model/chassis fields and legacy data mapping remain a later schema extension. No Angular business screen, scheduling or trip ownership work is included in this branch.

## Next implementation: Angular buses

Build the first real business screen against the documented API: ADMIN route/navigation, Material table, paging/filter/sort, accessible create/edit/delete flows, conflict recovery and loading/empty/error states. Add NgRx Store/Effects/Entity for this shared business state, with request cancellation and no credentials/tokens in the store. Extend en/de/ar resources and verify RTL/mobile/keyboard behavior. Verify package compatibility when installing NgRx.

Suggested model/effort: **Sol, High**, for the Angular forms/table, NgRx effects and accessibility tests. Keep this separate from the backend branch. No SMTP/email verification in the MVP.

## Following steps

1. Review/commit/push the backend buses branch, inspect Backend/Container CI, then merge and update main.
2. Implement Angular buses with Material, NgRx and en/de/ar.
3. Extend legacy bus details through a new migration when their contract/import mapping is settled.
4. Add routes/stops, schedules, assignments and the schedule overview, then trip lifecycle with ownership enforcement.
5. Add foreground phone location capture, Leaflet tracking/replay and reports incrementally.

Acceptance for each slice: documented behavior, relevant local/hosted checks and a focused user-reviewed branch. Do not describe proposed scripts as implemented.

## Later: AWS deployment and monitoring practice

After the runnable MVP, evaluate AWS as the preferred personal demo host, aiming for no out-of-pocket spend and access for one or two friends. Verify account eligibility and whole-stack resource requirements first; add a bounded CloudWatch logs/metrics/dashboard/alarm exercise and teardown. Keep an alternative open if AWS cannot satisfy the cost constraint. No resources are provisioned now. See [deployment learning plan](deployment-learning-plan.md).

## Database recovery track

Use the user-supplied reference dump as the primary candidate and retain the repository dump for comparison. Identify compatible Oracle original-import tooling, restore in isolation and verify schema/data before migration. Neither dump has yet been restored. Synthetic fixtures keep development independent of private data.

## Git workflow

The successor repository is https://github.com/mohsammarraie/bus-management-system; local `origin` uses SSH. Leave future task changes unstaged and uncommitted for the user to review, commit and push unless explicitly requested otherwise. Keep legacy dumps and inherited credentials outside the successor history. Retain existing branches unless the user authorizes their deletion.
