package io.github.mohsammarraie.busmanagement;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUserAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.auth.client-secret=test-only")
@AutoConfigureMockMvc
@Import({PostgresTestConfiguration.class, AuthenticationTests.Probes.class})
class AuthenticationTests {
    @Autowired MockMvc mvc;
    @Autowired org.springframework.security.oauth2.client.registration.ClientRegistrationRepository clients;
    @Autowired org.springframework.security.core.authority.mapping.GrantedAuthoritiesMapper mapper;

    @Test
    void anonymousApiRequestsFailWithoutHtmlLoginRedirect() throws Exception {
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
    }

    @Test
    void csrfIsAvailableBeforeLoginWithAngularCookieAndNoCache() throws Exception {
        mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk())
                .andExpect(cookie().exists("XSRF-TOKEN"))
                .andExpect(jsonPath("$.headerName").value("X-XSRF-TOKEN"))
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(header().string("Cache-Control", containsString("no-store")));
    }

    @Test
    void accountResponseExposesNoTokensOrCredentials() throws Exception {
        mvc.perform(get("/api/auth/me").with(oidcLogin()
                        .idToken(token -> token.subject("driver-id").claim("preferred_username", "driver"))
                        .authorities(new SimpleGrantedAuthority("ROLE_DRIVER"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value("driver-id"))
                .andExpect(jsonPath("$.username").value("driver"))
                .andExpect(jsonPath("$.roles[0]").value("DRIVER"))
                .andExpect(jsonPath("$", aMapWithSize(3)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"PASSENGER", "DRIVER"})
    void nonAdminsCannotUseAdminEndpoints(String role) throws Exception {
        mvc.perform(get("/api/admin/probe").with(oidcLogin()
                        .authorities(new SimpleGrantedAuthority("ROLE_" + role))))
                .andExpect(status().isForbidden());
    }

    @Test
    void passengersCannotUseDriverEndpointsEvenWithValidCsrf() throws Exception {
        mvc.perform(post("/api/driver/probe").with(oidcLogin()
                        .authorities(new SimpleGrantedAuthority("ROLE_PASSENGER"))).with(validCsrf()))
                .andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(strings = {"ADMIN", "DRIVER"})
    void authorizedRolesStillNeedCsrfForMutations(String role) throws Exception {
        var identity = oidcLogin().authorities(new SimpleGrantedAuthority("ROLE_" + role));
        mvc.perform(post("/api/driver/probe").with(identity)).andExpect(status().isForbidden());
        mvc.perform(post("/api/driver/probe").with(identity).with(validCsrf())).andExpect(status().isOk());
    }

    @Test
    void adminCanUseAdminEndpoint() throws Exception {
        mvc.perform(get("/api/admin/probe").with(oidcLogin()
                        .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isOk());
    }

    @Test
    void logoutRequiresCsrf() throws Exception {
        mvc.perform(post("/api/auth/logout").with(oidcLogin())).andExpect(status().isForbidden());
    }

    @Test
    void browserLogoutAcceptsTheMaskedCsrfTokenFromTheEndpoint() throws Exception {
        var response = mvc.perform(get("/api/auth/csrf")).andReturn().getResponse();
        var token = com.jayway.jsonpath.JsonPath.<String>read(response.getContentAsString(), "$.token");
        mvc.perform(post("/api/auth/logout").with(oidcLogin()
                        .clientRegistration(clients.findByRegistrationId("keycloak")))
                        .cookie(response.getCookie("XSRF-TOKEN")).param("_csrf", token))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", containsString("/protocol/openid-connect/logout")));
    }

    @Test
    void authorizationUsesStateNonceAndPkceAndOnlyAllowedLocale() throws Exception {
        mvc.perform(get("/api/oauth2/authorization/keycloak").param("registration", "true")
                        .param("lang", "ar").param("redirect_uri", "https://invalid.example/"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", allOf(containsString("state="), containsString("nonce="),
                        containsString("code_challenge="), containsString("code_challenge_method=S256"),
                        containsString("prompt=create"), containsString("ui_locales=ar"),
                        not(containsString("invalid.example")))));
    }

    @Test
    void forgedCallbackDoesNotCreateAuthenticatedSession() throws Exception {
        mvc.perform(get("/api/login/oauth2/code/keycloak").param("code", "fake").param("state", "forged"))
                .andExpect(status().isFound())
                .andExpect(redirectedUrl("http://localhost:8082/overview?auth=failed"));
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void onlyKnownSignedApplicationRoleClaimsBecomeAuthorities() {
        var idToken = new OidcIdToken("test-token", Instant.now(), Instant.now().plusSeconds(60),
                Map.of("sub", "test", "app_roles", List.of("ADMIN", "PASSENGER", "UNKNOWN", "ROLE_DRIVER")));
        var mapped = mapper.mapAuthorities(Set.of(new OidcUserAuthority(idToken)));
        assertThat(mapped.stream().map(Object::toString).filter(name -> name.startsWith("ROLE_")).toList())
                .containsExactlyInAnyOrder("ROLE_ADMIN", "ROLE_PASSENGER");
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor validCsrf() throws Exception {
        var response = mvc.perform(get("/api/auth/csrf")).andReturn().getResponse();
        var cookie = response.getCookie("XSRF-TOKEN");
        assertThat(cookie).isNotNull();
        return request -> {
            request.setCookies(cookie);
            request.addHeader("X-XSRF-TOKEN", cookie.getValue());
            return request;
        };
    }

    // Deliberately test-only endpoints exercise the real production filter rules.
    @TestComponent
    @RestController
    static class Probes {
        @GetMapping("/api/admin/probe") String admin() { return "ok"; }
        @org.springframework.web.bind.annotation.PostMapping("/api/driver/probe")
        String driver() { return "ok"; }
    }
}
