# Refactor Tracking

This document tracks refactor items and validation steps. Status values: Not Started, In Progress, Blocked, Done.

## How we will work
- We take one item at a time.
- After each item, I will ask for validation and provide specific steps (what/where/how).
- We only move to the next item after you confirm.

## Items

### 1) Split App monolith by domain
Status: In Progress
Scope: Extract MIB, FCOM, PCOM, microservice UI and side effects from App into feature modules + hooks.
Validation:
- Verify each app tab renders and behaves as before (Overview, FCOM, PCOM, MIB, Legacy).
- Confirm no errors in console during tab switches.
- Re-run lint and build.

### 2) Modal system standardization
Status: Not Started
Scope: Create shared modal shells + stack manager; move each modal body into its own component.
Validation:
- Open each modal and confirm layout and close behavior:
  - Microservice Status
  - Review/Commit
  - Builder Help
  - Advanced Flow
  - Flow Editor
  - Field Reference
  - Add Field
  - Path Help
  - Trap Composer
  - Remove Override(s)
  - Unsaved changes confirmations
- Confirm stacking order works (advanced flow + flow editor + field reference).

### 3) MIB Details panel extraction
Status: Not Started
Scope: Split right-side MIB details into header, support summary, actions, and objects panels.
Validation:
- Select a MIB file and confirm details render the same.
- Run MIB2FCOM and confirm output + errors display.
- Favorites star toggles still work for MIB file.

### 4) Flow editor / advanced flow refactor
Status: Not Started
Scope: Extract flow canvas, palette, validation, and editor into a flow feature module.
Validation:
- Open Advanced Flow (global/object), add nodes, save, and verify staged changes.
- Open Flow Editor, edit a node, save, and confirm changes apply.
- Validate error highlighting and focus behavior.

### 5) Request state hook + error handling standardization
Status: Not Started
Scope: Replace repeated loading/error patterns with a `useRequest` hook and shared error formatter.
Validation:
- Trigger errors in MIB search and browse and confirm messages still show.
- Trigger favorites load error and confirm message display.
- Confirm spinners/loading indicators still appear in the same places.

### 6) Builder links + pill components
Status: Not Started
Scope: Replace repeated builder link/pill markup with shared components.
Validation:
- Verify builder links (primary/secondary rows) still open builder correctly.
- Verify pills render correctly across object cards and summaries.

### 7) Table sorting + filtering abstraction
Status: Not Started
Scope: Introduce `useSortableTable` and shared sort header component; migrate folder overview + overview page.
Validation:
- Sort columns in folder overview and overview page; confirm order + indicator.
- Filter input still updates rows as expected.

### 8) Microservice chain component extraction
Status: Not Started
Scope: Extract chain + card UI into dedicated components and reuse in modal.
Validation:
- Open Microservice Status modal; confirm chain, status text, and actions unchanged.
- Refresh status and confirm cards stay visible.

### 9) Finish empty/error state migrations
Status: Not Started
Scope: Replace remaining raw empty/error blocks with shared components.
Validation:
- Check overview page empty/error states.
- Check PCOM empty states.
- Check any remaining dialogs with empty/error states.

## Progress log
- 2026-02-11: Reapplied App extractions for FCOM/PCOM/MIB/Legacy and moved microservice modal into a feature component.
