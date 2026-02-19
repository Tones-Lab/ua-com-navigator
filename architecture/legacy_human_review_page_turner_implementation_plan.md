# Legacy Human Review Queue - Implementation Plan

## Objective
Implement a guided, page-turner review workflow for legacy conversion suggestions that:
- Prioritizes highest-risk items first.
- Lets users Accept, Edit, Reject, or Defer each item.
- Hides 100% high-confidence items by default.
- Preserves traceability from original source lines to converted output lines.

This plan converts the draft concept into implementable backend/frontend work.

## In Scope (Phase 1)
- Review Queue generation endpoint from existing conversion artifacts.
- Single-item page-turner UX in Step 3 (Review Results).
- Decision capture per item (accept/edit/reject/defer).
- Worst-first ranking using deterministic score.
- Hide high-confidence items by default; explicit reveal controls.

## Out of Scope (Phase 1)
- Multi-reviewer assignment and approvals.
- Hard governance policy/signoff workflows.
- Full audit export polish (CSV/JSON in phase 2).

## User Experience Specification

### Entry
From Legacy Step 3, add action:
- Start Human Review Queue

Initial modal/panel summary:
- Total items
- Needs intervention count
- Hidden high-confidence count
- Estimated review time

### Page-Turner Layout
Main content renders one item at a time.

Header row:
- Queue position: `Item N of M`
- Risk badge: `Critical | High | Medium | Low`
- Confidence: score and level

Body split:
- Left: Original source context
  - source file path
  - function/rule block
  - source line range
  - highlighted snippet
- Right: Proposed conversion
  - target object/override
  - processor payload
  - output file/line range (or pending)

Footer actions:
- Previous
- Accept
- Edit
- Reject
- Defer
- Accept & Next
- Reject & Next
- Save Progress

### Queue Controls
Top/side controls:
- Toggle `Needs intervention only` (default: on)
- Toggle `Show high-confidence items` (default: off)
- Action `Review sample high-confidence` (optional sampling mode)
- Action `Accept all remaining high-confidence` (explicit confirmation)

### End State
When queue reviewed:
- Summary of decisions
- Remaining deferred/rejected count
- Option to apply accepted set
- Option to export review report (phase 2 enhanced)

## Ranking and Visibility Rules

### Priority Score (Deterministic)
`reviewPriorityScore` (higher first):
- manual status: +100
- conditional status: +60
- regex/if branch complexity: +40
- conflict present: +35
- required mapping count: +15 each
- fallback set-only used: +25
- confidence penalty: `(1 - confidenceScore) * 30`

Tie-breakers:
1. lower confidence score first
2. source file path
3. source line start

### Hidden-by-Default Rules
Hide from initial queue view when all are true:
- status = direct
- confidence level = high
- no conflict
- no required mappings
- no fallback set-only

Hidden items remain included in totals and can be explicitly revealed.

## Backend Design

### New Endpoint 1: Build Review Queue
`POST /api/v1/legacy/review-queue`

Request:
```json
{
  "report": { "...": "LegacyConversionReport" },
  "applyPreview": { "...": "LegacyApplyFcomOverridesResponse optional" },
  "options": {
    "hideHighConfidence": true,
    "needsInterventionOnly": true,
    "maxItems": 500
  }
}
```

Response:
```json
{
  "queueId": "legacy-review-20260219-abc123",
  "generatedAt": "2026-02-19T15:12:22.000Z",
  "summary": {
    "totalItems": 184,
    "visibleItems": 42,
    "hiddenHighConfidence": 142,
    "critical": 9,
    "high": 18,
    "medium": 11,
    "low": 4
  },
  "items": [
    {
      "reviewItemId": "item-001",
      "queueIndex": 1,
      "riskLevel": "critical",
      "reviewPriorityScore": 166.4,
      "source": {
        "sourceFile": "/root/navigator/rules/legacy/uploads/NCE/file.rules",
        "sourceFunction": "_global_",
        "sourceLineStart": 221,
        "sourceLineEnd": 238,
        "sourceSnippet": "if (...) { ... }"
      },
      "target": {
        "targetType": "override",
        "objectName": "legacy_1.3.6...",
        "targetField": "$.event.Summary",
        "outputFile": "pending",
        "outputLineStart": null,
        "outputLineEnd": null
      },
      "proposal": {
        "processorType": "if",
        "processorPayload": {
          "if": {
            "condition": { "regex": { "source": "$.source.varbind.text", "pattern": "..." } },
            "then": [ { "regex": { "source": "$.source.varbind.text", "pattern": "...", "targetField": "$.tmp.v1" } }, { "set": { "source": "...", "args": ["$.tmp.v1"], "targetField": "$.event.Summary" } } ]
          }
        },
        "fallbackUsed": false
      },
      "quality": {
        "confidenceScore": 0.41,
        "confidenceLevel": "low",
        "status": "conditional",
        "rootCauses": ["regex-branch-complexity", "unresolved-variable-mappings"],
        "requiredMappings": ["generic"],
        "conflictFlag": false
      },
      "userDecision": {
        "decision": "unset",
        "editedPayload": null,
        "reviewerNote": ""
      }
    }
  ]
}
```

### New Endpoint 2: Save Review Decisions
`POST /api/v1/legacy/review-queue/:queueId/decisions`

Request:
```json
{
  "decisions": [
    {
      "reviewItemId": "item-001",
      "decision": "accepted",
      "editedPayload": null,
      "reviewerNote": "Looks correct"
    },
    {
      "reviewItemId": "item-002",
      "decision": "edited",
      "editedPayload": { "set": { "source": "explicit", "targetField": "$.event.Severity" } },
      "reviewerNote": "Adjusted severity mapping"
    }
  ]
}
```

Response:
```json
{
  "queueId": "legacy-review-20260219-abc123",
  "saved": 2,
  "summary": {
    "accepted": 1,
    "edited": 1,
    "rejected": 0,
    "deferred": 0,
    "unset": 40
  }
}
```

### New Endpoint 3: Materialize Reviewed Output
`POST /api/v1/legacy/review-queue/:queueId/materialize`

Request:
```json
{
  "includeDeferred": false,
  "includeHighConfidenceHidden": true,
  "dryRun": true
}
```

Response:
```json
{
  "generatedAt": "2026-02-19T16:02:11.000Z",
  "summary": {
    "acceptedApplied": 37,
    "editedApplied": 5,
    "rejectedSkipped": 3,
    "deferredSkipped": 4
  },
  "overrides": ["..."],
  "generatedDefinitions": ["..."],
  "lineTrace": [
    {
      "reviewItemId": "item-001",
      "source": {
        "file": "/root/navigator/rules/legacy/uploads/NCE/file.rules",
        "lineStart": 221,
        "lineEnd": 238
      },
      "output": {
        "file": "legacy-reviewed-output.json",
        "lineStart": 514,
        "lineEnd": 542
      }
    }
  ]
}
```

## Backend Implementation Notes
- Reuse existing conversion artifacts:
  - `report.stubs.processorStubs`
  - `matchDiffs`
  - `overrideProposals`
  - `apply-fcom-overrides` processor summary
- Add source trace extraction:
  - from function block metadata and assignment parsing
- Add output line calculation:
  - after final JSON render, use deterministic writer + line map index
- Persist queue and decisions under legacy upload root project scope (or in-memory cache for MVP with explicit expiry)

## Frontend Design

### New Components
- `LegacyHumanReviewQueuePanel`
- `LegacyReviewQueueSummary`
- `LegacyReviewItemCard`
- `LegacyReviewDecisionBar`
- `LegacyReviewSourceSnippet`
- `LegacyReviewOutputPreview`

### State Model
```ts
{
  queue: ReviewQueueResponse | null,
  currentIndex: number,
  decisionsByItemId: Record<string, DecisionState>,
  filters: {
    needsInterventionOnly: boolean,
    showHighConfidence: boolean,
    includeDeferred: boolean
  },
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
}
```

### Integration in LegacyWorkspace
- Keep current Step 3 report view.
- Add CTA: `Start Human Review Queue`.
- Launch queue panel in-place within Step 3 (same styling system).
- On completion, return to summary with decision metrics.

## UX States (Exact)

### Queue Bootstrapping
- `idle`: no queue yet
- `loading`: building queue
- `ready`: first item shown
- `error`: inline error + retry

### Item Decision States
- `unset`
- `accepted`
- `edited`
- `rejected`
- `deferred`

### Navigation States
- Previous disabled on first visible item
- Next disabled on last visible item
- if filter changes remove current item, jump to nearest next visible item

### Apply State
- `materialize-dry-run`
- `materialize-ready`
- `materialize-error`

## Review Report (AAR) Design - Phase 2
- Executive summary
- Intervention log (edited/rejected/deferred)
- Source-to-output trace matrix with lines
- Hidden high-confidence handling summary
- Optional reviewer notes section

## Validation and Acceptance Criteria

### Functional
- Queue sorts by priority score descending.
- Hidden high-confidence items excluded by default and included on reveal.
- Decisions persist and reload correctly.
- Materialized output reflects user decisions exactly.

### Traceability
- Every reviewed item maps source line range.
- Every applied item maps output line range after materialization.

### UX
- User can complete full review without leaving page-turner mode.
- Keyboard navigation works for next/previous and primary decisions.

## Phased Work Breakdown

### Sprint A - Backend Queue API
1. Add queue item builder and risk scorer.
2. Add review queue endpoint.
3. Add decision persistence endpoint.
4. Add tests for ranking/hide rules.

### Sprint B - Frontend Queue MVP
1. Add queue start CTA in Step 3.
2. Implement item card and decision footer.
3. Implement navigation and filter toggles.
4. Add save decisions flow and summary counters.

### Sprint C - Materialization + Trace
1. Add materialize endpoint.
2. Add output line map generation.
3. Add dry-run preview + apply gating.

### Sprint D - AAR and Export
1. Add after-action report view.
2. Add CSV/JSON export.
3. Add reviewer notes in report.

## Risks and Mitigations
- Risk: output line numbers drift with JSON formatting changes.
  - Mitigation: single renderer utility with deterministic formatting.
- Risk: queue item volume too high for UI responsiveness.
  - Mitigation: lazy loading and pagination for queue list rail.
- Risk: user skips too much hidden confidence content.
  - Mitigation: require sample-review confirmation before bulk accept in strict mode.

## Suggested Defaults
- `needsInterventionOnly = true`
- `showHighConfidence = false`
- `maxItems = 500`
- `hideHighConfidence threshold = direct + high confidence + no conflicts + no required mappings + no fallback`

## Decision Needed Before Coding
1. Persist queue in backend store vs ephemeral cache for MVP.
2. Whether deferred items block final apply by default.
3. Minimum sample size before allowing bulk-accept high-confidence set.
