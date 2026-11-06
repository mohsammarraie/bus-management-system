# Backend setup and design

## Scope and versions

| Component | Selection |
|---|---|
| Java | 25 toolchain; stable features, no preview flags |
| Spring Boot | 4.1.2 |
| Gradle | 9.8.2, committed wrapper and official distribution checksum |
| Toolchain resolver | Foojay convention plugin 1.0.0 |
| Dependency management | Plugin 1.1.7; Boot manages library versions |
| Persistence | Spring Data JPA/Hibernate, PostgreSQL 18.6 |
| Migrations | Flyway 12.4.0 + PostgreSQL module |
| JDBC driver | PostgreSQL 42.7.14 |
| Integration containers | Testcontainers 2.0.5 |

Application code is Java; the build uses Kotlin DSL. Group `io.github.mohsammarraie`; package `io.github.mohsammarraie.busmanagement`. The backend includes Web MVC, Actuator, JPA and Flyway. It has no business endpoints or authentication yet. The initial fleet entity is groundwork for bus CRUD.

Java 25 is supported by the selected Boot and Gradle releases. Future CI jobs and backend Docker build/runtime stages must use it consistently. The generated wrapper JAR and pinned distribution checksum were verified against official Gradle checksums. The wrapper JAR is an intentional source-control exception for this bootstrap binary; downloaded JDKs, Gradle distributions and build outputs stay out of Git.

## Prerequisites and commands

Use a full JDK 25 for local development. The wrapper can launch with another compatible Java version and use its toolchain/Foojay resolver to locate or download JDK 25. It does not change system Java or the `java` command on PATH. Initial downloads need internet access; offline builds need the JDK and previously cached build dependencies and Docker images.

Docker must be running for the integration tests. Gradle enables native access only for test JVMs because Testcontainers uses JNA to access Docker on Java 25. From `backend/`:

```bash
./gradlew clean test bootJar
```

Tests create a temporary PostgreSQL database, apply the real migrations and start Spring Boot. They do not use the development Compose database or `.env` credentials. They fail if Docker is unavailable; no database tests are silently skipped.

For application startup, follow the [database setup](database-setup.md) to copy the root `.env` and start Compose, then from `backend/`:

```bash
./gradlew bootRun --args='--spring.profiles.active=local'
# Alternatively, using Java 25:
java -jar build/libs/bus-management-system-backend-0.0.1-SNAPSHOT.jar --spring.profiles.active=local
```

The `local` profile imports the root `.env` automatically when starting from `backend/` or the repository root. No shell export is required; environment variables still override file settings. The task name is `bootRun`, with a capital R. Prefer `./gradlew` over global Gradle; use `gradlew.bat` on Windows. Change the HTTP port with `PORT` or `--server.port`. Production-style execution supplies external datasource environment variables without the local profile. A Java 25-targeted JAR cannot run on Java 21.

Use `./gradlew -q javaToolchains` to inspect JDK detection. If `JAVA_HOME` is invalid, correct or unset it before launching Gradle. A runtime alone may have no `javac`.

## Responsibilities and behavior

- `BusManagementSystemApplication` starts the application.
- Actuator supplies `/actuator/health`; configuration hides components/details and other management endpoints. Health now includes database connectivity.
- Flyway creates the `bus_management` schema and applies versioned SQL before Hibernate validates entity mappings. Hibernate never creates or updates the schema; open-in-view is disabled.
- `fleet.domain.Bus` maps the initial bus table. Identity-generated IDs replace manual ID allocation; database constraints protect required/unique registration numbers and positive capacity. The version column prepares the entity for optimistic locking when editing is implemented.
- Configuration stays in properties/environment; no credentials are hardcoded into Java or embedded in the JAR.

## Tests and learning checkpoints

`PostgresTestConfiguration` provides a Boot-managed PostgreSQL container with `@ServiceConnection`; Boot supplies its actual connection details to the datasource and Flyway. The pinned image matches Compose. The framework starts the database before dependent beans and closes it after them.

`DatabaseIntegrationTests` verifies migration from an empty PostgreSQL 18 database, safe reruns, checksum drift detection, generated IDs/JPA round trips, and constraints even when callers bypass Java validation. Transactional data tests roll back their changes. A deliberately altered migration lives only in test resources.

`HealthEndpointTests` makes real HTTP requests to the embedded server: UP health without internal details, and 404 for management discovery, environment, info and metrics. Those tests use the actual migrated database rather than excluding database auto-configuration.

The wrapper pins the build tool; the toolchain selects Java for compile/test/bootRun. A Boot starter brings a curated dependency set. Flyway tracks schema history; JPA maps objects to it. Hibernate validates mappings, while database tests verify constraints that schema validation alone does not cover.

See [database setup and verification](database-setup.md) for commands and current evidence. The [backend CI workflow](backend-ci.md) is merged and has verified successful hosted PR/main runs.

## Official references

- [Boot system requirements](https://docs.spring.io/spring-boot/system-requirements.html)
- [Boot data initialization](https://docs.spring.io/spring-boot/how-to/data-initialization.html)
- [Boot Testcontainers integration](https://docs.spring.io/spring-boot/reference/testing/testcontainers.html)
- [Actuator endpoints](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html)
- [Gradle Java compatibility](https://docs.gradle.org/current/userguide/compatibility.html)
- [Gradle toolchain provisioning](https://docs.gradle.org/current/userguide/toolchains.html#sub:download_repositories)
- [Official PostgreSQL image](https://hub.docker.com/_/postgres)
