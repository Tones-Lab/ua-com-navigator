# Legacy Conversion Phase 1 (Detailed)

## Purpose
Build the first, detailed implementation plan for Legacy Conversion. This phase focuses on:
- Parsing legacy Perl-based rule files (fault or performance).
- Identifying OIDs, event/perf intent, and mappings.
- Comparing against existing FCOM/PCOM support and available MIBs.
- Generating a guided report and a raw override bundle output.

This document intentionally captures all user feedback and all current assumptions in detail. It is not a summary.

## Implementation Status Snapshot (2026-02-18)

The current codebase has implemented a substantial portion of this Phase 1 plan:

- Legacy UI tab/workspace is active (not stub-only): upload files, select files, run conversion/preview, inspect report outputs, filter object/match views, and open matched COM files.
- Backend legacy routes exist for uploads, safe zip extraction, file read, match-file read, and conversion execution.
- Core conversion engine exists with traversal discovery, rule classification, object extraction, proposal generation, matching/diff scoring, and report generation.
- Scripted conversion mode exists and uses the same core conversion engine.

Still not implemented (or intentionally deferred):

- Guided apply workflow to directly create/update COM overrides from validated proposals.
- Wizard-driven triage for unresolved/low-confidence conversion items.
- Advanced lookup migration workflow (Perl hashes / external references) into reusable COM processor patterns.
- Assistant/chatbot integration for conversion remediation guidance.

This status should be treated as the baseline for Phase 2 planning.

## User Feedback (Required, Verbatim Intent)
1. Parsing must be "smart" and robust. The sample legacy files are a tiny subset of possible formats. We should design for variability and unknown patterns.
2. Compare against both FCOM/PCOM and MIBs, but do not depend on MIBs existing. The rules are the source of truth; MIBs are only a helper when present.
3. Classification heuristics are acceptable: fault when working with traps/notification fields and EventCategory/Severity; performance when seeing OID lists, SNMP queries, and metric-like logic.
4. A single legacy file will not mix fault and performance; each file is one or the other. The conversion should detect this based on rule structure.
5. UI placement for the report is flexible and should be documented as a variable decision point. The plan should present at least one design with alternatives.
6. The raw output should be a combined view of all generated event overrides from the conversion process. This raw output is a secondary/hidden capability, not the main UX path.

## Phase 1 Scope
### In Scope
- Parse legacy Perl `.rules` and related `.pl` lookup files for a vendor set.
- Extract rule intent, OIDs, trap definitions, and enum mappings.
- Detect fault vs performance per file.
- Compare extracted objects/semantics against:
  - FCOM (fault objects, notifications, trap definitions).
  - PCOM (performance objects).
  - MIB inventory (when available).
- Generate guidance report (UI primary).
- Generate a raw combined override output for all event overrides (secondary).
- Document LLM assist strategy and how feedback can improve conversion quality.

### Out of Scope (Phase 1)
- Fully automated multi-file override application into the repo without user confirmation.
- Cross-vendor correlation and normalization.
- Advanced natural language explanation of every field mapping.
- Full UI build with all workflows; focus on design + minimal integration hooks.

## Assumptions
- Legacy rules are Perl-based and may use a variety of patterns.
- Legacy files are either fault or performance, not mixed.
- MIB availability is optional. MIBs improve confidence, but absence should not block conversion.
- "Smart" parsing means we will implement structured pattern matching first, with LLM fallback for ambiguous cases.
- `$Event->{...}` assignments are the primary signal for fault/event parsing logic.
- Performance rules are signaled by `$MetricID`, `Find*()` calls, hash lists of key/oid pairs, and SNMP session usage; these are primary performance hints.
- Enterprise/notification OIDs used for dispatch do not imply performance; OID-only files should not automatically be classified as performance.

## Inputs
### File Types (Observed)
- `.rules`: Main Perl rule files and trap processing.
- `.pl`: Lookup tables / mappings for severity, alarm type, etc.
- `base.rules`, `base.includes`, `base.load`: Global or common logic.

### Sample Observations (from Huawei NCE set)
- Dispatcher rule checks enterprise OID and routes to handler functions.
- Trap-specific rules parse varbinds into local variables and set:
  - `$Event->{Severity}`
  - `$Event->{EventCategory}`
  - `$Event->{Summary}`
  - `$Event->{HelpKey}`
  - `$Event->{Node}` / `$Event->{SubNode}`
- Lookup tables map text to severity/category.

### Traversal + Resolution Findings (Critical, Preserve)
- Entry points are not guaranteed. Some vendor bundles include `base.rules` (dispatcher), `base.includes` (function->path map), and `base.load` (global lookup loaders). Others may include only a single `.rules` file.
- `base.rules` order matters. The `if`/`elsif` chain is evaluated in order; traversal should preserve this sequence as the effective dispatch priority list.
- `base.includes` provides function names that do not always match filenames. Mapping must be flexible:
  - Exact include path when present and resolvable.
  - Match by filename or by `# Name:` / `$rulesfile` metadata inside `.rules` files.
  - Treat unresolved include paths as external/shared dependencies, not hard errors.
- `base.load` lists lookup/utility functions invoked once at startup. These are global dependencies and must be captured as such, even when the implementation files are missing.
- Barebones handling is required. When only a single `.rules` file exists and no `base.*` files are present, the file itself becomes the traversal root and should still be parsed for event/perf intent.
- Do not hardcode vendor assumptions. Traversal must be derived from files on disk using the above rules; when ambiguous, record uncertainty and keep processing.
- Some vendor bundles are hierarchical. Example: `NCE_all` has no root `base.*`, while each subfolder (e.g., `NCE`, `NCE_Campus`, `NCE_Fabric`) contains its own `base.*`. Traversal must be per-subfolder when the root has no dispatcher/includes.

#### Definitions (Ordered Files vs Traversal Entries)
- **Ordered files**: the final, de-duplicated list of file paths the converter will process, in exact order. This is the execution list.
- **Traversal entries**: the step-by-step traversal records used to build the ordered list. Each entry preserves the “why” (dispatch/include/standalone/fallback), the root, and any dispatcher condition or function name.

## Output (Phase 1)
### Primary Output: Guidance Report
A user-facing report in the Legacy Conversion UI. It must include:
- File-level classification (Fault or Performance) with confidence and evidence.
- Summary counts:
  - Total legacy notifications/perf objects detected.
  - Matching objects found in FCOM/PCOM.
  - Matching objects found in MIBs.
  - Missing objects (no match in either FCOM/PCOM or MIB).
- Match matrix listing:
  - Legacy object (name, OID, source file, rule function).
  - Match in FCOM/PCOM (if any): object name and path.
  - Match in MIB (if any): module + object name + OID.
  - Confidence score and matching method (OID exact, module+name, prefix, inferred).
  - Cache metadata: how many objects/files were indexed, cache hit/miss, and index age.
- Mismatch report:
  - Field-level diffs when a legacy rule differs from the nearest FCOM/PCOM object.
  - Example: legacy severity=3 vs FCOM severity=5.
- Recommended actions:
  - Create override for mismatched fields.
  - Create new FCOM/PCOM rule skeleton for missing objects.
- Optional MIB highlight targets:
  - A list of object OIDs to highlight in the MIB browser.

### Secondary Output: Raw Combined Override View (Hidden/Advanced)
- A consolidated, raw preview of all overrides that would be generated.
- Must show:
  - Original legacy-derived values
  - Existing FCOM/PCOM values
  - Proposed override values
- Represented as one combined view even if the actual output would split into multiple FCOM override files.
- Provide a "download raw" option (JSON or text). The raw view is not a primary UI path.

## Decision Variables (Documented, Not Final)
### UI Placement
- Option A: Legacy Conversion panel (embedded report + actions).
- Option B: Sidecar view (opens a report panel and links back to MIB/FCOM/PCOM with highlights).
- Option C: Hybrid (Legacy panel summary + link to detailed report view).

### Matching Strategy
- Use multiple strategies and rank confidence:
  1. Exact OID match.
  2. Module + symbolic name match.
  3. Prefix match with heuristic validation.
  4. LLM-assisted inference when ambiguous.
- Each match records a method label (`oid`, `name`, `heuristic`) and a numeric score.
- Matching results should be cached with a short TTL to avoid re-scanning the local COM tree on every conversion.

### Override Application
- Phase 1 will generate overrides but not auto-apply without user action.
- Later phases can include bulk apply, staging, and review flows.

## Phase 1 Pipeline (Detailed)
### Step 1: Ingestion
- User uploads or selects a legacy file set (folder or bundle).
- Identify files by extension:
  - `.rules` for rule logic.
  - `.pl` for lookup/mapping data.
- Build a manifest:
  - File path
  - Type
  - Size
  - Modified timestamp

### Step 2: Parsing (Robust, Pattern-First)
- Run a "multi-pattern" parser with the following layers:
  - **Layer A: Structural pattern detection**
    - Detect function definitions, if/elsif chains, and dispatcher sections.
    - Detect per-rule functions (e.g., `hwNmNorthboundEventTrap()` or `iMAPNorthboundFaultAlarmNotification()`)
  - **Layer B: OID extraction**
    - Recognize `enterprise` comparisons and trap OIDs.
    - Recognize `$trapoid` or `$Event->{HelpKey}` patterns.
  - **Layer C: Varbind mapping**
    - Detect assignment patterns like `my $x = $v1;` to map varbind index to meaning.
  - **Layer D: Event field assignment**
    - Parse `$Event->{Field}` assignments to identify severity, category, summary, etc.
  - **Layer E: Lookup table usage**
    - Detect hash lookups like `%huawei_nce_lookup_*` for severity/category mapping.

### Step 3: Classification (Fault vs Performance)
- A file-level classification, not per-rule.
- Fault signals:
  - `$Event->{Severity}` or `$Event->{EventCategory}` set.
  - Trap function names or notification types.
  - Trap varbind parsing into `$Event` fields.
- Performance signals:
  - OID lists used for metric collection.
  - SNMP polling logic or SNMP library calls.
  - Hashes mapping OIDs to metric definitions.
- If mixed signals appear, classify by dominant signal and flag as "review required".

### Step 4: Extract Legacy Objects
- For fault files:
  - Identify each trap/notification block.
  - Capture:
    - OID / enterprise
    - Rule function name
    - Summary pattern
    - Severity mapping (including lookup table)
- For performance files:
  - Identify each metric OID definition.
  - Capture:
    - OID
    - Metric name
    - Polling or scaling logic

### Step 5: Match Against Known Objects
- Build match candidates from:
  - FCOM objects (fault/notification definitions).
  - PCOM objects (performance definitions).
  - MIB inventory (module + OID + symbolic names).
- Use multiple matching passes:
  1. Exact OID match.
  2. Module+symbolic name if available.
  3. Prefix match (higher risk, lower confidence).
  4. LLM inference if ambiguous.
- Record match confidence and method.
- Record cache stats for the COM index (objects, files, cache hit/miss, age).

### Step 6: Compare and Derive Overrides
- If a legacy object matches an existing FCOM/PCOM object:
  - Compare key fields (severity, category, summary, etc.).
  - Create an override only when values differ.
  - If values match, no override generated.
- If a legacy object has no match:
  - Generate a new "best-effort" FCOM/PCOM skeleton.
  - Mark as "missing in base" and "generated".

### Step 7: Generate Report + Raw Output
- Construct the guidance report (primary UI view).
- Construct the raw combined override output (secondary).
- Provide summary metrics:
  - Total items
  - Matched vs missing
  - Overrides generated
  - Confidence distribution

## AI/LLM Assist (Phase 1 Design)
### Why AI/LLM Helps
- Legacy rule formats vary widely. Pattern-based parsing will fail for edge cases.
- LLM can interpret unstructured Perl logic and infer intent for mapping.

### Strategy
- Use deterministic parsing as the default.
- When patterns are ambiguous or missing, fall back to LLM inference.
- LLM output is always a "proposal" with confidence and evidence.

### Learning / "Training" Over Time
- We can improve with a feedback loop without traditional training:
  - Log parsed structures and user corrections.
  - Build a "conversion memory" dataset (input snippet -> corrected output).
  - Use this dataset for retrieval-augmented prompting (RAG) so the LLM sees similar past cases.
- If a custom model is later desired:
  - Fine-tune on the conversion memory dataset.
  - Include multiple vendor formats and edge cases.
- Incremental learning approach:
  - Step 1: Capture corrections in a structured format.
  - Step 2: Use those corrections as exemplars in LLM prompts.
  - Step 3: Periodically evaluate and expand the pattern parser with new rules.

### LLM Interaction Boundaries
- LLM should not mutate code or commit changes.
- LLM produces a structured conversion proposal for user review.
- LLM output includes confidence scores and explicit reasoning based on evidence.

## Data Model (Phase 1)
### LegacyItem
- id
- sourceFile
- ruleFunction
- legacyType: fault | performance
- oid
- module
- symbolicName
- varbindMap (if available)
- fieldsSet (Event fields or metric fields)
- severityMap (if available)
- summaryPattern

### MatchResult
- legacyItemId
- matchType: exact_oid | module_name | prefix | inferred
- confidence: 0..1
- matchedObjectId (FCOM/PCOM/MIB)
- matchedObjectType: fcom | pcom | mib

### Operational Toggles
- `LEGACY_MATCH_EXISTING`: when set to `false`, skip matching entirely (useful for tests).
- `LEGACY_MATCH_CACHE_TTL_MS`: cache TTL for COM matching index (0 disables expiry).
- `LEGACY_COMS_ROOT`: override the local COMs root path used to open matched files.

### OverrideProposal
- legacyItemId
- targetType: fcom | pcom
- baseObjectId (if any)
- changes: list of field diffs
- generated: true/false

### Report
- totals
- matchSummary
- missingList
- overrides
- confidenceBreakdown
- highlightTargets
- rawOverrideBundle

## Edge Cases to Handle
- No MIBs available for a vendor.
- No FCOM/PCOM objects match.
- Multiple matching objects with similar OIDs.
- Legacy file uses non-standard variable naming.
- Severity values mapped through external lookup table.

## Phase 1 Deliverables
1. Parser and extractor (pattern-based with LLM fallback).
2. Matching engine against FCOM/PCOM/MIB.
3. Override proposal generator.
4. Report generator.
5. Raw combined override output (secondary view).
6. Documentation updates for the UI flow and decision variables.

---

## Phase 2 Focus (Target: 80%+ Practical Conversion Coverage)

The next execution phase should prioritize converting more real-world rule logic with explicit user-triage support.

### 1) Quick action: create FCOM overrides for confirmed findings

- Add a primary action in Legacy workspace: "Create FCOM Overrides (confirmed)".
- Scope only high-confidence matches/proposals first.
- Route generated outputs through the same review/commit safety model used in FCOM override workflows.
- Keep dry-run/report-first as the default; require explicit apply confirmation.

### 2) User-review wizard for flagged items

- Introduce a simple step wizard (or modal flow) that walks unresolved items one-by-one.
- Minimum data per step:
  - Source snippet / rule function context
  - Proposed mapping (if any)
  - Confidence + why
  - Quick choices: accept proposal, edit target mapping, mark skip/defer
- Persist triage outcomes so reruns do not restart from zero.

### 3) Advanced lookup migration track

- Detect and classify lookup-heavy patterns:
  - Perl hash maps
  - External include/load dependencies
  - Conditional branches requiring data normalization
- Convert by pattern families (best-effort, not hardcoded per vendor):
  - direct map/lookup processors
  - preprocessor normalization chains
  - staged enrichment paths when direct conversion is not possible
- Flag when conversion depends on missing external data and require user confirmation.

### 4) Dirty/needs-input catalog

- Add explicit "Needs User Input" category for logic that cannot be safely inferred.
- Typical dirty cases to track:
  - ambiguous object target
  - multi-candidate match collisions
  - unresolved includes/lookups
  - derived values requiring business context
- Export this catalog in report JSON + UI for auditability.

### Success criteria

- Practical conversion coverage goal: **80%+ of legacy logic converted or confidently mapped**.
- Remaining 20% should be explicitly documented as user-triaged, with reason codes and next actions.
- No silent drops: every unresolved or skipped item must appear in report outputs.

## Dual Execution Mode (GUI + Scripted)
### Requirement
The conversion pipeline must be callable from the GUI and from a scripted/CLI entry point that outputs files. Both entry points must use the same core conversion engine to avoid divergent logic.

### Shared Core
- Single conversion engine with:
  - Input manifest builder
  - Parser + extractor
  - Matching engine
  - Override generator
  - Report generator
- GUI and script are thin wrappers that pass inputs and receive structured outputs.

### Script/CLI Mode (Phase 1 Design)
- Accept input path(s):
  - Single file
  - Folder
  - Optional include/exclude patterns
- Output artifacts:
  - Guidance report (JSON and human-readable text)
  - Raw combined override bundle
  - Optional per-file breakdowns
- Output directory:
  - Provided by user or defaults to `./legacy-conversion-output/<timestamp>`
- Logs:
  - Console summary
  - Detailed log file with parse/match evidence

### GUI Mode (Phase 1 Design)
- Upload or select files in the Legacy Conversion panel.
- GUI uses the same core engine and displays:
  - Summary
  - Match matrix
  - Missing/mismatch lists
  - Raw combined overrides (secondary)
- GUI provides a "Download output" option that mirrors the CLI artifacts.

### Parameter Mapping (GUI <-> Script)
- Selected files/folders in GUI map directly to CLI input paths.
- GUI toggles map to CLI flags:
  - Use MIB matching
  - Use LLM assist
  - Output raw overrides
- CLI output directory maps to GUI download bundle.

### Exit Codes (Scripted)
- 0: Success (conversion completed)
- 1: Parse error (no usable legacy objects)
- 2: Match error (engine error or missing indices)
- 3: Output write error

### Notes
- The script mode does not apply overrides by default.
- Both modes must preserve the same report schema and override schema.

## Local Upload Storage (GUI Requirement)
### Requirement
The GUI must allow users to upload legacy files from their local machine. The system cannot assume files already exist on the server. Uploaded files must land in a local server directory that the UI can read back for review and comparison.

### Default Storage Path
- Default upload root: `rules/legacy/uploads` (relative to repo root).
- This path is ignored in git to avoid committing customer data.
- The upload root can be overridden via environment configuration (future).

### GUI Behavior
- Provide a file picker that uploads files to the server upload root.
- Show the upload root path in the UI so users know where files land.
- List uploaded files and allow the user to preview raw content.
- Use uploaded files as inputs to the conversion pipeline.

### Script/CLI Behavior
- CLI can also target the upload root or any other path.
- GUI and CLI must both operate on the same folder format and file conventions.

### Security and Safety
- Restrict uploads to expected file extensions (`.rules`, `.pl`, `base.*`).
- Prevent path traversal (no `../` in upload subpaths).
- Enforce file size limits at upload time.

### CLI Flag Names (Phase 1 Proposal)
- `--input` (repeatable): Path to a file or folder of legacy rules.
- `--include`: Glob filter for included files (default: `*.rules,*.pl,base.*`).
- `--exclude`: Glob filter for excluded files.
- `--output-dir`: Output directory for artifacts.
- `--vendor`: Optional vendor label override.
- `--use-mibs`: Enable MIB matching (default: on).
- `--no-mibs`: Disable MIB matching.
- `--use-llm`: Enable LLM assist (default: off in phase 1).
- `--no-llm`: Disable LLM assist.
- `--report-format`: `json` | `text` | `both` (default: `both`).
- `--raw-overrides`: Emit combined raw override bundle (default: on).
- `--no-raw-overrides`: Disable raw bundle output.
- `--emit-per-file`: Emit per-file breakdown reports.
- `--log-level`: `info` | `debug` | `warn` | `error` (default: `info`).
- `--max-llm-requests`: Cap LLM usage per run.
- `--dry-run`: Parse and report only; no override files written.

### Sample CLI Invocations
```bash
# Convert a vendor folder and emit both report formats + raw overrides
npm run legacy:convert -- \
  --input ./rules/legacy/NCE \
  --output-dir ./legacy-conversion-output/NCE-$(date +%Y%m%d-%H%M%S) \
  --report-format both \
  --raw-overrides \
  --emit-per-file

# Convert a single file with MIB matching disabled and LLM assist enabled
npm run legacy:convert -- \
  --input ./rules/legacy/NCE/Huawei_NCE_iMAPNorthboundFaultAlarmNotification.rules \
  --output-dir ./legacy-conversion-output/NCE-single \
  --no-mibs \
  --use-llm

# Convert multiple inputs with filters and debug logging
npm run legacy:convert -- \
  --input ./rules/legacy/NCE \
  --input ./rules/legacy/NCE_Campus \
  --include "*.rules" \
  --exclude "*EventKey*" \
  --output-dir ./legacy-conversion-output/batch \
  --log-level debug
```

## Phase 1 UI Wireflow (Text-Only)
### Entry: Legacy Conversion Panel
- Entry point: "Legacy Conversion" tab.
- Panel layout:
  - Top: Upload / Select legacy rule bundle.
  - Middle: Conversion status and summary.
  - Bottom: Report preview and actions.

### Step A: Upload / Select
- User selects a file or a folder of legacy rule files.
- UI displays:
  - Total files discovered.
  - File types (rules/pl/includes).
  - Detected vendor label (heuristic from filenames or folder name).

### Step B: Parse + Classify
- UI shows a progress indicator:
  - "Parsing rules" (structural extraction).
  - "Extracting OIDs".
  - "Classifying type" (fault or performance).
  - "Matching against FCOM/PCOM".
  - "Matching against MIBs".
- Output is a per-file classification card:
  - File name
  - Type (fault/perf)
  - Confidence indicator
  - Evidence snippets (Event fields or SNMP logic highlights)

### Step C: Report View (Primary)
- Summary header:
  - Total legacy objects
  - Matches in FCOM/PCOM
  - Matches in MIB
  - Missing objects
- Report sections:
  - Matching matrix (sortable table)
  - Missing objects list
  - Mismatch list (field diffs)
  - Proposed override count
- Actions:
  - "Generate override draft" (default action)
  - "Review details" (expands mismatches)
  - "Highlight in MIB" (if available)

### Step D: Raw Combined Override View (Secondary)
- Hidden toggle: "Advanced" or "Raw".
- Shows:
  - Combined override draft in a read-only raw view
  - Diff-like sections (legacy -> base -> override)
- Includes:
  - "Download raw" option
  - "Copy raw" option

### Optional Sidecar View (Decision Variable)
- Alternative to Step C: open a side panel or new view with the full report.
- Includes quick links back to:
  - MIB browser (highlight OIDs)
  - FCOM/PCOM object lists (matching object selection)

## Phase 1 Backlog Checklist (Detailed)
### Parser + Extraction
- Implement file ingestion and manifest builder for folder or file upload.
- Implement parser layers A-E (structural, OID, varbind, Event fields, lookup tables).
- Implement rule-function discovery and dispatcher matching.
- Implement extracted object model normalization for fault and perf.
- Implement per-file type classification with evidence capture.

### Matching Engine
- Build FCOM/PCOM object index by OID and name.
- Build MIB index by module + OID + symbolic name.
- Implement multi-pass matching with confidence scoring.
- Log match method per item and store evidence.

### Override Proposal
- Implement diff logic between legacy-derived values and base objects.
- Generate override proposal only for mismatches.
- Generate skeleton objects for missing base support.
- Assign override grouping rules (even if raw combined view is single).

### Reporting + UI
- Build summary metrics block.
- Build matching matrix table with filtering.
- Build missing object list with object details.
- Build mismatch list with field-level diffs.
- Add "Highlight in MIB" list output (if MIBs available).
- Add raw combined override view toggle.
- Add raw combined override download button.

### LLM Assist (Phase 1)
- Define LLM prompt templates for ambiguous parsing.
- Define structured output schema for LLM proposals.
- Implement fallback mechanism when parser confidence is low.
- Capture user corrections as structured training data.

### Documentation
- Keep Phase 1 doc updated as implementation progresses.
- Document all decision variables and final choices.
- Capture feedback from early conversions and refine parsing rules.

## AI Assist Appendix (Expanded)
### Goals
- Improve conversion robustness in the face of unknown formats.
- Reduce manual review burden while keeping user validation in control.
- Learn from each conversion without blocking progress.

### Strategy: Deterministic First, LLM Second
- Parse with deterministic rules whenever possible.
- If extraction fails or confidence drops below a threshold, trigger LLM.
- LLM output is always tagged with:
  - Confidence score
  - Evidence snippets (source lines)
  - Proposed mappings and fields

### Feedback Loop (Learning Without Fine-Tuning)
- Capture:
  - Legacy snippet
  - Parser extraction
  - User corrections
- Store in a "conversion memory" dataset.
- Use retrieval to supply similar past examples to the LLM.

### Optional Fine-Tuning Path (Future)
- Aggregate conversion memory into a training corpus.
- Train a domain-specific model that maps Perl rules to normalized objects.
- Validate against a curated test set before use in production.

### Safety and Control
- User review is required before any override is applied.
- LLM outputs are never applied directly without user confirmation.
- Confidence thresholds determine when LLM output is shown vs suppressed.

### Evidence-First Output
- Every LLM suggestion must include:
  - The exact source snippet used.
  - The derived mapping and reasoning.
  - A direct link to the legacy file for review.

### Metrics to Track
- Parse success rate (deterministic).
- LLM assist rate (fallback usage).
- User acceptance rate of LLM suggestions.
- Override acceptance rate.
- Conversion coverage per vendor.

## Open Questions (Track)
- UI location choice for the report.
- How to highlight missing objects in the MIB browser (deep link or selection list).
- Whether to permit bulk-apply overrides in Phase 2.
- File upload UX vs direct selection from repo.

## Notes (from User Feedback)
- The conversion must be smart and generalized.
- The rules are the standard; MIBs are supportive.
- Fault vs performance can be inferred from Event fields vs SNMP metric patterns.
- One file equals one type (fault or performance).
- Raw override output is an advanced-only path.
- All decisions and variables must be documented at each phase.
