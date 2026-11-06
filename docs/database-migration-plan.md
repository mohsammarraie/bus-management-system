# Database choice and migration plan

Prepared 6 November 2026. PostgreSQL 18.6 is implemented for new application development with a pinned Compose image, Flyway migrations and Testcontainers tests. See [database-setup.md](database-setup.md). Oracle remains isolated source recovery/verification only. The target schema currently contains initial fleet groundwork; no legacy dump import or executable Oracle conversion has been completed.

## Oracle versus PostgreSQL

| Consideration | Oracle Free | PostgreSQL |
|---|---|---|
| License cost | Free edition exists | Free/open-source PostgreSQL license |
| Legacy compatibility | Closest to existing Oracle SQL; old export restoration still requires verification | Requires type, SQL, procedure and trigger conversion |
| Published edition limits | 2 CPUs, 2 GB database RAM, 12 GB user data | No corresponding edition cap; actual infrastructure capacity still limits use |
| Learning and portfolio | Useful if targeting Oracle-heavy roles | Demonstrates portable application architecture and a documented database migration |
| Project recommendation | Temporary recovery environment or fallback if migration proves too costly | Primary database for application, local development, and CI |

PostgreSQL is not recommended merely because Oracle costs money: Oracle has a free option. It is recommended because it fits the requested standalone portfolio application and offers an opportunity to move scheduling logic into tested Java services while retaining relational integrity. Oracle's current Free FAQ says it does not receive patches; use a disposable local recovery environment. Software being free does not guarantee free public hosting.

## Final dump evidence

Source: `database-reference/buses-final-source.dmp`, SHA-256 `a96f3398ce07e35828c79a3d3e6fb9686c4a4a40bcc3d02634410def9df73f97`, 225,280 bytes. Header includes `EXPORT:V11.02.00`: consistent with an Oracle 11.2 original Export file. Oracle documents original `imp` for `exp` dumps; do not assume `impdp` or PostgreSQL tools can read it.

Read-only printable metadata inspection found 18 distinct table names, 8 view names, 3 procedures, 1 function, and 1 trigger name. Definitions appear multiple times in the file. These counts are deduplicated names, not a restored catalog. Printable extraction omits short/non-ASCII segments and is not valid executable DDL or a data export. Restore through Oracle tooling to settle status, ownership, completeness, encoding, and duplicated sections.

Tables: ADMINS_USERS, BUSES, BUSES_DRIVERS, BUSES_SCHEDULES, BUS_SCHEDULE_CONFLICT_REPORTS, DRIVERS, DRIVERS_USERS, REPORT_STATUS, ROUTES, ROUTES_SCHEDULES, ROUTES_STOPS, ROUTES_STOPS_SCHEDULES, STOPS, STUDENTS, STUDENTS_USERS, STUDENT_TRIP_REVIEWS, TRIPS, TRIPS_COORDINATES.

Views: ROUTES_SCHEDULES_TIMES_VIEW, BUSES_SCHEDULES_VIEW, DRIVERS_SCHEDULES_VIEW, PAST_TRIPS_VIEW, STUDENT_CURRENT_TRIPS_VIEW, REPORTS_VIEW, ALL_SCHEDULES_BUSES_VIEW, ALL_SCHEDULES_VIEW.

| Object | Observed behavior/status | Proposed disposition |
|---|---|---|
| INSERT_WITH_CONFLICT_CHECK | Scans assigned bus intervals; four inclusive overlap comparisons; inserts or raises an error; called by Java DAO | Replace with a transactional scheduling service and PostgreSQL integrity/locking strategy |
| UPDATE_WITH_CONFLICT_CHECK | Similar conflict scan and assignment update; called by Java DAO | Replace; explicitly exclude the assignment being edited and test conflicts after schedule changes |
| PROCEDURE1 | Additional cursor-based conflict routine; no Java caller found | Verify dependencies; retire if obsolete, preserving evidence |
| CHECK_SCHEDULE_CONFLICT | Extracted body returns NULL; no Java caller found | Treat as candidate placeholder; verify and omit if unused |
| TRIGGER1 | BEFORE INSERT on BUSES_SCHEDULES; scans overlapping intervals; export explicitly says DISABLE | Do not blindly reactivate or port; verify restored status and replace required behavior through the service |
| BUS_SCHEDULE_CONFLICT_REPORTS | Additional table absent from older dump inventory; no Java reference found | Check dependencies/data before deciding retention |
| STUDENT_TRIP_REVIEWS | Final dump primary key is (TRIP_ID, STUDENT_ID) | Preserve uniqueness; this corrects the older-dump finding in the first assessment |

TRIGGER1 is stored under `CREATE FORMAT92TRIG`, so an initial `CREATE TRIGGER` scan missed it. Its extracted body includes a transaction rollback and queries the table it fires on; assess intended behavior rather than assuming a literal port is safe. PostgreSQL supports triggers, but Oracle PL/SQL and PostgreSQL PL/pgSQL are not interchangeable. No conclusion about all production triggers is possible from this file alone.

## Conversion map

| Legacy construct | Target approach / validation |
|---|---|
| NUMBER | Use integer/bigint for fitting IDs and counts, numeric for decimal values; inspect precision and actual values before narrowing |
| VARCHAR2 and bilingual values | varchar/text, UTF-8 export/load; verify Arabic names manually and programmatically |
| DATE / TIMESTAMP used as schedule clock | Separate service date, local time, day offset and timezone; distinguish true timestamps from 1970 placeholders |
| Actual trip timestamps | Map to instants only after establishing source timezone; keep original values in private staging for reconciliation |
| String coordinates / LONGTITUDE spelling | Validated numeric coordinates; explicitly map legacy column spelling |
| MAX(id)+1 | Identity/sequence-generated keys, generated-key retrieval; reset sequences above migrated maxima |
| SYSDATE, TO_CHAR, CONCAT, Oracle formatting | Explicit PostgreSQL expressions or typed Java operations; compare query outcomes |
| Empty string = NULL behavior | Normalize intentionally and test missing values, unique constraints and required fields |
| Uppercase quoted schema/table names | Map to lower snake_case target names; do not depend on implicit case folding |
| Storage/tablespace/FORMAT clauses | Remove Oracle physical/export directives from logical migrations |
| ENABLE NOVALIDATE constraints | Check actual source orphans/duplicates; do not assume pre-existing rows were validated |
| Status text in English/Arabic | Canonical status codes; translate display labels in Angular |
| Per-role plaintext user tables | Unified accounts and roles; demo/reset credentials, no reuse of legacy plaintext passwords |
| Views used by reports | PostgreSQL views or explicit read-model queries; verify equivalent filters/aggregates |
| Scheduling procedures/trigger | Java domain rules + transaction locks + DB constraints; concurrent tests required |

## Migration runbook and gates

1. **Preserve:** keep checksummed original dumps and source commit. Raw dumps and exports stay out of public commits/CI artifacts. Keep the two database versions separately identified.
2. **Recover:** select a compatible Oracle client/server combination with original `imp`; first inspect metadata/log output and run recovery in an isolated schema/instance. Confirm tooling availability before promising current Oracle Free can restore the file without an intermediate version.
3. **Inventory:** record owner/object names, enabled triggers, valid/invalid objects, procedure source, sequences, constraints, view dependencies, row counts, encoding and time assumptions. Compare final dump to code-required columns/objects.
4. **Define mappings:** one row per table/column/rule with destination, transform, default, rejection rule and test. Preserve old identifiers in private mapping tables when target IDs change.
5. **Create target:** apply versioned Flyway SQL migrations to empty PostgreSQL. Use schema validation, not Hibernate auto-update. Create synthetic deterministic demo data separately from legacy ETL.
6. **Export and stage:** export typed data through Oracle tooling with explicit character encoding and timestamp formatting. Load to staging; identify invalid coordinates, missing relations, duplicate users, ambiguous time values and malformed data. Quarantine rejected rows with reason/count; never silently drop them.
7. **Transform/load:** parents before children; map accounts/profiles, fleet, stops/routes, timetable/assignments, historical trips, coordinates and reviews. Preserve decimal ratings and historical associations. Reset generated ID sequences. Account migration requires an explicit reset strategy.
8. **Reconcile:** source/staging/target counts per mapped category, duplicate and FK checks, required data nullability, representative values, Arabic text, trip chronology, ratings and report aggregates. Explain any changed counts due to intentional merges or rejected rows. Historical missing fields must be reported, not fabricated as recovered facts.
9. **Rehearse:** restore a fresh target from migrations and rerun import deterministically; a second run must not duplicate rows. Keep run IDs and source hashes. Record elapsed time and failures. Use synthetic fixtures for automated CI.
10. **Rollback and release:** before an import, snapshot the target. On failure, restore the snapshot or recreate a disposable target and replay known migrations. Keep legacy source available. For this portfolio, no live dual-write/cutover is needed. If an active production system is later involved, separately plan downtime, write freeze/delta sync, rollback compatibility and ownership.

Completion means successful restoration and reconciliation, not merely readable strings or a schema diagram. If source recovery blocks progress, build the approved target with synthetic data while tracking migration as incomplete.

## Docker integration

The target PostgreSQL runs from a pinned official image with a named data volume in the main Compose stack. Flyway handles schema changes; synthetic seed data is separate from legacy import. Keep raw Oracle dumps outside image build contexts. The temporary Oracle recovery environment uses its own explicit Compose file and volumes once compatible import tooling is verified. Document backup/restore and validate data persistence across target-container recreation; no database image embeds migrated records.

## Initial acceptance scenarios

- Adjacent and contained intervals, equal endpoints, different buses, editing the same assignment, reassignment and changing an already-assigned timetable.
- Two simultaneous conflicting assignments: exactly one succeeds.
- Two concurrent drivers: location/end/cancel operations affect only the owned trip.
- Duplicate review submissions: database rejects the second; decimal average remains correct.
- Schedule times around midnight and punctuality/start-window boundaries.
- Invalid coordinates, out-of-order samples, duplicate sample sequence, and stale position display.
- Imported Arabic strings, orphan records and timestamps survive explicit validation.

## Official references

- [Oracle Free FAQ](https://www.oracle.com/uk/database/free/faq/) for free-edition limits and maintenance terms.
- [Original Import documentation](https://docs.oracle.com/en/database/oracle/oracle-database/26/sutil/oracle-original-import-utility.html) for `imp`/`exp` format distinction.
- [PostgreSQL license](https://www.postgresql.org/about/licence/).
- [PostgreSQL Oracle PL/SQL porting guide](https://www.postgresql.org/docs/current/plpgsql-porting.html) for language/type/trigger differences.
