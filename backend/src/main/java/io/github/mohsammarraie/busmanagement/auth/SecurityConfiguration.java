package io.github.mohsammarraie.busmanagement.auth;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.oidc.web.logout.OidcClientInitiatedLogoutSuccessHandler;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.oidc.user.OidcUserAuthority;
import org.springframework.security.core.authority.mapping.GrantedAuthoritiesMapper;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.savedrequest.NullRequestCache;

@Configuration(proxyBeanMethods = false)
@EnableMethodSecurity
@EnableConfigurationProperties(AuthProperties.class)
public class SecurityConfiguration {
    @Bean
    ClientRegistrationRepository clients(AuthProperties properties) {
        // Explicit endpoints allow Docker back-channel traffic without changing the public issuer.
        String issuer = properties.issuer().toString();
        String internal = properties.internalIssuer().toString();
        return new InMemoryClientRegistrationRepository(ClientRegistration.withRegistrationId("keycloak")
                .clientId("bus-management").clientSecret(properties.clientSecret())
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri(properties.publicUrl() + "/api/login/oauth2/code/keycloak")
                .scope("openid", "profile")
                .issuerUri(issuer)
                .authorizationUri(issuer + "/protocol/openid-connect/auth")
                .tokenUri(internal + "/protocol/openid-connect/token")
                .jwkSetUri(internal + "/protocol/openid-connect/certs")
                .userInfoUri(internal + "/protocol/openid-connect/userinfo")
                .userNameAttributeName("sub")
                .providerConfigurationMetadata(Map.of("end_session_endpoint", issuer + "/protocol/openid-connect/logout"))
                .clientName("Bus Management System").build());
    }

    @Bean
    GrantedAuthoritiesMapper applicationAuthorities() {
        Set<String> known = new HashSet<>();
        Arrays.stream(ApplicationRole.values()).forEach(role -> known.add(role.name()));
        return authorities -> {
            Set<org.springframework.security.core.GrantedAuthority> mapped = new HashSet<>(authorities);
            for (var authority : authorities) {
                if (authority instanceof OidcUserAuthority oidc) {
                    List<String> roles = oidc.getIdToken().getClaimAsStringList("app_roles");
                    if (roles != null) {
                        roles.stream().filter(known::contains)
                                .map(role -> new SimpleGrantedAuthority("ROLE_" + role)).forEach(mapped::add);
                    }
                }
            }
            return mapped;
        };
    }

    @Bean
    SecurityFilterChain security(HttpSecurity http, ClientRegistrationRepository clients,
                                 AuthProperties properties, GrantedAuthoritiesMapper authorities) throws Exception {
        var resolver = new LoginRequestResolver(clients);
        var logout = new OidcClientInitiatedLogoutSuccessHandler(clients);
        logout.setPostLogoutRedirectUri(properties.publicUrl() + "/overview");
        http.authorizeHttpRequests(auth -> auth
                .dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ERROR).permitAll()
                .requestMatchers("/actuator/health", "/api/auth/csrf", "/api/auth/login", "/api/auth/signup",
                        "/api/oauth2/**", "/api/login/oauth2/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/driver/**").hasAnyRole("ADMIN", "DRIVER")
                .requestMatchers("/api/**", "/api").authenticated()
                .anyRequest().denyAll())
            .csrf(csrf -> csrf.csrfTokenRepository(
                    org.springframework.security.web.csrf.CookieCsrfTokenRepository.withHttpOnlyFalse()).spa())
            .requestCache(cache -> cache.requestCache(new NullRequestCache()))
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((request, response, error) -> {
                    if (!request.getRequestURI().startsWith("/api")) {
                        response.sendError(404);
                    } else {
                        response.setStatus(401);
                        response.setContentType("application/json");
                        response.getWriter().write("{\"code\":\"AUTHENTICATION_REQUIRED\"}");
                    }
                })
                .accessDeniedHandler((request, response, error) -> {
                    response.setStatus(403);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"code\":\"ACCESS_DENIED\"}");
                }))
            .oauth2Login(oidc -> oidc
                .authorizationEndpoint(endpoint -> endpoint.authorizationRequestResolver(resolver))
                .redirectionEndpoint(endpoint -> endpoint.baseUri("/api/login/oauth2/code/*"))
                .userInfoEndpoint(info -> info.userAuthoritiesMapper(authorities))
                .defaultSuccessUrl(properties.publicUrl() + "/overview", true)
                .failureUrl(properties.publicUrl() + "/overview?auth=failed"))
            .logout(config -> config.logoutUrl("/api/auth/logout")
                .logoutSuccessHandler(logout).invalidateHttpSession(true).deleteCookies("JSESSIONID"));
        return http.build();
    }
}
