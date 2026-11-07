# Frontend continuous integration

## Triggers and checks

`.github/workflows/frontend-ci.yml` defines **Frontend CI**, with two independent jobs: **Frontend checks and build** (`frontend`) and **Frontend browser and accessibility tests** (`e2e`). It runs for PRs targeting main, pushes to main and manual dispatches. No path filters are used, so documentation PRs receive the same check. A feature-branch push alone does not trigger it; open a PR targeting main. Manual dispatch is available in the Actions UI after the workflow reaches the default branch.

Both Ubuntu 24.04 jobs select Node from frontend/.nvmrc (currently 24.22.2), install npm 11.19.1, restore the lockfile-keyed npm download cache and run npm ci. They have no needs dependency and can run in parallel, subject to runner availability. Each job sets CI=true and runs commands from frontend/.

The checks/build job has a ten-minute timeout and runs:

```bash
npm run format:check
npm run lint
npm run typecheck:e2e
npm run test:ci
npm run build
```

The browser job has a twenty-minute timeout and runs:

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

Only the browser job installs Chromium and uploads browser reports. Playwright starts its own loopback development server, so it does not depend on production assets from the other job. It forbids focused tests, uses two workers, allows one retry and bounds the browser suite to five minutes so reporters can finish. Tests cover desktop/mobile Chromium, localization, keyboard navigation, reflow and axe scans; they do not establish full WCAG conformance or real-device/screen-reader coverage. Neither job requires backend/database services or repository secrets. Packaged stack checks remain in the independent Container CI workflow.

This split makes source/build results available without waiting for browser setup. It does not speed up Chromium installation itself. Two jobs repeat checkout/npm setup, which can increase runner usage. Both checks must pass for the workflow to succeed. If the previous combined check was required by branch protection, update that setting to require both new names; this task does not change repository settings.

## Permissions, cache and diagnostics

- Token permissions are contents: read; checkout does not persist credentials. No deployment, image upload, pull_request_target or write access is configured.
- All actions use full release commit SHAs. Verified official releases: checkout v7.0.1 (`3d3c42e5aac5ba805825da76410c181273ba90b1`), setup-node v7.1.0 (`949feb2413d6458794dcd2491c4babbbce0c15c1`), upload-artifact v7.0.2 (`cf430e030ddbb5b0abf93d22962f4752f3646cd9`). Review release and input compatibility when updating pins. Update npm here when packageManager changes.
- setup-node manages the npm download cache keyed by frontend/package-lock.json. It does not cache node_modules, browser binaries or build outputs. PR cache saves use GitHub's PR scope; this differs from the backend's explicitly read-only PR Gradle cache. npm ci always reconstructs dependencies from the lockfile.
- Concurrency cancels superseded runs on the same workflow/ref.
- The browser job's final step attempts upload on success or failure unless cancelled. frontend-browser-reports contains only playwright-report/ and test-results/, retained for seven days. HTML includes axe violations and manual-review attachments; failure diagnostics include retained traces/screenshots. Unit/build diagnostics are in step logs. If an early step fails before reports exist, upload warns while the original failure remains failed.
- Production assets are compiled for verification and are not published. Branch protection is unchanged; making this check required is a separate repository setting.

## Verification and publication

Local validation passed with Node 24.22.2/npm 11.19.1: clean npm ci (zero known audit findings), format/lint/browser-test type checks, all eight unit tests, production build and all 38 browser cases with CI=true (no retries/skips). actionlint 1.7.12 validated all three workflows; ShellCheck was disabled because it is not installed. Action release commits and setup-node inputs were checked against official GitHub metadata. Local validation does not execute GitHub JavaScript actions or reproduce the hosted runner.

A dry run of the Chromium --with-deps installer reported seven missing local packages (six font packages and xvfb) and exited nonzero. No OS packages were installed locally. The headless browser suite passed using the existing Chromium installation; the subsequent combined-job hosted runs below verified browser setup successfully. On a local machine with Chromium/system libraries installed, CI=true npm run test:e2e exercises CI mode without installing OS packages. The workflow installs Chromium system dependencies on its disposable hosted runner.

**Previous combined job: verified successful after merge through PR #7.** The [PR run](https://github.com/mohsammarraie/bus-management-system/actions/runs/42315912538) at 29c64ac and the [main push run](https://github.com/mohsammarraie/bus-management-system/actions/runs/42316124028) at 7d30dbe both completed successfully, verified through the public Actions API. Check future runs individually and inspect frontend-browser-reports on the run summary. Branch protection remains unchanged.

## Split-job verification and timing comparison

The split jobs require a new hosted run after publication; previous successful combined runs do not verify the new topology. After splitting, a clean npm ci, formatting, lint, browser-test type checking, all eight unit tests, the production build and all 38 CI-mode browser cases passed locally (no retries/skips). All three workflows passed actionlint 1.7.12 with ShellCheck disabled. Local execution does not establish GitHub scheduling or performance; the hosted Chromium/system-package install was not rerun locally.

Timing baseline from the [combined PR #9 frontend run](https://github.com/mohsammarraie/bus-management-system/actions/runs/42320952868): whole job 5m20s, production build 3s, Chromium/system-dependency installation 4m12s, browser tests 40s. After pushing and opening a PR, compare the checks/build job duration, browser job duration, browser-install step and total workflow completion (including queue time). The expected benefit is earlier source/build feedback; the full workflow may remain dominated by browser setup. No browser-image change or browser cache is introduced in this split.

## References

- [setup-node caching and inputs](https://github.com/actions/setup-node)
- [Playwright CI setup](https://playwright.dev/docs/ci-intro)
- [GitHub cache scope](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows#restrictions-for-accessing-a-cache)
- [Artifact upload](https://github.com/actions/upload-artifact)
