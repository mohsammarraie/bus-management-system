package io.github.mohsammarraie.busmanagement.shared.api;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.ArraySchema;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.MapSchema;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.ObjectSchema;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import java.util.List;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class OpenApiConfiguration {
    @Bean
    OpenAPI applicationApi() {
        return new OpenAPI().info(new Info().title("Bus Management System API").version("v1")
                .description("Sign in through the normal application first. Bus management and these documentation pages "
                        + "require ADMIN. The browser sends its HttpOnly session cookie automatically; no Bearer token "
                        + "or Swagger Authorize entry is needed. GET /api/auth/csrf refreshes the readable XSRF-TOKEN "
                        + "cookie; Swagger UI copies it into X-XSRF-TOKEN for writes. The JSON token is masked for forms."))
                .servers(List.of(new Server().url("/")))
                .components(new Components()
                        .addSecuritySchemes("sessionCookie", new SecurityScheme().type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.COOKIE).name("JSESSIONID")
                                .description("Existing browser application session; login via /api/auth/login. Do not paste a token here."))
                        .addSecuritySchemes("csrfHeader", new SecurityScheme().type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.HEADER).name("X-XSRF-TOKEN")
                                .description("Raw XSRF-TOKEN cookie, automatically sent by Swagger UI; refresh via GET /api/auth/csrf.")));
    }

    @Bean
    OpenApiCustomizer busesApiContract() {
        return api -> {
            // Jakarta Pattern uses Java-only flags. Document that rule in prose rather than emit invalid JSON Schema regex.
            for (String name : List.of("CreateBusRequest", "UpdateBusRequest")) {
                Schema<?> request = api.getComponents().getSchemas().get(name);
                if (request == null || request.getProperties() == null) continue;
                Schema<?> registration = request.getProperties().get("registrationNumber");
                if (registration != null) {
                    registration.setPattern(null);
                    registration.setMinLength(1);
                }
            }
            // Add this schema alongside its references, after springdoc's unused-model pruning.
            api.getComponents().addSchemas("ApiProblem", new ObjectSchema()
                    .addProperty("type", new StringSchema().example("about:blank"))
                    .addProperty("title", new StringSchema())
                    .addProperty("status", new IntegerSchema().example(400))
                    .addProperty("detail", new StringSchema())
                    .addProperty("instance", new StringSchema())
                    .addProperty("code", new StringSchema().description("Stable application error code"))
                    .addProperty("fields", new MapSchema().description("Field names mapped to validation codes")
                            .additionalProperties(new ArraySchema().items(new StringSchema()))));
            api.getPaths().forEach((path, item) -> {
                if (!path.equals("/api/v1/buses") && !path.equals("/api/v1/buses/{id}")) return;
                item.readOperationsMap().forEach((method, operation) -> {
                    operation.getResponses()
                            .addApiResponse("400", problem("INVALID_REQUEST or VALIDATION_FAILED (see fields)"))
                            .addApiResponse("401", problem("AUTHENTICATION_REQUIRED"))
                            .addApiResponse("403", problem("ACCESS_DENIED; ADMIN and valid CSRF are required for bus writes"));
                    SecurityRequirement security = new SecurityRequirement().addList("sessionCookie");
                    if (path.contains("{id}")) operation.getResponses().addApiResponse("404", problem("BUS_NOT_FOUND"));
                    if (method != PathItem.HttpMethod.GET) {
                        security.addList("csrfHeader");
                        String conflicts = switch (method) {
                            case POST -> "BUS_REGISTRATION_CONFLICT";
                            case PUT -> "BUS_REGISTRATION_CONFLICT or BUS_VERSION_CONFLICT";
                            case DELETE -> "BUS_VERSION_CONFLICT or BUS_IN_USE";
                            default -> "Conflict";
                        };
                        operation.getResponses().addApiResponse("409", problem(conflicts));
                    }
                    operation.setSecurity(List.of(security));
                });
            });
        };
    }

    private ApiResponse problem(String description) {
        return new ApiResponse().description(description).content(new Content()
                .addMediaType("application/problem+json", new MediaType()
                        .schema(new Schema<>().$ref("#/components/schemas/ApiProblem"))));
    }
}
