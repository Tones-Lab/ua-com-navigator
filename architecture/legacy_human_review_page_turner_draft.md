# Legacy Conversion Human Review Queue (Page-Turner) - Draft

## Goal
Provide a guided human review experience for complex legacy-to-COM conversion outcomes, where users:
- See highest-risk conversion items first.
- Accept, modify, or reject each suggestion one item at a time.
- Build confidence as they move from uncertain to highly reliable conversions.
- Skip low-risk 100% matches by default, with optional reveal.

## Product Direction
This should not be a giant table-first workflow. It should be a focused review queue with page-turner behavior:
1. Review one item.
2. Decide (Accept / Edit / Reject / Defer).
3. Move Next.
4. Continue until queue is exhausted or user exits.

The system should front-load uncertainty and reduce cognitive load over time.

## Core UX Model

### Entry Point
Add a new review mode in Legacy Conversion Step 3:
- Open Human Review Queue.
- Show queue summary before starting:
  - Total suggestions.
  - Items requiring intervention.
  - High confidence items hidden by default.

### Queue Ordering (Worst First)
Default sort should prioritize items most likely to need human intervention.

Proposed priority rank (highest first):
1. Manual conversion required.
2. Conditional conversion with unresolved mappings.
3. Regex or if/else branch complexity.
4. Conflicts with matched object values.
5. Fallback set-only conversion where parser template was unavailable.
6. Direct high-confidence conversions.

Within same priority, sort by lower confidence score first, then by source file and line.

### Item-by-Item Review Card
Each queue item page should show:
- Header: Queue position and risk level (for example 3 of 42, Critical Review).
- Legacy source context:
  - Source file path.
  - Function or rule block.
  - Original line range.
  - Snippet with highlighted line(s).
- Proposed conversion:
  - Target object/override.
  - Processor type and payload (if, regex, set, copy, lookup).
  - Output file and output line range (or pending line until write stage).
- Quality panel:
  - Confidence score and level.
  - Root cause tags (manual-expression-shape, unresolved-variable-mappings, regex-branch-complexity, fallback-set-only).
  - Required mappings still unresolved.

### Actions Per Item
- Accept as-is.
- Edit suggestion (processor payload and field mappings).
- Reject suggestion.
- Defer (leave for later pass).
- Previous / Next navigation.

Optional convenience actions:
- Accept and Next.
- Reject and Next.

### Progress and Trust Curve
Display review progress emphasizing decreasing risk:
- Intervention required remaining.
- Medium-risk remaining.
- High-confidence hidden count.

As confidence increases, user can:
- Continue strict mode (only risky items).
- Expand to include high-confidence items.
- Bulk accept remaining high-confidence items.

## Visibility Rules for 100% Matches

### Default Behavior
Do not show 100% matches by default.

### Reveal Behavior
Provide explicit controls:
- Show high-confidence items.
- Review sample of high-confidence items (for trust calibration).
- Accept all remaining high-confidence items.

### Safety Guardrails
Even if hidden by default, high-confidence suggestions should remain:
- Counted in summary.
- Exportable in review report.
- Re-openable before final apply.

## Risk Scoring Model (Draft)

### Existing Inputs (already available)
- Stub status: direct, conditional, manual.
- Confidence score and level.
- Required mappings count.
- Parser root causes.
- Conflict detection.
- Fallback set-only indicators.

### Suggested Composite Review Priority
Priority score example:
- Manual: +100
- Conditional: +60
- Regex/if complexity: +40
- Conflict present: +35
- Required mappings each: +15
- Fallback set-only: +25
- Confidence penalty: +(1.0 - confidence) * 30

Higher score appears earlier in queue.

## Data Contract Draft

### Review Item Shape
Each item should include:
- reviewItemId
- source:
  - sourceFile
  - sourceFunction
  - sourceLineStart
  - sourceLineEnd
  - sourceSnippet
- target:
  - objectName
  - targetType (override or generated-definition)
  - targetField
  - outputFile
  - outputLineStart
  - outputLineEnd
- proposal:
  - processorType
  - processorPayload
  - fallbackUsed
- quality:
  - confidenceScore
  - confidenceLevel
  - status
  - rootCauses
  - requiredMappings
  - conflictFlag
  - reviewPriorityScore
- userDecision:
  - decision (accepted, edited, rejected, deferred, unset)
  - editedPayload
  - reviewerNote

## Line Number Traceability

### Source Traceability
Store exact source line range from parser extraction stage:
- File path + function block + line interval.

### Output Traceability
After staged/bundle generation, compute and store output line locations:
- Output file path.
- Processor index.
- Rendered line range in generated JSON.

If line positions are not final yet, mark as pending until final render.

## Recommended UI Layout

### Left Rail
- Queue list with risk badges.
- Filters:
  - Needs intervention only.
  - Include deferred.
  - Include high-confidence.

### Main Panel
- Source vs conversion diff-style view.
- Quality diagnostics.
- Decision controls.
- Next/Previous footer navigation.

### Footer Bar
- Save progress.
- Apply reviewed set.
- Export after-action report.

## After-Action Report (Human Accuracy Review)

### Purpose
Create a final audit artifact for reviewers and operations.

### Sections
1. Executive summary
   - Total reviewed
   - Accepted, edited, rejected, deferred
   - Hidden high-confidence accepted in bulk
2. High-risk interventions
   - All manual/conditional/regex-complex items and decisions
3. Traceability matrix
   - Source file:line-range -> target file:line-range
4. Remaining risk
   - Deferred items and reasons
5. Reviewer notes

### Export Formats
- UI report view
- CSV for operations
- JSON for automated pipelines

## Rollout Strategy

### Phase 1 (MVP)
- Queue generation with risk-first sorting.
- Page-turner review card.
- Accept/Edit/Reject/Defer decisions.
- Hide high-confidence by default.

### Phase 2
- Full source and output line traceability.
- Bulk actions for high-confidence items.
- After-action report export.

### Phase 3
- Team workflows:
  - Reviewer assignment.
  - Sign-off checkpoints.
  - Decision history and diff snapshots.

## Success Criteria
- Reduced time-to-review for high-risk conversions.
- Higher reviewer confidence before apply.
- Fewer post-apply corrections.
- Clear audit trail from legacy source to converted output.

## Open Questions
1. Should deferred items block final apply, or allow apply with explicit warning?
2. Should high-confidence bulk accept require a sample-review step first?
3. Do we want per-domain thresholds (fault vs performance) for confidence gating?
4. Should output line numbers be computed at dry-run stage or only final bundle generation?
