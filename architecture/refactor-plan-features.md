# Frontend Refactor Plan (Feature-Based Split)

## Goals
- Break the monolithic App.tsx into feature modules: Overview, FCOM, PCOM, MIB Browser.
- Isolate shared UI and utilities.
- Reduce coupling, improve readability, enable targeted tests.

---

## Target File Map (Proposed)
```
frontend/src/
  app/
    App.tsx                # shell: layout + tab routing
    AppTabs.tsx            # top nav (Overview/FCOM/PCOM/MIB)
    AppState.ts            # top-level shared state only

  features/
    overview/
      OverviewPage.tsx
      overviewHooks.ts
      overviewTypes.ts

    fcom/
      FcomPage.tsx
      FcomEditor.tsx
      FcomBuilderPanel.tsx
      FcomAdvancedFlow.tsx
      FcomFieldReference.tsx
      fcomHooks.ts
      fcomTypes.ts
      fcomUtils.ts

    pcom/
      PcomPage.tsx
      PcomEditor.tsx
      pcomHooks.ts
      pcomTypes.ts
      pcomUtils.ts

    mib/
      MibBrowserPage.tsx
      MibDefinitionPanel.tsx
      MibTrapComposer.tsx
      mibHooks.ts
      mibTypes.ts
      mibUtils.ts

  components/
    common/
      CodeBlock.tsx        # standard JSON/code rendering
      Stepper.tsx          # progress bar style stepper
      Modal.tsx            # base modal wrapper
      EmptyState.tsx
      Pills.tsx
      SearchBar.tsx

  hooks/
    useDebounce.ts
    useClipboard.ts
    useConfirmDiscard.ts

  services/
    apiClient.ts
    fcomApi.ts
    pcomApi.ts
    mibApi.ts

  state/
    sessionStore.ts
    uiStore.ts

  utils/
    format.ts
    json.ts
    flow.ts
    schema.ts

  styles/
    tokens.css
    components.css
```

---

## Refactor Phases (Concrete)

### Phase 1 — App Shell + Tabs
1) Create `app/AppTabs.tsx` to render the header tabs (Overview/FCOM/PCOM/MIB).
2) Move the existing tab switching logic out of `App.tsx` into `AppTabs.tsx`.
3) Keep `App.tsx` as a simple shell rendering the active page.

**Deliverable:** App.tsx < 200 lines, only routing + layout.

### Phase 2 — Feature Extraction
4) Create `features/overview/OverviewPage.tsx` and move the overview dashboard UI from App.tsx.
5) Create `features/fcom/FcomPage.tsx` and move all FCOM content.
6) Create `features/pcom/PcomPage.tsx` and move PCOM content.
7) Create `features/mib/MibBrowserPage.tsx` and move MIB Browser content.

**Deliverable:** No feature UI remains in App.tsx.

### Phase 3 — Extract Large Sub‑components
8) In FCOM, split:
   - `FcomEditor.tsx` (main editor + panels)
   - `FcomBuilderPanel.tsx` (eval/processor builder)
   - `FcomAdvancedFlow.tsx` (advanced flow modal)
   - `FcomFieldReference.tsx` (field ref modal)
9) In MIB, split:
   - `MibDefinitionPanel.tsx`
   - `MibTrapComposer.tsx`

**Deliverable:** Each file focused on one UI area.

### Phase 4 — Shared Components + Utilities
10) Create common components:
    - `CodeBlock.tsx` (standard JSON view)
    - `Stepper.tsx` (select/configure/review)
    - `Modal.tsx`
11) Move formatters (dates, labels) into `utils/format.ts`.
12) Move flow helpers into `utils/flow.ts`.
13) Move JSON helpers into `utils/json.ts`.

**Deliverable:** Remove duplicated helpers from feature files.

### Phase 5 — Services + Types
14) Create feature-specific API wrappers in `services/`.
15) Move type definitions into `features/*/types.ts`.

**Deliverable:** API calls centralized and typed.

---

## Migration Notes
- Keep behavior identical during refactor (no feature changes).
- Move code in small, testable chunks; avoid large sweeping edits.
- After each phase, run the app and verify:
  - Login works
  - File browser renders
  - FCOM editor operates
  - Advanced flow opens
  - MIB browser renders

---

## Post‑Refactor Documentation Plan (High Level)
- Create docs per feature:
  - Overview
  - FCOM
  - PCOM
  - MIB Browser
- Each doc must include:
  - Purpose
  - Data sources
  - Primary workflows
  - Permissions/limitations
  - UI screenshots

---

## Acceptance Criteria
- App.tsx under 200 lines.
- Each feature has its own folder and main page component.
- Shared code is extracted (no repeated helper blocks).
- Behavior parity verified.
