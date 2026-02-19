# Legacy Human Review Queue - Execution Checklist

## Purpose
Execution-ready checklist for implementing the Human Review Queue page-turner flow defined in:
- `architecture/legacy_human_review_page_turner_draft.md`
- `architecture/legacy_human_review_page_turner_implementation_plan.md`

Use this as the build sequence and status tracker for engineering work.

## Milestone 0 - Alignment and Guardrails

### Ticket M0-1: Freeze MVP scope
- Owner: Product + Engineering
- Deliverable:
  - Confirm Phase 1 scope only (queue + page-turner + decisions + hide high confidence)
  - Confirm out-of-scope items deferred to phase 2+
- Acceptance:
  - Written scope statement in PR or issue

### Ticket M0-2: Decision policy defaults
- Owner: Product
- Deliverable:
  - Confirm defaults:
    - `needsInterventionOnly=true`
    - `showHighConfidence=false`
  - Confirm deferred-item apply policy
- Acceptance:
  - Policy section added to implementation notes

---

## Milestone 1 - Backend Queue Foundation

### Ticket B1-1: Add review queue domain types
- Owner: Backend
- Dependencies: M0-1
- Work:
  - Add TypeScript types/interfaces for:
    - `ReviewQueueResponse`
    - `ReviewQueueItem`
    - `ReviewDecision`
    - `ReviewQueueSummary`
- Acceptance:
  - Build passes
  - Types reused by route handlers

### Ticket B1-2: Implement risk scoring function
- Owner: Backend
- Dependencies: B1-1
- Work:
  - Implement deterministic `reviewPriorityScore` from stubs/conflicts/mappings/confidence
- Acceptance:
  - Unit tests verify ranking order for representative cases

### Ticket B1-3: Implement hide-high-confidence filter rules
- Owner: Backend
- Dependencies: B1-2
- Work:
  - Add hidden logic for direct + high confidence + no fallback/no conflicts/no required mappings
- Acceptance:
  - Unit tests cover show/hide boundaries

### Ticket B1-4: Build queue item mapper from conversion artifacts
- Owner: Backend
- Dependencies: B1-1
- Work:
  - Map from report + apply preview into queue items
  - Populate source info, proposal, quality, initial decision
- Acceptance:
  - Snapshot tests for queue payload shape

### Ticket B1-5: Add endpoint `POST /api/v1/legacy/review-queue`
- Owner: Backend
- Dependencies: B1-4
- Work:
  - Validate payload
  - Build queue with options
  - Return summary + ordered items
- Acceptance:
  - Endpoint integration test passes

---

## Milestone 2 - Decision Persistence

### Ticket B2-1: Queue persistence strategy (MVP)
- Owner: Backend
- Dependencies: B1-5
- Work:
  - Implement temporary queue store with TTL (in-memory or project-scoped file)
  - Emit `queueId`
- Acceptance:
  - Queue can be read and updated across user actions during session

### Ticket B2-2: Add endpoint `POST /api/v1/legacy/review-queue/:queueId/decisions`
- Owner: Backend
- Dependencies: B2-1
- Work:
  - Upsert decisions per item
  - Return decision summary
- Acceptance:
  - Decision updates persist and round-trip correctly

### Ticket B2-3: Decision validation and edit payload constraints
- Owner: Backend
- Dependencies: B2-2
- Work:
  - Validate decision enum and optional edited payload structure
- Acceptance:
  - Invalid decisions rejected with clear errors

---

## Milestone 3 - Materialization and Traceability

### Ticket B3-1: Add endpoint `POST /api/v1/legacy/review-queue/:queueId/materialize`
- Owner: Backend
- Dependencies: B2-2
- Work:
  - Materialize reviewed set into overrides/generated definitions
  - Respect include/exclude flags
- Acceptance:
  - Dry-run and non-dry-run behavior tested

### Ticket B3-2: Source line trace extraction
- Owner: Backend
- Dependencies: B1-4
- Work:
  - Attach source file and line ranges to review items using function block metadata
- Acceptance:
  - Source trace present for all parsable items

### Ticket B3-3: Output line mapping
- Owner: Backend
- Dependencies: B3-1
- Work:
  - Add deterministic JSON renderer + line map index
  - Attach output file/line ranges post-materialization
- Acceptance:
  - Trace matrix available in materialization response

---

## Milestone 4 - Frontend Queue UI MVP

### Ticket F4-1: Add API client + TS types
- Owner: Frontend
- Dependencies: B1-5, B2-2
- Work:
  - Add client methods for queue build/save/materialize
  - Add response/request typing
- Acceptance:
  - Frontend compiles with strict typing

### Ticket F4-2: Add Step 3 CTA `Start Human Review Queue`
- Owner: Frontend
- Dependencies: F4-1
- Work:
  - Add entry action in Legacy Step 3 review area
- Acceptance:
  - CTA visible only when report data exists

### Ticket F4-3: Build `LegacyHumanReviewQueuePanel`
- Owner: Frontend
- Dependencies: F4-2
- Work:
  - Page-turner item card
  - Header with position, risk badge, confidence
  - Source/proposed conversion side-by-side
- Acceptance:
  - One-item review flow works end-to-end

### Ticket F4-4: Decision actions and keyboard flow
- Owner: Frontend
- Dependencies: F4-3
- Work:
  - Accept/Edit/Reject/Defer
  - Previous/Next controls
  - keyboard shortcuts for next/previous and primary actions
- Acceptance:
  - All actions update state and can save

### Ticket F4-5: Queue controls and visibility toggles
- Owner: Frontend
- Dependencies: F4-3
- Work:
  - `needsInterventionOnly`
  - `showHighConfidence`
  - counters for hidden/visible
- Acceptance:
  - Re-filtering keeps navigation stable and predictable

### Ticket F4-6: Save progress integration
- Owner: Frontend
- Dependencies: F4-4, B2-2
- Work:
  - Persist decisions with optimistic UI
  - recover on refresh when queueId present
- Acceptance:
  - Decisions survive panel close/reopen in same session

---

## Milestone 5 - Apply Path Integration

### Ticket F5-1: Materialize reviewed output flow
- Owner: Frontend
- Dependencies: B3-1
- Work:
  - Add action to build reviewed output from decisions
  - Show summary and errors inline
- Acceptance:
  - Reviewed output displayed in existing Step 3 result model

### Ticket F5-2: Decision summary UI
- Owner: Frontend
- Dependencies: F5-1
- Work:
  - Show accepted/edited/rejected/deferred/unset
- Acceptance:
  - Summary matches backend response

---

## Milestone 6 - Testing and Quality

### Ticket Q6-1: Backend unit tests
- Owner: Backend
- Dependencies: B1-2, B1-3
- Work:
  - Score/rank tests
  - hide rule tests
- Acceptance:
  - All tests passing in CI

### Ticket Q6-2: Backend integration tests
- Owner: Backend
- Dependencies: B1-5, B2-2, B3-1
- Work:
  - route-level tests for queue/decisions/materialize
- Acceptance:
  - Request/response contracts validated

### Ticket Q6-3: Frontend component tests
- Owner: Frontend
- Dependencies: F4-3, F4-4
- Work:
  - Render and navigation
  - decision state updates
- Acceptance:
  - Deterministic tests for core review flow

### Ticket Q6-4: Manual QA scenario pass
- Owner: QA/Engineering
- Dependencies: F5-2
- Work:
  - Validate worst-first ordering
  - Validate hidden high-confidence behavior
  - Validate line trace display behavior (when available)
- Acceptance:
  - Test checklist signed

---

## Phase 2 Tickets (Post-MVP)

### Ticket P2-1: After-action report view
- Add report page with intervention summary and trace matrix

### Ticket P2-2: CSV/JSON export
- Export review report artifacts for operations

### Ticket P2-3: High-confidence sample review gate
- Optional minimum sample before bulk accept

### Ticket P2-4: Output trace polish
- Improve output line precision and cross-linking UX

---

## Definition of Done (MVP)
- Queue generation endpoint available and tested.
- Page-turner UI supports full decision workflow.
- Worst-first ordering active and verified.
- 100% matches hidden by default and revealable.
- Decisions persist and materialize into reviewed output.
- Build/tests pass for backend and frontend.

## Suggested Work Order (Fastest Path)
1. B1-1 -> B1-5
2. B2-1 -> B2-3
3. F4-1 -> F4-6
4. B3-1 (minimal materialize) + F5-1/F5-2
5. Q6 suite

## Quick Risk Register
- Queue volume too large for client rendering -> paginate list rail early.
- Decision payload edits too permissive -> enforce schema validation on backend.
- Traceability gaps for some parser cases -> mark as `tracePending` with clear UX label.
