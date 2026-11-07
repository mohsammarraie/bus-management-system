# Frontend continuous integration

## Triggers and checks

`.github/workflows/frontend-ci.yml` defines **Frontend CI**, with the job **Frontend checks and browser tests**. It runs for PRs targeting main, pushes to main and manual dispatches. No path filters are used, so documentation PRs receive the same check. A feature-branch push alone does not trigger it; open a PR targeting main. Manual dispatch is available in the Actions UI after the workflow reaches the default branch.

The Ubuntu 24.04 job selects Node from `frontend/.nvmrc` (currently 24.22.2), installs npm 11.19.1 to match packageManager, then runs from frontend/:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck:e2e
npm run test:ci
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

The job sets CI=true. Playwright starts its own loopback development server, forbids focused tests, uses two workers, allows one retry and bounds the whole browser suite to five minutes so reporters can finish. The job timeout is 20 minutes. Tests exercise desktop/mobile Chromium, localization, keyboard navigation, reflow and axe accessibility scans. They do not establish full WCAG conformance or real-device/screen-reader coverage. No backend, Docker database, .env, private data or repository secrets are needed. Full-stack/container tests follow their implementation.

## Permissions, cache and diagnostics

- Token permissions are contents: read; checkout does not persist credentials. No deployment, image upload, pull_request_target or write access is configured.
- All actions use full release commit SHAs. Verified official releases: checkout v7.0.1 (`3d3c42e5aac5ba805825da76410c181273ba90b1`), setup-node v7.1.0 (`949feb2413d6458794dcd2491c4babbbce0c15c1`), upload-artifact v7.0.2 (`cf430e030ddbb5b0abf93d22962f4752f3646cd9`). Review release and input compatibility when updating pins. Update npm here when packageManager changes.
- setup-node manages the npm download cache keyed by frontend/package-lock.json. It does not cache node_modules, browser binaries or build outputs. PR cache saves use GitHub's PR scope; this differs from the backend's explicitly read-only PR Gradle cache. npm ci always reconstructs dependencies from the lockfile.
- Concurrency cancels superseded runs on the same workflow/ref.
- The final step attempts upload on success or failure unless cancelled. frontend-browser-reports contains only playwright-report/ and test-results/, retained for seven days. HTML includes axe violations and manual-review attachments; failure diagnostics include retained traces/screenshots. Unit/build diagnostics are in step logs. If an early step fails before reports exist, upload warns while the original failure remains failed.
- Production assets are compiled for verification and are not published. Branch protection is unchanged; making this check required is a separate repository setting.

## Verification and publication

Local validation passed with Node 24.22.2/npm 11.19.1: clean npm ci (zero known audit findings), format/lint/browser-test type checks, all eight unit tests, production build and all 38 browser cases with CI=true (no retries/skips). actionlint 1.7.12 validated both workflows; ShellCheck was disabled because it is not installed. Action release commits and setup-node inputs were checked against official GitHub metadata. Local validation does not execute GitHub JavaScript actions or reproduce the hosted runner.

A dry run of the Chromium --with-deps installer reported seven missing local packages (six font packages and xvfb) and exited nonzero. No OS packages were installed locally. The headless browser suite passed using the existing Chromium installation; the actual hosted dependency-install step remains unverified until publication. On a local machine with Chromium/system libraries installed, CI=true npm run test:e2e exercises CI mode without installing OS packages. The workflow installs Chromium system dependencies on its disposable hosted runner.

**Hosted status: verified successful after merge through PR #7.** The [PR run](https://github.com/mohsammarraie/bus-management-system/actions/runs/42315912538) at 29c64ac and the [main push run](https://github.com/mohsammarraie/bus-management-system/actions/runs/42316124028) at 7d30dbe both completed successfully, verified through the public Actions API. Check future runs individually and inspect frontend-browser-reports on the run summary. Branch protection remains unchanged.

## References

- [setup-node caching and inputs](https://github.com/actions/setup-node)
- [Playwright CI setup](https://playwright.dev/docs/ci-intro)
- [GitHub cache scope](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#restrictions-for-accessing-a-cache)
- [Artifact upload](https://github.com/actions/upload-artifact)
