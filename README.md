# Bus Management System

An independent modernization of the MyGJU Buses System graduation project, preserving its main use cases while rebuilding the implementation with a modern web stack.

**Status:** repository foundation and architecture planning. The application is not runnable yet; Dockerfiles, Compose services, application starters and CI workflows are the next milestone.

## Intended experience

- Administrators manage buses, drivers, stops, routes, schedules and reports.
- Drivers start trips on their phones and explicitly share location.
- Passengers browse ongoing trips, watch the bus on a Leaflet map and review completed trips.
- Mobile-friendly English/Arabic screens support these workflows.

## Technology direction

Spring Boot 4 with Java and Gradle; modern Angular with RxJS and NgRx; PostgreSQL; Leaflet; Docker images and Compose; GitHub Actions testing. Angular Material and session-based authentication are proposed. Exact versions and the map tile provider will be verified during setup.

## Start here

1. [Architecture and roadmap](docs/architecture-and-roadmap.md)
2. [Database migration plan](docs/database-migration-plan.md)
3. [Current milestone and next steps](docs/next-steps.md)
4. [Development workflow templates](docs/development-workflow-templates.md)
5. [Leaflet decision](docs/decisions/0001-leaflet.md)

Setup and test commands will be added with the runnable starter. Do not interpret planned commands in the architecture as currently available scripts.

## Project history and credits

The original **MyGJU Buses System** was developed by Mohammed Al-Sammarraie and Taha Al-Khaffaf at the German Jordanian University, supervised by Dr. Firas Al-Hawari.

- [Original repository](https://github.com/mohsammarraie/gradproj), reference commit `b1415fdf16a7bff57025a1a9d756952dc2a21829`.
- Related paper: Feras Al-Hawari, Mohammed Al-Sammarraie and Taha Al-Khaffaf, *Design, Validation, and Comparative Analysis of a Private Bus Location Tracking Information System*, Journal of Advanced Transportation (2020), [DOI](https://doi.org/10.1155/2020/8895927).

This successor is an independent portfolio project. Historical names and authors are preserved in credits; the new application uses generic branding. Published study results belong to the original work and are not benchmarks of this rebuild.

The original repository remains the historical baseline. This successor starts with clean documentation history; raw database dumps, inherited credentials and legacy binaries are not copied into it. License selection for new work and any reused source must be resolved before public publication; this foundation does not assign a new license to the original work.
