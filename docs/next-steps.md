# Roadmap

## Implemented

- Independent successor repository, original-project credits, architecture decisions and feature workflow.
- Java 25 / Spring Boot / Gradle backend; PostgreSQL and Flyway with real database integration tests.
- Angular/Material shell, en/de/ar and RTL, saved Light/Dark/System appearance shared with Keycloak.
- Backend-managed Keycloak OIDC/session/CSRF, passenger signup, role guards and controlled ADMIN/DRIVER assignments.
- ADMIN [buses API and Angular screen](buses-api.md), NgRx server-page state, validation, optimistic locking and secured Swagger.
- URL-persisted bus queries and selected editor, including reloads, copied links and Back/Forward; editors restore saved values only.
- Shared SCSS breakpoints aligned with Angular layout queries and a rem-based typography scale.
- Opt-in synthetic buses; Docker images/Compose; independent backend, frontend and container CI.

## Current branch

`refactor/shared-scss-tokens` centralizes responsive thresholds and font sizes, preserving existing layouts. Changes remain uncommitted for review; hosted checks await publication.

## Next: routes and stops

Implement routes and stops, starting with the backend. Confirm the legacy use cases and define stops, localized names and ordered route stops. Add Flyway migrations, ADMIN CRUD endpoints, validation, integration tests and Swagger documentation. Follow with the Angular management screen in a separate slice.

Additional bus fields are out of scope for the current project. Keep registration number, passenger capacity and active/inactive status; focus on passenger trips and schedules.

## Following features

1. Schedules, assignments and schedule overview, including database integrity and concurrent assignment checks.
2. Trip lifecycle with driver assignment/ownership enforcement.
3. Foreground phone location capture and Leaflet tracking with stale/offline states.
4. Reports and operational views.

Each slice includes backend authorization, relevant tests, en/de/ar, RTL, mobile and accessibility checks. SMTP/email verification remains post-MVP.

## Legacy data migration

The user-supplied reference dump is the primary candidate; retain the repository dump for comparison. Restore in an isolated Oracle environment and verify schema/data before mapping into PostgreSQL. Neither dump has been restored. Keep private data and credentials outside Git; synthetic fixtures support development meanwhile.

## Deployment and monitoring

AWS is the preferred personal demo host if account eligibility and whole-stack costs allow no out-of-pocket spend. Evaluate this after the runnable MVP, including CloudWatch logs/metrics, bounded alarms and teardown. Keep an alternative host available. See the [deployment learning plan](deployment-learning-plan.md).
