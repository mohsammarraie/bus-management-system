# Repository working agreements

## Purpose

Rebuild Bus Management System while preserving its main use cases. Help the user learn Angular, Spring Boot and agent-assisted engineering. Explain substantial design choices briefly and report verification honestly.

## Current state

The backend starter is implemented. Read docs/backend-starter.md and docs/next-steps.md, plus architecture/decisions relevant to a task.

Command contract from `backend/`: the wrapper launches with a compatible Java installation and resolves Java 25 through the configured toolchain/Foojay resolver. An installed full JDK 25 is reused; otherwise the first build downloads one. Do not depend on a chat-specific absolute JDK path.

- `./gradlew clean test bootJar`: compile, HTTP integration tests and executable JAR.
- `./gradlew bootRun`: start backend; `GET /actuator/health` returns UP.
- `java -jar build/libs/bus-management-system-backend-0.0.1-SNAPSHOT.jar`: run packaged backend.

PostgreSQL, Angular, Docker and CI scripts are not implemented yet. No business APIs or authentication exist at this stage.

## User-controlled Git and step handoffs

- Before each implementation step, state its scope and recommend a model/reasoning effort so the user can choose for credit efficiency. Do not automatically switch models or proceed into the next major step after the handoff.
- Create a focused local branch for the task. Check for existing user changes first; preserve them and avoid switching or resetting away work.
- Implement the authorized task, run relevant checks and review the diff.
- Leave all task changes uncommitted and unstaged. Do not run git add, commit, push, open a PR, merge or rewrite history unless the user explicitly requests that action in a later instruction. Earlier publication/merge authorizations were specific to those completed actions.
- At each handoff, report branch, changes, actual validation and limitations, a suggested commit message, and the next step with recommended model/effort and a short reason.
- The user reviews, commits and pushes. Remote CI results can only be reported after the user's push and an actual run; mark them pending beforehand.

## Engineering

- Work in focused feature branches with acceptance criteria and reviewable diffs.
- Keep controllers, services, domain rules and persistence responsibilities clear.
- Preserve useful behavior, not legacy implementation defects. Record intended behavior changes.
- Avoid unnecessary duplication and speculative generic frameworks.
- Enforce role/ownership checks on the backend and relational invariants in the database.
- Never store active user/trip state in mutable static fields.
- Flyway owns schema changes; do not use automatic Hibernate schema updates.
- Leaflet is accepted; tile hosting is still undecided. Keep mapping separate from coordinate capture and trip business logic.
- Mobile/RTL behavior and stale/offline tracking states are acceptance criteria.

## Data and verification

- Keep raw dumps, exports, credentials and real personal data out of Git and Docker build contexts. Use synthetic fixtures in tests/demos.
- Use PostgreSQL integration tests for database behavior. Add concurrency tests for scheduling/trip integrity.
- Run checks appropriate to each change and report actual results, skipped checks and limitations.
- Do not publish artifacts or change remote repositories without authorization for that step.
- Respect the user's requested hands-on exercises; otherwise complete authorized routine work without repeated confirmation.
