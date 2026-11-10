package io.github.mohsammarraie.busmanagement.fleet.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "buses", schema = "bus_management")
public class Bus {

    public static final int REGISTRATION_MAX_LENGTH = 32;
    // Unicode text, no surrounding whitespace or control characters; exact case is preserved.
    public static final String REGISTRATION_PATTERN = "(?U)[^\\s\\p{Cc}](?:[^\\p{Cc}]*[^\\s\\p{Cc}])?";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "registration_number", nullable = false, length = 32)
    private String registrationNumber;

    @Column(nullable = false)
    private int capacity;

    @Column(nullable = false)
    private boolean active = true;

    @Version
    @Column(nullable = false)
    private long version;

    protected Bus() {
    }

    public Bus(String registrationNumber, int capacity) {
        this(registrationNumber, capacity, true);
    }

    public Bus(String registrationNumber, int capacity, boolean active) {
        changeDetails(registrationNumber, capacity, active);
    }

    public void changeDetails(String registrationNumber, int capacity, boolean active) {
        if (registrationNumber == null || registrationNumber.length() > REGISTRATION_MAX_LENGTH
                || !registrationNumber.matches(REGISTRATION_PATTERN)) {
            throw new IllegalArgumentException("Registration number must be trimmed text of 1 to 32 characters");
        }
        if (capacity <= 0) {
            throw new IllegalArgumentException("Capacity must be positive");
        }
        this.registrationNumber = registrationNumber;
        this.capacity = capacity;
        this.active = active;
    }

    public Long getId() {
        return this.id;
    }

    public String getRegistrationNumber() {
        return this.registrationNumber;
    }

    public int getCapacity() {
        return this.capacity;
    }

    public boolean isActive() {
        return this.active;
    }

    public long getVersion() {
        return this.version;
    }
}
