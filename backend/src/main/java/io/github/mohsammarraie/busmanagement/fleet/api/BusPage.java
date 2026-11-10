package io.github.mohsammarraie.busmanagement.fleet.api;

import java.util.List;
import org.springframework.data.domain.Page;

// Stable HTTP contract; do not serialize Spring Data's implementation-specific Page structure.
public record BusPage(List<BusResponse> content, int page, int size, long totalElements, int totalPages) {
    public static BusPage from(Page<BusResponse> page) {
        return new BusPage(page.getContent(), page.getNumber(), page.getSize(),
                page.getTotalElements(), page.getTotalPages());
    }
}
