# Backlog: Staged Review Improvements

## Summary
Improve staged review usability for large diffs: add object‑level expand/collapse and “Expand all originals” toggle.

## Why
- Large diff lists are hard to scan.
- Users need quick access to original vs staged values without scrolling through each card.

## Current Touchpoints
- Review modal rendering in [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx)
  - `stagedDiff.sections`, `expandedOriginals`
- Styles in [fcom-curator/frontend/src/App.css](../fcom-curator/frontend/src/App.css)

## Recommended Changes
### 1) Object‑level expand/collapse
- **Files:** [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx)
- **Changes:**
  - Wrap each `section` in a collapsible container.
  - Default open when only 1 object, collapsed otherwise.

### 2) Expand all originals
- **Files:** [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx)
- **Changes:**
  - Add a toggle near “Review staged changes” to set all `expandedOriginals` to true/false.

### 3) Compact summaries
- **Files:** [fcom-curator/frontend/src/App.tsx](../fcom-curator/frontend/src/App.tsx)
- **Changes:**
  - Show short summary per change in collapsed state (“Original: …”, “After: …”).

## Risks / Notes
- Avoid overwhelming the modal with nested accordions.
- Keep keyboard accessibility for toggles.
