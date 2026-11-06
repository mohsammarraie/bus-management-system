package io.github.mohsammarraie.busmanagement;

import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;

@TestConfiguration(proxyBeanMethods = false)
class PostgresTestConfiguration {

    // Keep this pinned reference aligned with compose.yaml.
    private static final String POSTGRES_IMAGE =
            "postgres:18.6-bookworm@sha256:f1ea2a1a4fb7b68d4836be1fdcb8a6466a89b072158bf9d97663600538c294c5";

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgres() {
        // The official image is pinned by both tag and digest; declare its base image explicitly.
        DockerImageName image = DockerImageName.parse(POSTGRES_IMAGE).asCompatibleSubstituteFor("postgres");
        return new PostgreSQLContainer(image)
                .withDatabaseName("bus_management_test")
                .withUsername("test")
                .withPassword("test");
    }
}
