package io.github.mohsammarraie.busmanagement.fleet.api;

import io.github.mohsammarraie.busmanagement.fleet.application.BusService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ResponseStatus;

@RestController
@RequestMapping("/api/v1/buses")
@Tag(name = "Buses", description = "ADMIN-only bus management. Updates/deletes require the latest version.")
public class BusController {
    private final BusService buses;

    public BusController(BusService buses) {
        this.buses = buses;
    }

    @GetMapping
    @Operation(operationId = "listBuses", summary = "List, search and filter buses")
    public BusPage list(
            @RequestParam(defaultValue = "0") @Min(0) @Max(10000) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(defaultValue = "registrationNumber") @Pattern(regexp = "id|registrationNumber|capacity|active") String sort,
            @RequestParam(defaultValue = "asc") @Pattern(regexp = "asc|desc") String direction,
            @Parameter(description = "Case-insensitive registration substring; %, _ and backslash are literal")
            @RequestParam(required = false, name = "q") @Size(max = 100) String query,
            @RequestParam(required = false) Boolean active) {
        return buses.list(page, size, sort, direction, query, active);
    }

    @GetMapping("/{id}")
    @Operation(operationId = "getBus", summary = "Read a bus and its current version")
    public BusResponse get(@PathVariable @Positive long id) {
        return buses.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(operationId = "createBus", summary = "Create a bus", description = "Returns the new bus and a Location header. IDs/versions are server-managed.")
    public ResponseEntity<BusResponse> create(@Valid @RequestBody CreateBusRequest request) {
        BusResponse bus = buses.create(request.registrationNumber(), request.capacity(), request.active());
        return ResponseEntity.created(URI.create("/api/v1/buses/" + bus.id())).body(bus);
    }

    @PutMapping("/{id}")
    @Operation(operationId = "updateBus", summary = "Update or deactivate a bus", description = "Send every editable field and the latest version. A stale version returns 409; reload before retrying.")
    public BusResponse update(@PathVariable @Positive long id, @Valid @RequestBody UpdateBusRequest request) {
        return buses.update(id, request.registrationNumber(), request.capacity(), request.active(), request.version());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(operationId = "deleteBus", summary = "Permanently delete an unreferenced bus", description = "Requires the latest version. Use active=false in PUT to retain the record instead.")
    public ResponseEntity<Void> delete(@PathVariable @Positive long id, @RequestParam @PositiveOrZero long version) {
        buses.delete(id, version);
        return ResponseEntity.noContent().build();
    }
}
