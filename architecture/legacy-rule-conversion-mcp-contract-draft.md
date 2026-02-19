# Legacy Rule Conversion Review Tool — MCP Contract Draft (v1)

## Purpose

This document defines a **first-pass contract** for a UA Assistant tool that scores legacy-to-FCOM conversion proposals.
It is intended as a handoff baseline for the UA Assistant team and Navigator team to refine together.

## Scope and Assumptions

- Tool is exposed via UA Assistant MCP service (`/mcp`) and appears in `tools/list`.
- Tool is **read-only** from MCP perspective (analysis + scoring only; no config writes).
- Navigator currently calls a UA endpoint with:
  - `tool`: tool name
  - `input`: structured object
- Navigator currently extracts score from response and supports multiple paths, but prefers a **top-level numeric score**.

## Canonical Tool Name

- `legacy-rule-conversion`

## MCP Exposure Model

### `tools/list` expectation

Tool entry should include:

- `name`: `legacy-rule-conversion`
- `description`: scoring and rationale for conversion candidate quality
- `inputSchema`: JSON schema object (below)
- `annotations`:
  - `readOnly: true`
  - `domain: "legacy_conversion"`
  - `costClass: "medium"`

### `tools/call` expectation

UA Assistant should accept standard MCP JSON-RPC `tools/call` with object arguments.

## Input Contract (Tool Arguments)

### JSON Schema (v1)

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "schema_version": {
      "type": "string",
      "enum": ["1.0"],
      "description": "Contract version for deterministic validation and future migration."
    },
    "task": {
      "type": "string",
      "description": "Human-readable objective for the reviewer model."
    },
    "expectations": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "scoring": { "type": "string" },
        "strictness": { "type": "string" }
      },
      "required": ["scoring", "strictness"]
    },
    "item": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "sourceFile": { "type": "string" },
        "ruleFunction": { "type": "string" },
        "objectName": { "type": "string" },
        "targetField": { "type": "string" },
        "expression": { "type": "string" },
        "status": { "type": "string" },
        "requiredMappings": {
          "type": "array",
          "items": { "type": "string" }
        },
        "suggestedProcessor": { "type": "string" },
        "suggestedTemplate": {
          "type": ["object", "null"]
        },
        "sourceSnippet": {
          "type": ["string", "null"]
        }
      },
      "required": [
        "sourceFile",
        "ruleFunction",
        "objectName",
        "targetField",
        "expression",
        "status",
        "requiredMappings",
        "suggestedProcessor"
      ]
    },
    "trace": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "request_id": { "type": "string" },
        "session_id": { "type": "string" },
        "caller": { "type": "string" }
      },
      "required": []
    }
  },
  "required": ["schema_version", "task", "expectations", "item"]
}
```

## Output Contract (Tool Result)

### Required fields

```json
{
  "status": "success",
  "score": 0.87,
  "rationale": "Short reason for confidence level.",
  "tool": "legacy-rule-conversion",
  "schema_version": "1.0"
}
```

### Optional fields

```json
{
  "confidenceScore": 0.87,
  "checks": [
    {
      "name": "semantic_equivalence",
      "passed": true,
      "detail": "Condition and assignment behavior preserved."
    },
    {
      "name": "required_mappings_present",
      "passed": true,
      "detail": "All mappings resolved in proposal."
    }
  ],
  "normalized": {
    "scale": "0..1",
    "raw": 87,
    "raw_scale": "0..100"
  },
  "warnings": [
    "Regex edge case may need human confirmation."
  ],
  "timing_ms": 412
}
```

### Error result

```json
{
  "status": "error",
  "error_code": "VALIDATION_ERROR",
  "message": "Missing required field: item.targetField",
  "retryable": false,
  "tool": "legacy-rule-conversion",
  "schema_version": "1.0"
}
```

## Score Semantics

- Preferred range: `0.0` to `1.0`.
- Acceptable alternate range: `0` to `100` (Navigator will normalize).
- Suggested confidence buckets:
  - `high`: `>= 0.80`
  - `medium`: `>= 0.55` and `< 0.80`
  - `low`: `< 0.55`

## Request/Response Examples

### A) Navigator direct call body (current integration style)

```json
{
  "tool": "legacy-rule-conversion",
  "input": {
    "schema_version": "1.0",
    "task": "Validate legacy rule conversion proposal against documented standards and source code intent.",
    "expectations": {
      "scoring": "Return confidence score between 0 and 1 where higher is better.",
      "strictness": "Penalize undocumented or semantically inconsistent conversions."
    },
    "item": {
      "sourceFile": "rules/legacy/sample.rules",
      "ruleFunction": "processTrap_123",
      "objectName": "ifOperStatus",
      "targetField": "event.severity",
      "expression": "$Event->{Severity} = 4 if $ifAdmin eq 'down';",
      "status": "conditional",
      "requiredMappings": ["Severity", "ifAdmin"],
      "suggestedProcessor": "if",
      "suggestedTemplate": {
        "type": "if",
        "conditions": ["ifAdmin == 'down'"],
        "then": { "set": { "event.severity": 4 } }
      },
      "sourceSnippet": "if ($ifAdmin eq 'down') { $Event->{Severity} = 4; }"
    },
    "trace": {
      "request_id": "legacy-req-001",
      "caller": "navigator-backend"
    }
  }
}
```

### B) MCP `tools/call` example

```json
{
  "jsonrpc": "2.0",
  "id": "17",
  "method": "tools/call",
  "params": {
    "name": "legacy-rule-conversion",
    "arguments": {
      "schema_version": "1.0",
      "task": "Validate legacy rule conversion proposal against documented standards and source code intent.",
      "expectations": {
        "scoring": "Return confidence score between 0 and 1 where higher is better.",
        "strictness": "Penalize undocumented or semantically inconsistent conversions."
      },
      "item": {
        "sourceFile": "rules/legacy/sample.rules",
        "ruleFunction": "processTrap_123",
        "objectName": "ifOperStatus",
        "targetField": "event.severity",
        "expression": "$Event->{Severity} = 4 if $ifAdmin eq 'down';",
        "status": "conditional",
        "requiredMappings": ["Severity", "ifAdmin"],
        "suggestedProcessor": "if",
        "suggestedTemplate": null,
        "sourceSnippet": "if ($ifAdmin eq 'down') { $Event->{Severity} = 4; }"
      }
    }
  }
}
```

### C) MCP tool result payload

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"status\":\"success\",\"score\":0.87,\"rationale\":\"Conversion preserves branch intent and field mapping.\",\"tool\":\"legacy-rule-conversion\",\"schema_version\":\"1.0\"}"
    }
  ],
  "isError": false,
  "metadata": {
    "tool": "legacy-rule-conversion",
    "status": "success"
  }
}
```

## Validation Rules (Recommended)

- Reject unknown top-level keys (`additionalProperties: false`) for deterministic behavior.
- Reject missing required fields with `VALIDATION_ERROR`.
- Reject invalid enum values with `VALIDATION_ERROR`.
- If model output cannot produce score, return `status=error` with `MODEL_OUTPUT_ERROR`.

## Compatibility Requirements for Navigator

To avoid backend changes in Navigator, UA Assistant response should include:

1. `status` (`success` or `error`)
2. `score` numeric (top-level)
3. `rationale` string (top-level)

Optional aliases supported by Navigator today:

- `confidenceScore`
- `result.score`
- `data.score`
- `output.score`

## Non-Goals (v1)

- No automated write-back to FCOM objects.
- No mutation of UA config/rules.
- No batch scoring endpoint in this contract (single item per call).

## Rollout Plan (Contract First)

1. UA team implements tool definition + handler with this schema.
2. UA team validates MCP `tools/list` visibility and `tools/call` execution.
3. Joint test with 10 representative stubs from Navigator.
4. Compare returned score/rationale with human reviewer decisions.
5. Lock v1 and then discuss v1.1 deltas (batch mode, richer check taxonomy, provenance).

## Open Questions for Joint Review

- Should `status` in `item` be enum-restricted (`direct|conditional|manual`)?
- Should `suggestedTemplate` be strongly typed per processor family in v1, or remain free-form object?
- Should score calibration guidance be formalized (for example, target acceptance precision at threshold 0.80)?
- Do we want UA MCP to return native envelope text in addition to compact JSON score payload?

## Decision Gate for Finalizing v1

Contract can be finalized when all are true:

- UA Assistant exposes `legacy-rule-conversion` in MCP `tools/list`.
- MCP `tools/call` succeeds with schema-compliant payload.
- Response includes top-level numeric `score` and `status=success`.
- Navigator ingests score without parser changes.
- Joint sample review confirms score directionality is acceptable.
