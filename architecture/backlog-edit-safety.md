# Backlog: Edit Safety Enhancements

## Summary
Improve edit safety with field/section dirty indicators and undo/redo for builder changes.

## Why
- Users need visibility into what changed.
- Undo reduces risk of mistakes in complex edits.

## Current Touchpoints
- Dirty logic: `getPanelDirtyFields()` in [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx)
- Builder state and apply handlers in [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx)
- Styling in [fcom-curator/frontend/src/App.css](../fcom-curator/frontend/src/App.css)

## Recommended Changes
### 1) Field‑level dirty chips
- **Files:** [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx), [fcom-curator/frontend/src/App.css](../fcom-curator/frontend/src/App.css)
- **Changes:**
  - Add a small dot or chip next to each field label when dirty.
  - Show a section‑level “Unsaved changes” badge for the object.

### 2) Builder undo/redo
- **Files:** [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx)
- **Changes:**
  - Maintain a stack for builder state (`builderFocus`, `builderRegularText`, `builderConditions`, etc.).
  - Add Undo/Redo buttons in builder header.

### 3) Confirmations
- **Files:** [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx)
- **Changes:**
  - Expand existing discard confirmation coverage to other cancel points (where applicable).

## Risks / Notes
- Undo/redo should be scoped to builder only (not entire file).
- Keep state stack bounded to avoid memory growth.
