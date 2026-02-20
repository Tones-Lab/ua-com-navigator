# Legacy Conversion: Why "Referenced only" appears for obvious `$Event` assignments

## Context

In review UI, some fields show:

- **Referenced only**
- **Why not mapped:** "Referenced in legacy rule context/read logic..."
- **Suggested COM pattern:** "Parser evidence required (if/regex/copy/set/lookup)"

This can look wrong when source code clearly has direct assignments like:

- `$Event->{'Node'} = ...;`
- `$Event->{'AlarmCode'} = ...;`
- `$Event->{'AlarmCategorization1'} = ...;`

## What is happening today (native behavior)

### 1) Analysis detects many event fields

The parser does detect event assignment usage broadly via `$Event->{...} = ...` extraction.

### 2) Phase-1 conversion only promotes a **subset** of fields into proposals

Current phase-1 `buildOverrideProposals` promotes primarily:

- `Severity`
- `EventCategory`
- `Summary`
- `HelpKey`
- `Node`
- `SubNode`

Fields outside that subset may still be detected in analysis but are not always promoted into `proposal.fields`.

### 3) Processor stubs are built only from promoted proposal fields

`buildProcessorStubForField` (which can output `set`, `copy`, `if`, etc.) runs against `proposal.fields` entries only.

If a field never enters `proposal.fields`, it never gets a native processor stub, even if assignment appears straightforward in source.

### 4) UI "Referenced only" table is a **difference view**

The table compares:

- dependency fields seen in related legacy object context
- vs fields currently mapped in selected generated/matched COM payload

Any dependency field not present in mapped payload is shown as referenced-only, with generic "parser evidence required" text.

## Why your screenshot can look contradictory

A source snippet can contain direct assignments, but the selected COM suggestion may still exclude those fields because:

- phase-1 field promotion is intentionally narrow
- dependency set can be broader than mapped set
- table text is generic and does not distinguish "known direct assignment but out-of-scope in phase-1" from "truly unresolved"

## What can be achieved natively in-app (without external LLM)

The app can support a better native path by extending phase-1 promotion and inference tiers.

### Native improvements with high value

1. **Promote direct `$Event` assignments to candidate mappings beyond current subset**
   - For fields directly assigned in function block, create candidate `set`/`copy` stubs.

2. **Introduce confidence tiers for native inference**
   - `evidence_direct` (safe auto-suggest)
   - `evidence_inferred` (best-effort, requires review)
   - `unresolved` (manual)

3. **Refine UI labels for referenced-only rows**
   - Distinguish:
     - "Out of current phase-1 scope"
     - "Expression unsupported"
     - "Needs variable lineage resolution"
     - "Branch ambiguity"

4. **Add one-click action from referenced-only table**
   - "Create best-effort set/copy candidate" for clearly direct assignments.

## Recommended interpretation for users today

When you see "Parser evidence required":

- It does **not** always mean "no assignment exists in source".
- It often means "assignment exists but was not promoted into current phase-1 mapped payload".

## Decision guidance

Given current workflow goals, we should keep safety guardrails, but reduce confusion by:

- promoting obvious direct assignments into native candidates
- making UI reason text specific to true root cause (scope vs ambiguity vs unsupported parse)
