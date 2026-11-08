# Keycloak login theme

The bus-management login theme matches the Angular application's blue/orange palette, light/dark surfaces, Arial typography, rounded controls and bus mark. Keycloak still renders and processes login/registration. A small appearance script reads a cosmetic preference; no Angular, React, Keycloakify, new npm dependency, SCSS compiler or custom authentication logic is added to the identity service.

## Files and reading order

1. infra/keycloak/themes/bus-management/login/theme.properties inherits keycloak.v2 and loads its stylesheet before bus-management.css. It loads js/appearance.js and disables the inherited automatic dark-mode script so that it cannot override an explicit Light/Dark selection.
2. resources/css/bus-management.css maps the frontend palette from frontend/src/styles/_theme.scss to local CSS variables and PatternFly controls. Layout uses logical properties for RTL, wrapping headers and a bounded responsive card; focus remains visible.
3. messages/messages_en.properties, messages_de.properties and messages_ar.properties provide neutral localized branding. Standard field labels, validation messages and language selection are inherited from Keycloak.
4. resources/img/bus.svg is the frontend favicon copied as a decorative brand mark and page favicon.
5. infra/keycloak/Dockerfile adds only these public assets to the existing digest-pinned Keycloak 26.8.2 runtime, retaining its non-root user. At build time it adds a 12-character SHA-256 content hash to the custom CSS/JavaScript filenames and updates the image's theme.properties references. The allowlist .dockerignore excludes the realm file, bootstrap script and private configuration from this image build.
6. compose.yaml builds bus-management-system-keycloak:local; the fresh realm import selects loginTheme=bus-management. The master realm/admin console and account/email themes are unchanged.

No FreeMarker templates are copied: inherited fields, form actions, escaping, required-field hints, password visibility, locale direction and identity/session scripts remain owned by Keycloak. This reduces template drift during upgrades. This is a visual match; Angular Material components are not loaded into the identity provider's PatternFly pages.

## Appearance preference

Preferences → Appearance offers **Light / Dark / System** in English, German and Arabic. System is the default and responds immediately to device appearance changes; an explicit Light/Dark selection overrides the device. Switching changes colors without navigating, signing out or clearing form data.

The saved value is a host-only cookie named `bus-management.appearance`, with a one-year lifetime, `Path=/`, `SameSite=Lax`, and `Secure` on HTTPS. Only `light`, `dark` and `system` are accepted. Missing/invalid values fall back to System. If browser storage is blocked, Angular can still change its current appearance, but persistence and sharing with another document are unavailable. The preference belongs to this browser, rather than a Keycloak user profile.

The cookie is deliberately readable by these cosmetic scripts, so it is not HttpOnly. It contains no user identifier, password, JWT or session value; it grants no permissions. Authentication cookies, server-side tokens, CSRF and role checks are unchanged. A cookie supplies one shared preference across the two localhost ports; localStorage alone would be isolated by origin.

Reading order for the new flow:

1. `frontend/public/appearance.js` reads the allowlisted cookie in the document head before Angular/styles render. `frontend/src/index.html` loads it. This applies a saved preference early and avoids waiting for a lazy preferences route.
2. `frontend/src/app/core/appearance/theme.service.ts` restores/persists the choice and updates `html[data-theme]`; the Preferences component binds labelled Material radio controls to its signal.
3. `frontend/src/styles/_theme.scss` sets `color-scheme` and paired `light-dark()` Material roles. Existing semantic tokens carry those colors into components and document-level overlays. System delegates live changes to CSS, without an Angular media-query subscription or a new store.
4. Keycloak's `resources/js/appearance.js` reads the same cookie before form rendering and on page restoration. It sets the same attribute and maintains the inherited PatternFly dark class, including live system changes. `darkMode=false` disables the competing inherited script, not our dark appearance.
5. `resources/css/bus-management.css` supplies matching light/dark surfaces, text, buttons, focus and error colors. These scripts only change appearance; Keycloak still owns forms and validation.

Use **localhost consistently**: full stack is `http://localhost:8082`; host development uses Angular at `http://localhost:4200` and Keycloak at `http://localhost:8082/identity`. Cookies are shared across ports on that hostname. Mixing `127.0.0.1` and `localhost` creates separate cookie scopes. The planned deployed proxy similarly serves the application and `/identity` on one hostname. A future separate identity hostname needs an explicit design for preference transfer; this cookie does not cross unrelated hosts.

Rebuild the frontend and Keycloak images to apply this feature. No realm setting, credential, database migration or volume reset is required when `bus-management` is already the selected login theme. The admin/account consoles retain their own themes.

## Run and activate

Fresh databases select the theme automatically through the realm import. Both local modes use the same themed image:

```bash
# Full stack, from the repository root:
docker compose up --build -d --wait --wait-timeout 240
```

```bash
# Host Angular/Spring Boot; stop the full stack first to release port 8082:
docker compose -f compose.yaml -f compose.host.yaml up --build -d --wait --wait-timeout 240 keycloak
```

Keep existing .env credentials and the PostgreSQL volume. For host backend/frontend commands and switching modes, see [authentication setup](authentication-setup.md#angular-and-spring-boot-on-the-host).

**Existing realms need one theme-setting update.** Keycloak startup skips an existing realm, so editing the import does not update its loginTheme. After starting the themed image, open http://localhost:8082/identity/admin/, sign in with local-admin / KEYCLOAK_ADMIN_PASSWORD, select bus-management → Realm settings → Themes → Login theme → bus-management → Save. Preserve all other settings and users. Changing this setting requires no user recreation, password reset or volume deletion.

For this local checkout, the existing realm's loginTheme was selected during verification. Its other realm settings and user count were checked before/after and remained unchanged. Local containers were returned to their original stopped state, retaining the database volume.

Theme changes are baked into the image: rebuild/recreate Keycloak after editing assets, then open a fresh login page; a cached browser page may need reloading. Theme caching remains enabled for ordinary runs. For a deliberate rollback, select keycloak.v2 as the realm's login theme. Keep the custom image available while the custom theme is selected.

### Updating a previously cached theme

Keycloak serves static theme files with `Cache-Control: max-age=2592000` (30 days in the pinned version). Previously, a rebuilt image reused the same custom CSS URL. A browser could therefore retain the old light-only stylesheet even though the saved cookie and appearance script selected Dark. Fresh browser contexts did not expose that upgrade problem.

The identity image now publishes `css/bus-management.<content-hash>.css` and `js/appearance.<content-hash>.js`. Changed bytes produce new URLs, while unchanged assets retain normal caching. Source filenames remain readable and no FreeMarker override, extra dependency or global cache disabling is needed. The HTTP smoke checks both hashed URL shapes and their actual content digests. Rebuild/recreate Keycloak and reopen or normally reload the login page; no database reset is needed.

## Verification

Build the stack images, then run:

```bash
docker compose --env-file .env.example build
python3 scripts/smoke-compose.py --browser-tests --report-dir container-test-results
```

The default Python identity smoke checks that the configured stylesheet and appearance script are present and served, so existing Container CI covers theme packaging without Chromium. The optional browser mode checks all three preferences, including explicit overrides of opposite device settings and live System changes, on actual login and registration in English, German and Arabic. It covers normal/invalid-credentials/required-field-error states, language/direction, no horizontal overflow, password-toggle keyboard behavior and visible focus. It saves preference-specific screenshots and axe violations/incomplete results to frontend/test-results/. It still verifies real role claims, passenger-only signup and application/SSO logout.

Theme scans supplement the application browser suite. Automated axe/keyboard results do not establish complete WCAG conformance; actual screen readers, additional browser engines and real devices remain manual follow-ups.

## Maintenance

The small CSS palette and icon copy deliberately avoid a cross-application asset build pipeline. When the Angular palette/icon changes, update this theme alongside it. Keep the appearance cookie name, value allowlist and fallback aligned across the two independently packaged bootstraps and ThemeService. CSS is ordinary browser CSS with variables; no SCSS build step is needed here.

When upgrading Keycloak, update the tag/digest in infra/keycloak/Dockerfile and inspect the new keycloak.v2 theme/PatternFly selectors before rerunning the identity checks. Do not edit bundled theme files. Authentication forms, errors and locale behavior must remain intact in both modes. No SMTP/email-verification feature is introduced by the theme.

References: [Angular Material theming](https://material.angular.dev/guide/theming), [Keycloak theme inheritance and CSS](https://www.keycloak.org/ui-customization/themes), [Keycloak container customization](https://www.keycloak.org/server/containers).

## Original light-theme verification — 8 November 2026

The final themed image builds, both Compose modes validate, formatting/lint/e2e type checks and Python/realm syntax checks pass. Existing application source was unchanged; Java and Angular unit suites were not repeated. A host backend JAR was built for local-profile verification.

The final isolated full-stack smoke passed all 62 application browser cases with no retries/skips, the real identity flows, served-theme CSS, migrations, persistence after recreation and database outage/recovery. Twelve identity states were scanned: normal/error login and normal/required-field-error registration in each of en/de/ar. There were zero confirmed axe violations; incomplete aria-valid-attr-value results for inherited fields with empty aria-invalid attributes are retained for manual review. Keyboard tab order, password visibility and submit focus were exercised. The English desktop check also used a dark system preference and retained the frontend's light theme. Desktop and German/Arabic mobile screenshots were visually reviewed.

An independent disposable host-mode check ran Angular on 4200, a local-profile Spring Boot JAR on 8080 and Docker Keycloak/PostgreSQL, completing the same real role login/signup/logout flows and theme scans. Final card/focus CSS refinements were then checked in the full-stack run. Both test projects and the host application processes were removed. The existing local realm only received its theme selection; users, roles, credentials, application data and .env were preserved.

These results describe the original light-theme task. The user has since merged that branch. Real screen readers, additional browser engines and real devices remain unverified. No public deployment or email feature is claimed.

## Appearance feature verification — 8 November 2026

On `feat/theme-preferences`, lint/format/e2e type checks, the production Angular build and all 29 unit tests passed. The isolated full-stack run passed all 86 application browser cases without retries/skips and completed the HTTP identity checks, migration/persistence/recreation and database outage/recovery. This reused the unchanged backend image; Java unit tests were not repeated.

Real identity browser checks scanned 36 states: login, invalid-password login, registration and required-field registration errors, for Light/Dark/System in each of en/de/ar. There were zero confirmed axe violations; 36 incomplete `aria-valid-attr-value` entries for inherited empty `aria-invalid` attributes remain for manual review. Explicit selections were checked against opposite device settings, and live System changes preserved entered form values. Real roles, passenger signup, session cookies and browser/SSO logout still passed.

An independent isolated host-mode run also passed those real identity flows with Angular on localhost:4200, Spring Boot on 8080 and Docker Keycloak on 18083 (a separate test port), verifying cross-port cookie sharing. Screenshots of the dark overview/preferences, English login and Arabic mobile registration were reviewed. Shared dark text/control color pairs were additionally calculated at a minimum 5.88:1 contrast; this is not a full interactive-state conformance audit.

The first standalone dev-server suite passed 85/86 cases; an existing mobile logout-error case failed transiently and passed its separate recheck. The complete production-image run passed all 86 without retries. All eight final focused appearance browser checks passed, including the open dark language overlay and keyboard focus. Temporary test stacks/volumes and host processes were removed; the normal local stack, its users, data and .env were preserved. Hosted CI awaits the user's commit/push/PR. Screen-reader and additional-browser checks remain manual.


## Cached-upgrade fix verification — 8 November 2026

A fresh browser on the normal running stack already applied the saved dark preference correctly. Public response headers showed the fixed custom asset URLs had a 30-day cache lifetime, so fresh-context checks had missed an upgrade path. A temporary local HTTP proxy then primed a Chromium browser with the preceding committed light-only CSS at the original URL, using the same cache lifetime. Both login and signup stayed light despite the dark cookie, reproducing the reported symptom. The browser fetched that legacy CSS only once and retained it in cache.

After building the content-hashed identity image and recreating only the normal Keycloak container, that same open browser passed Dark and Light on both login and signup while still retaining the legacy cached response. Live CSS/JavaScript responses matched their filename hashes; application/database health remained UP. The updated browser selector, e2e type check, formatting, Python syntax and diff checks passed. Full unit/browser suites were not repeated for this packaging-only fix. Databases, realm settings and accounts were not changed; no credential was submitted in this regression check. The temporary browser/proxy were closed. Changes remain on the existing uncommitted feature branch.
