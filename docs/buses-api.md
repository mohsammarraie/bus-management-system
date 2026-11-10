# Backend buses API

The first business API lets an ADMIN create, list, inspect, edit, deactivate and delete buses. It uses the existing PostgreSQL table and JPA entity. The Angular buses screen and NgRx state are the next separate feature; the current sidebar still lists Buses as upcoming.

## Scope and data rules

Each bus response contains `id`, `registrationNumber`, `capacity`, `active` and `version`. IDs and versions are server-managed.

- Registration numbers contain 1–32 characters, with no surrounding Unicode whitespace or control characters. The API rejects padded input rather than silently changing it. Exact, case-sensitive uniqueness is retained from V1; `DEMO-1` and `demo-1` are distinct. Search is case-insensitive.
- Capacity is a required positive integer within Java/PostgreSQL's integer range. Decimal numbers and quoted numbers are rejected.
- Active is a required JSON boolean. `false` deactivates a bus while retaining its record. Inactive buses remain visible unless the caller filters them out.
- Unknown fields, including a client-supplied ID or a version on creation, are rejected. Updates require the version returned by the latest GET/create/update.
- DELETE physically removes the record. A stale version is rejected; a database foreign-key reference prevents deletion and returns a conflict. Scheduling/trip tables and their eligibility/ownership rules are later features. Deactivation is available when retaining a record is preferable.

No Flyway migration is needed: V1 already contains these columns, constraints and the optimistic-lock version. It is unchanged. Flyway still owns schema changes; Hibernate validates mappings. The original project's manufacturer, model year and chassis details need a later versioned schema extension and verified import mapping. The legacy license number corresponds conceptually to the new registration number, but no legacy records have been imported or identifiers remapped.

## HTTP contract

Base path: `/api/v1/buses`. Every operation requires ADMIN, including reads. Passengers and drivers will receive purpose-specific trip/assignment views in later features rather than access to this management API.

| Method | Path | Result |
|---|---|---|
| GET | `/api/v1/buses` | 200, paginated response |
| POST | `/api/v1/buses` | 201, created bus and relative `Location` header |
| GET | `/api/v1/buses/{id}` | 200, bus; 404 if absent |
| PUT | `/api/v1/buses/{id}` | 200, updated bus; full replacement of editable fields |
| DELETE | `/api/v1/buses/{id}?version={version}` | 204, empty body; 404 if absent |

IDs must be positive. Create body:

```json
{
  "registrationNumber": "DEMO-123",
  "capacity": 40,
  "active": true
}
```

Update body (use the actual current version):

```json
{
  "registrationNumber": "DEMO-123",
  "capacity": 45,
  "active": false,
  "version": 0
}
```

List query parameters:

| Parameter | Default | Allowed values |
|---|---|---|
| `page` | 0 | Zero-based integer, 0–10000 |
| `size` | 20 | Integer, 1–100 |
| `sort` | `registrationNumber` | `id`, `registrationNumber`, `capacity`, `active` |
| `direction` | `asc` | `asc` or `desc` |
| `q` | none | Registration substring, up to 100 characters; surrounding search whitespace is ignored |
| `active` | none | Optional boolean filter, e.g. `true` or `false` |

Search treats `%`, `_` and `\` as literal characters, not SQL wildcards. Sorting always has an ascending ID tie-breaker unless sorting by ID itself. No arbitrary property names or SQL fragments are accepted.

Example: `GET /api/v1/buses?q=demo&active=true&page=0&size=20&sort=capacity&direction=desc`.

```json
{
  "content": [
    { "id": 1, "registrationNumber": "DEMO-123", "capacity": 40, "active": true, "version": 0 }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1
}
```

An empty database has `content: []`, `totalElements: 0` and `totalPages: 0`. A page beyond the result set has empty content and still reports the matching total. The response is an application-owned DTO, not Spring Data's internal Page serialization.

## Errors and security

Expected errors use `application/problem+json` with standard problem-detail members and a stable `code`. Validation failures also provide field names mapped to lists of codes; rejected input values, SQL and constraint names are not included. Frontend translations should use these codes rather than parsing English detail strings.

| Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_FAILED` | Body field constraints failed; see `fields` |
| 400 | `INVALID_REQUEST` | Malformed JSON, unknown/wrongly typed fields, invalid query/path values or missing parameters |
| 401 | `AUTHENTICATION_REQUIRED` | A session is required |
| 403 | `ACCESS_DENIED` | Role access denied; writes also require valid CSRF |
| 404 | `BUS_NOT_FOUND` | The requested bus does not exist |
| 409 | `BUS_REGISTRATION_CONFLICT` | Another record has exactly that registration number |
| 409 | `BUS_VERSION_CONFLICT` | Stale version or a concurrent change |
| 409 | `BUS_IN_USE` | A foreign-key reference prevents deletion |

Field codes include `REQUIRED`, `TOO_LONG`, `FORMAT`, `POSITIVE` and `NON_NEGATIVE`. Framework errors such as unsupported media types/methods also receive stable codes. Unexpected data-integrity failures return a generic `INTERNAL_ERROR` without database details. Existing authentication codes are retained; the 401/403 filter responses now also include standard problem-detail type/title/status members. A write without CSRF can be rejected with 403 before authentication is evaluated.

Spring Security restricts the route, and method authorization also protects the service. Authentication remains the backend-managed Keycloak OIDC session; do not send JWTs from Angular. The browser sends the HttpOnly session cookie automatically. Mutating API requests send the current readable `XSRF-TOKEN` cookie value in `X-XSRF-TOKEN`, as Angular HttpClient does. The masked token returned in the CSRF endpoint's JSON is for the native logout form, not this header. See [authentication setup](authentication-setup.md).

## Transactions and concurrency

Each write is transactional. PostgreSQL's unique constraint is the final authority for duplicate registrations, including concurrent creates; a pre-check would not prevent that race. Failed writes roll back.

PUT and DELETE require an explicit expected version. Hibernate's `@Version` also protects the actual database write when two transactions load the same version. Mutation reads use an optimistic lock so even a no-op update verifies its version at commit. An identical PUT need not increment the version; a changed record does. On conflict, reload the record and let the administrator review the latest data rather than silently retrying an overwrite.

No cascaded deletion, assignment management, audit log or legacy ID allocation is introduced. Future reference tables must use foreign keys and feature-specific rules rather than bypassing this policy.

## Swagger UI and OpenAPI

Springdoc 3.2.0 generates the OpenAPI document from the actual controllers, DTOs and validation rules. Swagger UI provides an interactive developer reference. Both the UI and schema/assets require an ADMIN application session.

After starting/rebuilding the backend, sign in normally as `demo-admin`, then open:

| Local mode | Swagger UI | OpenAPI JSON |
|---|---|---|
| Docker stack | http://localhost:8082/api/docs | http://localhost:8082/api/openapi |
| Angular host proxy | http://localhost:4200/api/docs | http://localhost:4200/api/openapi |
| Direct host backend | http://localhost:8080/api/docs | http://localhost:8080/api/openapi |

The schema is also available at `/api/openapi.yaml`. Documentation paths stay under `/api`, so the existing Caddy/Angular proxies handle them. Relative server URLs keep Try it out on the current origin. Anonymous requests receive 401; driver/passenger sessions receive 403. The normal application login is required, not a Keycloak admin-console login.

Use the browser session directly; Swagger's Authorize dialog is not needed. Swagger UI reads the raw `XSRF-TOKEN` cookie and supplies `X-XSRF-TOKEN` on requests. The Angular sign-in flow obtains this cookie; the documented GET `/api/auth/csrf` operation refreshes it if needed. Session and CSRF checks stay enabled, and no OAuth client secret or JWT is embedded in Swagger.

The spec includes bus operations and the session/CSRF helpers, required fields, examples, response status codes, error schemas and session/CSRF security schemes. Java-specific registration regex flags are represented by a prose restriction in the schema rather than an invalid JSON Schema regex; server validation remains unchanged. `OpenApiConfiguration.java` owns shared metadata/error references; controller annotations supply operation descriptions and status codes. [Springdoc compatibility and configuration](https://springdoc.org/).

## Try it locally

Start either documented [local mode](../README.md#run-locally), then log in as the demo administrator through the normal UI. Browser DevTools Console uses that same session and same-origin API proxy:

```javascript
await fetch('/api/auth/csrf');
const csrf = decodeURIComponent(
  document.cookie.split('; ').find(item => item.startsWith('XSRF-TOKEN=')).slice('XSRF-TOKEN='.length)
);
const response = await fetch('/api/v1/buses', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrf },
  body: JSON.stringify({ registrationNumber: 'DEMO-123', capacity: 40, active: true })
});
const bus = await response.json();
console.log(response.status, bus);
```

GET `fetch('/api/v1/buses').then(response => response.json())` to inspect the list. Reuse the returned ID/version for PUT or DELETE and fetch fresh CSRF after a session change. Repeating the example registration intentionally produces a duplicate conflict. This exercise creates a real local development record; automated tests instead use disposable synthetic databases.

## Code reading order and reusable feature pattern

1. `fleet/api/CreateBusRequest.java`, `UpdateBusRequest.java`, `BusResponse.java`, `BusPage.java`: validated input and stable output contracts.
2. `fleet/api/BusController.java`: routes, parameter validation, status codes and Location.
3. `fleet/application/BusService.java`: ADMIN authorization, transaction boundaries, query construction, version checks and DTO mapping.
4. `fleet/persistence/BusRepository.java` and `fleet/domain/Bus.java`: Spring Data/JPA persistence, domain invariants and Hibernate locking.
5. `fleet/application/BusException.java` and `shared/api/ApiExceptionHandler.java`: application failure reasons mapped to safe HTTP errors, including Spring's two request-validation paths.
6. `auth/SecurityConfiguration.java`: route permissions, OIDC/session/CSRF security and 401/403 handling.
7. `BusApiIntegrationTests.java`: real PostgreSQL API, rollback, role/CSRF and concurrency examples. `scripts/auth_smoke.py` adds real Keycloak session coverage through the packaged proxy.

The Java paths are under `backend/src/main/java/io/github/mohsammarraie/busmanagement/`; the integration test is under the matching test package. Reuse these responsibilities for routes/drivers/stops, adapting their rules rather than introducing a generic CRUD superclass. JPA is the persistence API, Hibernate ORM implements it, and Spring Data implements the repository. The new validation starter supplies Hibernate Validator for Jakarta Bean Validation; it is distinct from Hibernate ORM.

## Verification

From `backend/`: `./gradlew clean test bootJar` requires Docker and creates isolated PostgreSQL containers. From the root, build the backend image and run `python3 scripts/smoke-compose.py`; the normal development volume and credentials are not used. Existing Backend CI runs the Java checks; existing Container CI runs the enhanced real-session smoke without a new workflow/job.

Local verification on 10 November 2026: `./gradlew clean test bootJar` passed all 82 tests with no failures/errors/skips (41 bus API cases, 9 API documentation cases and 32 existing authentication/database/health cases). The tests use actual PostgreSQL and production security filters with test OIDC identities. They cover concurrent creates/edits, no-op locking, deletion references, generated schema references, documentation access restrictions and proxy-safe Swagger assets.

The backend image and disposable Compose smoke passed with real Keycloak sessions: ADMIN CRUD/conflicts, documentation access, driver/passenger denial, CSRF, session/logout/signup, migration, persistence and database outage/recovery. All 88 application browser checks passed; the optional real-identity browser flow also used Swagger's actual Try it out controls to create/delete a bus and verified the raw CSRF header. Its exported OpenAPI references resolve, and the page was visually reviewed. Temporary test containers/network/volume were removed; normal development data was not used.

Formatting, browser-test type checking, Python syntax, local documentation links and diff checks passed. Hosted Backend/Container CI remains pending the user's commit/push/PR. No frontend buses CRUD screen is claimed here.

References: [Spring problem details](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html), [Spring Data locking](https://docs.spring.io/spring-data/jpa/reference/jpa/locking.html), [Spring validation](https://docs.spring.io/spring-boot/reference/io/validation.html).
