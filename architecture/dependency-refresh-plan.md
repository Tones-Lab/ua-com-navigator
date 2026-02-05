# Plan: Dependency Refresh (OJET-First, Controlled Updates)

**Date:** 2026-02-05

## Goals
- Refresh key dependencies without breaking the UI or UA integration.
- Keep OJET as the primary design system and theme source.
- Update in small, reversible batches with clear verification steps.

## Principles
- Avoid bulk upgrades; use small batches with verification per batch.
- Prioritize runtime stability over version novelty.
- Keep the frontend single-runtime (React) and OJET-aligned.

## Scope
- **Frontend:** Vite, TypeScript, ESLint, React tooling, OJET.
- **Backend:** Express, TypeScript, ESLint, tsx, jest.
- **Shared:** Ajv, axios, lint tooling.

## Out of Scope (For Now)
- Major framework migration (React -> Preact).
- Bundler migration away from Vite.
- New testing tooling (tracked separately under Testing & Quality).

## Batch Plan

### Batch 1: Tooling Baseline (Low Risk)
- Vite and @vitejs/plugin-react
- TypeScript
- ESLint + @typescript-eslint/*

**Verify:**
- `npm run -w frontend build`
- `npm run -w frontend lint`

### Batch 2: Backend Tooling (Low Risk)
- TypeScript
- ESLint + @typescript-eslint/*
- tsx
- jest

**Verify:**
- `npm run -w backend build`
- `npm run -w backend lint`

### Batch 3: Runtime Libraries (Moderate Risk)
- React + react-dom (keep 18.x unless a clear need to move)
- OJET (`@oracle/oraclejet`)

**Verify:**
- `npm run -w frontend build`
- Manual UI smoke: login, file open, edit, save

### Batch 4: Shared Libraries (Moderate Risk)
- axios, ajv, ajv-formats

**Verify:**
- Run frontend build + backend build
- Spot-check API calls (auth + file open)

## Rollback Strategy
- Revert the specific batch commit.
- Reinstall dependencies from package-lock.json.

## Risks & Mitigations
- **OJET version drift:** Can introduce styling or component changes.
  - **Mitigation:** Update OJET in isolation; validate UI for layout regressions.
- **TypeScript/ESLint changes:** New rules may fail lint.
  - **Mitigation:** Update configs or pin versions if needed.

## Success Criteria
- Builds and lint pass for frontend + backend.
- No runtime regressions in core flows.
- OJET styling remains consistent.
