# Bus Management System

An independent modernization of the MyGJU Buses System graduation project, preserving its main use cases while rebuilding the implementation with a modern web stack.

**Status:** backend starter implemented. Spring Boot runs independently with an HTTP health endpoint. PostgreSQL, Angular, Docker/Compose and CI workflows are upcoming milestones.

## Intended experience

- Administrators manage buses, drivers, stops, routes, schedules and reports.
- Drivers start trips on their phones and explicitly share location.
- Passengers browse ongoing trips, watch the bus on a Leaflet map and review completed trips.
- Mobile-friendly English/Arabic screens support these workflows.

## Technology direction

The backend uses Java 25, Spring Boot 4.1.2 and Gradle 9.8.2. Planned components are modern Angular with RxJS and NgRx Store; PostgreSQL 18 with Flyway; Leaflet; Docker images and Compose; and GitHub Actions testing. Angular Material and session-based authentication are proposed. Remaining dependency versions and the map tile provider will be verified during their setup.

## Start here

1. [Architecture and roadmap](docs/architecture-and-roadmap.md)
2. [Database migration plan](docs/database-migration-plan.md)
3. [Current milestone and next steps](docs/next-steps.md)
4. [Development workflow templates](docs/development-workflow-templates.md)
5. [Leaflet decision](docs/decisions/0001-leaflet.md)

## Run the backend

Use a full **JDK 25** (including `javac`) and the committed Gradle wrapper. The project targets Java 25: Gradle reuses an installed JDK 25 or downloads one automatically through the Foojay toolchain resolver when launched with a compatible Java installation. The first build needs internet access for Gradle, plugins, dependencies and, if missing, JDK 25. No global Gradle installation is required. Offline builds require an installed JDK 25 and previously cached build dependencies; configure `JAVA_HOME` if needed.

```bash
cd backend
./gradlew clean test bootJar
./gradlew bootRun
```

From another terminal:

```bash
curl --fail http://localhost:8080/actuator/health
```

Expected response includes `"status":"UP"`; Boot may also include health-group names. Stop the server with Ctrl+C. To run the packaged application, use Java 25:

```bash
java -jar build/libs/bus-management-system-backend-0.0.1-SNAPSHOT.jar
```

Use `PORT=8081 ./gradlew bootRun` or `java -jar build/libs/bus-management-system-backend-0.0.1-SNAPSHOT.jar --server.port=8081` if port 8080 is occupied. On Windows, use `gradlew.bat` and set environment variables with the shell's syntax.

Only Actuator health is exposed, without internal details. There are no business APIs or login yet. No database is required by this starter; health currently verifies the application, not persistence. [Backend setup and design](docs/backend-starter.md) explains the versions, tests and next task.

Commands for later milestones in the architecture are proposals, not available scripts.

## Project history and credits

The original **MyGJU Buses System** was developed by Mohammed Al-Sammarraie and Taha Al-Khaffaf at the German Jordanian University, supervised by Dr. Firas Al-Hawari.

- [Original repository](https://github.com/mohsammarraie/gradproj), reference commit `b1415fdf16a7bff57025a1a9d756952dc2a21829`.
- Related paper: Feras Al-Hawari, Mohammed Al-Sammarraie and Taha Al-Khaffaf, *Design, Validation, and Comparative Analysis of a Private Bus Location Tracking Information System*, Journal of Advanced Transportation (2020), [DOI](https://doi.org/10.1155/2020/8895927).

This successor is an independent portfolio project. Historical names and authors are preserved in credits; the new application uses generic branding. Published study results belong to the original work and are not benchmarks of this rebuild.

The original repository remains the historical baseline. This successor starts with clean documentation history; raw database dumps, inherited credentials and legacy binaries are not copied into it. License selection for new work and any reused source must be resolved before public publication; this foundation does not assign a new license to the original work.
