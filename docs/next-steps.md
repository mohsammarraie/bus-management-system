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

Implemented on ci/container-checks from main 9668044: separate image build/Compose smoke workflow with read-only permissions, pinned actions, timeouts, synthetic data and seven-day bounded diagnostics. Reuses the existing smoke scenario without duplicating unit/browser suites. See [container-ci.md](container-ci.md). Merged through PR #9; the container workflow passed its PR run. The Keycloak foundation is merged through PR #12; verify hosted runs individually. Angular account changes require their own hosted run after publication.

## Completed: Keycloak authentication foundation

Merged through PR #12 (main 118df5d): Keycloak 26.8.2, separate identity database/user, reproducible local realm, passenger signup and backend-managed OIDC/PKCE with session/CSRF endpoints and role filters. Keycloak owns credentials; no app password table or email service is added. See [ADR 0003](decisions/0003-backend-managed-keycloak-login.md) and [setup](authentication-setup.md).

## Current task: Angular account integration

Implemented on feat/angular-account-integration: localized Login/Sign up/Log out and account controls; in-memory signal/RxJS state; session/CSRF initialization; native form logout through Keycloak; role-specific navigation and guards; retryable connection errors, denied access and expired-session handling. Account, administration and driver pages display real identity/access information and explicitly upcoming business tools. No business API or profile administration is added. See [authentication setup](authentication-setup.md#angular-account-integration) for design, reading order, tests and limits. All changes remain uncommitted; hosted verification awaits the user's publication.

## Next implementation: Keycloak login theme

Start only after the user has reviewed/published the current account branch and explicitly asks to begin the next task.

- [ ] Customize the hosted Keycloak login and registration pages to match the current frontend: blue/orange palette, neutral Bus Management System branding, typography, buttons, form fields and error styling.

Keep authentication forms hosted by Keycloak. Support English, German and Arabic/RTL, responsive desktop/mobile layouts, keyboard navigation, visible focus, labelled fields and accessible error messages/contrast. Package the theme reproducibly with the Keycloak container and verify login, signup and logout in both local execution modes. No theme package or library is selected yet.

Suggested model/effort: **Sol, High**, for Keycloak theme integration, localized/RTL accessibility and real browser verification. This is the next focused branch, before business CRUD.

## After theming: backend bus CRUD

Implement the first business API: an ADMIN-managed bus resource using the existing buses table. Agree the API contract, validation, pagination/filtering, optimistic-lock handling and error codes; enforce backend roles and test with real PostgreSQL. Keep legacy data import and trip ownership work separate.

Then implement the Angular buses table/forms with NgRx Store/Effects/Entity in a separate branch, including en/de/ar, RTL and accessibility. No SMTP or email verification in the MVP.

## Following steps

1. Review/merge Angular account integration and inspect its hosted CI results.
2. Customize and verify the Keycloak login/registration theme.
3. Implement backend bus CRUD with ADMIN permissions and PostgreSQL integration tests.
4. Implement the Angular buses feature with Material tables/forms and NgRx Store/Effects/Entity.
5. Add routes/stops, schedules, assignments and the schedule overview, then trip lifecycle with ownership enforcement.
6. Add foreground phone location capture, Leaflet tracking/replay and reports incrementally.

Acceptance for each slice: documented behavior, relevant local/hosted checks and a focused user-reviewed branch. Do not describe proposed scripts as implemented.

## Later: AWS deployment and monitoring practice

After the runnable MVP, evaluate AWS as the preferred personal demo host, aiming for no out-of-pocket spend and access for one or two friends. Verify account eligibility and whole-stack resource requirements first; add a bounded CloudWatch logs/metrics/dashboard/alarm exercise and teardown. Keep an alternative open if AWS cannot satisfy the cost constraint. No resources are provisioned now. See [deployment learning plan](deployment-learning-plan.md).

## Database recovery track

Use the user-supplied reference dump as the primary candidate and retain the repository dump for comparison. Identify compatible Oracle original-import tooling, restore in isolation and verify schema/data before migration. Neither dump has yet been restored. Synthetic fixtures keep development independent of private data.

## Git workflow

The successor repository is https://github.com/mohsammarraie/bus-management-system; local `origin` uses SSH. Leave future task changes unstaged and uncommitted for the user to review, commit and push unless explicitly requested otherwise. Keep legacy dumps and inherited credentials outside the successor history. Retain existing branches unless the user authorizes their deletion.
