# Docker images and local Compose stack

## Run

Install Docker Engine with Compose and BuildKit support. Python 3 is needed only for the smoke check. Host Java/Node are not required to build and start the stack. From the repository root:

```bash
cp -n .env.example .env
# Review .env; keep an existing file and its database credentials.
docker compose up --build -d --wait --wait-timeout 180
```

Open http://localhost:8082 (FRONTEND_PORT overrides 8082). Only the frontend is published, bound to loopback. Backend and PostgreSQL are reached over the Compose network as backend:8080 and db:5432. The existing database volume and PostgreSQL 18.6 digest are unchanged. Changing POSTGRES_PASSWORD does not change the password inside an already initialized volume; follow database-setup.md.

```bash
curl --fail http://localhost:8082/api/health
docker compose ps
docker compose logs --tail=100 backend frontend
docker compose down
```

`down` retains the database volume. Do not add --volumes to a normal project unless you intend to erase its data. Attached logs use `docker compose up --build`; --wait implies detached mode, while -d makes that intent explicit. The wait timeout covers startup, not the preceding image build.

For host development, continue using `docker compose -f compose.yaml -f compose.dev.yaml up -d --wait db`, then host Gradle/Angular commands. Selecting only db does not start the application containers. The dev override publishes PostgreSQL on loopback port 5433; the base stack publishes no database/backend ports.

## Images and routing

- Backend multi-stage build uses pinned Temurin Java 25 JDK and the committed Gradle wrapper to build bootJar; runtime contains the Java 25 JRE, JAR and curl for health checks. It runs as UID/GID 10001. Tests are separate prerequisites; image building does not run Testcontainers or mount the Docker socket.
- Frontend build uses pinned Node 24.22.2, npm 11.19.1, npm ci and the Angular production build. Runtime uses the official Caddy 2.11.9 Alpine image, pinned by digest, running as UID/GID 10001 on port 8080. No Node toolchain, dev server or node_modules is copied to runtime. Caddy admin API and automatic HTTPS are disabled for this loopback HTTP demo. Writable runtime config/data live under /tmp.
- Caddy serves compiled files, compresses responses and falls back to index.html for page routes, including refreshed nested routes. Missing static assets return 404. /api and /api/* proxy to Spring with the original path preserved; backend errors never fall back to Angular HTML. /api/health explicitly maps to the minimal Actuator health response. Direct /actuator paths are blocked. /healthz tests the frontend server only.
- Compose waits for database health before backend startup, then backend health before frontend startup. Backend health includes database connectivity. Health checks detect failures after startup but do not automatically restart dependencies or repair broken credentials. Hikari reconnects after a temporary database outage, as checked by the smoke scenario.
- Each build context is its own application directory. Allowlist .dockerignore files exclude local .env, dumps, private keys, generated outputs and unrelated sources. Credentials are supplied only to backend/database at runtime, never frontend build arguments or bundles.

All base images use verified registry digests in Dockerfiles; review tag and digest together when upgrading. The PostgreSQL reference must also match Testcontainers. npm/Gradle dependencies use existing lock/wrapper/version configuration. The runtime curl installation resolves OS packages at build time; digest pins alone are not a byte-for-byte reproducibility claim. This local HTTP configuration is not an internet deployment/TLS setup. Registry publishing is not configured.

## Repeatable verification

First build images, then run:

```bash
docker compose build
python3 scripts/smoke-compose.py
```

The script creates a uniquely named project and its own volume with synthetic credentials, using .env.example rather than local .env. It checks page/proxy routing, health, non-root application users and versioned Flyway history; writes one synthetic bus, recreates the stack while retaining its volume, verifies persistence, and checks database outage/recovery. Finally it removes only its disposable project, network and volume, including on normal exceptions. A forcibly killed process may require cleanup of the printed bms-smoke-* project. Default port 18082 can be changed with SMOKE_PORT; never point this check at the normal project.

To also test the built frontend with the existing 38 browser cases, install frontend dependencies/Chromium as documented in frontend-starter.md, then run:

```bash
python3 scripts/smoke-compose.py --browser-tests
```

The optional mode requires Node 24/npm 11 and uses PLAYWRIGHT_BASE_URL to target the container without starting an Angular dev server. Ordinary Playwright commands retain their existing behavior. Report files remain ignored. Source checks and backend integration tests remain separate from this smoke check.

Container CI is the next task; no hosted image build, registry upload or container smoke run is claimed yet.

References: [Caddy handle routing](https://caddyserver.com/docs/caddyfile/directives/handle), [Compose health dependencies](https://docs.docker.com/compose/how-tos/startup-order/).

## Local verification evidence

Both images build from the permitted source contexts. Base/dev Compose validation, format/lint and browser-test type checking passed. The backend clean test bootJar run passed all 18 tests. The isolated smoke scenario passed, including all 38 existing browser cases against the production Angular build (no retries/skips), migration, synthetic data persistence across stack recreation and database outage/recovery. Temporary projects/volumes were removed. Tested on Linux amd64 with Docker 29.8.0/Compose 5.5.1; other architectures and internet deployment remain unverified. Existing frontend/backend source CI passed previously; hosted container checks are still pending implementation.
