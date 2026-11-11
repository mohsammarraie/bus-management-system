# Repository working agreements

## Purpose

Rebuild Bus Management System while preserving its main use cases. Help the user learn Angular, Spring Boot and agent-assisted engineering. Explain substantial design choices briefly and report verification honestly.

## Current state

The backend and PostgreSQL/Flyway foundation are implemented. Read docs/backend-starter.md, docs/database-setup.md and docs/next-steps.md, plus architecture/decisions relevant to a task.

Command contract from `backend/`: the wrapper launches with a compatible Java installation and resolves Java 25 through the configured toolchain/Foojay resolver. An installed full JDK 25 is reused; otherwise the first build downloads one. Do not depend on a chat-specific absolute JDK path.

- `./gradlew clean test bootJar`: compile, PostgreSQL Testcontainers/HTTP integration tests and executable JAR. Docker is required; tests must fail rather than silently skip without it. They need no external database credentials.
- From the repository root, copy `.env.example` to `.env` only if absent, then `docker compose -f compose.yaml -f compose.host.yaml up --build -d --wait --wait-timeout 240 keycloak` starts PostgreSQL and Keycloak for host-run applications. Stop the full stack first to release port 8082. The base file always publishes PostgreSQL on loopback for DBeaver; use `docker compose up -d --wait db` for database-only work; see docs/authentication-setup.md for the exact host flow, existing-realm callback update and mode switching. See the exact Bash commands in README.
- From `backend/`, `./gradlew bootRun --args='--spring.profiles.active=local'` or `java -jar build/libs/bus-management-system-backend-0.0.1-SNAPSHOT.jar --spring.profiles.active=local` starts against that database. The local profile imports the root `.env` from either supported working directory (repository root or backend/), without manual exports; process environment variables override imported values. `GET /actuator/health` reflects database connectivity.
- Production-style execution uses `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME` and `SPRING_DATASOURCE_PASSWORD`, without the local profile.

PostgreSQL 18.6 is pinned by tag/digest in compose.yaml and PostgresTestConfiguration; update both together. The named volume mounts at `/var/lib/postgresql`. Flyway owns the `bus_management` schema; Hibernate uses `validate` and open-in-view is disabled. The initial bus table/mapping is groundwork for fleet CRUD. The backend CI workflow is configured in .github/workflows/backend-ci.yml; see docs/backend-ci.md. Backend CI passed on GitHub after merge. The Angular/Material starter is implemented; see docs/frontend-starter.md. Frontend CI is configured in .github/workflows/frontend-ci.yml; hosted PR/main runs passed after merge. See docs/frontend-ci.md. Application Dockerfiles and the full Compose stack are implemented; see docs/container-stack.md. Independent Container CI is configured in .github/workflows/container-ci.yml; hosted results remain pending publication and an observed run. See docs/container-ci.md. Use python3 scripts/smoke-compose.py for a disposable synthetic stack, optionally --browser-tests for the built UI. Never reset the normal development volume during verification. Keycloak/backend OIDC authentication foundation is implemented; see docs/authentication-setup.md and ADR 0003. The ADMIN-only /api/v1/buses CRUD API is implemented; see docs/buses-api.md for its DTOs, search/paging bounds, strict JSON validation, versioned writes and safe error codes. Keycloak owns passwords; MVP public signup grants PASSENGER only, with driver/admin roles controlled. No SMTP/email verification. Angular account integration is implemented: signals/RxJS session state, native CSRF form logout, functional guards and localized role navigation. Read docs/authentication-setup.md before changing these flows. Keycloak login/registration theme styling is implemented; see docs/keycloak-theme.md for native inheritance, image packaging, existing-realm activation and verification. The ADMIN Angular buses screen is implemented at /buses with lazy NgRx Store/Effects/Entity, current-page server state, Material dialogs, explicit conflict reloads, localized pagination and role/session protection. See docs/buses-api.md for the frontend architecture; bus queries now restore from validated URL parameters on reload and Back/Forward; shared breakpoints/typography are next after review/merge, then routes and stops; additional bus fields are out of scope. Preserve the bus API contract and architecture in docs/buses-api.md; reuse its responsibilities without a generic CRUD superclass. Existing .env files need the four new identity keys from .env.example without replacing PostgreSQL credentials.

Frontend commands from `frontend/` (Node 24, npm 11): `npm ci`, `npm start`, `npm run format:check`, `npm run lint`, `npm run typecheck:e2e`, `npm run test:ci`, `npm run build`, and `npm run test:e2e` after `npx playwright install chromium`. Unit tests use Vitest; browser tests cover desktop/mobile Chromium. No backend/database is required for these frontend tests. Keep package-lock.json committed; generated caches/reports stay ignored.

Use standalone components, strict TypeScript/templates, lazy routes and Material theme APIs. Keep every component template and stylesheet in separate HTML/SCSS files. Material theme roles belong in frontend/src/styles/_theme.scss; semantic color variables belong in _tokens.scss. Component SCSS owns local layout and uses these shared colors. Transloco 8 loads bundled en/de/ar dictionaries; LanguageService owns validated preference storage, document language/direction and locale previews. Changes must preserve route/form state during language switching. Keep bus query/current-page business state in its lazy NgRx feature and unsaved form input local; clear feature state and cancel pending work on leaving. Never automatically replay a failed mutation. Bus query changes must go through the URL, then update NgRx and fetch once; initialize from validated route parameters before the first request. The edit=<busId> parameter restores the editor from a fresh saved-record read; keep drafts out of the URL and never reload the list merely for a dialog parameter change. Bus search/filter changes require Enter or Search; cancelling dialogs must preserve results and scroll without reloading. Use one responsive Material table; below 700px use compact headings and a three-dot row action menu instead of cards. Do not add speculative stores or fake API responses to the shell.

Appearance supports Light/Dark/System in Preferences. ThemeService persists only the validated choice in the host-only bus-management.appearance cookie (Path=/, SameSite=Lax, one year, Secure on HTTPS). The early frontend bootstrap and Keycloak appearance script read the same cookie; both local modes must use localhost consistently. Keep their allowlists/palette aligned; never use this cosmetic preference for authentication or authorization. CSS color-scheme/light-dark follows live OS changes for System. Keycloak's script owns the PatternFly dark class; leave its competing built-in darkMode script disabled. Its Dockerfile content-hashes custom CSS/JS filenames to avoid stale 30-day browser caches; preserve the hash/served-content smoke checks. See docs/keycloak-theme.md.

## User-controlled Git and step handoffs

- Before each implementation step, state its scope and recommend a model/reasoning effort so the user can choose for credit efficiency. Do not automatically switch models or proceed into the next major step after the handoff.
- Create a focused local branch for the task. Check for existing user changes first; preserve them and avoid switching or resetting away work.
- Implement the authorized task, run relevant checks and review the diff.
- Leave all task changes uncommitted and unstaged. Do not run git add, commit, push, open a PR, merge or rewrite history unless the user explicitly requests that action in a later instruction. Earlier publication/merge authorizations were specific to those completed actions.
- At each handoff, report branch, changes, actual validation and limitations, a suggested commit message, and the next step with recommended model/effort and a short reason.
- The user reviews, commits and pushes. Remote CI results can only be reported after the user's push and an actual run; mark them pending beforehand.

## Engineering

- Write concise documentation for developers familiar with the stack: setup, contracts, architecture, important behavior and limitations. Keep personal code reading orders, technology tutorials and detailed learning explanations in chat. Avoid repeating implementation walkthroughs or verification history across documents.

- Use neutral Bus Management System branding throughout UI, source comments and public documentation. Keep the original graduation-project credit and repository link in the README history section; avoid repeating historical branding in product screens or other documentation.

- Work in focused feature branches with acceptance criteria and reviewable diffs.
- Keep controllers, services, domain rules and persistence responsibilities clear.
- Preserve useful behavior, not legacy implementation defects. Record intended behavior changes.
- Avoid unnecessary duplication and speculative generic frameworks.
- Enforce role/ownership checks on the backend and relational invariants in the database.
- Never store active user/trip state in mutable static fields. Authentication is Keycloak + Spring-managed OIDC/session/CSRF, not an Angular Keycloak adapter or duplicated password store. Never return access/refresh tokens from account APIs. Domain authorization must also check assignments and ownership.
- Flyway owns schema changes; do not use automatic Hibernate schema updates.
- Leaflet is accepted; tile hosting is still undecided. Keep mapping separate from coordinate capture and trip business logic.
- Use Buses, Routes and Trips as the UI feature names; translations use Busse/Routen/Fahrten and الحافلات/المسارات/الرحلات.
- Delivered UI features must support English (en), German (de) and Arabic (ar), with translated messages, locale-aware formatting and Arabic RTL. English is the initial default. Keep API codes independent of display language and distinguish translated UI from user-entered content.
- Target WCAG 2.2 AA for delivered UI: semantic landmarks/headings, labelled controls, visible focus, keyboard operation, route focus/title updates, contrast and reflow. Extend axe/keyboard checks with each feature; retain incomplete scan results for manual review and never equate automated passes with full conformance or real screen-reader testing.
- Mobile/RTL behavior and stale/offline tracking states are acceptance criteria.

## Data and verification

- Keep raw dumps, exports, credentials and real personal data out of Git and Docker build contexts. Use synthetic fixtures in tests/demos.
- Use PostgreSQL integration tests for database behavior. Add concurrency tests for scheduling/trip integrity.
- Run checks appropriate to each change and report actual results, skipped checks and limitations.
- Do not publish artifacts or change remote repositories without authorization for that step.
- Respect the user's requested hands-on exercises; otherwise complete authorized routine work without repeated confirmation.
