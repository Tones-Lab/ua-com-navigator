# Legacy Conversion Stub Generation (Processor + Lookup)

## Purpose

This document defines the generic stub-generation behavior added to the legacy converter so that large, mixed-format legacy rule sets can be transformed into actionable COM JSON candidates with explicit confidence levels.

The goal is to **convert as much as possible safely**, while clearly flagging where source-variable mapping or manual review is still required.

## Design goals

- Apply to many legacy formats and coding styles (not tied to a single vendor file layout).
- Preserve safety: never emit a "direct" stub when mapping is ambiguous.
- Ground all processor recommendations in known FCOM processor behavior.
- Make reports actionable for batch conversion workflows.

## Output model

The converter now emits `report.stubs` in `legacy-conversion-report.json` with:

- `processorStubs[]`
  - One stub per proposed field assignment.
  - Includes:
    - source object/file context
    - target event field
    - original expression
    - status (`direct`, `conditional`, `manual`)
    - recommended processor
    - processor template (when derivable)
    - required variable mappings
    - notes and documentation references

- `lookupStubs[]`
  - One stub per lookup-like legacy `.pl` file.
  - Includes:
    - lookup name
    - inferred entries (when parsable)
    - status and notes

- `summary`
  - direct/conditional/manual counts for processor stubs
  - lookup stub totals

## Processor stub classification rules

### Direct

Expressions that can be converted with no ambiguity:

1. Literal assignment
- Example: `3`, `"Heartbeat"`
- Output: `set` with literal source.

2. Event-field reference copy
- Example: `$Event->{'EMSName'}`
- Output: `copy` from `$.event.EMSName`.

3. Event-only string concatenation
- Example: `$Event->{'EMSName'} . ": Alarm Sync END"`
- Output: `set` with format source + args.

### Conditional

Expressions that are structurally convertible but require variable-source mapping:

1. Variable-only assignment
- Example: `$ip`, `$hwNmNorthboundNEName`
- Output: `copy` template with placeholder source (`<map:varName>`).

2. Mixed concatenation (event refs + variables)
- Example: `$Event->{'HelpKey'} . " - " . $iMAPNorthboundAlarmCSN`
- Output: `set` template with `args`, some placeholders.

3. Extract-then-compose patterns
- Example includes `$extracted_value`
- Output guidance: `regex` + `set` (and optionally `if`).

### Manual

Expressions not safely parsable into deterministic templates are marked manual and surfaced for review.

## Lookup stub generation rules

Lookup stubs are generated for `.pl` files whose names indicate lookup behavior.

- If key/value pairs are detected (`"k" => "v"` style), emit direct lookup template:
  - `name`
  - `_type: "lookup"`
  - `lookup: { ...pairs }`
- If no pairs are detected, emit a manual lookup stub with explicit note.

## Report enhancements

`legacy-conversion-report.txt` now includes:

- processor stub totals (direct/conditional/manual)
- lookup stub totals
- conditional stub sample (shows mapping gaps)
- manual stub sample
- lookup stub sample with entry counts

This is intended to support large-batch triage and prioritization.

## Safety constraints

- Stub generation never mutates source logic.
- Conditional/manual statuses are explicit to avoid false confidence.
- Placeholder mappings (`<map:varName>`) are required to be resolved before production apply.

## Next evolution (recommended)

1. Variable mapping graph
- ✅ Initial support implemented: derives local variable lineage per function for simple assignments:
  - `$var = $vN` -> `$.trap.variables[N-1].value`
  - `$var = $Event->{'Field'}` -> `$.event.Field`
  - `$var = $otherVar` chain resolution (when previously mapped)
- Remaining:
  - support richer expression lineage (function calls, captures, conditional assignments)
  - protocol-aware source mapping (trap/syslog) where input path differs

2. Expression normalization pass
- Normalize Perl concatenation/assignments into an AST-like intermediate representation for broader pattern coverage.

3. Lookup parser expansion
- Support more Perl hash and nested map forms beyond basic key/value pairs.

4. Wizard/report UX
- Add guided conversion workflow UI for resolving conditional/manual stubs with inline suggestions and validation.
