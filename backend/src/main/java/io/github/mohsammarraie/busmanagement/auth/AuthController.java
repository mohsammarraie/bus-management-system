package io.github.mohsammarraie.busmanagement.auth;

import java.util.List;
import java.util.Set;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.view.RedirectView;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    @GetMapping("/login")
    RedirectView login(@RequestParam(name = "lang", defaultValue = "en") String language) {
        return beginLogin(language, false);
    }

    @GetMapping("/signup")
    RedirectView signup(@RequestParam(name = "lang", defaultValue = "en") String language) {
        // Keycloak handles registration; the configured realm default grants PASSENGER only.
        return beginLogin(language, true);
    }

    private RedirectView beginLogin(String language, boolean registration) {
        String locale = Set.of("en", "de", "ar").contains(language) ? language : "en";
        return new RedirectView("/api/oauth2/authorization/keycloak?lang=" + locale
                + (registration ? "&registration=true" : ""));
    }

    @GetMapping("/csrf")
    ResponseEntity<CsrfResponse> csrf(CsrfToken token) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(new CsrfResponse(token.getHeaderName(), token.getToken()));
    }

    @GetMapping("/me")
    ResponseEntity<AccountResponse> me(Authentication authentication) {
        OidcUser user = (OidcUser) authentication.getPrincipal();
        List<String> roles = authentication.getAuthorities().stream().map(Object::toString)
                .filter(role -> role.startsWith("ROLE_"))
                .map(role -> role.substring(5)).sorted().toList();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(
                new AccountResponse(user.getSubject(), user.getPreferredUsername(), roles));
    }

    record CsrfResponse(String headerName, String token) {}
    record AccountResponse(String id, String username, List<String> roles) {}
}
