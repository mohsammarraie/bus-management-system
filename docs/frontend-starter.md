# Frontend starter setup and design

## Scope and versions

| Component | Pinned/tested version |
|---|---|
| Node / npm | 24.22.2 / 11.19.1; .nvmrc and package engines describe the baseline |
| Angular framework | 22.2.5 |
| Angular CLI / build | 22.2.6 |
| Material / CDK | 22.2.6 |
| TypeScript / RxJS | 6.0.3 / 7.8.2 |
| Transloco | Stable 8.4.0 |
| Angular ESLint / ESLint | 22.6.0 / 10.14.0 |
| Vitest / Playwright / axe Playwright | 5.1.0 / 1.65.0 / 4.14.0 |

The app was generated with the official Angular CLI, standalone components, routing and SCSS. TypeScript strict mode and strict template checking are explicitly enabled. Direct dependency versions and package-lock.json are committed for reproducible installs. No global Angular CLI is required.

## Run and check

From the repository root:

```bash
cd frontend
# If using nvm, select the .nvmrc version with nvm install and nvm use.
npm ci
npm start
```

Open http://localhost:4200. The overview and preferences pages require no backend/database. Unknown paths display a localized recovery page; refreshing a nested route works through the dev server's SPA fallback.

```bash
npm run format:check
npm run lint
npm run typecheck:e2e
npm run test:ci
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` watches unit tests. Playwright starts the dev server on loopback port 4200 if it is not already running. It uses Chromium desktop and Pixel 7 viewport/touch emulation; it does not claim real Android/iOS or Safari verification. Browser binaries live in the normal Playwright cache, outside Git. Reports/traces and build/cache directories are ignored.

Production assets are emitted to `frontend/dist/bus-management-system/browser/`. A production static server must route unknown non-asset paths to index.html for SPA routing. That server, application Dockerfiles and deployment configuration are later tasks.

The development proxy forwards `/api/**` to `http://127.0.0.1:8080`; change proxy.conf.json if the host backend uses another port. No frontend API calls or backend business endpoints are implemented yet. This proxy is a development facility, not production routing.

## Responsibilities

- App owns the responsive shell: desktop sidenav, mobile overlay navigation, accessible menu/skip controls, route outlet and persistent header language selector.
- Overview describes future buses/routes/trips with clearly marked coming-soon cards. It contains no fabricated operational counts or fake API responses.
- Preferences demonstrates selected-language formatting with explicitly labeled example values. The example date uses UTC and does not define future trip timezone behavior.
- Feature pages are standalone, OnPush and lazy-loaded. The shell uses supported Material theme overrides, logical layout properties and bundled vector icons/system fonts; no external font request is required.
- core/i18n contains bundled en/de/ar JSON resources, the Transloco provider/loader and LanguageService. The validated saved preference defaults to English; document lang/dir, Material direction and displayed messages change together. Storage is best-effort and contains only the language code. PageTitleStrategy combines the translated route title and app name, updating on navigation and language changes.

[ADR 0002](decisions/0002-frontend-localization.md) records the translation choice. API codes, stored route names and user comments are independent of display language. Login, CRUD, mapping and NgRx feature stores follow their actual use-case slices; no placeholder store or authentication flow is introduced by this starter.

## Component files and shared styling

Every component uses external HTML and SCSS, including preferences, language switcher, icon, bus illustration and not-found. Component TypeScript contains behavior and metadata; local SCSS contains its layout/responsive rules. The overview delegates its decorative artwork to a feature-local BusIllustration component; the shared Icon component handles small symbols. The illustration retains inherited theme colors and stays hidden from assistive technology.

- `src/styles/_theme.scss`: one global Material theme using the built-in azure/orange palettes and a small set of role overrides. The application palette uses blue `#0D86C8` and orange-gold `#F5AA00`. A darker primary blue supports readable white text; surfaces use light blue, white and dark ink. The application keeps its generic identity and its own icon.
- `src/styles/_tokens.scss`: semantic CSS variables mapped to Material roles, shared by component styles and the decorative SVG. Colors are not repeated inside component markup/styles.
- `src/styles.scss`: imports the theme/tokens once, then holds resets, focus styles and shared typography. Layout spacing remains local; this is not an additional design-system framework.

This organization change adds extracted files and two shared styling partials. It introduces no new dependencies or feature logic. The standalone favicon and browser theme-color metadata use matching fixed colors because they cannot inherit document CSS variables.

## Accessibility

Target WCAG 2.2 Level AA as features are delivered. The current starter provides named navigation/main landmarks, a single route heading, localized route-specific browser titles, labelled controls and decorative icons hidden from assistive technology. Upcoming features are readable static list items rather than misleading links.

The first Tab reveals the skip link. Activating it focuses main content without changing the route. In-app navigation focuses the new page heading; the initial load preserves normal Tab order. Material supplies keyboard selection and the mobile drawer focus trap, Escape handling, focus restoration and inert background. The drawer exposes a labelled modal dialog on mobile and a complementary landmark on desktop. Visible focus styles remain enabled. The sidebar footer participates in document flow so short viewports can scroll without overlapping navigation.

`e2e/accessibility.spec.ts` adds axe scans with WCAG 2 A/AA, 2.1 A/AA, 2.2 AA and best-practice tags for all three pages/languages on desktop/mobile Chromium. Keyboard cases cover skip navigation, menu focus containment/Escape, route focus, language selection and RTL. Reflow checks use 320 CSS pixels, WCAG text-spacing overrides and a short menu viewport. Reducing the viewport tests reflow behavior; actual browser zoom and operating-system text scaling still need manual review.

Playwright report attachments retain both confirmed axe violations and incomplete results under `manualReview`; incomplete results are not passes. Axe requests manual contrast review for some Material overlay/nav text, and ARIA review for the popup relationship. A direct browser assertion verifies the open selector's aria-controls matches the visible listbox ID. Main theme text pairs have been checked separately; interactive states and assistive-technology behavior still need human review.

Before claiming conformance, test the delivered flows with a real screen reader (for example NVDA with Firefox or VoiceOver with Safari): landmarks and heading navigation, route/title announcements, language pronunciation, selector options, modal entry/exit and focus order. Also review browser zoom/text scaling, contrast in interaction states and high-contrast/forced-colors mode. Current automated/keyboard checks do not establish full WCAG conformance or replace these checks.

## Dependency and bundle decisions

The generated lint dependency graph included minimatch 10 affected by [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). A targeted npm override selects patched minimatch 11.0.5 for affected versions, compatible with Node 24. This crosses the upstream lint tools' requested major range; lint/build/tests must remain part of verification, and the override should be reviewed/removed when upstream adopts a patched version. No force-based dependency upgrade was used. The clean npm ci audit reported zero known vulnerabilities at verification time.

The measured initial production bundle is about 641 kB raw / 138 kB estimated transfer, including Material and the bundled language infrastructure. Budgets are 700 kB warning and 850 kB error for the initial bundle; page routes remain lazy. These replace the minimal CLI welcome-page budget with a measured starter baseline. They are size guards, not a performance benchmark.

## Verification

Verified locally with Node 24.22.2 and npm 11.19.1:

- A clean `npm ci` reproduced the lockfile. The final dependency installation reported zero known audit findings.
- `npm run format:check`, `npm run lint` (including browser test sources/config) and `npm run typecheck:e2e` passed.
- `npm run test:ci`: eight tests passed for initial/restored/invalid language preferences, Arabic direction and persistence, blocked storage, locale formatting and dictionary completeness.
- `npm run build`: production build passed within its size budgets (641.08 kB raw initial / 138.19 kB estimated transfer).
- `npm run test:e2e`: 38 desktop/mobile Chromium cases passed, including the original routing/localization cases and 28 accessibility cases. Axe scans reported no confirmed violations in the tested states; manual-review attachments remain available in the Playwright report.
- Additional manual Chromium checks found no horizontal overflow in German/Arabic overview layouts at widths 320, 360, 768 and 1024. Desktop/tablet/Arabic-mobile screenshots were captured; desktop and Arabic-mobile screens were visually inspected.

After the accessibility update, format/lint/type checks, all eight unit tests, all 38 browser cases and the production build passed. All seven components retain external template/style references. Real screen-reader and additional browser-engine checks are still pending.

Frontend CI is configured; hosted verification is pending publication and an observed run. See [frontend CI](frontend-ci.md). Backend CI is merged and independently verified successful. No backend code or business behavior changed, so its unchanged test suite was not rerun in this frontend task. Real-device testing and other browser engines remain future coverage.

## Official references

- [Angular compatibility](https://angular.dev/reference/versions)
- [Angular testing](https://angular.dev/guide/testing)
- [Angular Material theming](https://material.angular.dev/guide/theming)
- [Transloco](https://jsverse.gitbook.io/transloco)
- [Playwright](https://playwright.dev/docs/intro)
- [WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/)
- [Playwright accessibility testing and limitations](https://playwright.dev/docs/accessibility-testing)
