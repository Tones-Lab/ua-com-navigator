# Backlog: Search & Navigation Enhancements

## Summary
Add jump‑to‑object navigation and persist search filters across file switches.

## Why
- Users editing deep lists lose context.
- Persisted filters reduce repetitive setup.

## Current Touchpoints
- Search UI/state in [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx)
  - `searchQuery`, `searchScope`, `highlightObjectKeys`, `handleNextMatch`
- Object list rendering and scroll refs `objectRowRefs`

## Recommended Changes
### 1) Jump‑to‑object list
- **Files:** [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx)
- **Changes:**
  - Add a dropdown/list of matched objects with quick jump.
  - Reuse `objectRowRefs` for smooth scroll.

### 2) Persist filters
- **Files:** [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx)
- **Changes:**
  - Store `searchQuery`, `searchScope` in `sessionStorage` and restore on file switch.

### 3) Highlight retention
- **Files:** [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx)
- **Changes:**
  - Keep `highlightObjectKeys` when moving between objects in the same file.

## Risks / Notes
- Don’t restore highlights across different files unless explicitly desired.
- Ensure “Reset Navigation” clears persisted state.
