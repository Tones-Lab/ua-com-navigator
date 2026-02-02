# Backlog: Processor Builder Coverage Expansion

## Summary
Expand the Processor Builder beyond `set` and `regex` to include additional processors (copy, convert, lookup, math, split, strcase, substr, trim). Add validation, examples, and consistent UX in builder steps.

## Why
- Reduces need for raw JSON/advanced flow editing for common operations.
- Improves consistency and reduces errors by validating inputs in a guided UI.

## Current Touchpoints
- Builder UI and logic in [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx)
  - Processor builder state: `processorType`, `processorDraft`, `buildProcessorPayload()`
  - Builder UI: processor selection, configure, review/preview
- Styling in [fcom-curator/frontend/src/App.css](../fcom-curator/frontend/src/App.css)
- Processor help text in `processorHelp` object

## Recommended Changes
### 1) Add new processor types to builder
- **Files:** [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx)
- **Changes:**
  - Extend `processorCatalog` to mark new processors as `builderEnabled: true`.
  - Add per‑processor configuration schema in `processorHelp` for description/example.
  - Extend `buildProcessorPayload()` to build payloads for each processor.

### 2) Add configuration forms per processor
- **Files:** [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx)
- **Changes:**
  - Add UI blocks for each processor’s required fields (e.g., `copy.source`, `copy.targetField`, `split.delimiter`, `trim.targetField`).
  - Reuse existing helpers for field insertion and path normalization.

### 3) Validation + inline errors
- **Files:** [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx)
- **Changes:**
  - Add per‑processor validation in builder “Configure” step and disable “Review/Save” until valid.
  - Surface specific hints for required fields and type validation.

### 4) Preview and JSON review
- **Files:** [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx)
- **Changes:**
  - Keep existing JSON preview and formatted summary lines for each processor.
  - Add a compact summary for new processors (e.g., “copy source → target”).

## Suggested Implementation Order
1. Enable copy/trim/substr (simple payloads).
2. Add split/strcase (simple configs + enum validation).
3. Add convert/math/lookup (more complex config; validate options).

## Risks / Notes
- Ensure per‑processor config doesn’t conflict with advanced flow builder behavior.
- Avoid overloading `processorDraft` with fields for unrelated processors; consider per‑type sections.

## Implementation Details (Completed)
### Shared processor config registry
- Introduced a shared processor config schema for all processors.
- Both inline builder and advanced flow editor render from the same config spec.

### Builder coverage expansion
- Enabled all processors in the builder palette (set/regex + core processors).
- Added shared payload builder so builder and advanced flow produce identical JSON.

### Nested processors parity
- Inline builder now supports `foreach` and `switch` nested processors with add/remove and ordering.
- Nested payloads are built using the same flow serializer as Advanced Flow.

### Review/Save consistency
- Unified Review/Save UX and summary preview across processors.

## Files Updated
- [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx)
- [fcom-curator/frontend/src/App.css](../fcom-curator/frontend/src/App.css)

## Status
- ✅ Completed in current iteration.
