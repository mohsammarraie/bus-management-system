package io.github.mohsammarraie.busmanagement;

import io.github.mohsammarraie.busmanagement.fleet.domain.Bus;
import jakarta.persistence.EntityManager;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.exception.FlywayValidateException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(PostgresTestConfiguration.class)
class DatabaseIntegrationTests {

    @Autowired
    private Flyway flyway;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private EntityManager entityManager;

    @Test
    void migratesAnEmptyPostgresDatabaseAndRerunsWithoutChanges() {
        assertThat(jdbc.queryForObject("SELECT current_setting('server_version_num')::int", Integer.class))
                .isBetween(180000, 189999);
        assertThat(flyway.info().current().getVersion().getVersion()).isEqualTo("1");
        assertThat(flyway.validateWithResult().validationSuccessful).isTrue();
        assertThat(flyway.migrate().migrationsExecuted).isZero();
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM bus_management.flyway_schema_history
                WHERE version = '1' AND success
                """, Integer.class)).isEqualTo(1);
    }

    @Test
    @Transactional
    void persistsABusWithAGeneratedIdAndReadsItThroughJpa() {
        Bus bus = new Bus("DEMO-123", 45);
        entityManager.persist(bus);
        entityManager.flush();
        entityManager.clear();

        assertThat(bus.getId()).isPositive();
        Bus stored = entityManager.find(Bus.class, bus.getId());
        assertThat(stored.getRegistrationNumber()).isEqualTo("DEMO-123");
        assertThat(stored.getCapacity()).isEqualTo(45);
        assertThat(stored.isActive()).isTrue();
        assertThat(stored.getVersion()).isZero();
    }

    @ParameterizedTest
    @ValueSource(ints = {0, -1})
    @Transactional
    void rejectsNonpositiveCapacityEvenWhenJavaValidationIsBypassed(int capacity) {
        assertThatThrownBy(() -> insertBus("INVALID-CAPACITY", capacity))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("ck_buses_capacity_positive");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "\t", "\n", " PADDED ", "PADDED\t"})
    @Transactional
    void rejectsMissingBlankOrUntrimmedRegistrationNumbers(String registrationNumber) {
        assertThatThrownBy(() -> insertBus(registrationNumber, 45))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @Transactional
    void rejectsDuplicateRegistrationNumbers() {
        insertBus("UNIQUE-123", 45);
        assertThatThrownBy(() -> insertBus("UNIQUE-123", 50))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("uq_buses_registration_number");
    }

    @Test
    void detectsChangesToAnAlreadyAppliedMigration() {
        Flyway changedMigration = Flyway.configure()
                .dataSource(flyway.getConfiguration().getDataSource())
                .defaultSchema("bus_management")
                .locations("classpath:db/checksum-drift")
                .load();

        assertThatThrownBy(changedMigration::validate)
                .isInstanceOf(FlywayValidateException.class)
                .hasMessageContaining("checksum mismatch");
    }

    private void insertBus(String registrationNumber, int capacity) {
        jdbc.update("INSERT INTO bus_management.buses (registration_number, capacity) VALUES (?, ?)",
                registrationNumber, capacity);
    }
}
