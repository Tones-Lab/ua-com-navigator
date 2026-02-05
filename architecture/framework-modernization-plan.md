# Plan: Framework Modernization (OJET-First, Streamlined)

**Date:** 2026-02-05

## Goals
- Keep Oracle JET (OJET) as the primary design system and component strategy.
- Reduce framework surface area to a single runtime (no React + Preact mix).
- Improve dependency clarity, upgradeability, and bundle size.
- Keep migration risk low and reversible.

## Current State (Observed)
- Frontend runtime is React (React + ReactDOM in entry point).
- OJET is present only as Redwood theme CSS.
- No Preact usage in source code; Preact dependencies are installed but unused.
- Vite React plugin is in use.

## Decision (Default Path)
**Keep React as the single runtime and retain OJET via web components and Redwood styling.**
This minimizes change risk, aligns with current code, and preserves OJET as the UI standard.

## Target Architecture
- **Runtime:** React 18 (single framework).
- **OJET:** Use `@oracle/oraclejet` for theme + web components where appropriate.
- **Remove:** `preact` and `@oracle/oraclejet-preact` to eliminate redundant framework.
- **Build tooling:** Vite + React plugin remains.

## Plan of Record (Phases)

### Phase 1: Dependency Consolidation (Low Risk)
- Remove `preact` and `@oracle/oraclejet-preact` from frontend dependencies.
- Keep `@oracle/oraclejet` and Redwood CSS import.
- Validate no Preact imports exist in `src/`.

**Exit criteria:**
- Build and dev server run without Preact packages.
- No runtime errors from missing Preact modules.

### Phase 2: OJET Usage Strategy (Incremental Adoption)
- Identify 2-3 high-visibility UI areas where OJET components add value.
- Replace raw HTML controls with OJET web components only if it improves UX consistency.
- Keep a short list of approved OJET components to avoid inconsistent use.

**Exit criteria:**
- OJET components used in at least one key UI flow.
- Design remains consistent with Redwood theme.

### Phase 3: Dependency Refresh (Controlled Updates)
- Use a controlled update list (no bulk jumps without review).
- Update Vite, TypeScript, and ESLint in small batches.
- Validate UI regression risk after each batch.

**Exit criteria:**
- Dependencies updated with no lint/build regressions.

## Risks and Mitigations
- **Risk:** OJET components might require additional setup or CSS overrides.
  - **Mitigation:** Start with a single component swap and validate visuals.
- **Risk:** Removing Preact might break an indirect dependency.
  - **Mitigation:** Confirm no Preact imports; run build before commit.
- **Risk:** OJET web components usage patterns differ from React components.
  - **Mitigation:** Document a short usage guide and patterns for the team.

## Out of Scope (For Now)
- Major UI rewrite or component library replacement.
- Switching to Preact runtime.
- Bundler migration away from Vite.

## Success Metrics
- Single runtime in package.json (React only).
- No Preact or oraclejet-preact packages installed.
- Consistent Redwood styling and visible OJET adoption in UI.

## Rollback Strategy
- Revert the dependency change commit.
- Restore `preact` and `@oracle/oraclejet-preact` if required.

## Notes
- If Oracle JET introduces a dedicated React wrapper package that is stable and recommended, re-evaluate the runtime decision at that time.
