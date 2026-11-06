# Backend continuous integration

## Workflow behavior

`.github/workflows/backend-ci.yml` defines **Backend CI**, with the job **Backend tests and build**. It runs for pull requests targeting `main`, pushes to `main`, and manual dispatches. It deliberately has no path filters, so documentation PRs still receive the check. Pushing a feature branch alone does not run it; open a PR targeting main. Manual dispatch becomes available from the Actions UI once the workflow is on the default branch.

The job uses GitHub's `ubuntu-24.04` runner and Temurin JDK 25. It checks out source without persisted Git credentials, then uses Gradle's setup action to validate wrapper JAR checksums before Gradle execution and manage the Gradle user-home cache. The committed wrapper selects Gradle 9.8.2; its configured SHA-256 verifies the downloaded distribution. No global Gradle installation is used.

Docker availability is checked before running, from `backend/`:

```bash
./gradlew --no-daemon --console=plain clean test bootJar
```

Testcontainers starts the pinned PostgreSQL image, supplies connection details through `@ServiceConnection` and applies the actual Flyway migrations. No Compose database, `.env`, local profile, private dump or repository secret is required. Database tests fail if Docker is unavailable. Packaging runs in the same command; a successful CI job requires both tests and JAR creation to succeed.

## Permissions, cache and reports

- Workflow token permissions are `contents: read`. There is no deployment, registry publication or pull_request_target execution.
- All actions are pinned to full release commit SHAs. Review the upstream release and update the SHA/comment together when upgrading.
- setup-gradle owns the Gradle cache; setup-java caching is not enabled, avoiding two actions managing the same dependency cache. Only main-branch runs write the cache; PR and other branch runs read it.
- A 20-minute job timeout bounds hangs. Concurrency groups cancel superseded runs on the same workflow/ref.
- The final report step uses `always()` to attempt upload after failures. It retains only `backend/build/reports/tests/test/` and JUnit XML from `backend/build/test-results/test/`, for seven days. Early failures may produce no reports; upload then warns while the original step remains failed. It does not upload the workspace or local configuration.
- Gradle-generated artifacts also have seven-day retention configured. Tests use synthetic data. The executable JAR is built but not published by this workflow.

## Verified action releases

Verified against official release metadata and action input declarations during implementation:

| Repository | Release | Pinned commit |
|---|---|---|
| `actions/checkout` | [v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1) | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-java` | [v6.2.0](https://github.com/actions/setup-java/releases/tag/v6.2.0) | `77dd5b2ce225ea11469928ac317850245a74ae78` |
| `gradle/actions` | [v6.4.1](https://github.com/gradle/actions/releases/tag/v6.4.1) | `8da46b539cd8fe6ab27ca75128919a18d757604c` |
| `actions/upload-artifact` | [v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2) | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |

## Local verification and hosted status

Local checks passed:

- actionlint **1.7.12** reported no workflow errors. Its official Linux binary was downloaded outside the repository and checked against release checksums. ShellCheck was not installed; actionlint shell checking was disabled. Workflow run commands contain no shell scripts beyond the Docker/Gradle invocations.
- The exact workflow Gradle command passed all **18 tests**, with zero failures/errors/skips, and built the executable JAR on local Java 25 with Docker.
- Workflow inputs were checked against the pinned action metadata. Local validation does not execute the JavaScript actions or reproduce GitHub's hosted environment.

**Hosted status: pending.** No workflow was pushed or run on GitHub by this task. After reviewing, committing and pushing `ci/backend-checks`, open its PR against main. Inspect **Backend CI → Backend tests and build** and download **backend-test-reports** from the run summary. Confirm a successful hosted run before merging. Branch-protection settings have not been changed; the job can be selected as a required check after it has run.

Frontend, application container builds, Compose smoke checks and browser tests will extend CI as those components are implemented. Current DB integration coverage does not claim full-stack deployment verification.

## Official references

- [Gradle setup action and wrapper validation](https://github.com/gradle/actions/tree/main/setup-gradle)
- [Java setup action](https://github.com/actions/setup-java)
- [Artifact upload action](https://github.com/actions/upload-artifact)
- [actionlint](https://github.com/rhysd/actionlint)
