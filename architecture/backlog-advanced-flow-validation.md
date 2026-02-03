# Backlog: Advanced Flow Validation Improvements

## Summary
Add validation for advanced flow lanes (global pre/post, object flows) and clearer error hints. Ensure invalid node configs are highlighted and blocked from saving.

## Why
- Prevent invalid processors from being staged.
- Reduce user confusion around pre/post scope constraints (e.g., pre‑global cannot reference `$.event`).

## Current Touchpoints
- Flow editor and nodes in [com-management/frontend/src/App.tsx](../com-management/frontend/src/App.tsx)
  - `saveAdvancedFlow()`, `openAdvancedFlowModal()`
  - `getFlowEditorJsonErrors()`
  - `hasPreScopeEventUsage()` and pre‑scope detection
- Styling in [com-management/frontend/src/App.css](../com-management/frontend/src/App.css)

## Implementation Details (Completed)
### Validation engine
- Added shared validators that:
  - Enforce required fields per processor (based on config specs and optional labels).
  - Validate JSON fields for parse errors.
  - Block `$.event.*` paths in **global pre** scope across all config values (including JSON blobs).
  - Validate `switch` cases and require at least one case.
- Validation walks nested processors in `if`, `foreach`, and `switch` branches.

### UI feedback
- Flow nodes now render with an error outline and an inline error-count badge.
- The Advanced Flow modal shows a summary warning and blocks Save when errors exist.
- The Flow editor modal shows inline field errors and top-level validation hints.

### Shared parity
- Validation logic and UI state are shared across **object** and **global** advanced flow modals.
- Only lane context (`pre`/`post`/`object`) changes behavior.

## Files Updated
- [com-management/frontend/src/App.tsx](../com-management/frontend/src/App.tsx)
- [com-management/frontend/src/App.css](../com-management/frontend/src/App.css)

## Recommended Changes
### 1) Lane‑specific validation
- **Files:** [com-management/frontend/src/App.tsx](../com-management/frontend/src/App.tsx)
- **Changes:**
  - Expand `getFlowEditorJsonErrors()` to validate required fields for each processor type.
  - Enforce pre‑global restrictions (no `$.event` references) at node level, not just save time.

### 2) Inline error hints
- **Files:** [com-management/frontend/src/App.tsx](../com-management/frontend/src/App.tsx), [com-management/frontend/src/App.css](../com-management/frontend/src/App.css)
- **Changes:**
  - Show inline error labels near invalid config inputs.
  - Add red/amber indicators on nodes with errors.

### 3) Save blocking and summary
- **Files:** [com-management/frontend/src/App.tsx](../com-management/frontend/src/App.tsx)
- **Changes:**
  - Disable “Save” if any node has errors.
  - Provide a top‑level summary of errors per lane.

## Risks / Notes
- Avoid breaking existing flows by validating missing optional fields.
- Keep error list actionable; do not over‑block for optional settings.

## Status
- ✅ Completed in current iteration.
