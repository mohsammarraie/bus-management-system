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

`feat/aws-deployment-preparation` adds standalone ARM64 deployment Compose, HTTPS routing, generated private configuration/realm, resource limits and a disposable local verification script. See the [AWS runbook](aws-deployment.md). No AWS resources or registry publications have been created; hosted checks await publication.

## Next: first cloud demo

Deploy the existing buses CRUD and Keycloak login before adding more business features. Prefer an On-Demand **t4g.small in Frankfurt**, using prebuilt ARM64 images. The developer confirmed native ARM64 images and successful login/CRUD on an M4; AWS memory headroom remains unverified. The reported Free plan has $100 credit until 11 May 2027 or credit exhaustion; the separate 750-hour/month t4g.small compute promotion ends 31 December 2026. Disk/IP and other chargeable usage still consume credit. See the [capacity, costs and fallback assessment](deployment-learning-plan.md).

1. Use the selected `bms.timbalonia.de` hostname (IONOS DNS), confirm account eligibility/the t4g.small promotion and publish tested ARM64 images to ECR. Account for ancillary costs and standard rates after the promotion.
2. Use the prepared [deployment configuration](aws-deployment.md) for a guided Frankfurt EC2 launch. Set DNS and exact public issuer/callback/logout URLs, preserve private internal services, and verify AWS memory peaks/billing. Existing local development modes remain unchanged.
3. Deploy a temporary synthetic demo; verify signup/login/logout, ADMIN CRUD and role restrictions from desktop and a real phone, including en/de/ar and RTL. Check persistence after restart.
4. Add bounded logs, health/resource monitoring and reproducible setup/teardown instructions. See the [deployment learning plan](deployment-learning-plan.md).

### To-do before public deployment: private vulnerability reporting

[SECURITY.md](../SECURITY.md) now covers maintenance scope, a contact-request fallback, required report details and coordinated disclosure with best-effort responses. GitHub private vulnerability reporting was checked on 11 November 2026 and is disabled. Before public deployment, enable it in repository Settings → Advanced Security → Private vulnerability reporting, verify that the report form is available, then replace the fallback in SECURITY.md with the verified private reporting link. Repository settings have not been changed.

## After the cloud demo: routes and stops

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

AWS is the preferred personal demo host if account eligibility and whole-stack costs allow no out-of-pocket spend. This is the next milestone, using the current authentication and buses CRUD slice; include bounded logs/metrics and teardown. Keep an alternative host available. See the [deployment learning plan](deployment-learning-plan.md).
