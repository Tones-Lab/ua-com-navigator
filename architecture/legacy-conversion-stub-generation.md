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

### Generic regex-capture auto-conversion (new)

The converter now handles a broad regex family without vendor-specific rules:

1. Detect capture lineage in function scope
- Finds patterns like:
  - `$sourceVar =~ /.../;`
  - `my $captured = $1;`
- Links `$captured` to the source var, regex pattern, and capture group index.

2. Detect capture usage in event assignment composition
- If a target field expression (for example `Summary`) contains `$captured` inside concatenation, converter emits a branch-capable chain.

3. Emit branch-aware processor template
- Recommended processor: `if`
- Then branch:
  - `regex` extraction into temp field (e.g. `$.tmp.capturedVar`)
  - `set` composition using extracted value
- Else branch (when detectable in source rule):
  - fallback `set` composition without extracted value

4. Preserve safety on unresolved mappings
- If source variable path cannot be mapped, emit `<map:varName>` and keep status `conditional`.
- If source mappings are resolved by lineage/aliases, status can become `direct`.

This allows multiple future regex-heavy rule examples to flow through the same conversion pipeline logic.

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

## Processor stub confidence scoring (new)

Each generated `processorStub` now includes a deterministic confidence object:

- `confidence.score` (0.05 to 0.98)
- `confidence.level` (`high`, `medium`, `low`)
- `confidence.rationale` (compact explanation of why)

Current scoring policy:

- Base by status:
  - `direct`: 0.90
  - `conditional`: 0.62
  - `manual`: 0.30
- Risk adjustments:
  - unresolved required mappings: `-0.12`
  - regex branch chains (`if + regex + set`): `-0.06` when direct, `-0.12` when conditional
  - heuristic variable mapping (for example `$generic` fallback): `-0.08`
- Level thresholds:
  - `high` >= 0.80
  - `medium` >= 0.55 and < 0.80
  - `low` < 0.55

Purpose:

- Keep aggressive auto-conversion while exposing relative risk.
- Support wizard/report prioritization by confidence rather than only direct/conditional/manual buckets.

Calibration command:

- `npm run legacy:confidence-calibrate -- --input <legacy-processor-stubs.json|legacy-conversion-report.json> --output-dir <dir> --format both --max-items 25 --min-level medium`
- Outputs:
  - `legacy-confidence-calibration.json`
  - `legacy-confidence-calibration.txt`
- Behavior:
  - filters candidates by configurable minimum confidence level (`--min-level`)
  - ranks by lowest confidence score first, then mapping complexity
  - if filter yields none, falls back to lowest high-confidence stubs unless strict mode is enabled

### Calibration command options (detailed)

- `--input <path>` (required)
  - accepts either:
    - `legacy-processor-stubs.json` (array form)
    - `legacy-conversion-report.json` (extracts `stubs.processorStubs`)
- `--output-dir <path>`
  - output directory for text/json calibration artifacts
- `--format json|text|both`
  - artifact format selector (default `both`)
- `--max-items <N>`
  - maximum selected candidates after filtering/sorting (default `25`)
- `--min-level low|medium|high`
  - confidence threshold for candidate eligibility (default `medium`)
  - semantics:
    - `low`: include only low-confidence stubs
    - `medium`: include low + medium confidence stubs
    - `high`: include low + medium + high (all stubs)
- `--strict-min-level`
  - disables fallback behavior when no stubs match `--min-level`
  - keeps selected list empty by design in that case

### Selection algorithm

1. Build risk entries for all processor stubs.
2. Apply min-level eligibility filter.
3. Sort eligible entries by:
   - lowest `confidenceScore` first
   - highest `requiredMappings` count next
   - stable object-name tie-break
4. Select up to `--max-items`.
5. If selection is empty and strict mode is off:
   - fallback to global lowest-score stubs (typically high-confidence in mature datasets).

### Fallback behavior matrix

- `--min-level low` + no low stubs:
  - strict off: returns fallback list (lowest high-confidence)
  - strict on: returns empty list
- `--min-level medium` + no low/medium stubs:
  - strict off: returns fallback list
  - strict on: returns empty list
- `--min-level high`:
  - all stubs are eligible; fallback is effectively unnecessary

### Output metadata (new)

`legacy-confidence-calibration.json` includes `selectionPolicy`:

- `minLevel`
- `strictMinLevel`
- `fallbackEnabled`
- `usedFallback`
- `eligibleByMinLevel`

These fields make runs auditable and simplify workflow automation.

### Usage examples

Default triage (low+medium, with fallback):

- `npm run legacy:confidence-calibrate -- --input tmp/legacy-analysis/nce/legacy-processor-stubs.json --output-dir tmp/legacy-analysis/nce --format both --max-items 25 --min-level medium`

Only low-confidence stubs, strict (empty if none):

- `npm run legacy:confidence-calibrate -- --input tmp/legacy-analysis/nce/legacy-processor-stubs.json --output-dir tmp/legacy-analysis/nce --format both --max-items 25 --min-level low --strict-min-level`

Include entire population (score-ranked all stubs):

- `npm run legacy:confidence-calibrate -- --input tmp/legacy-analysis/nce/legacy-processor-stubs.json --output-dir tmp/legacy-analysis/nce --format both --max-items 50 --min-level high`

## Confidence drift comparison (new)

To track intelligence evolution across runs, compare two calibration outputs (before vs after):

- `npm run legacy:confidence-compare -- --before <before-calibration.json> --after <after-calibration.json> --output-dir <dir> --format both --max-items 20`

Outputs:

- `legacy-confidence-drift.json`
- `legacy-confidence-drift.txt`

What it compares:

1. Selection policy changes
- min-level / strict / fallback usage between runs.

2. Aggregate confidence drift
- deltas for high/medium/low counts.
- triage/selected candidate count deltas.

3. Root-cause drift
- per-cause `before -> after` counts + delta:
  - `manual-expression-shape`
  - `unresolved-variable-mappings`
  - `regex-branch-complexity`
  - `heuristic-alias-mapping`
  - `missing-confidence-metadata`
  - `general-medium-confidence`

4. Risk-set membership changes
- stubs newly appearing in after run (`added`)
- stubs no longer present (`removed`)
- stubs present in both (`common`)

5. Per-stub score/level drift (for common entries)
- score improvements/regressions/unchanged
- confidence level upgrades/downgrades/unchanged
- top regressions and top improvements by score delta

Stub identity key for drift matching:

- `objectName|sourceFile|targetField`

Operational recommendation:

1. Run conversion + calibration for baseline dataset.
2. Add new rules/examples and re-run conversion + calibration.
3. Run confidence compare and review:
   - top regressions first
   - then root-cause deltas with largest magnitude
4. Feed findings back into parser/lineage heuristics.

## One-command pipeline orchestrator (new)

For iterative rule ingestion, a single command now orchestrates conversion, calibration, and optional drift compare:

- `npm run legacy:pipeline -- --input <legacy-root> [options]`

Pipeline stages:

1. Convert
- Runs `legacy:convert` with your input paths and conversion options.
- Produces report + stubs under `conversion/`.

2. Calibrate
- Runs `legacy:confidence-calibrate` against generated processor stubs.
- Produces calibration artifacts under `calibration/`.

3. Compare (optional)
- If `--compare-before <calibration.json>` is provided, runs `legacy:confidence-compare`.
- Produces drift artifacts under `compare/`.

4. Manifest
- Writes `pipeline-manifest.json` containing:
  - resolved options
  - canonical artifact paths
  - run metadata (timestamp/run name)

### Pipeline options

- `--input <path>` (repeatable, required)
- `--output-root <path>` (default: `tmp/legacy-analysis/pipeline`)
- `--run-name <name>` (default: `run-<timestamp>`)
- `--include <a,b,c>` / `--exclude <a,b,c>`
- `--vendor <name>`
- `--use-mibs` / `--no-mibs`
- `--use-llm` / `--no-llm`
- `--dry-run` / `--no-dry-run`
- `--min-level <low|medium|high>`
- `--strict-min-level`
- `--max-items <N>`
- `--compare-before <path-to-calibration.json>`
- `--compare-latest` (auto-pick latest prior run calibration in output-root)

### Example workflows

Initial baseline run (no compare):

- `npm run legacy:pipeline -- --input rules/legacy/uploads/NCE --run-name nce-baseline --min-level medium --max-items 25`

Follow-up run with drift compare to previous baseline:

- `npm run legacy:pipeline -- --input rules/legacy/uploads/NCE --run-name nce-iter-2 --min-level medium --max-items 25 --compare-before tmp/legacy-analysis/pipeline/nce-baseline/calibration/legacy-confidence-calibration.json`

Auto-compare to latest prior run baseline (no manual path):

- `npm run legacy:pipeline -- --input rules/legacy/uploads/NCE --run-name nce-iter-3 --min-level medium --max-items 25 --compare-latest`

Shortcut variant (same behavior):

- `npm run legacy:pipeline:latest -- --input rules/legacy/uploads/NCE --run-name nce-iter-4 --min-level medium --max-items 25`

Strict low-only calibration in pipeline:

- `npm run legacy:pipeline -- --input rules/legacy/uploads/NCE --run-name nce-strict-low --min-level low --strict-min-level --max-items 25`

### Directory layout per run

- `<output-root>/<run-name>/conversion/...`
- `<output-root>/<run-name>/calibration/...`
- `<output-root>/<run-name>/compare/...` (optional)
- `<output-root>/<run-name>/pipeline-manifest.json`

### Baseline auto-resolution details

- `--compare-latest` scans sibling run directories under `--output-root`.
- It selects the most recently modified calibration file:
  - `<output-root>/<prior-run>/calibration/legacy-confidence-calibration.json`
- It excludes the current run directory (`--run-name`) from candidate search.
- If no prior calibration is found:
  - pipeline logs a warning
  - compare stage is skipped
  - conversion + calibration still complete normally.

Precedence rule:

- If `--compare-before` is provided, it is used as-is.
- `--compare-latest` is only used when `--compare-before` is not provided.

Manifest visibility:

- `pipeline-manifest.json` records:
  - requested `compareBefore` (if explicitly provided)
  - `compareLatest` flag
  - `resolvedCompareBefore` (actual baseline path used, if any)

## Safety constraints

- Stub generation never mutates source logic.
- Conditional/manual statuses are explicit to avoid false confidence.
- Placeholder mappings (`<map:varName>`) are required to be resolved before production apply.

## Runtime field mapping facts (from processor logs)

The converter should prefer runtime source facts observed in `fcom-processor` logs:

- `source.ip` is the authoritative inbound IP from the collector payload.
- `$.event.IPAddress` is typically mapped/derived from runtime source input (often from `source.ip` or equivalent trap context).
- `$.event.Node` may be host/DNS-formatted and should not be assumed to equal raw source IP.
- `trap.variables[]` may be empty for some test traps; in that case, `$vX` lineage cannot be resolved from payload alone.

Practical implication:

- When resolving legacy `$ip`, prefer mapping to runtime source (`source.ip`) where available, and treat event-level IP fields as derived outputs unless explicitly guaranteed by rule logic.

## `$vX`, OID, and MIB limitations

- Legacy `$vX` references depend on trap varbind ordering and OID semantics.
- Without MIB context (or equivalent varbind metadata), `$vX` to semantic-field mapping can be ambiguous.
- If MIBs are missing, the pipeline should mark those mappings as conditional/manual and request user intervention.

Recommended user workflow for unresolved `$vX` mappings:

1. Upload MIBs to the app/tooling context.
2. Re-run conversion (or re-run mapping-only step when available).
3. Review updated stubs/lookups and accept/adjust remaining manual mappings.

## `$specific` and `$generic` notes

- `$specific` can often be approximated from trap OID suffix (last numeric arc) for enterprise-specific trap patterns.
- This should be treated as a best-effort heuristic and documented as such.
- `$generic` value is not reliably visible in current observed `fcom-processor` logs for SNMPv2c-style payloads.
- If legacy logic depends on `$generic` (for example, linkDown/coldStart style branching), manual mapping/review may still be required unless runtime explicitly exposes that value.

Current implementation note:

- Stub generation now includes a best-effort alias heuristic that maps legacy `$generic` to literal `6` (enterpriseSpecific) when no explicit runtime generic value is discoverable.
- This is intentionally marked as heuristic behavior and should be user-reviewed for rule sets that rely on SNMPv1 generic semantics.

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
