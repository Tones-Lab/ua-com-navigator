# Processor Palette Unification Plan

## Goal
Unify the Global and Object processor palettes so they are rendered from a single source of truth. This ensures configuration, defaults, labels, and docs are defined once and shared everywhere.

## Why
- Eliminates drift between Global and Object palettes.
- Processor config changes happen once and apply everywhere.
- Reduces risk of inconsistent defaults or validation rules.

## Current State (Summary)
- Global and Object palettes are defined in different sections of the UI code.
- Processor config for the builder and advanced flow is duplicated or partially duplicated.

## Target State
A single processor registry drives:
- Palette rendering (global/object).
- Default config initialization.
- Config field definitions (form rendering).
- Help text (description + example).

## Proposed Architecture
1) **Processor Registry (Single Source)**
   - A single map/object describing each processor:
     - `id` (processorType)
     - `label`
     - `status` (working/testing/planned)
     - `help` (description + example JSON)
     - `defaults` (config defaults for builder + flow)
     - `configSpec` (form fields + types + placeholders)
     - `scopeSupport` (global/object/both) if needed for future differences

2) **Palette Renderer**
   - Both palettes render by filtering the registry list by `status` and optional `scopeSupport`.

3) **Builder + Flow Editor Use the Same Config Specs**
   - Builder forms and Flow editor forms use the same `configSpec` to render inputs.
   - Defaults come from the same registry entry.

4) **Help + Examples**
   - Help text and example JSON pulled from the registry for both palettes.

## Implementation Steps (No Code Yet)
1) Create registry data structure in a single module.
2) Move all processor metadata/config specs into the registry.
3) Update palette rendering to use registry entries.
4) Update builder defaults to pull from registry.
5) Update advanced flow editor config form to pull from registry.
6) Remove duplicate palette/config definitions.
7) Confirm behavior parity (global vs object).

## Notes
- If specific processors must differ by scope in the future, add `scopeSupport` and optional overrides inside the registry.
- Keep registry entries aligned with UA processor documentation.

## Risks / Mitigations
- **Risk:** Hidden differences between global/object palettes.
  - **Mitigation:** Add snapshot tests or a quick UI audit to confirm parity.

## Definition of Done
- Single registry drives both palettes and config specs.
- No duplicated processor definitions remain.
- Updating a processor’s config/help changes both global and object UIs.
