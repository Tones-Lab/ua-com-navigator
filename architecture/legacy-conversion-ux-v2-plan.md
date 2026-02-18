# Legacy Conversion UX V2 Plan (Detailed, Handoff-Ready)

**Date:** 2026-02-18  
**Status:** Draft for review  
**Owner:** COM Navigator team  
**Primary scope:** Legacy Conversion UI usability redesign (layout, navigation, review flow, density, discoverability)

---

## 1) Purpose

This plan defines a **practical, phased UX redesign** for the Legacy Conversion workspace to reduce scroll fatigue, improve decision speed, and make review/apply behavior explicit.

The current implementation is functionally rich but vertically dense. The redesign preserves current capabilities while reorganizing them into a faster, clearer review workflow.

This document is intentionally detailed so implementation can be paused and resumed without losing context.

---

## 2) Problem Statement

### Observed pain points

1. The page is highly vertical and requires frequent long scrolling.
2. Action controls, status, and outputs are separated by distance.
3. Important mode controls (Friendly vs Raw) and review context are discoverability-sensitive.
4. Suggested COM review and match review compete for screen space.
5. Dependency vs mapped fields are understandable only after reading multiple sections.
6. Data-heavy runs (many files/vendors) create scanning overhead and slower operator confidence.

### Product impact

- Slower operator throughput for conversion review.
- Higher cognitive load when triaging generated vs matched suggestions.
- Increased chance of user confusion around what will be emitted and why.

---

## 3) UX Design Goals

1. **Reduce scrolling by structure** (not by hiding information blindly).
2. **Keep primary controls always reachable** during review.
3. **Make each suggestion self-explanatory** (origin, mapped fields, referenced-only fields, conversion status).
4. **Enable rapid compare-and-edit** in both Friendly and Raw modes.
5. **Align interaction patterns with FCOM mental model** where possible.
6. **Preserve RBAC behavior** (editable for edit-capable users, read-only for others).

---

## 4) Non-Goals (for V2)

- No backend conversion-model rewrite.
- No replacement of current matching engine/scoring algorithm.
- No full wizard implementation in this phase.
- No deep parser redesign in this UX track.

---

## 5) User Personas + Primary Jobs

### Persona A: Rule Engineer (edit permissions)
- Wants to quickly review generated/matched suggestions.
- Needs to tweak fields and raw JSON where needed.
- Wants confidence that edits are tracked and safe before emit.

### Persona B: Reviewer/Analyst (read-only)
- Needs visibility into rationale and dependency mapping.
- Must understand what would be emitted without making edits.

### Persona C: Product/Support triage
- Wants high-level metrics: matched existing, generated, conflicts.
- Needs fast drill-down to specific problematic rows.

---

## 6) Information Architecture (Target)

### Proposed page regions

1. **Pinned Command Bar (sticky)**
   - Conversion status
   - Cloudy threshold
   - Preview/Create actions
   - Top summary counts

2. **Primary Review Workspace (split-pane)**
   - Left pane: item list (suggested COM entries) with quick filters
   - Right pane: selected item details (Friendly/Raw + dependencies + referenced-only rationale)

3. **Secondary Analysis Panels (collapsible)**
   - Match diffs
   - Traversal diagnostics
   - Raw text report

4. **Advanced diagnostics drawer** (optional in later subphase)
   - Include/load/missing diagnostics
   - Deep parser evidence

---

## 7) UX Decisions (Concrete)

### Decision 1: Sticky command/status bar
**Why:** Reduce scroll-back to controls.  
**Behavior:** Top bar remains visible while scrolling body sections.

### Decision 2: Suggested COM becomes master-detail
**Why:** Most user time is spent there.  
**Behavior:**
- Left list supports compact rows with badges (matched/generated/dirty/conflict).
- Right detail shows full field editor and mode toggle.

### Decision 3: Explicit mode toggle
**Why:** Discoverability issue with single button.  
**Behavior:** Friendly | Raw as explicit tabs/chips, always visible in detail header.

### Decision 4: Density controls
**Why:** Reduce white-space waste.  
**Behavior:**
- Compact row height by default in suggestion list.
- Field grid in detail panel: responsive 1/2/3 column layout.
- Expression-heavy fields can auto-span wider columns.

### Decision 5: Progressive disclosure
**Why:** Limit visual overload.  
**Behavior:**
- Match diffs and traversal start collapsed after suggestion load.
- Current session remembers section open/closed state.

### Decision 6: Conversion clarity per item
**Why:** Avoid “is this one included?” confusion.  
**Behavior:** Each item explicitly states:
- “Will emit as COM override (matched)” or
- “Will emit as generated COM definition (no match)”

### Decision 7: Explain unmapped references
**Why:** Improve trust and handoff quality.  
**Behavior:** Show referenced-only fields table:
- Field
- Why not mapped
- Suggested COM pattern

---

## 8) Proposed Interaction Flow

1. User runs conversion.
2. Sticky bar displays counts and threshold.
3. Threshold change triggers live preview refresh.
4. Suggested list updates in place with dirty states preserved where possible.
5. User selects item in left pane.
6. Right pane shows Friendly editor by default.
7. User can toggle Raw and edit JSON if permitted.
8. Dirty indicators show field-level and item-level delta vs baseline.
9. User creates bundle.

---

## 9) Component-Level Plan (Frontend)

### 9.1 Candidate component split

- `LegacyCommandBar`
- `LegacySuggestedList`
- `LegacySuggestedDetail`
- `LegacySuggestedDetailFriendly`
- `LegacySuggestedDetailRaw`
- `LegacySuggestedDependencies`
- `LegacyMatchDiffsPanel`
- `LegacyTraversalPanel`

> Note: If full split is too large for first pass, implement as logical subregions first, then extract.

### 9.2 Reusable patterns from existing app

- Reuse filter-chip style and active-state patterns from current FCOM/legacy controls.
- Reuse existing dirty badge visual language where possible.
- Reuse code-block styling for raw JSON editor.

---

## 10) Data/State Model Additions (UI-only focus)

1. `selectedSuggestionKey`
2. `sectionVisibilityState`
3. `densityMode` (`compact` / `comfortable`)
4. `detailMode` (`friendly` / `raw`)
5. `listFilters` (`dirtyOnly`, `matchedOnly`, `generatedOnly`, `conflictOnly`, search)

### Baseline semantics
- Baseline for dirty comparison remains “initial recommendation payload for this run/threshold snapshot.”
- Dirty status updates on both friendly-field edits and raw JSON edits.

---

## 11) RBAC Rules (Must Preserve)

- Edit-capable users:
  - Can modify friendly fields.
  - Can edit raw JSON.
- Read-only users:
  - Can view all data (friendly/raw), but controls are disabled/readOnly.
  - Can still inspect dependency and referenced-only rationale.

---

## 12) Accessibility + Keyboard Expectations

1. Mode toggles expose `role=tab` and `aria-selected`.
2. Split-pane list rows are keyboard navigable.
3. Expand/collapse controls have explicit labels.
4. Read-only states provide visible and semantic indication.
5. Sticky bar elements remain tab reachable in logical order.

---

## 13) Performance Strategy

1. Virtualize long suggestion and match lists once row counts exceed threshold.
2. Debounce threshold-triggered refresh (already present) and avoid full rerenders where possible.
3. Memoize derived dependency/reference-only rows per selected item.
4. Keep raw editor rendering scoped to selected item in split-pane mode.

---

## 14) Rollout Plan (Phased)

## Phase A — Structural foundation (Low-risk)
- Add sticky command bar.
- Introduce collapsible secondary panels with persisted open state.
- Add compact density mode (default on).

**Exit criteria**
- Actions/status always visible while scrolling.
- Match/traversal/raw panels can be collapsed and persist state.

## Phase B — Suggested COM split-pane
- Convert suggested section to master-detail layout.
- Keep per-item badges and explicit conversion status.
- Keep Friendly/Raw toggle in detail pane header.

**Exit criteria**
- User can review multiple entries with less vertical scroll.
- Detail pane updates by selection, not repeated full-card stacks.

## Phase C — Data density + scan controls
- Add list filters: dirty only, matched only, generated only, conflicts only.
- Add sort options: dirty first, generated first, score desc.
- Add quick search over object name/source.

**Exit criteria**
- Large runs remain navigable without excessive manual scanning.

## Phase D — Advanced diagnostics separation
- Move traversal/raw report diagnostics into dedicated advanced drawer.
- Keep summary indicators near top.

**Exit criteria**
- Primary workflow no longer buried under diagnostics.

---

## 15) Acceptance Criteria (Detailed)

1. A user can complete review + create flow without scrolling back to top controls.
2. Suggested list supports efficient multi-item review in one viewport.
3. Friendly/Raw mode is always discoverable in active review context.
4. Each item clearly indicates inclusion type (override vs generated).
5. Referenced-only fields include reason + suggested conversion pattern.
6. Dirty markers are visible at item and field levels.
7. Read-only users can inspect all content but cannot edit.

---

## 16) QA / Validation Plan

### Functional checks
- Threshold updates suggestions in real time.
- Dirty markers appear/disappear correctly.
- Raw JSON invalid state blocks create action.
- Read-only permissions enforce non-editability.

### UX checks
- Controls remain visible under long scroll.
- Toggle discoverability is immediate.
- Suggested detail remains readable at common viewport sizes.

### Regression checks
- Existing preview/create APIs continue returning expected output.
- Match diffs and traversal panels still render correctly.

---

## 17) Risks + Mitigations

### Risk: Over-compression hurts readability
- Mitigation: Provide compact/comfortable switch and smart field span rules.

### Risk: Split-pane introduces complexity on small screens
- Mitigation: Auto-fallback to stacked mode below breakpoint.

### Risk: Dirty baseline confusion across threshold changes
- Mitigation: Explicitly reset baseline on threshold-triggered recompute and show timestamp/threshold context.

### Risk: Too many controls in sticky bar
- Mitigation: Keep bar action-first; move diagnostics to advanced menu.

---

## 18) Implementation Work Breakdown (Task-Level)

### Workstream 1: Layout shell
- Add sticky command container.
- Define viewport and pane CSS primitives.
- Add section collapse state storage.

### Workstream 2: Suggested review redesign
- Build list row model + selected item state.
- Move current detail rendering into right pane.
- Wire mode toggle + dirty badges in detail pane.

### Workstream 3: Density + scan controls
- Add compact mode.
- Add filters/sorting/search for suggestion list.
- Add keyboard navigation improvements.

### Workstream 4: Diagnostics isolation
- Re-home traversal/match/raw diagnostics as secondary panels.
- Add top-level diagnostic badges (counts/warnings).

---

## 19) Handoff / Pause-Resume Notes

If work pauses, restart with this order:

1. Confirm current branch and latest committed plan snapshot.
2. Verify sticky command bar and split-pane scaffolding states.
3. Resume at the earliest incomplete workstream task.
4. Re-run frontend build and restart service after each checkpoint.
5. Capture UI screenshot diffs at each phase exit criteria gate.

### Checkpoint template (copy/paste)

- Date/Time:
- Branch:
- Phase:
- Completed tasks:
- Pending tasks:
- Known issues:
- Validation run:
- Next step:

---

## 20) Open Questions (For Review Before Build)

1. Should compact density be default for all users or remembered preference?
2. Should detail pane default to Friendly always, or remember last mode?
3. For unresolved dependency mapping, should we display parser confidence or only plain reason text?
4. Should generated definitions and matched overrides live in one unified list (recommended) or separate tabs?
5. Do we want an explicit “Apply edited suggestion back into model” step, or keep immediate edit model?

---

## 21) Recommendation (Decision Summary)

Proceed with **Phase A + B first** as the highest impact / lowest risk sequence:

- Sticky command/status bar
- Split-pane Suggested COM workspace
- Explicit Friendly/Raw toggle in detail panel
- Collapsible diagnostics

This will provide the largest immediate usability gain while preserving existing conversion behavior.

---

## 22) Appendix: Mapping Interpretation Guidance

- Legacy `$Event->{FIELD}` references represent runtime context usage in legacy rule logic.
- Suggested COM fields represent current extraction/mapping output.
- Referenced-only fields are not dropped silently; they should be surfaced with rationale and conversion pattern hints.

This interpretation should remain visible in the UI as short helper text to avoid ambiguity.
