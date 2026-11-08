# Container continuous integration

## Scope and execution

.github/workflows/container-ci.yml defines **Container CI**, job **Container builds and Compose smoke**. It runs independently on PRs targeting main, pushes to main and manual dispatch, without path filters. A feature-branch push alone does not trigger it; open a PR to main. Manual dispatch is available from the Actions UI once merged into the default branch.

The Ubuntu 24.04 runner supplies Docker, Compose, Python 3 and GNU timeout. Java/Node build tools run inside the images. The job validates Compose with .env.example, builds frontend, backend and themed Keycloak images, then runs:

```bash
timeout --signal=INT --kill-after=60s 8m python3 scripts/smoke-compose.py --report-dir container-test-results
```

This is one existing integration smoke scenario, not another full frontend/backend test suite. It checks startup/health, page and API routing, non-root application users, versioned Flyway history, synthetic bus persistence across stack recreation and database outage/recovery. The authentication foundation extends that same scenario with real OIDC login, signup, role mapping, CSRF logout and registered identity persistence; no password grant or browser dependency is added. Source unit/integration tests remain in Backend CI; frontend unit and all 38 browser cases remain in Frontend CI. Optional local --browser-tests coverage is unchanged and is not enabled here.

Images are built locally on the runner and never pushed to a registry. No login, deployment or repository secret is needed. The smoke check creates its own unique project and synthetic credentials; it does not operate on the normal development stack. .env.example config validation/build also avoid loading a private local .env.

## Limits and diagnostics

- Read-only contents token; checkout credentials are not persisted. Checkout v7.0.1 and upload-artifact v7.0.2 reuse the verified full release commit pins used by the other workflows. No pull_request_target execution or registry permissions.
- Same-ref concurrency cancels superseded runs. Job timeout: 25 minutes; build step: 15 minutes; smoke command: eight minutes plus a 60-second shutdown grace. GNU timeout sends SIGINT so Python can save diagnostics and clean up; forced termination can still prevent cleanup/report upload. The hosted runner is disposable. A local interrupted run may need removal of its printed bms-smoke-* project.
- --report-dir optionally records compose-status.json, compose-logs.txt (last 200 lines per service) and result.json before cleanup. Commands have 15-second diagnostic timeouts; diagnostic errors are reported without deliberately bypassing cleanup or hiding the test failure. Result describes the smoke assertions; a later cleanup error still fails the command.
- The artifact container-smoke-reports uploads after success/failure unless cancelled, with seven-day retention. Build diagnostics remain in Actions step logs. Early build/tool failures may leave no smoke files; upload warns while the original failure remains failed. Reports contain only synthetic-project data, not full docker inspect output, credentials/config dumps or private database exports. Generated report files are ignored by Git.
- No persistent cross-run Docker cache is configured initially. Builds can reuse layers within a job; a hosted run must work from an empty cache. This keeps the first workflow small; revisit caching after measuring actual hosted build cost.

## Local validation and hosted status

Local validation passed: Compose configuration and both image builds, the exact eight-minute-bounded smoke command, and actionlint 1.7.12 for all three workflows (ShellCheck disabled because unavailable). Official checkout/upload release pins were verified. Successful diagnostics contain a passed summary; deliberately interrupted runs produced failed summaries and retained status/logs, with their temporary resources removed. Local Docker subprocess termination raised PermissionError after the interrupt, so the recorded error reflects that host limitation rather than a plain KeyboardInterrupt. Hosted signal/cleanup behavior remains unverified. No application source, Dockerfile, source workflow or dependency changed; unit/browser suites were not repeated in this CI-only task. Local builds reused existing Docker caches, so fresh hosted execution remains pending. The application Dockerfiles and existing source CI workflows are unchanged by this step.

**Hosted container CI: pending publication and an observed run.** Commit/push this branch and open a PR targeting main, then verify all three independent checks and download the container artifact from the run summary. No branch-protection changes are made here.

References: [artifact upload](https://github.com/actions/upload-artifact), [bounded Compose logs](https://docs.docker.com/reference/cli/docker/compose/logs/).
