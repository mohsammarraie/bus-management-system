# Bus Management System

A modern bus management application for managing buses, routes and trips, built with Angular, Spring Boot and PostgreSQL.

**Status:** backend and database foundation implemented: Java 25, Spring Boot, PostgreSQL, Flyway, JPA and real database integration tests. Compose runs the complete local frontend/backend/PostgreSQL stack. Backend GitHub Actions CI is merged and has passed on GitHub. The Angular/Material starter includes a responsive shell and English/German/Arabic language switching. Business APIs and login are upcoming milestones; container CI is configured with hosted verification pending publication.

## Intended experience

- Administrators manage buses, drivers, stops, routes, schedules and reports.
- Drivers start trips on their phones and explicitly share location.
- Passengers browse ongoing trips, watch the bus on a Leaflet map and review completed trips.
- Mobile-friendly screens will support English (`en`), German (`de`) and Arabic (`ar`), including right-to-left Arabic layouts.

## Technology direction

The backend uses Java 25, Spring Boot 4.1.2, Gradle 9.8.2 and PostgreSQL 18.6 with Flyway migrations. The frontend uses Angular 22, Material, RxJS and Transloco. NgRx Store/Effects/Entity will join the first shared business-state feature; Leaflet follows in later tasks; frontend/backend Docker images are available. Backend and frontend checks are configured in GitHub Actions; frontend hosted checks have passed, and independent container CI is configured with hosted verification pending publication. Session-based authentication is proposed. Remaining dependency versions and the map tile provider will be verified during their setup.

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

## Run the full stack with Docker

```bash
cp -n .env.example .env
docker compose up --build -d --wait --wait-timeout 180
```

Open http://localhost:8082. Keep an existing .env and its database credentials. `docker compose down` stops the stack and retains its database volume. See [container setup](docs/container-stack.md) for routing, ports, image details and isolated smoke checks. Host-run development remains available below.

## Run the backend

Use a full **JDK 25** (including `javac`) and the committed Gradle wrapper. The project targets Java 25: Gradle reuses an installed JDK 25 or downloads one automatically through the Foojay toolchain resolver when launched with a compatible Java installation. The first build needs internet access for Gradle, plugins, dependencies and, if missing, JDK 25. No global Gradle installation is required. Offline builds require an installed JDK 25 and previously cached build dependencies; configure `JAVA_HOME` if needed.

Docker Engine and the Compose plugin must be running. Tests start their own temporary PostgreSQL container and do not require a Compose database or local credentials:

```bash
cd backend
./gradlew clean test bootJar
```

To run the application locally, first prepare the database from the repository root. These are Bash commands; copy `.env.example` only if you do not already have a `.env`:

```bash
cp -n .env.example .env
docker compose -f compose.yaml -f compose.dev.yaml up -d --wait db
cd backend
./gradlew bootRun --args='--spring.profiles.active=local'
```

Compose and the Spring Boot `local` profile both read the root `.env`. No manual environment export is required. Start the application from the repository root or `backend/`; environment variables can override file values. Use plain `KEY=value` entries as shown in `.env.example`. The development database binds only to `127.0.0.1`, on port 5433 by default. The base Compose file publishes no database port.

From another terminal:

```bash
curl --fail http://localhost:8080/actuator/health
```

Expected response includes `"status":"UP"`; Boot may also include health-group names. Database failure makes health report HTTP 503/DOWN without exposing internal details. Stop the application with Ctrl+C. To run the packaged application from `backend/`, use Java 25 and the same `local` profile:

```bash
java -jar build/libs/bus-management-system-backend-0.0.1-SNAPSHOT.jar --spring.profiles.active=local
```

Use `PORT=8081 ./gradlew bootRun --args='--spring.profiles.active=local'` if port 8080 is occupied. On Windows, use `gradlew.bat` and set environment variables with the shell's syntax. [Database setup](docs/database-setup.md) covers configuration, persistence, backups and troubleshooting.

Flyway applies the initial `bus_management.buses` schema on startup; Hibernate validates the mapping. No business APIs or login exist yet. [Backend setup and design](docs/backend-starter.md) explains the selected versions and tests.

Commands for later milestones in the architecture are proposals, not available scripts.

## Run the frontend

Use Node 24 (tested with 24.22.2; `frontend/.nvmrc`) and npm 11. From the repository root:

```bash
cd frontend
npm ci
npm start
```

Open http://localhost:4200. The overview and preferences pages work independently of the backend. Select English, German or Arabic in the header; the selection is remembered on this browser and Arabic changes the layout to RTL. Buses/routes/trips are marked as upcoming; there are no CRUD or login screens yet.

Local checks:

```bash
npm run lint
npm run typecheck:e2e
npm run test:ci
npm run build
npx playwright install chromium
npm run test:e2e
```

The frontend's development proxy forwards future `/api/**` calls to the backend on port 8080. No business API exists yet. See [frontend setup](docs/frontend-starter.md) for versions, architecture and test details. The [frontend CI workflow](docs/frontend-ci.md) runs these checks on PRs to main and main pushes once published.

## Project history and credits

Bus Management System is an independent refactoring and modernization of an earlier bus management graduation project developed by Mohammed Al-Sammarraie and Taha Al-Khaffaf. The new implementation is a learning and portfolio project for practicing Angular, Spring Boot and agent-assisted engineering. The [original project repository](https://github.com/mohsammarraie/gradproj), reference commit `b1415fdf16a7bff57025a1a9d756952dc2a21829`, remains the legacy baseline.

Raw database dumps, inherited credentials and legacy binaries are not copied into this repository. License selection for new work and any reused source must be resolved before publication; this project does not assign a new license to the original implementation.
