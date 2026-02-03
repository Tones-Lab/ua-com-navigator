# Backlog: Edit Safety Enhancements

## Summary
Improve edit safety with field/section dirty indicators and undo/redo for builder changes.

## Status
- ✅ Field/section dirty indicators complete (2026‑02‑02)
- ✅ Builder undo/redo complete (2026‑02‑02)

## Why
- Users need visibility into what changed.
- Undo reduces risk of mistakes in complex edits.

## Current Touchpoints
- Dirty logic: `getPanelDirtyFields()` in [com-management/frontend/src/App.tsx](../com-management/frontend/src/App.tsx)
- Builder state and apply handlers in [com-management/frontend/src/App.tsx](../com-management/frontend/src/App.tsx)
- Styling in [com-management/frontend/src/App.css](../com-management/frontend/src/App.css)

## Recommended Changes
### 1) Field‑level dirty chips
- **Files:** [com-management/frontend/src/App.tsx](../com-management/frontend/src/App.tsx), [com-management/frontend/src/App.css](../com-management/frontend/src/App.css)
- **Changes:**
  - Add a small dot or chip next to each field label when dirty.
  - Show a section‑level “Unsaved changes” badge for the object.
  - **Status:** Done

### 2) Builder undo/redo
- **Files:** [com-management/frontend/src/App.tsx](../com-management/frontend/src/App.tsx)
- **Changes:**
  - Maintain a stack for builder state (`builderFocus`, `builderRegularText`, `builderConditions`, etc.).
  - Add Undo/Redo buttons in builder header.
  - **Implemented:**
    - Snapshot builder‑scoped state only (no file‑level edits).
    - Reset stacks when switching target or closing builder.
    - Max 50 snapshots; duplicates skipped.
    - Undo/Redo buttons + keyboard shortcuts.

### 3) Confirmations
- **Files:** [com-management/frontend/src/App.tsx](../com-management/frontend/src/App.tsx)
- **Changes:**
  - Expand existing discard confirmation coverage to other cancel points (where applicable).

## Risks / Notes
- Undo/redo should be scoped to builder only (not entire file).
- Keep state stack bounded to avoid memory growth.
