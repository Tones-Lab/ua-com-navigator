# Legacy Rule Conversion MCP Review Checklist (v1)

Use this checklist during joint review between Navigator and UA Assistant teams.

## Linked Reference

- Contract draft: [architecture/legacy-rule-conversion-mcp-contract-draft.md](architecture/legacy-rule-conversion-mcp-contract-draft.md)

## Review Meeting Goals

- Confirm final tool name and ownership.
- Confirm v1 input schema and required fields.
- Confirm v1 output schema and score semantics.
- Confirm MCP exposure and validation behavior.
- Confirm rollout plan and sign-off criteria.

## Sign-Off Checklist

### 1) Tool Registration and Discovery

- [ ] Tool appears in MCP tools/list.
- [ ] Name is exactly legacy-rule-conversion.
- [ ] Description clearly states scoring-only scope.
- [ ] Tool metadata marks readOnly true.
- [ ] Domain/cost annotations are agreed.

### 2) Input Contract Validation

- [ ] schema_version is required and set to 1.0.
- [ ] task is required.
- [ ] expectations object is required with scoring and strictness.
- [ ] item object is required with all required fields.
- [ ] Unknown keys are rejected deterministically.
- [ ] Invalid enum/type values return clear validation errors.

### 3) Output Contract Validation

- [ ] Success response includes status=success.
- [ ] Success response includes top-level numeric score.
- [ ] Success response includes rationale.
- [ ] Error response includes status=error.
- [ ] Error response includes error_code, message, retryable.
- [ ] schema_version is echoed in responses.

### 4) Score Calibration and Thresholds

- [ ] Team agrees on score range (0..1 primary; 0..100 optional raw).
- [ ] Team agrees on confidence thresholds.
- [ ] Team agrees on how ambiguous/partial evidence is penalized.
- [ ] Team agrees on minimum rationale quality.

### 5) MCP Invocation Compatibility

- [ ] tools/call works with object arguments payload.
- [ ] Session behavior is understood (if session_id omitted).
- [ ] Response content is parseable by external callers.
- [ ] Tool returns consistent shape across repeated calls.

### 6) Navigator Compatibility Gate

- [ ] Navigator can ingest returned score without parser changes.
- [ ] Top-level score path is always populated on success.
- [ ] Failure cases are non-fatal to conversion flow.
- [ ] Timeout behavior is documented and tested.

### 7) Security and Operations

- [ ] MCP access control approach is confirmed.
- [ ] Logging/redaction policy for source snippets is confirmed.
- [ ] Rate limiting or concurrency guardrails are defined.
- [ ] Observability fields (request_id/session_id) are agreed.

### 8) Test Set and Acceptance

- [ ] Joint test set selected (minimum 10 representative stubs).
- [ ] At least one direct, conditional, and manual-like item included.
- [ ] Expected score directionality reviewed by both teams.
- [ ] Final go/no-go gate approved.

## Decision Log (Fill During Review)

- Decision owner:
- Date:
- Final tool name:
- Accepted schema version:
- Required output fields:
- Score scale and thresholds:
- Timeout and retry policy:
- Open issues:
- Follow-up owners and due dates:

## Post-Review Outcome States

- Approved for implementation
- Approved with minor edits
- Needs rework before approval

## Suggested Immediate Follow-Up After Review

- Publish v1 final contract document.
- Create one shared test fixture file for repeatable validation.
- Run a small shadow batch and compare against human review outcomes.
- Lock a v1.1 backlog for non-blocking enhancements.
