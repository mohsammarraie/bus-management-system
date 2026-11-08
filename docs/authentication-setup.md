# Authentication foundation: setup and API

See [ADR 0003](decisions/0003-backend-managed-keycloak-login.md) for the decision, browser-managed token comparison and limitations. The identity/backend foundation and Angular account integration are implemented. Keycloak login/registration styling is the next task; business screens and ownership rules follow afterward.

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

## Angular account integration

The header provides Log in / Sign up for visitors and an account link / Log out for signed-in users, translated in English, German and Arabic. Login/signup are normal browser links to the backend with the selected lang. Keycloak hosts the credential forms. Angular has no client secret, keycloak-js, JWT decoding or access/refresh tokens; only the language preference is persisted in browser storage.

| Frontend route | Access |
|---|---|
| /overview, /preferences | Public |
| /account | Any authenticated account |
| /administration | ADMIN |
| /driver | ADMIN or DRIVER |

The account page displays the username and roles. Administration/driver pages explicitly describe upcoming tools; they add no business APIs. Role-specific sidebar links are hidden when unavailable, and functional guards recheck /api/auth/me before allowing a protected route, including direct URLs and reloads. These are UI controls: Spring's API role checks remain the security boundary, and future trip services must also check ownership/assignment.

### State, failures and CSRF

AuthService owns a small in-memory signal state (loading, authenticated, anonymous or unavailable), with RxJS HTTP operations. Concurrent startup/guard checks share one request. A successful account lookup fetches fresh CSRF state before enabling actions. No NgRx store is introduced for this small identity view; Store/Effects/Entity are reserved for the first shared business-data feature.

An initial 401 is a normal anonymous visitor. A later 401 clears an existing identity and returns to the public overview with a localized session-ended message. Network/5xx failures show a separate connection message and retry action. A functional interceptor handles 401/403 from relative /api/ requests, preserving errors for the caller and never automatically replaying failed mutations. A 403 does not sign the user out. The backend's ?auth=failed redirect displays a translated login-failure message.

Account state is checked on initial load, protected navigation and persisted pageshow restoration; an old response cannot restore an identity invalidated by another API 401. There is no background polling or instantaneous multi-tab role/session synchronization. Expiry is discovered on the next check/API request. Role changes still require a new login under the MVP backend policy.

provideHttpClient retains Angular's default XSRF cookie/header support (XSRF-TOKEN / X-XSRF-TOKEN) for relative same-origin unsafe HTTP requests. Future mutations must use that /api contract after session/CSRF initialization. A CSRF/access rejection is shown without blindly retrying a write.

### Why logout uses a form

Logout crosses from the application to Keycloak and back, so a browser navigation must follow the redirects. A normal HttpClient POST would follow them as a fetch, potentially encounter cross-origin restrictions and leave the browser on the old page.

The logout button fetches /api/auth/csrf immediately before submission, then AccountControls fills the hidden _csrf input in its template-declared, same-origin POST form and submits it to /api/auth/logout. The _csrf field uses the endpoint's token, which is BREACH-masked for form submission. Angular's HTTP XSRF header instead uses the raw cookie token; these values must not be confused. Spring accepts the form token, invalidates its session and redirects through Keycloak logout to /overview. The new document initializes account state again and obtains fresh CSRF before authenticated actions.

ngNoForm keeps this form out of Angular form interception. The submit event is prevented while a fresh token is fetched; native form.submit() then continues browser navigation without re-entering that handler. The component sets the input value immediately before submission, so it does not depend on asynchronous template rendering.

A failed preparation or native submission leaves the account available and displays a retryable error; a successful navigation disables duplicate logout submission. Persisted-page restoration clears that navigation-busy state and checks the session again.

### Reading order and checks

Read core/auth/auth.service.ts first (prepareLogout manages token fetching and busy/error state), then shared/account-controls.html and shared/account-controls.ts for the browser flows; follow with core/auth/account.guard.ts, app.routes.ts and session.interceptor.ts. Component templates/SCSS remain separate, use Material/shared theme roles and preserve keyboard focus behavior and Arabic RTL.

Unit tests cover state transitions, request sharing, guard decisions, late-response invalidation, API failures, restored logout state and native submission of the template-declared form. The ordinary Playwright suite uses API fixtures from e2e/fixtures.ts and needs no database or Keycloak; these fixtures are test-only and never ship as application responses. Backend tests also verify the actual masked-token form contract.

For real Keycloak UI verification, build the images and run the existing isolated smoke with --browser-tests. It runs the deterministic UI suite against Caddy and then e2e/auth-browser-smoke.ts with Node 24: real admin/en, driver/de and passenger/ar login, route checks, HttpOnly sessions, browser/SSO logout, and passenger signup through the actual controls. New accounts exist only in the disposable database. The default container smoke still uses its standard-library HTTP verifier; no Chromium dependency is added to Container CI.

References: [Angular route guards](https://angular.dev/guide/routing/route-guards), [Angular HTTP interceptors](https://angular.dev/guide/http/interceptors) and [Spring SPA/form CSRF handling](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html).

Automated axe/keyboard/reflow checks cover delivered app states; real screen-reader, other browser-engine and full hosted identity-page accessibility review remain manual work. They do not establish full WCAG conformance.

## Next task: Keycloak visual theme

The hosted identity pages currently use Keycloak's supplied theme. A custom login/registration theme matching the frontend's blue/orange palette and neutral branding is next, before bus CRUD, including en/de/ar, RTL, responsive layouts and accessibility checks. Track the scope in [next steps](next-steps.md#next-implementation-keycloak-login-theme). This does not move credential handling into Angular.

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

Open http://localhost:4200. Use the Log in / Sign up controls, or visit http://localhost:4200/api/auth/login or /api/auth/signup directly. The existing Angular proxy sends /api/** to the host backend on 127.0.0.1:8080. Spring's local profile imports .env and defaults its application origin to http://localhost:4200; its token/JWK endpoints use the host-reachable Keycloak address. Do not set Docker-internal OIDC_INTERNAL_ISSUER in the host environment. Remove conflicting APP_PUBLIC_URL/OIDC_* overrides from earlier manual setup when using these defaults.

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

No public deployment, email infrastructure, profile-editing/user-administration UI, immediate administrative session revocation or business ownership implementation is claimed by this foundation. See ADR 0003 for the next responsibilities.

## Local verification evidence

The final backend clean test bootJar passed all 31 tests (13 authentication cases plus the existing 18 persistence/health tests), with no failures or skips. Both application images build; base/dev Compose and Caddy validation pass. A real Chromium driver login completed through Keycloak and returned the expected account role. The fresh isolated smoke with --browser-tests passed all 38 existing browser cases against Caddy and all real identity checks, including registered-user persistence after recreation and recovery after database interruption. Temporary containers/network/volume were removed; the normal database and existing .env were not changed. Workflow syntax validates locally; hosted checks for this branch remain pending the user's push/PR. Identity-screen screen-reader/accessibility review remains manual work; Angular account integration verification follows below.

Host-mode follow-up: base/dev/host Compose configurations validate. With only PostgreSQL and Keycloak containers running, host Gradle bootRun applied/validated Flyway successfully and host Angular served the existing /api proxy. Real Chromium login for all three demo roles returned to localhost:4200 with the expected account and HttpOnly session; logout without CSRF was rejected, and valid logout cleared both Spring and Keycloak sessions and returned to Angular. The signup form was reachable (no additional local account created). Only the two exact host redirect URLs were added to the existing client; users, credentials, application data and .env were preserved. After simplifying the setup to two modes, base/host configurations were validated and the full isolated smoke passed again: real login/signup, role/CSRF checks, persistence across recreation and database outage/recovery. Its database used a dynamically assigned loopback port alongside the existing development database; its temporary containers/network/volume were removed. Application images were reused; the frontend browser suite was not repeated for this configuration-only follow-up.

## Angular account verification — 8 November 2026

On feat/angular-account-integration, format/lint/browser-test type checking and all 24 frontend unit tests pass. Backend ./gradlew test passes all 32 cases, including the actual masked-token form logout check, with no failures/skips. The 62 deterministic desktop/mobile Chromium cases pass against both the dev server and the final Caddy image, including keyboard logout and simulated persisted-page restoration. The final frontend image builds within the existing budgets (672.34 kB raw initial / 149.27 kB estimated transfer); no dependency or backend production-code changes were needed.

The final isolated smoke with --browser-tests passed: actual admin/en desktop, driver/de mobile and passenger/ar mobile UI login; role-route checks; HttpOnly session; fresh-CSRF browser POST and Keycloak SSO logout; real UI signup granting PASSENGER only; then application/identity persistence after stack recreation and database outage/recovery. Desktop and German/Arabic mobile account screenshots were visually reviewed. Only disposable demo data was created; the temporary containers/network/volume were removed. Existing .env, database and users were not changed. Hosted CI remains pending the user's push/PR; real screen readers, other browser engines/devices and comprehensive hosted identity-page accessibility remain unverified.

Template-form follow-up: logout markup now lives in shared/account-controls.html, and the dynamic AuthNavigation helper has been removed. AuthService.prepareLogout returns a fresh masked token and owns busy/error state; AccountControls handles the declared input and native submission. All 24 frontend unit tests and 62 built-UI browser cases pass, including component checks for deferred/duplicate submission and retry after native submission failure. The rebuilt frontend and real Keycloak UI smoke also pass, including all three roles, passenger signup, SSO logout, persistence and database recovery. Backend production code and tests were unchanged in this follow-up; the previously verified 32 backend tests were not repeated.
