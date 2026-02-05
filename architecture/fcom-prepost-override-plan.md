# Plan: Editable Pre/Post Processors via Overrides

**Date:** 2026-02-04

## Goal
Enable users to view, understand, and edit object-level **pre**/**post** processor pipelines (e.g., syslog `preProcessors`/`postProcessors`) **without modifying original FCOM files**. All edits must be stored as **overrides**.

## Hard Constraints
- **No editing of base FCOM files.** All changes must be represented as overrides.
- **Preserve casing** of processor keys and target paths (e.g., `preProcessors` vs `preprocessors`).
- **Reuse existing UI/logic** where possible to reduce duplication and maintenance risk.

## Observations
- Syslog objects use `preProcessors` and `postProcessors` for baseline parsing and enrichment.
- Trap objects commonly use lowercase `preprocessors` and generally do not use `postprocessors`.
- The current Advanced Flow UI already handles processor payloads and override processors.

## Recommendation (High-Level)
- **Reuse the existing Advanced Flow modal** and processor builder, extending it to support **base pre/post processor lanes** driven by overrides.
- Provide **object-level lane selection** for:
  - Pre-processors (target `$.preProcessors` or `$.preprocessors` based on object casing)
  - Post-processors (target `$.postProcessors` or `$.postprocessors` when present)
- Treat overrides as the **single source of editable changes**, while **displaying the base pipeline** for context.

## UI/UX Approach
- In the object view, provide an “Edit Pre/Post Processors” entry that opens the Advanced Flow modal.
- Add a **lane selector** (Pre / Post / Advanced) using the existing builder steps and cards.
- Show:
  - **Base pipeline (read-only context)** for reference.
  - **Effective pipeline** reflecting overrides (editable).
- Maintain the current **commit/confirm flow** for Advanced Flow changes.

## Override Strategy
- Store edits as **override processors** that target the appropriate path:
  - `$.preProcessors` or `$.postProcessors` (camel case)
  - `$.preprocessors` or `$.postprocessors` (lower case)
- Prefer a **replace/set-style override** that writes the full desired array for determinism.
- Avoid modifying the original file structure or base arrays directly.

## Casing Rules
- Detect base casing from the object definition.
- Use the **same casing** for override target paths to avoid ambiguity or mismatches.

## Risks & Mitigations
- **Risk:** Ambiguous merge semantics between base and override.
  - **Mitigation:** Treat overrides as authoritative for the effective pipeline while keeping base visible as context.
- **Risk:** Confusion between override processors (runtime) and base processors (definition).
  - **Mitigation:** Clear labeling in the UI: “Base” vs “Override/Effective.”

## Open Questions
- Should overrides always replace the entire pre/post array, or support partial edits with diff/merge?
- Should post processors be exposed for trap objects even if absent in the base definition?

## Summary
This plan enables full, editable pre/post processor workflows while honoring the rule that base FCOM files are immutable. It reuses the existing Advanced Flow UI and stores all changes as overrides, preserving key casing to align with each file’s structure.
