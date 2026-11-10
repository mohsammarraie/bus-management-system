package io.github.mohsammarraie.busmanagement.fleet.api;

import io.github.mohsammarraie.busmanagement.fleet.domain.Bus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

@Schema(additionalProperties = Schema.AdditionalPropertiesValue.FALSE)
public record UpdateBusRequest(
        @Schema(example = "DEMO-123", description = "1–32 characters; no surrounding Unicode whitespace or control characters. Exact case is preserved.")
        @NotBlank(message = "REQUIRED")
        @Size(max = Bus.REGISTRATION_MAX_LENGTH, message = "TOO_LONG")
        @Pattern(regexp = Bus.REGISTRATION_PATTERN, message = "FORMAT") String registrationNumber,
        @Schema(example = "45") @NotNull(message = "REQUIRED") @Positive(message = "POSITIVE") Integer capacity,
        @Schema(example = "false") @NotNull(message = "REQUIRED") Boolean active,
        @Schema(example = "0", description = "Version from the latest read; reload after a conflict")
        @NotNull(message = "REQUIRED") @PositiveOrZero(message = "NON_NEGATIVE") Long version) {
}
