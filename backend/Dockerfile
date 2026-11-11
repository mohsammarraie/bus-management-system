FROM eclipse-temurin:25-jdk-noble@sha256:95e350ad1eb738f943e141640f7e3d797e483359a3b33c3864255bfd1ad71f8a AS build
WORKDIR /workspace
COPY gradlew build.gradle.kts settings.gradle.kts ./
COPY gradle ./gradle
COPY src/main ./src/main
RUN chmod +x gradlew
# Tests run separately with Docker/Testcontainers; image building does not run them.
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon --console=plain bootJar

FROM eclipse-temurin:25-jre-noble@sha256:a98128a57de944a72bd31fbc79b898edd5a5864d3652071d5bbd2160ab7d7dce
RUN groupadd --gid 10001 app && useradd --uid 10001 --gid app --no-create-home app
WORKDIR /app
COPY --from=build --chown=10001:10001 /workspace/build/libs/*-SNAPSHOT.jar app.jar
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
