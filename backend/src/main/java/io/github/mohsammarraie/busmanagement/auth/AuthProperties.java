package io.github.mohsammarraie.busmanagement.auth;

import java.net.URI;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.Assert;

@ConfigurationProperties("app.auth")
public record AuthProperties(URI publicUrl, URI issuer, URI internalIssuer, String clientSecret) {
    public AuthProperties {
        Assert.notNull(publicUrl, "app.auth.public-url is required");
        Assert.notNull(issuer, "app.auth.issuer is required");
        Assert.notNull(internalIssuer, "app.auth.internal-issuer is required");
        Assert.hasText(clientSecret, "OIDC_CLIENT_SECRET is required");
    }
}
