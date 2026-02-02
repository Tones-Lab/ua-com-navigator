# Backlog: Advanced Flow Validation Improvements

## Summary
Add validation for advanced flow lanes (global pre/post, object flows) and clearer error hints. Ensure invalid node configs are highlighted and blocked from saving.

## Why
- Prevent invalid processors from being staged.
- Reduce user confusion around pre/post scope constraints (e.g., pre‑global cannot reference `$.event`).

## Current Touchpoints
- Flow editor and nodes in [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx)
  - `saveAdvancedFlow()`, `openAdvancedFlowModal()`
  - `getFlowEditorJsonErrors()`
  - `hasPreScopeEventUsage()` and pre‑scope detection
- Styling in [fcom-curator/frontend/src/App.css](../fcom-curator/frontend/src/App.css)

## Recommended Changes
### 1) Lane‑specific validation
- **Files:** [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx)
- **Changes:**
  - Expand `getFlowEditorJsonErrors()` to validate required fields for each processor type.
  - Enforce pre‑global restrictions (no `$.event` references) at node level, not just save time.

### 2) Inline error hints
- **Files:** [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx), [fcom-curator/frontend/src/App.css](../fcom-curator/frontend/src/App.css)
- **Changes:**
  - Show inline error labels near invalid config inputs.
  - Add red/amber indicators on nodes with errors.

### 3) Save blocking and summary
- **Files:** [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx)
- **Changes:**
  - Disable “Save” if any node has errors.
  - Provide a top‑level summary of errors per lane.

## Risks / Notes
- Avoid breaking existing flows by validating missing optional fields.
- Keep error list actionable; do not over‑block for optional settings.
