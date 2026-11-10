package io.github.mohsammarraie.busmanagement;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oidcLogin;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.auth.client-secret=test-only")
@AutoConfigureMockMvc
@Import(PostgresTestConfiguration.class)
class ApiDocumentationTests {
    @Autowired MockMvc mvc;

    @Test
    void adminGetsTheActualBusContractAndSessionSecurityWithoutInternalEndpoints() throws Exception {
        mvc.perform(get("/api/openapi").with(oidcLogin().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.openapi", startsWith("3.")))
                .andExpect(jsonPath("$.info.title").value("Bus Management System API"))
                .andExpect(jsonPath("$.servers[0].url").value("/"))
                .andExpect(jsonPath("$.paths", aMapWithSize(4)))
                .andExpect(jsonPath("$.paths['/api/v1/buses'].get.operationId").value("listBuses"))
                .andExpect(jsonPath("$.paths['/api/v1/buses'].post.responses['201']").exists())
                .andExpect(jsonPath("$.paths['/api/v1/buses'].post.responses['200']").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/v1/buses/{id}'].put.responses['409'].content['application/problem+json'].schema['$ref']")
                        .value("#/components/schemas/ApiProblem"))
                .andExpect(jsonPath("$.paths['/api/v1/buses/{id}'].delete.responses['204'].content").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/auth/me'].get.security[0].sessionCookie").isArray())
                .andExpect(jsonPath("$.paths['/api/auth/csrf'].get.security").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/auth/csrf'].get.parameters").doesNotExist())
                .andExpect(jsonPath("$.components.securitySchemes.sessionCookie.in").value("cookie"))
                .andExpect(jsonPath("$.components.securitySchemes.sessionCookie.name").value("JSESSIONID"))
                .andExpect(jsonPath("$.components.securitySchemes.csrfHeader.name").value("X-XSRF-TOKEN"))
                .andExpect(jsonPath("$.paths['/api/v1/buses'].post.security[0].csrfHeader").isArray())
                .andExpect(jsonPath("$.components.schemas.CreateBusRequest.required", hasItems("registrationNumber", "capacity", "active")))
                .andExpect(jsonPath("$.components.schemas.UpdateBusRequest.required", hasItem("version")))
                .andExpect(jsonPath("$.components.schemas.CreateBusRequest.additionalProperties").value(false))
                .andExpect(jsonPath("$.components.schemas.CreateBusRequest.properties.registrationNumber.pattern").doesNotExist())
                .andExpect(jsonPath("$.components.schemas.CreateBusRequest.properties.registrationNumber.minLength").value(1))
                .andExpect(jsonPath("$.components.schemas.ApiProblem.properties.fields").exists());
    }

    @Test
    void adminCanLoadSwaggerAndItsAssetsUnderTheProxyPrefix() throws Exception {
        var admin = oidcLogin().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
        mvc.perform(get("/api/docs").with(admin)).andExpect(status().isFound())
                .andExpect(header().string("Location", containsString("/api/swagger-ui/index.html")));
        mvc.perform(get("/api/swagger-ui/index.html").with(admin)).andExpect(status().isOk())
                .andExpect(content().string(containsString("swagger-ui")));
        mvc.perform(get("/api/swagger-ui/swagger-ui.css").with(admin)).andExpect(status().isOk());
        mvc.perform(get("/api/swagger-ui/swagger-ui-bundle.js").with(admin)).andExpect(status().isOk());
        mvc.perform(get("/api/swagger-ui/swagger-initializer.js").with(admin)).andExpect(status().isOk())
                .andExpect(content().string(containsString("XSRF-TOKEN")));
        mvc.perform(get("/api/openapi/swagger-config").with(admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value("/api/openapi"))
                .andExpect(jsonPath("$.configUrl").value("/api/openapi/swagger-config"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/api/docs", "/api/openapi", "/api/openapi.yaml", "/api/openapi/swagger-config", "/api/swagger-ui/index.html"})
    void anonymousUsersCannotReadDocumentation(String path) throws Exception {
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @ValueSource(strings = {"DRIVER", "PASSENGER"})
    void nonAdminSessionsCannotReadDocumentationOrAssets(String role) throws Exception {
        for (String path : List.of("/api/docs", "/api/openapi", "/api/openapi.yaml", "/api/openapi/swagger-config",
                "/api/swagger-ui/index.html", "/api/swagger-ui/swagger-ui-bundle.js")) {
            mvc.perform(get(path).with(oidcLogin().authorities(new SimpleGrantedAuthority("ROLE_" + role))))
                    .andExpect(status().isForbidden());
        }
    }
}
