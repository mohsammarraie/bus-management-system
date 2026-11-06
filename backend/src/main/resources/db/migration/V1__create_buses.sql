CREATE TABLE buses (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    registration_number VARCHAR(32) NOT NULL,
    capacity INTEGER NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_buses_registration_number UNIQUE (registration_number),
    CONSTRAINT ck_buses_registration_number_trimmed
        CHECK (registration_number <> '' AND registration_number !~ '(^[[:space:]]|[[:space:]]$)'),
    CONSTRAINT ck_buses_capacity_positive CHECK (capacity > 0)
);
