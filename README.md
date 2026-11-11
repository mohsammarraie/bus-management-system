# Bus Management System

A modernization of a bus management application using Angular, Spring Boot and PostgreSQL.

**Implemented:** ADMIN bus CRUD, server-side search/pagination, session authentication, passenger signup, English/German/Arabic, RTL and Light/Dark/System appearance. Routes, schedules, trips and live Leaflet tracking are planned; see the [roadmap](docs/next-steps.md).

## Stack

| Area | Technology |
|---|---|
| Backend | Java 25, Spring Boot 4.1.2, Gradle 9.8.2, Spring Data JPA/Hibernate |
| Frontend | Angular 22, Material, NgRx Store/Effects/Entity 22.0.1, RxJS, Transloco |
| Database | PostgreSQL 18.6, Flyway |
| Authentication | Keycloak, Spring Security, backend-managed OIDC/session/CSRF |
| API documentation | Swagger UI / OpenAPI, generated with springdoc |
| Delivery | Docker Compose; separate backend, frontend and container GitHub Actions checks |

## Run locally

Prerequisites: Docker Engine and Compose. From the repository root, create `.env` if absent:

```bash
cp -n .env.example .env
```

Keep existing credentials. Both modes share the development volume; DBeaver connects to `localhost:5432` using `POSTGRES_DB`, `POSTGRES_USER` and `POSTGRES_PASSWORD` from `.env`.

| Mode | Docker services | Host applications | App URL |
|---|---|---|---|
| Full stack | Frontend, backend, Keycloak, PostgreSQL | None | http://localhost:8082 |
| Host development | Keycloak, PostgreSQL | Angular, Spring Boot | http://localhost:4200 |

### Full stack in Docker

```bash
docker compose up --build -d --wait --wait-timeout 240
```

Log in as `demo-admin` with `DEMO_USER_PASSWORD` from `.env`, then open **Buses**.

### Angular and Spring Boot on the host

Requires JDK 25, Node 24 and npm 11. The Gradle wrapper can provision JDK 25 if missing.

Start infrastructure from the root:

```bash
docker compose -f compose.yaml -f compose.host.yaml up --build -d --wait --wait-timeout 240 keycloak
```

Start the applications in separate terminals, each initially at the repository root:

```bash
cd backend
./gradlew bootRun --args='--spring.profiles.active=local'
```

```bash
cd frontend
npm ci
npm start
```

The local Spring profile reads the root `.env`; process environment variables override it. Angular proxies `/api/**` to `localhost:8080`. Keycloak stays at `localhost:8082/identity`. Existing realms require the [host callback/logout configuration](docs/authentication-setup.md#angular-and-spring-boot-on-the-host).

### Switching modes and database-only work

Stop host applications and run `docker compose down` before switching modes: the full-stack gateway and host-mode Keycloak both use port 8082. Normal `down` retains data; `down --volumes` deletes it.

For database-only work:

```bash
docker compose up -d --wait db
```

### Optional demo buses

After PostgreSQL is running and Spring Boot has applied Flyway:

```bash
sh scripts/seed-demo-data.sh
```

An empty table receives 30 synthetic buses: 24 active, 6 inactive, with capacities of 20/30/40/50. Reruns preserve existing registrations, edits and versions, restoring missing demo registrations. Loading is explicit and separate from startup/migrations; existing volumes work without a reset. IDs are generated and may have gaps.

## API documentation — Swagger / OpenAPI

Explore and test the backend endpoints in **Swagger UI**:

| Mode | Swagger UI |
|---|---|
| Docker stack | [localhost:8082/api/docs](http://localhost:8082/api/docs) |
| Host development | [localhost:4200/api/docs](http://localhost:4200/api/docs) |

Sign in to the application as an **ADMIN** in the same browser first. Swagger uses that session and handles CSRF automatically. OpenAPI is available at `/api/openapi` (JSON) and `/api/openapi.yaml` (YAML). See the [API contract](docs/buses-api.md).

## Checks

Backend, from `backend/`:

```bash
./gradlew clean test bootJar
```

Frontend, from `frontend/`:

```bash
npm run format:check
npm run lint
npm run typecheck:e2e
npm run test:ci
npm run build
npx playwright install chromium
npm run test:e2e
```

Backend tests require Docker and use temporary PostgreSQL containers. Frontend tests use isolated API fixtures. After building stack images, run `python3 scripts/smoke-compose.py --browser-tests` from the root for real-session stack verification. Hosted results for the current branch await publication.

## Documentation

- [Architecture](docs/architecture-and-roadmap.md), [roadmap](docs/next-steps.md) and [decisions](docs/decisions/0003-backend-managed-keycloak-login.md).
- [Buses API and Angular screen](docs/buses-api.md).
- [Backend setup](docs/backend-starter.md), [frontend setup](docs/frontend-starter.md), [database setup and recovery](docs/database-setup.md).
- [Authentication](docs/authentication-setup.md), [Keycloak theme](docs/keycloak-theme.md), [container stack](docs/container-stack.md).
- CI: [backend](docs/backend-ci.md), [frontend](docs/frontend-ci.md), [containers](docs/container-ci.md).
- [Migration plan](docs/database-migration-plan.md) and [development workflow](docs/development-workflow-templates.md).
- [Security policy and vulnerability reporting](SECURITY.md).
- [AWS demo deployment preparation](docs/aws-deployment.md) (ARM64 Compose, HTTPS, setup/recovery; not deployed yet).
- [ARM64 image publication](docs/ecr-publication.md) (manual GitHub workflow, ECR and OIDC/IAM setup).

## Project history and credits

Bus Management System is an independent modernization of a graduation project developed by Mohammed Al-Sammarraie and Taha Al-Khaffaf. It is a learning and portfolio project for Angular, Spring Boot and agent-assisted engineering. The [original repository](https://github.com/mohsammarraie/gradproj), reference commit `b1415fdf16a7bff57025a1a9d756952dc2a21829`, remains the legacy baseline.

Raw dumps, inherited credentials and legacy binaries are excluded. License selection for new or reused code remains unresolved; this project does not assign a new license to the original implementation.
