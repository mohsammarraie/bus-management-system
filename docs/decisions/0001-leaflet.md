# ADR 0001: Use Leaflet for trip maps

Status: accepted by the user, 6 November 2026.

## Context

Drivers share phone coordinates during trips; passengers view live bus positions and historical replay. The project favors accessible, open-source tooling and mobile-friendly screens.

## Decision

Use Leaflet for map rendering. Browser Geolocation captures positions; Spring Boot validates and persists them; Angular/RxJS retrieves updates. Keep the map component independent of the trip/location domain.

## Consequences

Select a tile provider and comply with its attribution/usage requirements before enabling maps. Leaflet itself does not provide unlimited free map hosting, background GPS, routing or predictive ETA. Google Maps is deferred unless a future need warrants reconsideration.

## Verification

Test driver-to-passenger marker updates, responsive/RTL layouts, stale/offline states, permission handling and terminal trip states. Use controlled assets and synthetic coordinates in CI, plus real-phone HTTPS acceptance checks.
