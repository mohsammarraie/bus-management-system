# Development workflow templates

Proposed content to place in the successor repository during its foundation PR. These are planning templates, not installed GitHub automation.

## Working agreement

The agent creates the task branch, implements changes, verifies them and leaves the diff unstaged and uncommitted. The user reviews, commits and pushes. No PR creation, merge, commit or push is implied by finishing an implementation step. Explicit later requests can authorize individual Git actions.

Before starting a step and at every completion, recommend an economical model/effort for the next bounded task. Recommendations are task-specific guidance, not guaranteed quality or usage estimates. The user controls the model selection.

## Completion handoff

- Branch:
- Changes and purpose:
- Validation actually run and results:
- Limitations / hosted CI pending:
- Suggested commit message (text only):
- Next step and completion criteria:
- Recommended model and effort, with reason:
- Git state: changes uncommitted, unstaged and unpushed.

## Feature issue

Title: `<feature>: <observable outcome>`

- User and problem:
- Current behavior and evidence:
- Desired behavior:
- Legacy behavior to preserve and intentional improvements:
- Acceptance examples, including invalid/unauthorized cases:
- API and database impact:
- Scope exclusions:
- Tests and demonstration:
- Learning objective and part I will implement:
- Docker/image/Compose impact, if applicable:
- Related architecture decision:

## Pull request

Problem and resulting behavior:

Implementation and meaningful tradeoffs:

Validation performed, with exact commands/results:

Database migration and recovery considerations, if applicable:

Screenshots for UI changes; include RTL where affected:

Known limitations:

Linked issue:

## Agent task prompt

Implement issue <id> using the repository instructions and approved architecture. First explain the relevant concept and the proposed change briefly. Keep the task focused on the acceptance criteria. Preserve the main use cases while creating a clean implementation; improve legacy design and remove unnecessary duplication where justified. Document intentional behavior corrections and verify them. Let me implement <exercise> before completing that part when requested; otherwise proceed with the authorized implementation. Run the relevant checks, review the diff, and report actual results and remaining limitations. Update documentation only where behavior/setup changed. Do not invent passing test results or publish raw database data. Create a focused task branch, leave changes unstaged and uncommitted, and provide a commit message for me to use. Do not push or create/merge a PR unless separately requested. End with the next step and a model/effort recommendation.

## Architecture decision

Title and status: proposed / accepted / superseded.

Context and requirements:

Options considered:

Decision and reason:

Costs and consequences:

How we verify it:

Revisit when:

## Definition of done

- Acceptance behavior implemented and demonstrated; legacy use cases mapped to tests.
- Responsibilities and contracts are clear; unnecessary duplication and inefficient access patterns are addressed within scope.
- Backend authorization, validation and relevant database integrity enforced.
- Relevant local checks pass; hosted CI passes after the user pushes. If no push occurred, explicitly mark hosted CI pending rather than reporting it as passed.
- For container changes: images build, Compose validates, affected services become healthy, and relevant smoke/persistence checks pass.
- Diff reviewed; unrelated changes excluded.
- API/setup/migration documentation updated where necessary.
- Learner can explain the change, alternatives and verification.
- UI changes are checked at phone/tablet/desktop widths and in English, German and Arabic layouts (including Arabic RTL and German text expansion); tracking changes include permission, stale and offline cases.
- New UI/docs use Bus Management System branding; historical MyGJU/GJU references and contributor credits remain accurate.

## First feature reference: bus CRUD

Backend files: BusController, BusService, BusRepository, Bus entity, CreateBusRequest, UpdateBusRequest, BusResponse, feature exceptions/problem mapping, Flyway migration, focused rule tests, repository and authorized HTTP integration tests.

Frontend files: bus feature route, list and form components, typed API service, actions/reducer/selectors/effects, focused tests, Material table with server paging/sorting, validation, loading/empty/error states.

First acceptance example: an admin creates a bus with a unique license number and positive capacity; it appears in the list after reload. Duplicate license returns a conflict, invalid capacity is rejected, a passenger cannot create/edit/delete buses, and an assigned bus cannot be hard-deleted. A Playwright test covers the normal flow; API/database tests cover authorization, duplicates and constraints.
