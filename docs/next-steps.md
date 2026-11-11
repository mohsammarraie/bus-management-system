# Roadmap

## Implemented

- Independent successor repository, original-project credits, architecture decisions and feature workflow.
- Java 25 / Spring Boot / Gradle backend; PostgreSQL and Flyway with real database integration tests.
- Angular/Material shell, en/de/ar and RTL, saved Light/Dark/System appearance shared with Keycloak.
- Backend-managed Keycloak OIDC/session/CSRF, passenger signup, role guards and controlled ADMIN/DRIVER assignments.
- ADMIN [buses API and Angular screen](buses-api.md), NgRx server-page state, validation, optimistic locking and secured Swagger.
- Opt-in synthetic buses; Docker images/Compose; independent backend, frontend and container CI.

## Current branch

`feat/angular-buses` adds the buses UI and a shared loading overlay for page navigation, tables and dialogs. Local formatting/lint/types, 43 unit tests, 126 browser cases and the production build pass; earlier image/Compose checks are recorded in the buses API document. Changes remain uncommitted for review; hosted checks await publication.

## Next: preserve bus queries in the URL

After the current buses feature is reviewed and merged, use Angular Router query parameters for the applied search, status filter, page, page size, sort field and direction (`q`, `active`, `page`, `size`, `sort`, `direction`).

- Restore validated URL values into NgRx before the first request; use safe defaults for missing or invalid parameters.
- Keep unsent filter edits local. Enter/Search applies them to the URL; sorting and pagination update the URL as well. Reset clears search/status and returns to page one.
- Reloading or opening a copied URL restores the same query. Browser Back/Forward restores the controls and results without duplicate requests or navigation loops.
- Add focused browser checks for reloads, direct links, Back/Forward, Reset and invalid parameters. No backend contract changes are required.

## Then: shared breakpoints and typography

Centralize repeated responsive breakpoints in shared SCSS variables/mixins and keep Angular `BreakpointObserver` thresholds aligned. Consolidate repeated font sizes through Material typography and a small shared, rem-based type scale; keep component-specific layout local. Preserve the current appearance and verify mobile/desktop reflow, zoom and en/de/ar layouts.

## Afterward: routes and stops

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
