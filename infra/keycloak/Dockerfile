FROM quay.io/keycloak/keycloak:26.8.2@sha256:3879c623248408de29a5303178b5816c77e8dfef3890c361f8c0bbeaa979ba3b

# Inherit Keycloak's runtime/user; only public theme assets are added.
COPY --chown=1000:0 themes/bus-management/ /opt/keycloak/themes/bus-management/
