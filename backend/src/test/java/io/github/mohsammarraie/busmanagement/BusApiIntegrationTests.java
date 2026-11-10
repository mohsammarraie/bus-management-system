package io.github.mohsammarraie.busmanagement;

import io.github.mohsammarraie.busmanagement.fleet.api.CreateBusRequest;
import io.github.mohsammarraie.busmanagement.fleet.api.UpdateBusRequest;
import io.github.mohsammarraie.busmanagement.fleet.application.BusService;
import io.github.mohsammarraie.busmanagement.fleet.domain.Bus;
import io.github.mohsammarraie.busmanagement.fleet.persistence.BusRepository;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.OidcLoginRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oidcLogin;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.auth.client-secret=test-only")
@AutoConfigureMockMvc
@Import(PostgresTestConfiguration.class)
class BusApiIntegrationTests {
    private static final String API = "/api/v1/buses";
    @Autowired MockMvc mvc;
    @Autowired BusRepository buses;
    @Autowired BusService service;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired JsonMapper json;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void cleanSyntheticData() {
        buses.deleteAllInBatch();
    }

    @Test
    void adminCreatesReadsUpdatesDeactivatesAndDeletesABus() throws Exception {
        JsonNode created = body(create("DEMO-001", 40, true).andExpect(status().isCreated())
                .andExpect(header().string("Location", matchesPattern(API + "/[0-9]+")))
                .andExpect(jsonPath("$", aMapWithSize(5))));
        long id = created.path("id").asLong();
        assertThat(id).isPositive();
        assertThat(created.path("version").asLong()).isZero();
        mvc.perform(get(API + "/" + id).with(admin())).andExpect(status().isOk())
                .andExpect(jsonPath("$.registrationNumber").value("DEMO-001"));

        JsonNode changed = body(update(id, "DEMO-002", 45, false, 0).andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false)));
        assertThat(changed.path("version").asLong()).isEqualTo(1);
        assertThat(buses.findById(id).orElseThrow().getCapacity()).isEqualTo(45);
        mvc.perform(delete(API + "/" + id).param("version", "1").with(admin()).with(validCsrf()))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(buses.findById(id)).isEmpty();
        mvc.perform(get(API + "/" + id).with(admin())).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("BUS_NOT_FOUND"));
    }

    @Test
    void listIsPagedFilteredAndStablySortedWithLiteralSearchCharacters() throws Exception {
        for (String registration : List.of("DEMO-C", "DEMO-A", "DEMO-B", "OTHER", "DEMO%_\\")) {
            buses.saveAndFlush(new Bus(registration, 40, !registration.equals("DEMO-C")));
        }
        mvc.perform(get(API).param("q", "demo-").param("active", "true")
                        .param("size", "1").param("page", "1").with(admin()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].registrationNumber").value("DEMO-B"))
                .andExpect(jsonPath("$.page").value(1)).andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.totalElements").value(2)).andExpect(jsonPath("$.totalPages").value(2));
        mvc.perform(get(API).param("q", "%_\\").with(admin()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].registrationNumber").value("DEMO%_\\"));
        mvc.perform(get(API).param("active", "false").param("sort", "capacity").param("direction", "desc").with(admin()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].registrationNumber").value("DEMO-C"));
        mvc.perform(get(API).param("q", "' OR 1=1 --").with(admin()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get(API).param("sort", "capacity").param("size", "2").with(admin()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].registrationNumber").value("DEMO-C"))
                .andExpect(jsonPath("$.content[1].registrationNumber").value("DEMO-A"));
        mvc.perform(get(API).param("page", "9999").with(admin()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content", empty()))
                .andExpect(jsonPath("$.totalElements").value(5));
    }

    @Test
    void emptyListHasAStableEnvelope() throws Exception {
        mvc.perform(get(API).with(admin())).andExpect(status().isOk())
                .andExpect(jsonPath("$", aMapWithSize(5))).andExpect(jsonPath("$.content", empty()))
                .andExpect(jsonPath("$.page").value(0)).andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalElements").value(0)).andExpect(jsonPath("$.totalPages").value(0));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{}", "{\"registrationNumber\":\"DEMO\",\"capacity\":0,\"active\":true}",
            "{\"registrationNumber\":\" PADDED\",\"capacity\":40,\"active\":true}",
            "{\"registrationNumber\":\"PADDED \",\"capacity\":40,\"active\":true}",
            "{\"registrationNumber\":\"\\u00a0PADDED\",\"capacity\":40,\"active\":true}",
            "{\"registrationNumber\":\"DEMO\\nBUS\",\"capacity\":40,\"active\":true}",
            "{\"registrationNumber\":\"DEMO\\u0000BUS\",\"capacity\":40,\"active\":true}",
            "{\"registrationNumber\":\"123456789012345678901234567890123\",\"capacity\":40,\"active\":true}",
            "{\"registrationNumber\":\"DEMO\",\"capacity\":40}",
            "{\"registrationNumber\":\"DEMO\",\"capacity\":-1,\"active\":true}"
    })
    void invalidBodiesHaveFieldCodesWithoutPersistingData(String body) throws Exception {
        mvc.perform(post(API).with(admin()).with(validCsrf()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest()).andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED")).andExpect(jsonPath("$.fields").isMap());
        assertThat(buses.count()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{", "{\"registrationNumber\":\"DEMO\",\"capacity\":1.5,\"active\":true}",
            "{\"registrationNumber\":\"DEMO\",\"capacity\":\"40\",\"active\":true}",
            "{\"registrationNumber\":\"DEMO\",\"capacity\":40,\"active\":\"true\"}",
            "{\"registrationNumber\":\"DEMO\",\"capacity\":40,\"active\":true,\"id\":1}",
            "{\"registrationNumber\":\"DEMO\",\"capacity\":40,\"active\":true,\"version\":0}"
    })
    void malformedWrongTypeAndServerManagedFieldsAreRejected(String body) throws Exception {
        mvc.perform(post(API).with(admin()).with(validCsrf()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        assertThat(buses.count()).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"page=-1", "page=10001", "size=0", "size=101", "sort=version", "sort=invalid.sql",
            "direction=sideways", "page=abc", "active=maybe", "size=2147483648"})
    void invalidQueriesReturnAStableBadRequest(String query) throws Exception {
        String[] parts = query.split("=");
        mvc.perform(get(API).param(parts[0], parts[1]).with(admin()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void staleUpdateAndDeleteCannotOverwriteTheCurrentBus() throws Exception {
        Bus bus = buses.saveAndFlush(new Bus("VERSIONED", 40));
        update(bus.getId(), "VERSIONED", 41, true, 0).andExpect(status().isOk());
        update(bus.getId(), "OVERWRITTEN", 42, true, 0).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BUS_VERSION_CONFLICT"));
        mvc.perform(delete(API + "/" + bus.getId()).param("version", "0").with(admin()).with(validCsrf()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("BUS_VERSION_CONFLICT"));
        assertThat(buses.findById(bus.getId()).orElseThrow().getRegistrationNumber()).isEqualTo("VERSIONED");
        assertThat(buses.findById(bus.getId()).orElseThrow().getCapacity()).isEqualTo(41);
    }

    @Test
    void updateAndDeleteRequireAValidVersionAndExistingPositiveId() throws Exception {
        Bus bus = buses.saveAndFlush(new Bus("VERSION-REQUIRED", 40));
        mvc.perform(put(API + "/" + bus.getId()).with(admin()).with(validCsrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"registrationNumber\":\"DEMO\",\"capacity\":40,\"active\":true}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.version", contains("REQUIRED")));
        update(bus.getId(), "DEMO", 40, true, -1).andExpect(status().isBadRequest());
        mvc.perform(delete(API + "/" + bus.getId()).with(admin()).with(validCsrf())).andExpect(status().isBadRequest());
        mvc.perform(delete(API + "/" + bus.getId()).param("version", "-1").with(admin()).with(validCsrf()))
                .andExpect(status().isBadRequest());
        mvc.perform(get(API + "/0").with(admin())).andExpect(status().isBadRequest());
        mvc.perform(get(API + "/not-a-number").with(admin())).andExpect(status().isBadRequest());
        update(Long.MAX_VALUE, "MISSING", 40, true, 0).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("BUS_NOT_FOUND"));
        mvc.perform(delete(API + "/" + Long.MAX_VALUE).param("version", "0").with(admin()).with(validCsrf()))
                .andExpect(status().isNotFound());
    }

    @Test
    void duplicateRegistrationRollsBackCreateAndUpdateWithoutLeakingSql() throws Exception {
        create("DUPLICATE", 40, true).andExpect(status().isCreated());
        String error = create("DUPLICATE", 41, true).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BUS_REGISTRATION_CONFLICT")).andReturn().getResponse().getContentAsString();
        assertThat(error).doesNotContain("uq_buses", "INSERT INTO", "org.hibernate", "SQLException");
        Bus second = buses.saveAndFlush(new Bus("OTHER", 42));
        update(second.getId(), "DUPLICATE", 43, false, 0).andExpect(status().isConflict());
        Bus unchanged = buses.findById(second.getId()).orElseThrow();
        assertThat(unchanged.getRegistrationNumber()).isEqualTo("OTHER");
        assertThat(unchanged.getVersion()).isZero();
        assertThat(unchanged.isActive()).isTrue();
        assertThat(buses.count()).isEqualTo(2);
        create("duplicate", 40, false).andExpect(status().isCreated()); // Exact case-sensitive uniqueness is retained.
    }

    @Test
    void referencedBusCannotBeDeletedAndConstraintDetailsStayPrivate() throws Exception {
        Bus bus = buses.saveAndFlush(new Bus("REFERENCED", 40));
        // Test-only dependent record exercises the policy before schedules/trips add their real foreign keys.
        jdbc.execute("CREATE TABLE bus_management.bus_api_reference_probe (bus_id BIGINT REFERENCES bus_management.buses(id))");
        try {
            jdbc.update("INSERT INTO bus_management.bus_api_reference_probe VALUES (?)", bus.getId());
            mvc.perform(delete(API + "/" + bus.getId()).param("version", "0").with(admin()).with(validCsrf()))
                    .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("BUS_IN_USE"))
                    .andExpect(content().string(not(containsString("bus_api_reference_probe"))));
            assertThat(buses.findById(bus.getId())).isPresent();
        } finally {
            jdbc.execute("DROP TABLE bus_management.bus_api_reference_probe");
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"DRIVER", "PASSENGER"})
    void nonAdminsCannotReadOrMutateBuses(String role) throws Exception {
        Bus bus = buses.saveAndFlush(new Bus("PRIVATE", 40));
        var identity = oidcLogin().authorities(new SimpleGrantedAuthority("ROLE_" + role));
        for (var request : List.of(get(API), get(API + "/" + bus.getId()), post(API), put(API + "/" + bus.getId()),
                delete(API + "/" + bus.getId()).param("version", "0"))) {
            mvc.perform(request.with(identity).with(validCsrf())).andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
        }
        assertThat(buses.count()).isEqualTo(1);
    }

    @Test
    void anonymousReadsRequireAuthenticationAndAdminWritesRequireRealCsrf() throws Exception {
        mvc.perform(get(API)).andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.status").value(401));
        Bus bus = buses.saveAndFlush(new Bus("CSRF-PROTECTED", 40));
        for (var request : List.of(post(API), put(API + "/" + bus.getId()),
                delete(API + "/" + bus.getId()).param("version", "0"))) {
            mvc.perform(request.with(admin())).andExpect(status().isForbidden());
        }
        mvc.perform(post(API).with(validCsrf())).andExpect(status().isUnauthorized());
        assertThat(buses.findById(bus.getId())).isPresent();
    }

    @Test
    @WithMockUser(roles = "PASSENGER")
    void serviceAuthorizationAlsoProtectsNonControllerCallers() {
        assertThatThrownBy(() -> service.get(1)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.create("DENIED", 40, true)).isInstanceOf(AccessDeniedException.class);
        assertThat(buses.count()).isZero();
    }

    @Test
    void concurrentHttpEditsReturnOneSuccessAndOneConflict() throws Exception {
        Bus bus = buses.saveAndFlush(new Bus("CONCURRENT-HTTP", 40));
        CyclicBarrier start = new CyclicBarrier(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<Integer> first = () -> {
                start.await(10, TimeUnit.SECONDS);
                return update(bus.getId(), "CONCURRENT-HTTP", 41, true, 0).andReturn().getResponse().getStatus();
            };
            Callable<Integer> second = () -> {
                start.await(10, TimeUnit.SECONDS);
                return update(bus.getId(), "CONCURRENT-HTTP", 42, true, 0).andReturn().getResponse().getStatus();
            };
            var a = executor.submit(first);
            var b = executor.submit(second);
            assertThat(List.of(a.get(15, TimeUnit.SECONDS), b.get(15, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(200, 409);
        }
        assertThat(buses.findById(bus.getId()).orElseThrow().getVersion()).isEqualTo(1);
    }

    @Test
    void concurrentDuplicateCreatesAreResolvedByTheDatabase() throws Exception {
        CyclicBarrier start = new CyclicBarrier(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<Integer> create = () -> {
                start.await(10, TimeUnit.SECONDS);
                return create("CONCURRENT-UNIQUE", 40, true).andReturn().getResponse().getStatus();
            };
            var a = executor.submit(create);
            var b = executor.submit(create);
            assertThat(List.of(a.get(15, TimeUnit.SECONDS), b.get(15, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(201, 409);
        }
        assertThat(buses.count()).isEqualTo(1);
    }

    @Test
    void twoTransactionsLoadedAtTheSameVersionCannotBothCommit() throws Exception {
        Bus bus = buses.saveAndFlush(new Bus("CONCURRENT-JPA", 40));
        CyclicBarrier bothLoaded = new CyclicBarrier(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<Boolean> change = () -> {
                try {
                    new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                        Bus loaded = buses.findForMutation(bus.getId()).orElseThrow();
                        try {
                            bothLoaded.await(10, TimeUnit.SECONDS);
                        } catch (Exception exception) {
                            throw new IllegalStateException(exception);
                        }
                        loaded.changeDetails("CONCURRENT-JPA", 41, true);
                        buses.flush();
                    });
                    return true;
                } catch (OptimisticLockingFailureException conflict) {
                    return false;
                }
            };
            var a = executor.submit(change);
            var b = executor.submit(change);
            assertThat(List.of(a.get(15, TimeUnit.SECONDS), b.get(15, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(true, false);
        }
    }

    @Test
    void noOpMutationStillDetectsAnotherCommittedEdit() throws Exception {
        Bus bus = buses.saveAndFlush(new Bus("NO-OP-LOCK", 40));
        CountDownLatch loaded = new CountDownLatch(1);
        CountDownLatch edited = new CountDownLatch(1);
        try (var executor = Executors.newSingleThreadExecutor()) {
            var noOp = executor.submit(() -> {
                try {
                    new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
                        Bus unchanged = buses.findForMutation(bus.getId()).orElseThrow();
                        unchanged.changeDetails("NO-OP-LOCK", 40, true);
                        loaded.countDown();
                        try {
                            if (!edited.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Edit timed out");
                        } catch (InterruptedException exception) {
                            Thread.currentThread().interrupt();
                            throw new IllegalStateException(exception);
                        }
                    });
                    return false;
                } catch (OptimisticLockingFailureException conflict) {
                    return true;
                }
            });
            assertThat(loaded.await(10, TimeUnit.SECONDS)).isTrue();
            try {
                update(bus.getId(), "NO-OP-LOCK", 41, true, 0).andExpect(status().isOk());
            } finally {
                edited.countDown();
            }
            assertThat(noOp.get(15, TimeUnit.SECONDS)).isTrue();
        }
    }

    private ResultActions create(String registration, int capacity, boolean active) throws Exception {
        return mvc.perform(post(API).with(admin()).with(validCsrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new CreateBusRequest(registration, capacity, active))));
    }

    private ResultActions update(long id, String registration, int capacity, boolean active, long version) throws Exception {
        return mvc.perform(put(API + "/" + id).with(admin()).with(validCsrf()).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(new UpdateBusRequest(registration, capacity, active, version))));
    }

    private JsonNode body(ResultActions response) throws Exception {
        return json.readTree(response.andReturn().getResponse().getContentAsString());
    }

    private OidcLoginRequestPostProcessor admin() {
        return oidcLogin().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    private RequestPostProcessor validCsrf() throws Exception {
        var response = mvc.perform(get("/api/auth/csrf")).andReturn().getResponse();
        var cookie = response.getCookie("XSRF-TOKEN");
        assertThat(cookie).isNotNull();
        return request -> {
            request.setCookies(cookie);
            request.addHeader("X-XSRF-TOKEN", cookie.getValue());
            return request;
        };
    }
}
