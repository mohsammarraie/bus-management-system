package io.github.mohsammarraie.busmanagement.auth;

import java.util.Set;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestCustomizers;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

final class LoginRequestResolver implements OAuth2AuthorizationRequestResolver {
    private final DefaultOAuth2AuthorizationRequestResolver delegate;

    LoginRequestResolver(ClientRegistrationRepository clients) {
        delegate = new DefaultOAuth2AuthorizationRequestResolver(clients, "/api/oauth2/authorization");
        delegate.setAuthorizationRequestCustomizer(OAuth2AuthorizationRequestCustomizers.withPkce());
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        return customize(request, delegate.resolve(request));
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String registrationId) {
        return customize(request, delegate.resolve(request, registrationId));
    }

    private OAuth2AuthorizationRequest customize(HttpServletRequest request, OAuth2AuthorizationRequest original) {
        if (original == null) return null;
        return OAuth2AuthorizationRequest.from(original).additionalParameters(parameters -> {
            if ("true".equals(request.getParameter("registration"))) parameters.put("prompt", "create");
            String language = request.getParameter("lang");
            if (language != null && Set.of("en", "de", "ar").contains(language)) {
                parameters.put("ui_locales", language);
            }
        }).build();
    }
}
