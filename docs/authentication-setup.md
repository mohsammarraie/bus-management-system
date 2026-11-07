# Authentication foundation: setup and API

See [ADR 0003](decisions/0003-backend-managed-keycloak-login.md) for the decision, browser-managed token comparison and limitations. The identity/backend foundation is implemented; Angular login buttons, guards/account state and business screens are the next slice.

## Local startup

For a fresh checkout, copy .env.example to .env. For an existing checkout, **keep the existing POSTGRES_* values** and add the four new keys from .env.example: KEYCLOAK_DB_PASSWORD, KEYCLOAK_ADMIN_PASSWORD, OIDC_CLIENT_SECRET and DEMO_USER_PASSWORD. Do not overwrite an existing database password or reset its volume.

```bash
docker compose up --build -d --wait --wait-timeout 240
```

All sample credentials are synthetic/local-only. Visit http://localhost:8082/api/auth/login or http://localhost:8082/api/auth/signup. After success the browser returns to /overview. No token is returned to Angular. Supported ?lang=en, ?lang=de and ?lang=ar parameters select the hosted page language; invalid values fall back to English. API failures return stable codes for future frontend translation.

Imported demo usernames: demo-admin, demo-driver and demo-passenger. Their shared local password is DEMO_USER_PASSWORD. Public signup grants only PASSENGER. The Keycloak administration console is http://localhost:8082/identity/admin/ with bootstrap username local-admin and KEYCLOAK_ADMIN_PASSWORD; this is separate from demo-admin's application role. No SMTP is configured; emails remain unverified and email recovery is disabled. Any assisted recovery must establish identity through a controlled process, not knowledge of an unverified email.

In the full stack, Keycloak, its management health port and Spring Boot are not published independently. Caddy publishes the application on loopback FRONTEND_PORT (8082 default), and PostgreSQL publishes loopback POSTGRES_PORT (5432 default) for DBeaver in both modes. The keycloak-db-init one-shot service creates its own database/user inside the existing server and exits; it does not alter application tables or reset existing identities/passwords. Realm startup import skips existing realms; editing the JSON does not update a live realm. Changing .env alone also does not rotate database, client, demo-user or already bootstrapped administrator credentials. Apply deliberate admin changes when preserving data; never erase the normal volume to pick up configuration.

## API contract

| Request | Behavior |
|---|---|
| GET /api/auth/login?lang=en | Starts server-managed OIDC login |
| GET /api/auth/signup?lang=en | Starts OIDC with prompt=create |
| GET /api/auth/csrf | Sets readable XSRF-TOKEN; returns headerName/token; no-store |
| GET /api/auth/me | Authenticated id, username, roles only; no-store; anonymous 401 |
| POST /api/auth/logout | Requires CSRF; invalidates application session and redirects through Keycloak logout |

For Angular integration, obtain fresh CSRF state before unsafe requests and again after login/logout. Angular uses its normal same-origin HTTP/XSRF support. Logout is a browser-navigation flow; the frontend slice must handle it as such instead of assuming a JSON response. Public authorization starts at /api/oauth2/authorization/keycloak; callback is /api/login/oauth2/code/keycloak. State, nonce and S256 PKCE are managed by Spring. There is no POST username/password endpoint, user HTTP Basic login, password grant or keycloak-js dependency. Missing authentication returns 401/AUTHENTICATION_REQUIRED; rejected role/CSRF returns 403/ACCESS_DENIED. Fixed success/failure destinations avoid user-controlled redirect targets.

Application ADMIN has access to /api/admin/**; DRIVER or ADMIN to /api/driver/**. Other API routes require authentication. These are security boundaries, not newly implemented trip/CRUD endpoints. Each future business controller/service must specify roles and ownership rules. A driver role alone must never grant access to another driver's trip. Keycloak ADMIN server privileges are never inferred from application role names.

## Configuration and host development

APP_PUBLIC_URL is the fixed application callback/redirect origin. OIDC_ISSUER is the public Keycloak realm issuer. OIDC_INTERNAL_ISSUER supplies Docker-internal token/JWK/userinfo endpoints while preserving public issuer validation. Compose sets these consistently using FRONTEND_PORT and service DNS. The backend builds ClientRegistration explicitly, so it does not need public-URL discovery during startup. Never use the Docker hostname as the browser's issuer or callback URL.

The backend uses a 30-minute idle session, HttpOnly/Lax session cookie and session rotation on login. SESSION_COOKIE_SECURE defaults false for loopback HTTP only; use true with HTTPS deployment. Forwarded headers are processed because the backend is behind Caddy; it must remain inaccessible to untrusted direct traffic in deployment.

### Angular and Spring Boot on the host

This mode runs only PostgreSQL and Keycloak in Docker, plus the one-shot database initializer. PostgreSQL is already published by the base file; the host override only publishes Keycloak directly. Use the same root .env and existing database volume. No extra Angular package or Java authentication code is needed.

First stop the full stack so its frontend releases port 8082 (do not add --volumes):

```bash
# Repository root
docker compose down
docker compose -f compose.yaml -f compose.host.yaml up -d --wait --wait-timeout 240 keycloak
```

Then run these in separate terminals, starting in the repository root:

```bash
cd backend
./gradlew bootRun --args='--spring.profiles.active=local'
```

```bash
cd frontend
npm start
```

Open http://localhost:4200. Try http://localhost:4200/api/auth/login or /api/auth/signup directly until Angular account controls are implemented. The existing Angular proxy sends /api/** to the host backend on 127.0.0.1:8080. Spring's local profile imports .env and defaults its application origin to http://localhost:4200; its token/JWK endpoints use the host-reachable Keycloak address. Do not set Docker-internal OIDC_INTERNAL_ISSUER in the host environment. Remove conflicting APP_PUBLIC_URL/OIDC_* overrides from earlier manual setup when using these defaults.

| Service | Host address |
|---|---|
| Angular | http://localhost:4200 |
| Spring Boot | http://localhost:8080 (health: /actuator/health) |
| Keycloak | http://localhost:8082/identity (admin: /identity/admin/) |
| PostgreSQL / DBeaver | localhost:5432 |

Use localhost consistently in the browser for login and session cookies. FRONTEND_PORT and POSTGRES_PORT still override the infrastructure ports; the default frontend/backend development ports remain 4200/8080. Changing those development ports also requires updating the Angular proxy or exact client redirects as appropriate.

The public Keycloak issuer stays http://localhost:8082/identity/realms/bus-management in both modes. In host mode, Keycloak itself publishes port 8082 on loopback; in the full stack, Caddy owns that port and proxies /identity. They cannot run on that port simultaneously. Continue using the host override for subsequent infrastructure up commands. Database-only work uses `docker compose up -d --wait db` without an override.

**Existing realm: one-time client update.** The checked-in import allows both application origins, but startup import skips existing realms. In the Keycloak admin console, select bus-management → Clients → bus-management → Settings. Preserve existing values; add http://localhost:4200/api/login/oauth2/code/keycloak under Valid redirect URIs and http://localhost:4200/overview under Valid post logout redirect URIs, then save. No wildcard, user recreation or volume reset is needed. These two entries were added to the existing local client during verification; fresh databases get them automatically from the import.

To return to the full container stack, stop host Angular and Spring Boot with Ctrl+C, then:

```bash
# Repository root; retains the database volume
docker compose -f compose.yaml -f compose.host.yaml down
docker compose up --build -d --wait --wait-timeout 240
```

The application is then at http://localhost:8082 again; no .env edits or issuer changes are required.

## Verification

```bash
cd backend
./gradlew clean test bootJar
# From the repository root:
docker compose --env-file .env.example build
python3 scripts/smoke-compose.py --report-dir container-test-results
```

Smoke uses a unique temporary project, fixed synthetic credentials and fresh data, not local .env or the normal database volume. It follows real OIDC forms for each role, checks role denials, session rotation, CSRF-protected application/SSO logout and passenger registration; checks that the new identity survives recreation and database recovery; then removes its resources. Its HTTP client matches browsers' Secure-cookie localhost exception only for synthetic localhost HTTP. Remote deployment must use HTTPS. --browser-tests additionally runs the existing Angular layout/accessibility suite. Container CI invokes the default smoke, so real authentication becomes part of that independent check without adding a second browser dependency.

No public deployment, email infrastructure, application account-management UI, immediate administrative session revocation or business ownership implementation is claimed by this foundation. See ADR 0003 for the next responsibilities.

## Local verification evidence

The final backend clean test bootJar passed all 31 tests (13 authentication cases plus the existing 18 persistence/health tests), with no failures or skips. Both application images build; base/dev Compose and Caddy validation pass. A real Chromium driver login completed through Keycloak and returned the expected account role. The fresh isolated smoke with --browser-tests passed all 38 existing browser cases against Caddy and all real identity checks, including registered-user persistence after recreation and recovery after database interruption. Temporary containers/network/volume were removed; the normal database and existing .env were not changed. Workflow syntax validates locally; hosted checks for this branch remain pending the user's push/PR. Identity-screen screen-reader/accessibility review and full Angular account flows remain next-slice coverage.

Host-mode follow-up: base/dev/host Compose configurations validate. With only PostgreSQL and Keycloak containers running, host Gradle bootRun applied/validated Flyway successfully and host Angular served the existing /api proxy. Real Chromium login for all three demo roles returned to localhost:4200 with the expected account and HttpOnly session; logout without CSRF was rejected, and valid logout cleared both Spring and Keycloak sessions and returned to Angular. The signup form was reachable (no additional local account created). Only the two exact host redirect URLs were added to the existing client; users, credentials, application data and .env were preserved. After simplifying the setup to two modes, base/host configurations were validated and the full isolated smoke passed again: real login/signup, role/CSRF checks, persistence across recreation and database outage/recovery. Its database used a dynamically assigned loopback port alongside the existing development database; its temporary containers/network/volume were removed. Application images were reused; the frontend browser suite was not repeated for this configuration-only follow-up.
