# Legacy Conversion Native Lookup Parser Spec (Generalized)

## Purpose

Define a **generic native parser strategy** to convert legacy lookup-based expressions into COM processors reliably, without hardcoding for one vendor or one rule pack.

This spec treats the NCE sample as validation input, not as a one-off implementation target.

## Design Principles

1. Pattern-first, vendor-agnostic parsing.
2. Deterministic lowering to COM processor chains.
3. No field-name guessing.
4. Explicit confidence and fallback behavior.
5. Reusable across rule families with similar lookup idioms.

## Problem Statement

Current conversion can detect many direct assignments but still falls back to manual when expressions include lookup dereference patterns, especially nested hash forms such as:

- `$lookupTable{$key}{Severity}`
- `$lookupTable{$key}{EventCategory}`
- `$lookupTable{$key}` with downstream field extraction

These are common legacy idioms and should map to native COM lookup/copy/set flows.

## Scope

### In scope

- Extract lookup definitions and references from `.pl` / `.rules`.
- Parse lookup access expressions in assignment RHS.
- Resolve lookup key expression when possible.
- Emit COM processor templates using `lookup`, `copy`, `set`, and optional `if`/fallback.
- Emit conditional stubs when key/path mapping is incomplete.

### Out of scope (v1)

- Runtime code execution of arbitrary Perl.
- Full Perl AST interpretation.
- Complex custom function emulation beyond deterministic patterns.

## Canonical Lookup Pattern Families

### Family A — Direct nested lookup dereference

Pattern:

- `$Event->{Target} = $Table{$Key}{Prop};`

Expected lowering:

1. Resolve key source path or placeholder.
2. Lookup row/object by key.
3. Copy property `Prop` into `$.event.Target`.
4. Optional fallback if lookup miss.

### Family B — Single-level lookup dereference

Pattern:

- `$Event->{Target} = $Table{$Key};`

Expected lowering:

1. Resolve key.
2. Lookup value.
3. Set/copy to target.

### Family C — Lookup used in conditional branch

Pattern:

- `if ($Table{$Key}{Prop} eq 'X') { ... }`

Expected lowering:

- Emit branch-aware chain with lookup step and conditional evaluation.

### Family D — Lookup value composed with text/args

Pattern:

- `$Event->{Target} = "prefix" . $Table{$Key}{Prop} . "suffix";`

Expected lowering:

- Lookup + composed `set` with `args`.

## Generic Parser Architecture

### Stage 1: Lookup definition inventory

Build a lookup registry from source files:

- Lookup name
- Source file
- Shape: scalar map vs object map
- Known properties (when object map detectable)
- Confidence metadata

### Stage 2: Expression recognition

For each assignment RHS, detect lookup access tokens with regex-backed structural parsing:

- table identifier
- key token/expression
- optional property token
- surrounding composition context

Output a normalized IR node.

### Stage 3: Key resolution

Resolve key token via existing lineage/alias mapping:

- direct event path
- local variable lineage
- global alias map

If unresolved, keep placeholder in `requiredMappings` and mark conditional.

### Stage 4: Processor lowering

Lower IR node into COM chain:

- `lookup` step (or equivalent lookup reference mechanism)
- `copy`/`set` to target
- optional `if` guard or fallback branch

### Stage 5: Confidence and intervention flags

Assign deterministic confidence bands:

- `direct` when table/key/property all resolved
- `conditional` when key/path unresolved or fallback placeholders remain
- `manual` only when expression shape unsupported

## Intermediate Representation (IR)

Suggested IR shape for lookup access:

```json
{
  "kind": "lookup_access",
  "table": "<lookup_table_name>",
  "key": {
    "raw": "$hwNmNorthboundSeverity",
    "resolvedPath": "$.event.SomeField",
    "resolved": true
  },
  "property": "Severity",
  "targetField": "$.event.Severity",
  "composition": {
    "mode": "direct",
    "prefix": "",
    "suffix": ""
  },
  "fallback": null,
  "confidence": "direct"
}
```

## COM Lowering Strategy

Use processor primitives already available in schema inventory:

- `lookup` / `lookup_file`
- `copy`
- `set`
- `if` (when branch/fallback is required)

### Example lowering (conceptual)

From:

- `$Event->{Severity} = $Table{$Key}{Severity};`

To:

1. lookup by `Key` into temp object
2. copy `temp.Severity` to `$.event.Severity`

If key unresolved:

- emit conditional stub with `requiredMappings: ["KeyVar"]`

## Fallback and Failure Semantics

On lookup miss or processor failure:

- Respect explicit fallback if legacy expression indicates one.
- Otherwise keep current value or mark unresolved according to policy.
- Surface deterministic reason codes in notes (e.g., `lookup_key_unresolved`, `lookup_property_missing`).

## Acceptance Matrix (General, Not Vendor-Locked)

### A. Coverage

- Detect and lower Family A/B/D patterns across at least 3 rule packs.
- Reduce manual stubs attributable to lookup expression shape by >= 60% from baseline.

### B. Correctness

- For sampled rules, generated target fields match expected lookup property semantics.
- No silent field-name inference without structural evidence.

### C. Explainability

- Every conditional/manual lookup stub has explicit reason code and required mappings.
- UI can distinguish:
  - unsupported expression
  - unresolved key mapping
  - missing lookup definition

### D. Safety

- Unknown or malformed lookup expressions remain manual.
- No runtime execution of untrusted Perl logic.

## Implementation Guardrails

1. Do not hardcode vendor-specific lookup table names.
2. Do not encode one-off field aliases into parser core.
3. Keep pattern detectors declarative and testable.
4. Centralize reason codes for UI messaging.
5. Add fixture-driven tests from multiple rule families.

## Suggested Iteration Plan

### Iteration 1

- Family A/B parsing + key resolution + basic lowering.
- Reason codes for unresolved key/property.

### Iteration 2

- Family D composition support with `set + args`.
- Branch-aware lookup use in `if` contexts.

### Iteration 3

- Broader lookup definition discovery and schema validation.
- Performance and false-positive hardening.

## Expected Outcome

After this parser path is implemented, common lookup assignments should be natively converted to COM processors with fewer manual fallbacks, while preserving deterministic behavior and cross-vendor portability.
