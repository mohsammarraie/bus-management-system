# Docker images and local Compose stack

## Run

Install Docker Engine with Compose and BuildKit support. Python 3 is needed only for the smoke check. Host Java/Node are not required to build and start the stack. Existing .env files need the new identity keys from .env.example; see authentication-setup.md. From the repository root:

```bash
cp -n .env.example .env
# Review .env; keep an existing file and its database credentials.
docker compose up --build -d --wait --wait-timeout 240
```

Open http://localhost:8082 (FRONTEND_PORT overrides 8082). The frontend and PostgreSQL are published only on loopback, on ports 8082 and 5432 by default; DBeaver works without an override. Backend, Keycloak and PostgreSQL are reached over the Compose network as backend:8080, keycloak:8080 and db:5432. A one-shot keycloak-db-init creates a separate identity database/user without changing the application schema; Keycloak manages its own tables. The existing database volume and PostgreSQL 18.6 digest are unchanged. Changing POSTGRES_PASSWORD does not change the password inside an already initialized volume; follow database-setup.md.

```bash
curl --fail http://localhost:8082/api/health
docker compose ps
docker compose logs --tail=100 backend frontend
docker compose down
```

`down` retains the database volume. Do not add --volumes to a normal project unless you intend to erase its data. Attached logs use `docker compose up --build`; --wait implies detached mode, while -d makes that intent explicit. The wait timeout covers startup, not the preceding image build.

For host Angular/Spring Boot development with real login, use `docker compose -f compose.yaml -f compose.host.yaml up --build -d --wait --wait-timeout 240 keycloak` after stopping the full stack. This starts PostgreSQL and Keycloak plus the one-shot initializer, without application containers. It publishes PostgreSQL on loopback 5432 and Keycloak on loopback 8082, preserving the issuer used by the full stack. See [host development](authentication-setup.md#angular-and-spring-boot-on-the-host) for terminal commands, the existing-realm redirect update and switching modes. For database-only work, use `docker compose up -d --wait db`; no extra override is needed.

## Images and routing

- Backend multi-stage build uses pinned Temurin Java 25 JDK and the committed Gradle wrapper to build bootJar; runtime contains the Java 25 JRE, JAR and curl for health checks. It runs as UID/GID 10001. Tests are separate prerequisites; image building does not run Testcontainers or mount the Docker socket.
- Frontend build uses pinned Node 24.22.2, npm 11.19.1, npm ci and the Angular production build. Runtime uses the official Caddy 2.11.9 Alpine image, pinned by digest, running as UID/GID 10001 on port 8080. No Node toolchain, dev server or node_modules is copied to runtime. Caddy admin API and automatic HTTPS are disabled for this loopback HTTP demo. Writable runtime config/data live under /tmp.
- Keycloak uses a thin custom image from infra/keycloak/Dockerfile, based on the same pinned 26.8.2 upstream runtime. It adds the inherited login theme's public CSS, localized branding and icon only. Fresh realms select it automatically; existing realms need the one-time theme selection described in [theme setup](keycloak-theme.md). No image credentials or copied authentication templates are added.
- Caddy serves compiled files, compresses responses and falls back to index.html for page routes, including refreshed nested routes. Missing static assets return 404. /api and /api/* proxy to Spring with the original path preserved; backend errors never fall back to Angular HTML. /api/health explicitly maps to the minimal Actuator health response. Direct /actuator paths are blocked. /healthz tests the frontend server only.
- Compose waits for database health, identity DB bootstrap and Keycloak health before backend startup, then backend health before frontend startup. Backend health includes database connectivity. Health checks detect failures after startup but do not automatically restart dependencies or repair broken credentials. Hikari reconnects after a temporary database outage, as checked by the smoke scenario.
- Frontend/backend build contexts are their application directories; Keycloak has an allowlisted infra/keycloak context containing only the Dockerfile/theme assets. Allowlist .dockerignore files exclude local .env, dumps, private keys, generated outputs and unrelated sources. Credentials are supplied only to backend/database at runtime, never frontend build arguments or bundles.

All base images use verified registry digests in Dockerfiles; review tag and digest together when upgrading. The PostgreSQL reference must also match Testcontainers. npm/Gradle dependencies use existing lock/wrapper/version configuration. The runtime curl installation resolves OS packages at build time; digest pins alone are not a byte-for-byte reproducibility claim. This local HTTP configuration is not an internet deployment/TLS setup. Registry publishing is not configured.

## Repeatable verification

First build images, then run:

```bash
docker compose build
python3 scripts/smoke-compose.py
```

The script also verifies real OIDC login for all three roles, passenger-only signup, session rotation, CSRF-protected logout/SSO and registered identity persistence/recovery. It does not use a password grant. See authentication-setup.md. The script creates a uniquely named project and its own volume with synthetic credentials, using .env.example rather than local .env. It sets POSTGRES_PORT=0 so Docker assigns an available loopback database port instead of competing with development port 5432. It checks page/proxy routing, health, non-root application users and versioned Flyway history; writes one synthetic bus, recreates the stack while retaining its volume, verifies persistence, and checks database outage/recovery. Finally it removes only its disposable project, network and volume, including on normal exceptions. Optional --report-dir container-test-results saves bounded status/logs and a result before cleanup; see container-ci.md. A forcibly killed process may require cleanup of the printed bms-smoke-* project. Default port 18082 can be changed with SMOKE_PORT; never point this check at the normal project.

To also test the built frontend with the current browser suite, install frontend dependencies/Chromium as documented in frontend-starter.md, then run:

```bash
python3 scripts/smoke-compose.py --browser-tests
```

The optional mode requires Node 24/npm 11 and uses PLAYWRIGHT_BASE_URL to target the container without starting an Angular dev server. It also runs e2e/auth-browser-smoke.ts through Node 24 against real Keycloak: all three role logins, role routes, native form/SSO logout and passenger signup. Ordinary Playwright commands use test-only API fixtures and remain independent of infrastructure. Report files remain ignored. Source checks and backend integration tests remain separate from this smoke check.

Independent [Container CI](container-ci.md) builds frontend, backend and themed Keycloak images and runs the default smoke check. Hosted execution is pending publication and an observed run; registry publication is not configured.

References: [Caddy handle routing](https://caddyserver.com/docs/caddyfile/directives/handle), [Compose health dependencies](https://docs.docker.com/compose/how-tos/startup-order/).

## Local verification evidence

Both images build from the permitted source contexts. Base/dev Compose validation, format/lint and browser-test type checking passed. The backend clean test bootJar run passed all 18 tests. The isolated smoke scenario passed, including all 38 existing browser cases against the production Angular build (no retries/skips), migration, synthetic data persistence across stack recreation and database outage/recovery. Temporary projects/volumes were removed. Tested on Linux amd64 with Docker 29.8.0/Compose 5.5.1; other architectures and internet deployment remain unverified. Existing frontend/backend source CI passed previously; hosted container checks are configured with observed results pending publication.

Account-integration follow-up: the rebuilt frontend image passed all 62 deterministic desktop/mobile browser cases and the optional real Keycloak UI checks (three role/language logins, browser/SSO logout and passenger signup). The isolated smoke also passed persistence and database recovery and removed its temporary resources. Backend tests passed 32 cases; production backend code/image was unchanged. See authentication-setup.md for current evidence and limits. Hosted verification for this branch awaits publication.
