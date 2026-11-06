# Bus Management System

An independent modernization of the MyGJU Buses System graduation project, preserving its main use cases while rebuilding the implementation with a modern web stack.

**Status:** backend and database foundation implemented: Java 25, Spring Boot, PostgreSQL, Flyway, JPA and real database integration tests. Compose runs PostgreSQL locally. Angular, application Docker images, business APIs, login and CI workflows are upcoming milestones.

## Intended experience

- Administrators manage buses, drivers, stops, routes, schedules and reports.
- Drivers start trips on their phones and explicitly share location.
- Passengers browse ongoing trips, watch the bus on a Leaflet map and review completed trips.
- Mobile-friendly screens will support English (`en`), German (`de`) and Arabic (`ar`), including right-to-left Arabic layouts.

## Technology direction

The backend uses Java 25, Spring Boot 4.1.2, Gradle 9.8.2 and PostgreSQL 18.6 with Flyway migrations. Planned components are modern Angular with RxJS and NgRx Store; Leaflet; frontend/backend Docker images; and GitHub Actions testing. Angular Material and session-based authentication are proposed. Remaining dependency versions and the map tile provider will be verified during their setup.

## Start here

1. [Architecture and roadmap](docs/architecture-and-roadmap.md)
2. [Database migration plan](docs/database-migration-plan.md)
3. [Current milestone and next steps](docs/next-steps.md)
4. [Development workflow templates](docs/development-workflow-templates.md)
5. [Leaflet decision](docs/decisions/0001-leaflet.md)
6. [Database setup, tests and recovery](docs/database-setup.md)

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

## Project history and credits

The original **MyGJU Buses System** was developed by Mohammed Al-Sammarraie and Taha Al-Khaffaf at the German Jordanian University, supervised by Dr. Firas Al-Hawari.

- [Original repository](https://github.com/mohsammarraie/gradproj), reference commit `b1415fdf16a7bff57025a1a9d756952dc2a21829`.
- Related paper: Feras Al-Hawari, Mohammed Al-Sammarraie and Taha Al-Khaffaf, *Design, Validation, and Comparative Analysis of a Private Bus Location Tracking Information System*, Journal of Advanced Transportation (2020), [DOI](https://doi.org/10.1155/2020/8895927).

This successor is an independent portfolio project. Historical names and authors are preserved in credits; the new application uses generic branding. Published study results belong to the original work and are not benchmarks of this rebuild.

The original repository remains the historical baseline. This successor starts with clean documentation history; raw database dumps, inherited credentials and legacy binaries are not copied into it. License selection for new work and any reused source must be resolved before public publication; this foundation does not assign a new license to the original work.
