package io.github.mohsammarraie.busmanagement.fleet.api;

import io.github.mohsammarraie.busmanagement.fleet.domain.Bus;

public record BusResponse(long id, String registrationNumber, int capacity, boolean active, long version) {
    public static BusResponse from(Bus bus) {
        return new BusResponse(bus.getId(), bus.getRegistrationNumber(), bus.getCapacity(),
                bus.isActive(), bus.getVersion());
    }
}
