FROM quay.io/keycloak/keycloak:26.8.2@sha256:3879c623248408de29a5303178b5816c77e8dfef3890c361f8c0bbeaa979ba3b

# Inherit Keycloak's runtime/user; only public theme assets are added.
COPY --chown=1000:0 themes/bus-management/ /opt/keycloak/themes/bus-management/

# Keycloak caches static resources for 30 days. New bytes need a new URL on every upgrade.
RUN set -eu; \
    theme=/opt/keycloak/themes/bus-management/login; \
    for asset in css/bus-management.css js/appearance.js; do \
        digest=$(sha256sum "$theme/resources/$asset" | cut -c1-12); \
        versioned="${asset%.*}.$digest.${asset##*.}"; \
        mv "$theme/resources/$asset" "$theme/resources/$versioned"; \
        sed -i "s|$asset|$versioned|g" "$theme/theme.properties"; \
    done
