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
Status: Done
Scope: Extract MIB, FCOM, PCOM, microservice UI and side effects from App into feature modules + hooks.
Validation:
- Verify each app tab renders and behaves as before (Overview, FCOM, PCOM, MIB, Legacy).
- Confirm no errors in console during tab switches.
- Re-run lint and build.

### 2) Modal system standardization
Status: Done
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
Status: Done
Scope: Split right-side MIB details into header, support summary, actions, and objects panels.
Validation:
- Select a MIB file and confirm details render the same.
- Run MIB2FCOM and confirm output + errors display.
- Favorites star toggles still work for MIB file.

### 4) Flow editor / advanced flow refactor
Status: Done
Scope: Extract flow canvas, palette, validation, and editor into a flow feature module.
Validation:
- Open Advanced Flow (global/object), add nodes, save, and verify staged changes.
- Open Flow Editor, edit a node, save, and confirm changes apply.
- Validate error highlighting and focus behavior.

### 5) Request state hook + error handling standardization
Status: Done
Scope: Replace repeated loading/error patterns with a `useRequest` hook and shared error formatter.
Validation:
- Trigger errors in MIB search and browse and confirm messages still show.
- Trigger favorites load error and confirm message display.
- Confirm spinners/loading indicators still appear in the same places.

### 6) Builder links + pill components
Status: Done
Scope: Replace repeated builder link/pill markup with shared components.
Validation:
- Verify builder links (primary/secondary rows) still open builder correctly.
- Verify pills render correctly across object cards and summaries.

### 7) Table sorting + filtering abstraction
Status: Done
Scope: Introduce `useSortableTable` and shared sort header component; migrate folder overview + overview page.
Validation:
- Sort columns in folder overview and overview page; confirm order + indicator.
- Filter input still updates rows as expected.

### 8) Microservice chain component extraction
Status: Done
Scope: Extract chain + card UI into dedicated components and reuse in modal.
Validation:
- Open Microservice Status modal; confirm chain, status text, and actions unchanged.
- Refresh status and confirm cards stay visible.

### 9) Finish empty/error state migrations
Status: In Progress
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
- 2026-02-14: Builder context surface tightening.
  - Split builder context into explicit `view` and `actions` contexts while preserving a compatibility hook.
  - Migrated builder subcomponents to consume only required slices via dedicated hooks.
  - Result: lower coupling per component and clearer boundaries for future App/context decomposition.
  - Test Delta: High-risk builder interaction path; awaiting pre-run test brief confirmation before executing regression checks per team workflow.
- 2026-02-16: Flow editor typing/build unblock kickoff (Item 4).
  - Fixed strict config-input typing in `FcomFlowEditorModal` by normalizing processor config values to safe input strings.
  - Fixed builder override-version lookup typing in `useFcomBuilderContextValue` via explicit `@objectName` narrowing.
  - Applied permanent `isRecord` initialization-order hardening in `App.tsx` and resolved follow-on strict null/undefined mismatch.
  - Result: frontend `npm run build` and `npm run lint` both pass with no App/flow typing blockers.
  - Test Delta: Medium risk (flow editor input/config typing and helper ordering); Add now; Coverage type: E2E (flow editor open/edit/save in object + global lanes).
- 2026-02-16: Step 4 extraction started (flow tree helper deduplication).
  - Switched `App.tsx` flow-tree operations to shared `features/fcom/flowUtils` helpers (`appendNodeAtPath`, `removeNodeById`, `findNodeById`, `replaceNodeById`) and removed duplicated inline implementations.
  - Result: reduced `App.tsx` flow orchestration duplication and moved core tree logic behind feature-module boundaries.
  - Test Delta: Medium risk (advanced-flow tree mutation path); Add now; Coverage type: E2E (advanced flow add/edit/remove node in object and global lanes).
- 2026-02-16: Step 4 extraction continued (flow validation + focus traversal module).
  - Added `features/fcom/flowValidation.ts` and moved processor-config validation, recursive flow-node validation, and focus-target traversal out of `App.tsx`.
  - Added `validateFlowEditorDraft` in `flowValidation.ts` and switched `App.tsx` flow-editor error computation to the shared helper.
  - Updated `App.tsx` to consume shared validation/focus utilities and removed duplicated local flow-validation logic.
  - Result: narrower App flow orchestration surface and clearer module boundary between flow UI orchestration and validation/traversal rules.
  - Test Delta: Medium risk (flow validation + focus/highlight behavior); Add now; Coverage type: E2E (advanced-flow validation errors and focus-target highlighting across object/global lanes).
- 2026-02-16: Step 4 extraction continued (flow editor state orchestration hook).
  - Added `features/fcom/useFlowEditorState.ts` to own flow-editor open/cancel/save behavior and draft lifecycle.
  - Updated `App.tsx` to consume hook-provided flow-editor state and handlers instead of local inline orchestration.
  - Result: reduced `App.tsx` modal orchestration surface and clearer separation of flow-editor state management from page-level composition.
  - Test Delta: Medium risk (flow editor open/save/cancel wiring); Add now; Coverage type: E2E (open node editor, modify processor config, save/cancel across object/global lanes).
- 2026-02-16: Step 4 extraction continued (flow payload builder dedup).
  - Switched `App.tsx` to use shared `features/fcom/flowBuilderUtils` exports for processor payload normalization and flow payload generation.
  - Removed duplicated inline payload-construction block from `App.tsx` and kept App-level wrapper calls for compatibility.
  - Result: reduced App flow-transformation duplication and consolidated payload-shape behavior in a dedicated flow feature module.
  - Test Delta: Medium risk (advanced-flow payload generation and serialization); Add now; Coverage type: E2E (advanced flow save + JSON preview parity for object/global lanes).
- 2026-02-16: Step 4 extraction continued (advanced-flow override upsert utility).
  - Added `features/fcom/advancedFlowUtils.ts` and moved patch-op detection plus advanced-flow override upsert/remove rules out of `App.tsx`.
  - Updated Advanced Flow open/save path in `App.tsx` to use shared `hasPatchOps` and `upsertAdvancedFlowOverrideEntry` helpers.
  - Result: reduced App save-path mutation complexity and centralized v2 advanced-flow override entry behavior.
  - Test Delta: Medium risk (advanced-flow save mutation semantics); Add now; Coverage type: E2E (global pre/post save clear+add, object-lane save clear+add).
- 2026-02-16: Step 4 extraction continued (flow editor type unification).
  - Updated `FcomFlowEditorModal.tsx` to use shared `FlowEditorState` from `useFlowEditorState`.
  - Result: removed duplicate modal-local flow-editor state typing and reduced drift risk between App and modal contracts.
  - Test Delta: Low risk (type-only contract unification); Queue for stabilization; Coverage type: Integration.
- 2026-02-16: Step 4 extraction completed (canvas + parser + orchestration hook).
  - Added `features/fcom/FlowCanvas.tsx` and moved recursive flow-lane rendering/layout out of `App.tsx`.
  - Added `features/fcom/flowNodeParser.ts` and moved processor-payload→flow-node parse logic out of `App.tsx`.
  - Added `features/fcom/useAdvancedFlowOrchestration.ts` and moved Advanced Flow open/save orchestration into a dedicated feature hook.
  - Updated `App.tsx` to consume extracted modules and keep only composition-level wiring.
  - Result: Item 4 target achieved; flow canvas, validation, editor state, payload builders, parser, and advanced-flow orchestration now reside in feature modules.
  - Test Delta: High risk (advanced-flow orchestration + recursive flow canvas); Add now; Coverage type: E2E (open/edit/save/close/focus for object/global lanes and nested if/foreach/switch branches).
- 2026-02-16: Item 5 kickoff (request-state + shared error formatting).
  - Added `hooks/useRequest.ts` to centralize loading/error state + request execution pattern.
  - Added `utils/errorUtils.ts` with shared `getApiErrorMessage` and switched `App.tsx`, `useSearchState`, `useFavorites`, and `useOverviewState` to consume shared error formatting.
  - Updated `useFavorites` and `useOverviewState` to use `useRequest` for repeated loading/error request patterns.
  - Result: reduced duplicated request-state boilerplate and standardized API error extraction surface across App/hooks.
  - Test Delta: Medium risk (loading/error indicator parity in overview/favorites/search); Add now; Coverage type: E2E (favorites fetch failure message, search error message, overview loading/error states).
- 2026-02-16: Item 5 continued (App request-state adoption).
  - Switched App microservice-status and MIB device-load request flows to use `hooks/useRequest` (`run` + shared loading/error state) while keeping existing UI/state behavior.
  - Removed duplicate App-local error-formatter implementation and fully consolidated on `utils/errorUtils.ts` for API error extraction.
  - Result: additional repeated loading/error request blocks in `App.tsx` now follow shared hook/formatter pattern.
  - Test Delta: Medium risk (microservice status + MIB device-loading indicators/messages); Add now; Coverage type: E2E (microservice modal refresh, MIB tab device load success/failure states).
- 2026-02-16: Item 5 continued (SNMP + trap request flow standardization).
  - Extended `hooks/useRequest.ts` with optional `captureError` to support effect-mounted guards without stale error writes.
  - Migrated App SNMP profile fetch, SNMP poll execution, and broker-server lookup flows to shared request-state handling.
  - Added mounted-guarded error handling for MIB device-load effect while keeping loading/error behavior unchanged.
  - Result: more App request paths now use unified request/error primitives with safer effect behavior.
  - Test Delta: Medium risk (SNMP profile/poll + trap server error/loading parity); Add now; Coverage type: E2E (PCOM poll success/failure, trap composer server-load fallback/manual mode).
- 2026-02-16: Item 5 completed (MIB + Legacy request/error standardization).
  - Migrated MIB workspace browse/search/conversion request flows to shared request-state handling and shared API error formatting.
  - Migrated Legacy workspace upload/listing request flows and standardized remaining API error extraction paths.
  - Result: Item 5 scope completed; repeated loading/error request patterns now use shared `hooks/useRequest.ts` and `utils/errorUtils.ts` across App/hooks/workspaces.
  - Test Delta: Medium risk (MIB/Legacy loading+error parity); Add now; Coverage type: E2E (MIB browse/search/parse/MIB2FCOM failures and Legacy upload/list/convert failure paths).
- 2026-02-16: Item 1 resumed (browse/deeplink orchestration extraction).
  - Added `hooks/useBrowseDeepLink.ts` to own browse default-load, URL hydration/deeplink restore, and URL query sync side effects previously in `App.tsx`.
  - Updated `App.tsx` to delegate those side effects to the extracted hook while preserving existing callbacks/state and URL parameter behavior for FCOM/PCOM/MIB/Legacy.
  - Result: reduced `App.tsx` side-effect surface for navigation/deeplink flows without behavior changes to browse/file restoration.
  - Test Delta: High risk (navigation/deep-link behavior contract); Add now; Coverage type: E2E (URL hydrate with app/node/file/mibPath/mibFile and URL sync on tab/node/file/view changes).
- 2026-02-16: Item 1 continued (staged review view-model extraction).
  - Added `features/fcom/stagedReviewModel.ts` and moved staged override diff computation, staged field-change map generation, and review inline line-diff helpers out of `App.tsx`.
  - Updated `App.tsx` to use `buildStagedReviewDiff`, `buildStagedFieldChangeMap`, `diffLines`, and `formatDiffValue` from the feature module.
  - Result: staged review modal model logic is now feature-scoped and App keeps composition/orchestration responsibilities.
  - Test Delta: High risk (staged review diff visibility and inline change rendering); Add now; Coverage type: E2E (review modal sections + added/updated/removed field rendering across object/global overrides).
- 2026-02-16: Item 1 completed (staged review UI orchestration hook extraction).
  - Added `hooks/useStagedReviewUiState.ts` to own staged-review CTA pulse cadence, review modal section auto-open defaults, and review UI state slices (`showReviewModal`, `reviewStep`, `expandedOriginals`, `stagedSectionOpen`).
  - Updated `App.tsx` to consume the staged-review UI hook and removed duplicate inline effect orchestration.
  - Result: Item 1 scope is complete; App now primarily composes extracted feature modules/hooks for browse/deeplink, staged review model/state, MIB, Legacy, and advanced flow concerns.
  - Test Delta: High risk (review CTA pulse + review section expansion behavior); Add now; Coverage type: E2E (staged changes present/absent pulse behavior, review modal first-open section defaults, original diff toggle persistence).
- 2026-02-16: Item 2 kickoff (modal shell + stack manager standardization).
  - Added `hooks/useModalStack.ts` and moved modal z-index stack bookkeeping (`updateModalStack` + `getModalOverlayStyle`) out of `App.tsx`.
  - Extended shared `components/Modal.tsx` with `style` support for stacked overlay cases.
  - Switched multiple App inline overlays to shared `Modal` shell (Builder Help, Field Reference, builder-switch confirm, and unsaved-change confirmation dialogs).
  - Result: modal shell usage is now more consistent and stack behavior is centralized behind a dedicated hook.
  - Test Delta: Medium risk (modal layering and close-action parity across converted dialogs); Add now; Coverage type: E2E (open/close converted dialogs + verify stacked field-reference overlay above advanced flow/editor modals).
- 2026-02-16: Item 2 continued (modal body component extraction).
  - Added `features/fcom/FcomBuilderHelpModal.tsx` and moved Builder Help modal body out of `App.tsx`.
  - Added `features/fcom/FcomFieldReferenceModal.tsx` and moved Field Reference modal body out of `App.tsx` while preserving stacked overlay styling via shared modal stack styles.
  - Updated `App.tsx` to compose these dedicated modal components instead of inline body markup.
  - Result: modal body ownership moved further toward feature-scoped components with no behavior changes.
  - Test Delta: Medium risk (modal content rendering + close handlers + stacked field reference visibility); Add now; Coverage type: E2E (open/close Builder Help and Field Reference while Advanced Flow/Flow Editor are open).
- 2026-02-16: Item 2 continued (shared confirm modal extraction).
  - Added `components/ConfirmModal.tsx` as a shared confirm-dialog shell over `components/Modal.tsx`.
  - Replaced repeated App inline confirm modal bodies (builder type switch, panel-nav warning, unsaved navigation, pending cancel, pending review discard) with `ConfirmModal` composition.
  - Result: duplicated confirm-dialog body markup reduced and modal action semantics standardized across common confirm flows.
  - Test Delta: Medium risk (confirm-dialog action wiring and cancel/confirm labels); Add now; Coverage type: E2E (trigger each converted confirm path and verify cancel/confirm side effects).
- 2026-02-16: Item 2 continued (override-removal modal body extraction).
  - Added `features/fcom/FcomOverrideRemovalModals.tsx` and moved remove-override and remove-all-overrides modal body markup out of `App.tsx`.
  - Updated `App.tsx` to delegate those dialogs to the feature component while preserving existing callbacks and advanced-flow handoff behavior.
  - Result: override-removal dialog ownership is now feature-scoped instead of inline in App composition.
  - Test Delta: Medium risk (remove override/remove-all confirmation behavior and Advanced Flow handoff link); Add now; Coverage type: E2E (single-field remove, remove-all, and open-advanced-flow from remove-all dialog).
- 2026-02-16: Item 2 continued (field-selection modal extraction + path-help shell standardization).
  - Added `features/fcom/FcomFieldSelectionModals.tsx` and moved Add Field and Event Field picker modal bodies out of `App.tsx`.
  - Converted Path Help/Tool Overview overlay in `App.tsx` to shared `Modal` shell usage.
  - Result: further reduction of inline modal markup in App with field-selection modal behavior preserved via feature component composition.
  - Test Delta: Medium risk (field insertion modal filtering/selection behavior and path-help modal close/copy affordance); Add now; Coverage type: E2E (open add-field modal, select/add field, open event field picker insertion, open/close path help + copy path).
- 2026-02-16: Item 2 continued (trap-variable modal body extraction).
  - Added `features/fcom/FcomTrapVariablesModal.tsx` and moved trap-variable modal body markup out of `App.tsx`.
  - Updated `App.tsx` to compose the new modal component while preserving insert-mode keyboard/click behavior and stacked overlay z-index.
  - Result: reduced another large inline modal block in App and kept trap-variable rendering behavior feature-scoped.
  - Test Delta: Medium risk (trap-variable selection/insert interactions + modal close reset behavior); Add now; Coverage type: E2E (open trap-variable modal in view/insert mode, select variable token, close modal and verify state reset).
- 2026-02-16: Item 2 completed (final modal body extraction pass).
  - Added `features/fcom/TrapComposerModal.tsx`, `features/mib/PcomAdvancedSettingsModal.tsx`, and `app/UserPreferencesModal.tsx` to own the last large modal bodies that were still inline in `App.tsx`.
  - Updated shared `components/Modal.tsx` to accept `containerRef` so extracted modal components can preserve existing validation pulse/focus-target behavior.
  - Updated `App.tsx` to compose those extracted components and removed the remaining inline `modal-overlay` blocks.
  - Validation: `npm run lint` and `npm run build` passed in `com-management/frontend` (existing non-blocking Vite chunk-size warning unchanged).
  - Test Delta: Medium risk (trap send flow, PCOM advanced apply path, and cache-refresh UI wiring); Add now; Coverage type: E2E (open/close Trap Composer + send/validation states, open/apply PCOM advanced settings, open User Preferences and trigger all cache refresh actions).
- 2026-02-16: Item 3 completed (MIB details panel extraction).
  - Added `features/mib/MibDetailsHeader.tsx`, `features/mib/MibSupportSummary.tsx`, `features/mib/MibActionsPanel.tsx`, and `features/mib/MibObjectsPanel.tsx`.
  - Updated `features/mib/MibWorkspace.tsx` to compose the extracted right-side details components (header, support summary, actions/output, objects/details) while preserving existing behavior and callbacks.
  - Validation: `npm run lint` and `npm run build` passed in `com-management/frontend` (existing non-blocking Vite chunk-size warning unchanged).
  - Test Delta: Medium risk (MIB object selection/details rendering and MIB2FCOM/PCOM action wiring); Add now; Coverage type: E2E (select MIB file, verify support summary counts, run MIB2FCOM output edits, select OBJECT-TYPE and run Test Poll, select trap type and open Compose Trap).
- 2026-02-16: Item 6 kickoff (shared builder link/pill components + builder migration slice).
  - Added `components/BuilderLink.tsx` and `components/Pill.tsx` for standardized builder-link buttons and pill chips.
  - Migrated initial builder surfaces to shared components: `features/fcom/builder/FcomBuilderHeader.tsx`, `FcomBuilderEvalSection.tsx`, `FcomBuilderProcessorSection.tsx`, `FcomProcessorSwitchEditor.tsx`, and `FcomProcessorReviewStep.tsx`.
  - Validation: `npm run lint` and `npm run build` passed in `com-management/frontend` (existing non-blocking Vite chunk-size warning unchanged).
  - Test Delta: Medium risk (builder action controls and pill appearance in header/review flows); Add now; Coverage type: E2E (undo/redo links, advanced processor entry links, switch case add/remove actions, review JSON toggle, and header pills in v2/mixed + unsaved states).
- 2026-02-16: Item 6 continued (flow editor builder-link standardization).
  - Migrated `features/fcom/FcomFlowEditorModal.tsx` builder-link buttons (field reference, apply example, switch case add/remove) to shared `BuilderLink`.
  - Validation: `npm run lint` and `npm run build` passed in `com-management/frontend` (existing non-blocking Vite chunk-size warning unchanged).
  - Test Delta: Medium risk (flow editor switch-case actions and field-reference quick access); Add now; Coverage type: E2E (open flow editor, open field reference, apply example, add/remove switch cases).
- 2026-02-16: Item 6 continued (App + FCOM shared pill/link migration).
  - Migrated remaining `App.tsx` builder-link/pill surfaces to shared `BuilderLink`/`Pill` (staged review actions, override summary action link, advanced-flow JSON toggle, trap variable chips, and PCOM object chips).
  - Migrated `features/fcom/TrapComposerModal.tsx` builder-link actions (failure controls and varbind add/remove) to `BuilderLink`.
  - Migrated `features/fcom/FcomTrapVariablesModal.tsx` and `features/fcom/FcomObjectCard.tsx` pill chips to shared `Pill`.
  - Validation: `npm run lint` and `npm run build` passed in `com-management/frontend` (existing non-blocking Vite chunk-size warning unchanged).
  - Test Delta: Medium risk (review modal expand/collapse actions, trap varbind controls, object-card status chips); Add now; Coverage type: E2E (review modal section controls, trap composer failure/varbind actions, object-card chip visibility in override/match/unsaved scenarios).
- 2026-02-16: Item 6 completed (remaining event/header/advanced-flow standardization).
  - Migrated `features/fcom/FcomEventPrimaryRow.tsx`, `FcomEventSecondaryRow.tsx`, and `FcomEventAdditionalFields.tsx` to shared `BuilderLink`/`Pill` for builder entry actions and override/removed chips.
  - Migrated `features/fcom/FcomAdvancedFlowModal.tsx` focus/convert links to `BuilderLink` and warning/removal chips to `Pill`.
  - Migrated `features/fcom/FcomFileHeader.tsx` and `features/pcom/PcomWorkspace.tsx` remaining plain pill chips to shared `Pill`.
  - Validation: `npm run lint` and `npm run build` passed in `com-management/frontend` (existing non-blocking Vite chunk-size warning unchanged).
  - Test Delta: Medium risk (builder entry links in event rows, advanced flow focus controls, and status chip rendering consistency); Add now; Coverage type: E2E (open builder from primary/secondary/additional rows, advanced flow focus controls + convert CTA, global/file and PCOM chip rendering).
- 2026-02-16: Item 7 completed (table sorting abstraction + shared sort header).
  - Added `hooks/useSortableTable.ts` to centralize sort state, direction toggling, and sort indicator behavior.
  - Added `components/TableSortButton.tsx` and migrated table headers in `features/overview/OverviewPage.tsx` and `features/fcom/FcomFolderOverview.tsx`.
  - Updated `hooks/useOverviewState.ts` and `App.tsx` to use `useSortableTable` instead of duplicated inline sort toggles.
  - Validation: `npm run lint` and `npm run build` passed in `com-management/frontend` (existing non-blocking Vite chunk-size warning unchanged).
  - Test Delta: Medium risk (column sort direction/state propagation in overview and folder tables); Add now; Coverage type: E2E (toggle each sortable column in both tables and verify order + indicator, confirm filter inputs still narrow rows).
- 2026-02-16: Item 8 completed (microservice chain/card extraction).
  - Added `features/microservices/MicroserviceStatusCard.tsx` and `features/microservices/MicroserviceChain.tsx`.
  - Updated `features/microservices/MicroserviceStatusModal.tsx` to delegate chain and card rendering to the new components while preserving action-state logic and control callbacks.
  - Validation: `npm run lint` and `npm run build` passed in `com-management/frontend` (existing non-blocking Vite chunk-size warning unchanged).
  - Test Delta: Medium risk (microservice modal status/action rendering and deploy/redeploy controls); Add now; Coverage type: E2E (open microservice status modal, refresh status, verify chain arrows/card tones/status text, and run deploy/redeploy action buttons).
- 2026-02-16: Item 9 kickoff (overview/PCOM empty-error state migration slice).
  - Migrated `features/overview/OverviewPage.tsx` overview error and empty states to shared `InlineMessage` / `EmptyState`.
  - Migrated `features/pcom/PcomWorkspace.tsx` and `features/pcom/PcomPage.tsx` empty placeholders to shared `EmptyState`.
  - Validation: `npm run lint` and `npm run build` passed in `com-management/frontend` (existing non-blocking Vite chunk-size warning unchanged).
  - Test Delta: Low risk (presentation-only component swap for empty/error rendering); Add now; Coverage type: UI sanity (overview loading/error/empty states and PCOM empty placeholders).

## Resume checkpoint (quick retrieval)
- Last completed cleanup item: processor step navigation extraction + catalog/palette typing propagation.
- Current detour status: test rubric established; builder regression tests added (`tests/e2e/test-g.spec.ts`, `tests/e2e/test-h.spec.ts`).
- Environment note: local Playwright run is currently blocked by fixture/data availability for FCOM file/object builder flows.
- Next refactor item to resume: Item 1 App monolith split (browse/deeplink orchestration and staged review view-model extraction).

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
