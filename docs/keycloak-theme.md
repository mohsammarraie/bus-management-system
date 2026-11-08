# Keycloak login theme

The bus-management login theme matches the Angular application's blue/orange palette, Arial typography, pale blue surfaces, rounded controls and bus mark. Keycloak still renders and processes login/registration. No Angular, React, Keycloakify, new npm dependency, SCSS compiler or custom authentication script is added to the identity service.

## Files and reading order

1. infra/keycloak/themes/bus-management/login/theme.properties inherits keycloak.v2 and loads its stylesheet before bus-management.css. Dark mode is disabled to match the frontend's current light theme.
2. resources/css/bus-management.css maps the frontend palette from frontend/src/styles/_theme.scss to local CSS variables and PatternFly controls. Layout uses logical properties for RTL, wrapping headers and a bounded responsive card; focus remains visible.
3. messages/messages_en.properties, messages_de.properties and messages_ar.properties provide neutral localized branding. Standard field labels, validation messages and language selection are inherited from Keycloak.
4. resources/img/bus.svg is the frontend favicon copied as a decorative brand mark and page favicon.
5. infra/keycloak/Dockerfile adds only these public assets to the existing digest-pinned Keycloak 26.8.2 runtime, retaining its non-root user. The allowlist .dockerignore excludes the realm file, bootstrap script and private configuration from this image build.
6. compose.yaml builds bus-management-system-keycloak:local; the fresh realm import selects loginTheme=bus-management. The master realm/admin console and account/email themes are unchanged.

No FreeMarker templates are copied: inherited fields, form actions, escaping, required-field hints, password visibility, locale direction and identity/session scripts remain owned by Keycloak. This reduces template drift during upgrades. This is a visual match; Angular Material components are not loaded into the identity provider's PatternFly pages.

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

## Verification

Build the stack images, then run:

```bash
docker compose --env-file .env.example build
python3 scripts/smoke-compose.py --browser-tests --report-dir container-test-results
```

The default Python identity smoke also checks that the configured theme stylesheet is present and served, so existing Container CI covers theme packaging without Chromium. The optional browser mode additionally checks actual login and registration in English, German and Arabic, normal/invalid-credentials/required-field-error states, language/direction, no horizontal overflow, password-toggle keyboard behavior and visible focus. It saves screenshots and axe violations/incomplete results to frontend/test-results/. It still verifies real role claims, passenger-only signup and application/SSO logout.

Theme scans supplement the application browser suite. Automated axe/keyboard results do not establish complete WCAG conformance; actual screen readers, additional browser engines and real devices remain manual follow-ups.

## Maintenance

The small CSS palette and icon copy deliberately avoid a cross-application asset build pipeline. When the Angular palette/icon changes, update this theme alongside it. CSS is ordinary browser CSS with variables; no SCSS build step is needed here.

When upgrading Keycloak, update the tag/digest in infra/keycloak/Dockerfile and inspect the new keycloak.v2 theme/PatternFly selectors before rerunning the identity checks. Do not edit bundled theme files. Authentication forms, errors and locale behavior must remain intact in both modes. No SMTP/email-verification feature is introduced by the theme.

References: [Keycloak theme inheritance and CSS](https://www.keycloak.org/ui-customization/themes), [Keycloak container customization](https://www.keycloak.org/server/containers).

## Local verification — 8 November 2026

The final themed image builds, both Compose modes validate, formatting/lint/e2e type checks and Python/realm syntax checks pass. Existing application source was unchanged; Java and Angular unit suites were not repeated. A host backend JAR was built for local-profile verification.

The final isolated full-stack smoke passed all 62 application browser cases with no retries/skips, the real identity flows, served-theme CSS, migrations, persistence after recreation and database outage/recovery. Twelve identity states were scanned: normal/error login and normal/required-field-error registration in each of en/de/ar. There were zero confirmed axe violations; incomplete aria-valid-attr-value results for inherited fields with empty aria-invalid attributes are retained for manual review. Keyboard tab order, password visibility and submit focus were exercised. The English desktop check also used a dark system preference and retained the frontend's light theme. Desktop and German/Arabic mobile screenshots were visually reviewed.

An independent disposable host-mode check ran Angular on 4200, a local-profile Spring Boot JAR on 8080 and Docker Keycloak/PostgreSQL, completing the same real role login/signup/logout flows and theme scans. Final card/focus CSS refinements were then checked in the full-stack run. Both test projects and the host application processes were removed. The existing local realm only received its theme selection; users, roles, credentials, application data and .env were preserved.

Source/Container CI for this branch remains pending the user's push/PR. Real screen readers, additional browser engines and real devices remain unverified. No public deployment or email feature is claimed.
