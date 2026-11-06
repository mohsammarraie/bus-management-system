# Backend starter

## Scope and versions

- Spring Boot **4.1.2**, generated from official Spring Initializr metadata.
- Java **25**, enforced through the Gradle toolchain. The pinned Foojay resolver convention plugin **1.0.0** automatically provisions a missing JDK.
- Gradle **9.8.2**, pinned by the wrapper, with the official distribution SHA-256 configured.
- Java application code with a Kotlin DSL build. `io.spring.dependency-management` **1.1.7** is supplied by Initializr; Boot manages dependency versions.
- Group `io.github.mohsammarraie`; package `io.github.mohsammarraie.busmanagement`.
- Spring Web MVC and Actuator. No database dependencies, authentication or domain endpoints yet.

Java 25 is the chosen LTS baseline for this rebuild and is supported by the selected Spring Boot and Gradle releases. Use stable Java features; preview features are not enabled. Future CI jobs and backend Docker build/runtime stages must also use Java 25. PostgreSQL 18 and Flyway remain the next implementation task.

The generated wrapper JAR was checked against the official Gradle checksum. The wrapper JAR is an intentional source-control exception to the general exclusion of generated binaries. No downloaded JDK or Gradle distribution belongs in the repository.

## Prerequisites and commands

A full JDK 25 is recommended for local development; both `java -version` and `javac -version` should report 25. The wrapper can also launch with another Java version supported by Gradle 9.8.2. The application compiles, tests and runs through `bootRun` with the Java 25 toolchain regardless of the launcher version. Gradle first looks for a matching JDK and, if absent, the Foojay resolver downloads one to the Gradle user cache. This does not replace system Java or require a project-specific absolute JDK path.

```bash
cd backend
./gradlew clean test bootJar
./gradlew bootRun
```

The task name is `bootRun`, with a capital R. Prefer `./gradlew` over a separately installed `gradle` so the pinned version is used. On Windows, use `gradlew.bat`.

Initial downloads require access to the Gradle Plugin Portal, dependency repositories and, when a JDK must be provisioned, Foojay and the selected JDK provider. Offline builds require a full JDK 25 and previously cached Gradle/plugins/dependencies. Configure `JAVA_HOME` if needed; `java -version` alone is insufficient because a runtime may not include `javac`. Use `./gradlew -q javaToolchains` to inspect detected/provisioned installations. If `JAVA_HOME` names an invalid installation, correct or unset it before launching Gradle.

Build/test results are under `backend/build/` and are ignored by Git.

The executable artifact is `backend/build/libs/bus-management-system-backend-0.0.1-SNAPSHOT.jar`. From the repository root, with Java 25 selected:

```bash
java -jar backend/build/libs/bus-management-system-backend-0.0.1-SNAPSHOT.jar
curl --fail http://localhost:8080/actuator/health
```

A JAR targeting Java 25 cannot run on a Java 21 runtime. The Gradle toolchain controls Gradle tasks, but it does not change the `java` command on your shell's PATH.

Stop the process with Ctrl+C. Port defaults to 8080 and can be changed through `PORT` or `--server.port`. No database needs to be running.

## Implementation and tests

`BusManagementSystemApplication` is the application entry point. Spring's Actuator supplies `/actuator/health`; there is no custom controller duplicating it. Configuration exposes only health, disables management discovery, and hides health components/details.

`HealthEndpointTests` starts the embedded web server on a random port and makes real HTTP requests using Java's HTTP client. It verifies a 200 UP JSON response without internal details, and 404 responses for discovery, environment, info and metrics endpoints. These tests check the runtime configuration as well as startup; no empty context-only test is retained.

The next step adds PostgreSQL, Flyway and real database integration tests. Once database dependencies exist, health and these tests must be adapted to a test database instead of hiding database failures.

## Learning checkpoints

- The Gradle wrapper pins the build tool; its toolchain selects the Java compiler/runtime for compilation, tests and `bootRun`.
- A Spring Boot starter supplies a curated dependency set; the Boot plugin produces an executable JAR with an embedded server.
- Actuator provides operational endpoints. An UP response at this stage does not prove any future bus-management use case.
- Source/resources/tests have separate roles. Configuration is kept outside Java business logic.

## Verification

Verified locally with Ubuntu OpenJDK **25.0.4.1**: `./gradlew --no-daemon clean test bootJar` passed all **five HTTP test cases**, with zero failures, errors or skipped tests. Both `bootRun` and the packaged JAR ran on Java 25, returned HTTP 200 with UP health on temporary loopback ports, and were stopped after verification. The application class in the JAR has Java 25 bytecode (class version 69).

`./gradlew --version` confirmed Gradle 9.8.2 with the Java 25 launcher. `./gradlew -q javaToolchains` confirmed the installed full JDK 25 and enabled toolchain detection/download. This run reused the installed JDK 25; downloading a missing JDK 25 was not exercised. The wrapper JAR and pinned distribution checksum matched the official Gradle checksums, and `gradlew` is executable. Hosted CI is not implemented yet.

## Official references

- [Spring Initializr](https://start.spring.io/)
- [Boot system requirements](https://docs.spring.io/spring-boot/system-requirements.html)
- [Boot Gradle plugin](https://docs.spring.io/spring-boot/gradle-plugin/getting-started.html)
- [Actuator endpoints](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html)
- [Gradle Java compatibility](https://docs.gradle.org/current/userguide/compatibility.html)
- [Gradle distribution checksums](https://gradle.org/release-checksums/)
- [Gradle toolchain provisioning](https://docs.gradle.org/current/userguide/toolchains.html#sub:download_repositories)
- [Foojay resolver plugin](https://plugins.gradle.org/plugin/org.gradle.toolchains.foojay-resolver-convention)
