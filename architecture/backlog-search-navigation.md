# Backlog: Search & Navigation Enhancements

## Summary
Add jump‑to‑object navigation and persist search filters across file switches.

## Status
- ✅ Completed (2026‑02‑02)

## Why
- Users editing deep lists lose context.
- Persisted filters reduce repetitive setup.

## Current Touchpoints
- Search UI/state in [com-management/frontend/src/App.tsx](../com-management/frontend/src/App.tsx)
  - `searchQuery`, `searchScope`, `highlightObjectKeys`, `handleNextMatch`
- Object list rendering and scroll refs `objectRowRefs`

## Implemented Changes
### 1) Jump‑to‑object list
- **Files:** [com-management/frontend/src/App.tsx](../com-management/frontend/src/App.tsx), [com-management/frontend/src/App.css](../com-management/frontend/src/App.css)
- **Details:**
  - Added a match jump dropdown in the match bar.
  - Uses matched object keys + labels to jump to specific objects.

### 2) Persist filters
- **Files:** [com-management/frontend/src/App.tsx](../com-management/frontend/src/App.tsx)
- **Details:**
  - Persist `searchQuery` and `searchScope` in `sessionStorage`.
  - “Clear Search” clears query only; “Reset Navigation” clears query + scope.

### 3) Highlight retention + scroll restore
- **Files:** [com-management/frontend/src/App.tsx](../com-management/frontend/src/App.tsx)
- **Details:**
  - Per‑file match index retained when switching files.
  - Scroll position restored for the friendly view.

### 4) Raw view content match navigation
- **Files:** [com-management/frontend/src/App.tsx](../com-management/frontend/src/App.tsx), [com-management/frontend/src/App.css](../com-management/frontend/src/App.css)
- **Details:**
  - Raw view now highlights content matches and shows its own match bar.
  - Prev/Next in raw view scrolls between raw text hits.

## Risks / Notes
- Don’t restore highlights across different files unless explicitly desired.
- Ensure “Reset Navigation” clears persisted state.
