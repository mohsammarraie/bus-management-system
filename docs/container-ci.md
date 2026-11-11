# Container continuous integration

## Scope and execution

.github/workflows/container-ci.yml defines **Container CI**, job **Container builds and Compose smoke**. It runs independently on PRs targeting main, pushes to main and manual dispatch, without path filters. A feature-branch push alone does not trigger it; open a PR to main. Manual dispatch is available from the Actions UI once merged into the default branch.

The Ubuntu 24.04 runner supplies Docker, Compose, Python 3 and GNU timeout. Java/Node build tools run inside the images. The job validates Compose with .env.example, builds frontend, backend and themed Keycloak images, then runs:

```bash
timeout --signal=INT --kill-after=60s 8m python3 scripts/smoke-compose.py --report-dir container-test-results
```

The local-stack scenario checks routing, migrations, OIDC/roles/CSRF, demo data, persistence and database recovery. Backend/frontend suites remain independent; optional local --browser-tests coverage is unchanged and is not enabled here. The heavier [AWS-config smoke check](aws-deployment.md#local-verification-and-follow-up) is a manual local check before deployment or after infrastructure changes, excluded from routine CI to avoid a second full-stack startup/recreation cycle.

Images are built locally on the runner and never pushed to a registry. No registry login, deployment or repository secret is needed. The smoke check creates its own unique project and synthetic credentials; it does not operate on the normal development stack. .env.example config validation/build also avoid loading a private local .env.

## Limits and diagnostics

- Read-only contents token; checkout credentials are not persisted. Checkout v7.0.1 and upload-artifact v7.0.2 reuse the verified full release commit pins used by the other workflows. No pull_request_target execution or registry permissions.
- Same-ref concurrency cancels superseded runs. Job timeout: 25 minutes; build step: 15 minutes; smoke command: eight minutes plus a 60-second shutdown grace. GNU timeout sends SIGINT so Python can clean up; forced termination can still prevent cleanup/report upload. The hosted runner is disposable. A local interrupted run may need removal of its printed bms-smoke-* project.
- --report-dir optionally records compose-status.json, compose-logs.txt (last 200 lines per service) and result.json before cleanup. Commands have 15-second diagnostic timeouts; diagnostic errors are reported without deliberately bypassing cleanup or hiding the test failure. Result describes the smoke assertions; a later cleanup error still fails the command.
- The artifact container-smoke-reports uploads after success/failure unless cancelled, with seven-day retention. Early build/tool failures may leave no smoke files; upload warns while the original failure remains failed. Reports contain only synthetic-project data, not full docker inspect output, credentials/config dumps or private database exports. Generated report files are ignored by Git.
- No persistent cross-run Docker cache is configured initially. Builds can reuse layers within a job; a hosted run must work from an empty cache. This keeps the first workflow small; revisit caching after measuring actual hosted build cost.

## Local validation and hosted status

AWS-preparation validation passed locally on Linux amd64: frontend image rebuild, both smoke scripts, Python/shell/YAML syntax, documentation links and actionlint for all three workflows (ShellCheck disabled). Disposable resources were removed. Source unit/browser suites were not repeated because application code is unchanged. ARM runtime evidence comes from the developer's M4 run; Graviton capacity, public certificate issuance and hosted signal/cleanup behavior remain unverified. Builds reused local caches; fresh hosted execution remains pending.

**The streamlined workflow awaits publication and a completed hosted run.** Push the update to the PR, then verify all three independent checks and download the container artifact from the run summary. No branch-protection changes are made here.

References: [artifact upload](https://github.com/actions/upload-artifact), [bounded Compose logs](https://docs.docker.com/reference/cli/docker/compose/logs/).
