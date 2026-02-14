# Refactor Tracking

This document tracks refactor items and validation steps. Status values: Not Started, In Progress, Blocked, Done.

## How we will work
- We take one item at a time.
- After each item, I will ask for validation and provide specific steps (what/where/how).
- We only move to the next item after you confirm.

## Test Plan Rubric (apply on every iteration)
- For each refactor step, record a **Test Delta** with:
  - Risk level: Low / Medium / High
  - Behavior contract touched (what user-visible behavior must remain true)
  - Test action: Add now / Queue for stabilization
  - Coverage type: E2E / Integration / Unit
- Add tests immediately when one of these is true:
  - Step changes branching/state progression logic
  - Step changes payload shape/normalization logic
  - Step changes navigation/deep-link behavior
- Defer tests to stabilization only when change is pure code movement with no behavior delta.
- Progress log rule (required): every new entry must include a one-line **Test Delta** note.

## Refactor Test Backlog + Coverage Map
- `FcomBuilderSidebar` decomposition and context wiring
  - Required: processor step progression and configure editors remain functional.
  - Coverage: ✅ Added E2E regression tests (`tests/e2e/test-g.spec.ts`, `tests/e2e/test-h.spec.ts`).
- Processor configure normalization (`useProcessorConfigure`)
  - Required: switch cases/default and foreach nested processors still render and mutate.
  - Coverage: ✅ Added E2E regression tests (`tests/e2e/test-h.spec.ts`).
- Processor config typing hardening (`ProcessorBuilderConfig` and related)
  - Required: selecting processor still enters configure/review flow and preview can be reached.
  - Coverage: ✅ Added E2E regression tests (`tests/e2e/test-g.spec.ts`).
- App hook/util extraction (`useCacheStatus`, `useFavorites`, `useOverviewState`, `useSearchState`, `pathUtils`, `navigationUtils`)
  - Required: tab routing, browse navigation, and edit/commit baseline flow stay stable.
  - Coverage: ✅ Existing E2E suite (`tests/e2e/test-a.spec.ts` … `test-f.spec.ts`) covers baseline flows; additional targeted utility-level tests are queued for post-refactor stabilization.

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
- 2026-02-14: Deep cleanup continued for FCOM builder.
  - Split `FcomBuilderSidebar` into focused builder subcomponents and introduced shared builder context + types.
  - Reduced App→Sidebar prop drilling to `contextValue` and extracted context assembly to `useFcomBuilderContextValue`.
  - Normalized processor builder internals by reusing local helper functions for palette options and config-array updates.
- 2026-02-14: Processor builder decomposition continued.
  - Extracted `FcomProcessorForeachEditor` and `FcomProcessorSwitchEditor` from `FcomBuilderProcessorSection`.
  - Kept shared state-update helpers in parent and passed focused callbacks/sections to child components.
  - Result: lower component complexity and clearer separation between processor-type editors.
- 2026-02-14: Processor step extraction continued.
  - Extracted `FcomProcessorSelectStep` and `FcomProcessorReviewStep` from `FcomBuilderProcessorSection`.
  - Parent now orchestrates step flow while child components own step-specific rendering.
  - Result: reduced section size and easier targeted changes per step.
- 2026-02-14: Configure-step orchestration extraction.
  - Added `useProcessorConfigure` hook to centralize configure-step update logic for foreach/switch/default processor flows.
  - `FcomBuilderProcessorSection` now delegates configure mutations and flow callback assembly to the hook.
  - Result: lower cognitive load in the section component and improved reuse/normalization of update logic.
- 2026-02-14: Processor config type hardening.
  - Added shared processor config interfaces (`ProcessorFlowNode`, `ProcessorSwitchCase`, `ProcessorBuilderConfig`) in builder shared types.
  - Propagated typed config through builder context, configure hook, switch editor props, and App builder state/snapshot typing.
  - Result: reduced `any` usage in processor configure flow and safer state updates.
- 2026-02-14: Processor step navigation extraction.
  - Added `FcomProcessorStepNav` to own step progression UI and gating rules for select/configure/review transitions.
  - Simplified `FcomBuilderProcessorSection` by removing inline step metadata and button-state logic.
  - Result: clearer orchestration boundary and lower section-level complexity.
- 2026-02-14: Catalog/palette typing propagation.
  - Added shared `ProcessorCatalogItem` and `FlowPaletteItem` types in builder shared types.
  - Updated App, builder context, processor select step, and processor configure hook to use shared catalog/palette interfaces.
  - Result: removed duplicated local type declarations and reduced `any` usage across builder selection/configure flows.
- 2026-02-14: Refactor test rubric + backfill pass.
  - Added iteration test rubric and coverage map for completed refactor work.
  - Added Playwright regressions for processor builder progression and switch/foreach configure editors.
  - Hardened e2e helpers to support reset-label variants and dataset-agnostic file/object selection.
  - Test Delta: High-risk builder flow contract covered via E2E; utility-level tests queued for stabilization phase where fixture control is available.

## Resume checkpoint (quick retrieval)
- Last completed cleanup item: processor step navigation extraction + catalog/palette typing propagation.
- Current detour status: test rubric established; builder regression tests added (`tests/e2e/test-g.spec.ts`, `tests/e2e/test-h.spec.ts`).
- Environment note: local Playwright run is currently blocked by fixture/data availability for FCOM file/object builder flows.
- Next refactor item to resume: tighten/split builder context surface (view-state vs actions) after test fixture alignment.

## Further improvements identified during cleanup
- `App.tsx` is still very large and remains the main long-term risk area.
  - Recommended next extraction: deep-link + browse orchestration into a dedicated hook/module.
  - Recommended next extraction: staged review modal/view-model logic into a feature hook.
- `FcomBuilderProcessorSection.tsx` remains the largest builder component.
  - ✅ Switch-case editor and foreach editor were extracted into dedicated child components.
  - ✅ Select and review steps were extracted into dedicated child components.
  - ✅ Configure-step orchestration moved into `useProcessorConfigure`.
  - ✅ Processor-step metadata/progression logic extracted to `FcomProcessorStepNav`.
  - ✅ Replaced broad `any`-typed processor configure objects with explicit shared interfaces.
- Builder context currently includes many values; good for transition but can be tightened.
  - Recommended next step: split into smaller contexts (view state vs actions) or selector-based access.
- Utility growth in `pathUtils`/`navigationUtils` should be tracked.
  - Recommended next step: add focused tests for shared path/deeplink helpers before further expansion.
