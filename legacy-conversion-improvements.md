# Legacy Conversion Process: Analysis and Improvement Plan

This document analyzes the current legacy rule conversion process and proposes a phased plan to improve generated override confidence to **80%+** while reducing manual review cost.

## 1. Deep Dive Analysis

The converter transforms procedural Perl rules into declarative FCOM JSON. The architecture is strong, but confidence drops when the source logic is branch-heavy, scope-heavy, or regex-heavy.

### 1.1 Legacy Rule Structure

- **Source Location:** `rules/legacy/`
- **Core Technology:** Procedural Perl scripts.
- **Execution Flow:** `base.rules`, `base.load`, `base.includes` work as an orchestrated mini-application.
  - `base.includes`: maps symbolic names to files.
  - `base.load`: loads dependencies and lookup tables.
  - `base.rules`: dispatches by trap/OID characteristics.
- **Complexity Drivers:** global state (`$Event`, `$enterprise`), branch-heavy control flow, regex extraction, and direct event mutations.

### 1.2 FCOM Target Format

- **Schema:** `com-management/backend/schema/fcom.schema.json`
- **Paradigm Shift:** procedural “how” to declarative “what”.
- **Critical Features:**
  - `preProcessors` for structured transforms (`regex`, `lookup`, `conversion`, etc.).
  - `eval` as an escape hatch for hard-to-normalize logic.

### 1.3 Current Converter Strengths and Gaps

**Strengths**
- Traversal/discovery of dependencies and execution order is solid.
- Stub classes (`direct`, `conditional`, `manual`) are useful and operationally meaningful.
- Optional LLM support is a useful acceleration path for difficult stubs.

**Gaps**
- **Variable lineage/scoping:** local (`my`) vs global tracking remains the top source of ambiguity.
- **Expression coverage:** complex expressions, branch-specific assignments, and regex-chain flows still degrade output quality.
- **Input quality gate:** conversion is mostly reactive; low-quality source code directly causes lower-confidence output.

## 2. Success Criteria and Metrics

To avoid “confidence theater,” each phase must improve measurable outcomes.

### 2.1 Program-Level Targets

- **Target confidence:** ≥ 80% median confidence for proposed overrides.
- **Manual burden:** reduce `manual` stubs by 40% from baseline.
- **Reviewer throughput:** reduce review minutes per object by 30%.
- **Quality gate:** zero high-severity semantic violations in promoted bundles.

### 2.2 Core Tracking Metrics

- Conversion quality: `% direct`, `% conditional`, `% manual`
- Mapping quality: unresolved variable mappings per file/object
- Validation quality: semantic violations per run
- Curation efficiency: decision latency per queue item, edits per accepted item
- Conflict quality: match-diff conflict rate against certified FCOM objects

## 3. Proposed Work Plan (Phased)

### Phase 1: Pre-Conversion Analysis (Linter)

**Objective:** improve source quality before conversion.

**Work Items**
1. Build a dedicated legacy linter module.
2. Start with high-signal rules:
   - unused variables,
   - overly complex regex,
   - repeated/multi-step reassignment patterns.
3. Integrate as converter pre-flight (`--lint`) with severity summaries.

**Exit Criteria**
- Linter runs in CI/dev mode.
- Findings linked to file/line.
- Noise rate is acceptable for adoption (few false positives).

### Phase 2: Conversion Logic Enhancement

**Objective:** increase `direct` + high-confidence `conditional` outputs.

**Work Items**
1. Implement true scope-aware lineage (global + function + branch contexts).
2. Expand expression resolver incrementally (concats, branch assignments, regex-capture chains).
3. Improve `manual` stub assist path with stricter LLM guardrails:
   - deterministic prompting,
   - no silent auto-apply,
   - full provenance in notes.

**Exit Criteria**
- Statistically significant drop in unresolved mappings.
- Manual stub rate drops from baseline.

### Phase 3: Post-Conversion Validation and Confidence Model

**Objective:** ensure logical correctness and trustworthy confidence scoring.

**Work Items**
1. Add semantic validator (domain checks, contradiction detection).
2. Integrate match-diff conflicts as first-class confidence penalties.
3. Refactor confidence into weighted signals:
   - source hygiene,
   - conversion completeness,
   - semantic validation,
   - conflict risk,
   - manual/heuristic usage.

**Exit Criteria**
- Confidence score correlates with reviewer acceptance.
- Confidence and merge-readiness are reported separately.

### Phase 4: Curation UX Improvements (Per-File First)

**Objective:** reduce review cognitive load and increase review quality.

**Work Items**
1. **Per-file review queue** as default mode (review grouped by source file).
2. **Line-aware source panel** with stable line numbers and scroll-to-line behavior.
3. **Bi-directional field linking**:
   - selecting a queue item highlights source line range,
   - selecting source assignment highlights target field/proposal.
4. **Branch context cards** (condition + line span + related fields).
5. **Interactive conditional resolution** with in-scope variable suggestions.

**Exit Criteria**
- Review time per item declines.
- Fewer back-and-forth context switches.
- Higher first-pass accept/edit quality.

### Phase 5: Rollout Controls and Safety

**Objective:** ship improvements safely and reversibly.

**Work Items**
1. Feature flags for major behavior changes.
2. Shadow mode before default-on behavior.
3. Rollback criteria and runbook for regressions.

**Exit Criteria**
- New flow can be toggled without production risk.
- Measured deltas validate promotion readiness.

## 4. Recommended Execution Order

If capacity is constrained:

1. **Phase 2 + Phase 3 first** (largest confidence quality impact)
2. **Phase 4 next** (largest reviewer productivity impact)
3. **Phase 1 and Phase 5 in parallel where feasible** (quality and safety hardening)

## 5. Specific Notes on Per-File Review and Line Numbering

This is the right direction and should become the default review experience.

- **Per-file grouping** aligns with how analysts reason about legacy logic.
- **Line numbers are essential**, not optional, for confidence and reviewer communication.
- Source highlighting should support:
  - single-line assignment,
  - multi-line expression spans,
  - branch range highlights.
- Queue ordering should be:
  - file order,
  - then source line,
  - then risk score.

Net effect: less context switching, faster triage, and better decision quality.

## 6. Implementation Checklist (Mapped to Current Codebase)

This checklist translates the plan into small, safe increments tied to existing files.

### 6.1 Baseline and Instrumentation (Do First)

**Goal:** establish measurable baseline before behavior changes.

**Primary touchpoints**
- `com-management/backend/scripts/legacy_convert.ts`
- `com-management/backend/src/routes/legacy.ts`
- `com-management/frontend/src/features/legacy/LegacyWorkspace.tsx`

**Checklist**
- [ ] Capture baseline metrics per run (`direct/conditional/manual`, unresolved mappings, conflict rate).
- [ ] Record review timing metrics in UI (queue load to decision latency).
- [ ] Persist baseline snapshot for before/after comparison.

**Acceptance**
- [ ] Baseline report available for at least one representative ruleset.

### 6.2 Phase 1 Delivery: Linter as Pre-Flight

**Goal:** raise source quality before conversion.

**Primary touchpoints**
- `com-management/backend/src/services/legacy/legacy_linter.ts`
- `com-management/backend/scripts/legacy_convert.ts`

**Checklist**
- [ ] Enforce line-aware findings (`file`, `line`, `severity`, `message`).
- [ ] Keep first rule set small/high-signal (avoid noisy lint adoption).
- [ ] Expose summary in conversion output/report payload.

**Acceptance**
- [ ] Linter output is stable and actionable on a representative ruleset.
- [ ] False-positive rate is acceptable for default use.

### 6.3 Phase 2 Delivery: Conversion Quality Improvements

**Goal:** reduce manual stubs and unresolved mappings.

**Primary touchpoints**
- `com-management/backend/src/services/legacy/legacyConversion.ts`
- `com-management/backend/src/services/legacy/reviewQueue.ts`
- `com-management/backend/src/services/legacy/index.ts`

**Checklist**
- [ ] Harden scope-aware variable lineage (global/function/branch contexts).
- [ ] Expand expression resolver incrementally (concat → branch assignment → regex chain).
- [ ] Track why each fallback happened (structured root-cause tags).

**Acceptance**
- [ ] Manual stub percentage drops vs baseline.
- [ ] Unresolved mapping count drops vs baseline.

### 6.4 Phase 3 Delivery: Semantic Validation + Confidence Model

**Goal:** confidence score reflects real review risk.

**Primary touchpoints**
- `com-management/backend/src/services/legacy/reviewQueue.ts`
- `com-management/backend/src/routes/legacy.ts`
- `com-management/backend/src/services/legacy/legacyConversion.ts`

**Checklist**
- [ ] Add semantic validator pass after conversion.
- [ ] Integrate match-diff conflicts into confidence penalties.
- [ ] Emit separate fields for `confidenceScore` and `mergeReadiness`.

**Acceptance**
- [ ] Confidence ranking aligns with reviewer outcomes on sampled runs.
- [ ] High-confidence items show low reviewer edit/reject rates.

### 6.5 Phase 4 Delivery: Per-File, Line-Aware Review UX

**Goal:** make manual review faster and less error-prone.

**Primary touchpoints**
- `com-management/frontend/src/features/legacy/LegacyWorkspace.tsx`
- `com-management/frontend/src/features/legacy/components/LegacySuggestedReviewPanel.tsx`
- `com-management/frontend/src/features/legacy/components/LegacyReportPreviewPanel.tsx`
- `com-management/frontend/src/features/legacy/components/LegacyConfidenceWorkflowPanel.tsx`
- `com-management/frontend/src/features/legacy/legacySuggestedUtils.ts`
- `com-management/frontend/src/types/api.ts`
- `com-management/frontend/src/services/api.ts`

**Checklist**
- [ ] Default queue mode is grouped by source file.
- [ ] Source panel shows stable line numbers.
- [ ] Selecting queue item scrolls/highlights exact source line/range.
- [ ] Selecting source assignment highlights corresponding target field/proposal.
- [ ] Queue sort order: source file → mapped line number → risk score.

**Acceptance**
- [ ] Reviewer can resolve all items for one file without leaving file context.
- [ ] Measured decision latency drops vs baseline.

### 6.6 Phase 5 Delivery: Rollout and Safety

**Goal:** launch safely with clear rollback paths.

**Primary touchpoints**
- `com-management/backend/src/routes/legacy.ts`
- `com-management/frontend/src/App.tsx`
- runtime configuration and feature-flag wiring

**Checklist**
- [ ] Feature flags for new scoring and per-file review mode.
- [ ] Shadow mode outputs old/new scores side-by-side.
- [ ] Rollback criteria documented and tested.

**Acceptance**
- [ ] New flow can be disabled quickly without data loss.

## 7. Next Iteration Plan (Immediate)

For the next implementation cycle, execute in this order:

1. Baseline instrumentation (6.1)
2. Per-file queue + line numbers + source highlighting MVP (6.5 first three checklist items)
3. Scope-aware lineage hardening (6.3 first checklist item)
4. Confidence/merge-readiness split (6.4 third checklist item)

This order gives immediate reviewer UX wins while protecting long-term confidence quality.

## 8. Execution Risks, Controls, and Governance

To keep quality high while introducing LLM-assisted workflows, these controls are required.

### 8.1 Gold Dataset and Replayability

- Maintain a fixed benchmark corpus (legacy inputs + expected conversion artifacts).
- Version benchmark sets and retain run metadata (`run_id`, prompt version, index/corpus version, evaluator).
- Require deterministic replay artifacts for every release candidate.

### 8.2 Reviewer Consistency and Decision Policy

- Define explicit reviewer decision policy (`accepted`, `edited`, `deferred`, `rejected`).
- Enforce a shared rubric so reviewer outcomes are comparable.
- Track reviewer disagreement rate and calibrate policy when drift appears.

### 8.3 LLM Safety and Non-Negotiable Guardrails

- LLM outputs are advisory unless explicitly approved by a human reviewer.
- No silent auto-apply of LLM-generated processor payloads.
- Preserve provenance: source references, rationale, confidence, and uncertainty statement.
- Treat schema invention and fabricated citations as hard-fail conditions.

### 8.4 Operational Guardrails

- Define latency/token budgets for conversion + review assistance.
- Define ownership for regression triage and weekly quality review.
- Require rollback criteria before enabling expanded autonomy.

## 9. UA Assistant Chatbot Integration Scope

This section defines integration requirements for calling the existing UA Assistant chatbot from this system. Scope is integration-only, not a native chatbot implementation inside this application.

### 9.0 Grounded Acceptance Contract (Non-Negotiable)

- **Integration scope only:** this application calls UA Assistant APIs/services; it does not implement an in-app/native chatbot runtime.
- **Non-goals:** no inline chat canvas, no local chatbot orchestration layer, no independent retrieval stack that bypasses UA Assistant.
- **Scope locked:** assistant is advisory-only (no auto-write of COM), deterministic pipeline runs first, LLM runs second.
- **Sources locked:** only indexed documentation + COM corpus are primary sources (legacy corpus may be secondary); no open-web retrieval.
- **Evidence required:** each substantive recommendation cites at least one documentation chunk and one COM artifact when available.
- **Output contract:** each suggestion is labeled `grounded` or `heuristic`; heuristic suggestions include explicit caution text.
- **Fail-safe behavior:** if retrieval confidence is low or sources conflict, return `insufficient evidence` plus best next checks.

### 9.0.1 Integration Boundary and Ownership

- **UA Assistant owns:** retrieval, reranking, grounding logic, response synthesis, and citation packaging.
- **Navigator owns:** request shaping, context packaging, response rendering, human decision workflow, and audit persistence.
- **Contract first:** integration is versioned via UA Assistant request/response schemas with backward-compatibility rules.

### 9.1 Retrieval Design

- Configure UA Assistant retrieval profiles across:
  - approved documentation set,
  - COM outputs/templates (`coms`),
  - legacy source rules (`rules/legacy`) as optional secondary context.
- Require retrieval metadata in UA Assistant responses: method, domain, vendor, OID/object, source file/path, function, line range, corpus type, index timestamp.
- Track cross-corpus retrieval coverage (`docs`, `com`, `both`) and rerank scores from UA Assistant output.

### 9.1.1 Index Readiness Gates (Before Rollout)

- **Coverage:** 100% of approved documentation and active COM directories indexed.
- **Metadata quality:** each chunk/object includes required metadata fields for filtering and audits.
- **Freshness:** re-index SLA is defined (daily or on merge) and exposed in UI/API.
- **Traceability:** responses include source IDs/paths and chunk hashes for deterministic replay.

### 9.2 Output Contract

- UA Assistant outputs consumed by Navigator must align with FCOM schema and converter constraints.
- Integration responses should include:
  - proposed processor structure,
  - supporting evidence paths,
  - explicit uncertainty when confidence is limited,
  - any required mappings unresolved by automation.
- UA Assistant response payload should carry:
  - `recommendationType` (`grounded` | `heuristic`),
  - `evidenceSet` (doc/com citations),
  - `confidenceBand` (`high` | `medium` | `low`),
  - `fallbackReason` when `insufficient evidence` is returned.

### 9.2.1 Integration Reliability Requirements

- Define timeout/retry/circuit-breaker policy for UA Assistant calls.
- On UA Assistant timeout/error, fallback to deterministic-only review output with `needs manual review` marker.
- Log request/response correlation IDs for traceability across systems.

### 9.3 Evaluation Scorecard (Grounded COM Assistant)

#### Run Metadata

- `run_id`, date, model, index versions (docs/com), corpus freshness, prompt version, evaluator.

#### Task Metadata

- scenario type (`legacy-help`, `com-validation`, `processor-guidance`),
- complexity (`low`/`med`/`high`),
- expected artifacts.

#### Per-Case Scoring Fields

- **Retrieval quality:** `Recall@5`, `Recall@10`, top-hit relevance (1–5), cross-corpus coverage.
- **Grounding quality:** citation coverage %, unsupported-claim count, contradiction count, evidence-path correctness (0/1).
- **Answer quality:** technical correctness (1–5), actionability (1–5), completeness (1–5), ambiguity handling (1–5).
- **Safety/discipline:** schema invention (0/1 fail), fabricated field/operator (0/1 fail), explicit uncertainty when needed (0/1).

#### Required Quality Gates (Pre-Go-Live)

- **Gold set built:** real user tasks for conversion help and final COM validation.
- **Recall gate:** top-k retrieval contains at least one truly relevant source at agreed target rate.
- **Grounding gate:** substantive claims meet citation coverage target.
- **Contradiction gate:** contradiction/hallucination rate against source artifacts remains below threshold.
- **Human review gate:** SME usefulness/accuracy pass rate meets target.

#### Weighted Case Score

- Formula: `0.30*retrieval + 0.35*grounding + 0.25*answer + 0.10*discipline`.
- Hard-fail overrides (automatic case fail):
  - any schema invention,
  - any fabricated citation,
  - contradiction count above threshold.

#### Weekly Release Gates

- `Recall@10 >= 0.90`
- citation coverage `>= 0.95`
- contradiction rate `<= 0.03`
- SME pass rate `>= 0.90`
- Cost gate: median tokens/request and p95 latency within budget.

#### Runtime Guardrails

- **Cost controls:** token budget caps, max retrieved chunks, max LLM turns per request.
- **Priority order:** deterministic findings first, retrieved artifacts second, LLM synthesis third.
- **Risk controls:** unknown fields/processors are flagged and never fabricated.
- **Observability:** log query, retrieval set, rerank scores, final citations, and reviewer/user feedback outcome.

If any gate fails, keep assistant in advisory-limited + deterministic-first mode.

### 9.4 Go/No-Go Decision Policy

- **Go:** only if all four pass: index readiness, retrieval quality, grounding quality, and SME review.
- **No-Go:** if any fail, keep deterministic-first mode active and expose `needs manual review` pathways.

#### Dashboard Metrics (Track Weekly)

- **Quality:** pass rate, grounded-vs-heuristic ratio, unsupported claims/case, contradiction trend.
- **Ops:** p50/p95 latency, token cost/case, retrieval hit-rate by corpus.
- **Product:** user acceptance, rework rate after suggestions, escalation-to-manual rate.

## 10. Immediate Additions to Current Plan

To align the legacy conversion roadmap with UA Assistant integration, add these immediate tasks:

1. Add benchmark corpus and scoring harness ownership to Phase 1/Phase 3.
2. Add run metadata capture to pipeline outputs and review queue exports.
3. Add weekly release gate review as a standing checkpoint before enabling broader automation.
4. Add hard-fail safety checks to CI for schema invention/fabricated evidence indicators.
5. Add explicit output labels (`grounded`/`heuristic`) and fail-safe response behavior (`insufficient evidence`).
6. Add index readiness checks (coverage/metadata/freshness/traceability) to release checklist.
7. Add UA Assistant integration contract document (versioned request/response schema + ownership boundaries).
8. Add runtime fallback policy for UA Assistant unavailability (deterministic-only + manual-review path).
