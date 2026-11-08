# Bus Management System

A modern bus management application for managing buses, routes and trips, built with Angular, Spring Boot and PostgreSQL.

**Status:** backend and database foundation implemented: Java 25, Spring Boot, PostgreSQL, Flyway, JPA and real database integration tests. Compose runs the complete local frontend/backend/Keycloak/PostgreSQL stack. Backend GitHub Actions CI is merged and has passed on GitHub. The Angular/Material starter includes a responsive shell and English/German/Arabic language switching. Keycloak/backend session login and passenger signup are implemented; Angular login/signup/logout controls, account state and role-guarded pages are implemented; business APIs are upcoming milestones; container CI is configured with hosted verification pending publication.

## Intended experience

- Administrators manage buses, drivers, stops, routes, schedules and reports.
- Drivers start trips on their phones and explicitly share location.
- Passengers browse ongoing trips, watch the bus on a Leaflet map and review completed trips.
- Mobile-friendly screens will support English (`en`), German (`de`) and Arabic (`ar`), including right-to-left Arabic layouts.

## Technology direction

The backend uses Java 25, Spring Boot 4.1.2, Gradle 9.8.2 and PostgreSQL 18.6 with Flyway migrations. The frontend uses Angular 22, Material, RxJS and Transloco. NgRx Store/Effects/Entity will join the first shared business-state feature; Leaflet follows in later tasks; frontend/backend Docker images are available. Backend and frontend checks are configured in GitHub Actions; frontend hosted checks have passed, and independent container CI is configured with hosted verification pending publication. Keycloak with backend-managed OIDC/session authentication is implemented; see [ADR 0003](docs/decisions/0003-backend-managed-keycloak-login.md). Remaining dependency versions and the map tile provider will be verified during their setup.

## Start here

1. [Architecture and roadmap](docs/architecture-and-roadmap.md)
2. [Database migration plan](docs/database-migration-plan.md)
3. [Current milestone and next steps](docs/next-steps.md)
4. [Development workflow templates](docs/development-workflow-templates.md)
5. [Leaflet decision](docs/decisions/0001-leaflet.md)
6. [Database setup, tests and recovery](docs/database-setup.md)
7. [Backend CI and test reports](docs/backend-ci.md)
8. [Frontend setup and localization](docs/frontend-starter.md)
9. [Frontend CI and browser reports](docs/frontend-ci.md)
10. [Docker stack and smoke checks](docs/container-stack.md)
11. [Container CI and diagnostics](docs/container-ci.md)
12. [Authentication setup and API](docs/authentication-setup.md)
13. [Authentication architecture decision](docs/decisions/0003-backend-managed-keycloak-login.md)
14. [Keycloak login theme](docs/keycloak-theme.md)

## Run locally

Choose between two modes. **DBeaver access is available in both** at localhost:5432 using POSTGRES_DB, POSTGRES_USER and POSTGRES_PASSWORD from the root .env. POSTGRES_PORT changes that host port if needed.

| Mode | Runs in Docker | Runs on the host | Browser address |
|---|---|---|---|
| Full stack (compose.yaml) | Frontend, backend, Keycloak and PostgreSQL | No applications | http://localhost:8082 |
| Host development (compose.yaml + compose.host.yaml) | Keycloak and PostgreSQL | Angular and Spring Boot | http://localhost:4200 |

Docker Engine and the Compose plugin are required. Run the Docker commands from the repository root. Prepare the environment file once:

```bash
cp -n .env.example .env
```

Keep an existing .env and its database credentials; add the four Keycloak/client/demo keys from .env.example if missing. Both modes use the same development database volume. PostgreSQL's host port binds only to 127.0.0.1; this Compose setup is for local development.

### Full stack in Docker

No host Java or Node installation is needed:

```bash
docker compose up --build -d --wait --wait-timeout 240
```

Open http://localhost:8082. DBeaver can connect to localhost:5432 without an override. `up --build` builds the application images and starts the services; `docker compose build` only builds images.

### Angular and Spring Boot on the host

Start the infrastructure only; Keycloak also starts PostgreSQL and its one-shot identity database initializer:

```bash
docker compose -f compose.yaml -f compose.host.yaml up --build -d --wait --wait-timeout 240 keycloak
```

Run the backend and frontend in separate terminals using the commands below. Open http://localhost:4200. Keycloak stays at http://localhost:8082/identity, and DBeaver uses localhost:5432. The host override only adds Keycloak's direct port mapping. Selecting keycloak at the end of the command starts its dependencies without the frontend/backend containers.

Existing realms need the exact host callback/logout URLs added once; see [host login setup](docs/authentication-setup.md#angular-and-spring-boot-on-the-host).

### Switching modes and database-only work

Before switching modes, stop any host-run applications with Ctrl+C and stop the previous Docker stack with `docker compose down`. This retains the database volume; do not add --volumes when preserving data. Then use the desired startup command above. Host mode's Keycloak and the full stack's frontend both use port 8082, so they cannot run there together.

For database-only work, select just db from the base file:

```bash
docker compose up -d --wait db
```

No separate dev override is needed. To stop the stack, use `docker compose down`. See [container setup](docs/container-stack.md) for images and smoke checks, and [authentication setup](docs/authentication-setup.md) for identity configuration.

## Run the backend

Use a full **JDK 25** (including `javac`) and the committed Gradle wrapper. The project targets Java 25: Gradle reuses an installed JDK 25 or downloads one automatically through the Foojay toolchain resolver when launched with a compatible Java installation. The first build needs internet access for Gradle, plugins, dependencies and, if missing, JDK 25. No global Gradle installation is required. Offline builds require an installed JDK 25 and previously cached build dependencies; configure `JAVA_HOME` if needed.

Docker Engine and the Compose plugin must be running. Tests start their own temporary PostgreSQL container and do not require a Compose database or local credentials:

```bash
cd backend
./gradlew clean test bootJar
```

For host-run development, first start the host infrastructure or database-only option above. Then, from the repository root:

```bash
cd backend
./gradlew bootRun --args='--spring.profiles.active=local'
```

Compose and the Spring Boot `local` profile both read the root `.env`. No manual environment export is required. The local profile supports starting from the repository root or backend/; process environment variables can override file values. Use plain `KEY=value` entries as shown in .env.example. The development database port binds only to 127.0.0.1 and defaults to 5432.

From another terminal:

```bash
curl --fail http://localhost:8080/actuator/health
```

Expected response includes `"status":"UP"`; Boot may also include health-group names. Database failure makes health report HTTP 503/DOWN without exposing internal details. Stop the application with Ctrl+C. To run the packaged application from `backend/`, use Java 25 and the same `local` profile:

```bash
java -jar build/libs/bus-management-system-backend-0.0.1-SNAPSHOT.jar --spring.profiles.active=local
```

Use `PORT=8081 ./gradlew bootRun --args='--spring.profiles.active=local'` if port 8080 is occupied; also update frontend/proxy.conf.json when using Angular against that port. On Windows, use `gradlew.bat` and set environment variables with the shell's syntax. [Database setup](docs/database-setup.md) covers configuration, persistence, backups and troubleshooting.

Flyway applies the initial `bus_management.buses` schema on startup; Hibernate validates the mapping. No business CRUD APIs exist yet; the [authentication foundation](docs/authentication-setup.md) is available. [Backend setup and design](docs/backend-starter.md) explains the selected versions and tests.

Commands for later milestones in the architecture are proposals, not available scripts.

## Run the frontend

Use Node 24 (tested with 24.22.2; `frontend/.nvmrc`) and npm 11. From the repository root:

```bash
cd frontend
npm ci
npm start
```

Open http://localhost:4200. The overview and preferences pages work independently of the backend. Select English, German or Arabic in the header; the selection is remembered on this browser and Arabic changes the layout to RTL. Preferences also offers Light / Dark / System appearance, saved in this browser and shared with Keycloak login/registration; System follows live device changes. See [appearance and identity theme](docs/keycloak-theme.md#appearance-preference). Use the header to log in, sign up or log out. Signed-in users can open My account; administrators and drivers also receive their role-specific navigation. Buses/routes/trips remain upcoming. Start the backend and Keycloak for real account flows; if unavailable, public pages remain usable with a connection message and retry. See [authentication setup](docs/authentication-setup.md).

Local checks:

```bash
npm run lint
npm run typecheck:e2e
npm run test:ci
npm run build
npx playwright install chromium
npm run test:e2e
```

The frontend's development proxy forwards `/api/**` calls to the backend on port 8080. No business API exists yet. See [frontend setup](docs/frontend-starter.md) for versions, architecture and test details. The [frontend CI workflow](docs/frontend-ci.md) runs these checks on PRs to main and main pushes once published.

## Project history and credits

Bus Management System is an independent refactoring and modernization of an earlier bus management graduation project developed by Mohammed Al-Sammarraie and Taha Al-Khaffaf. The new implementation is a learning and portfolio project for practicing Angular, Spring Boot and agent-assisted engineering. The [original project repository](https://github.com/mohsammarraie/gradproj), reference commit `b1415fdf16a7bff57025a1a9d756952dc2a21829`, remains the legacy baseline.

Raw database dumps, inherited credentials and legacy binaries are not copied into this repository. License selection for new work and any reused source must be resolved before publication; this project does not assign a new license to the original implementation.
