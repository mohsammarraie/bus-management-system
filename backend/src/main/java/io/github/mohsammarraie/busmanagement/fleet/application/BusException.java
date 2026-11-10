package io.github.mohsammarraie.busmanagement.fleet.application;

public final class BusException extends RuntimeException {
    public enum Reason { NOT_FOUND, STALE_VERSION }

    private final Reason reason;

    public BusException(Reason reason) {
        super(reason.name());
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }
}
