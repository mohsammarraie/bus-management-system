-- Synthetic local practice data. Run explicitly after Flyway creates the schema.
-- Preserve existing registrations, including any edits and optimistic-lock versions.
BEGIN;

WITH inserted AS (
    INSERT INTO bus_management.buses (registration_number, capacity, active)
    SELECT
        'DEMO-BUS-' || lpad(number::text, 3, '0'),
        CASE number % 4
            WHEN 0 THEN 50
            WHEN 1 THEN 20
            WHEN 2 THEN 30
            ELSE 40
        END,
        number % 5 <> 0
    FROM generate_series(1, 30) AS demo(number)
    ORDER BY number
    ON CONFLICT ON CONSTRAINT uq_buses_registration_number DO NOTHING
    RETURNING id
)
SELECT count(*) AS inserted_buses FROM inserted;

COMMIT;
