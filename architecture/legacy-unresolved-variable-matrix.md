# Legacy Unresolved Variable Matrix

This matrix documents unresolved or partially-resolved legacy variables used in conversion, including runtime evidence, confidence, fallback behavior, and required user actions.

## Matrix

| Legacy Variable / Concept | Observed Runtime Evidence | Confidence | Current Converter Handling | Recommended Mapping Target | Fallback Behavior | User Action Required | Notes |
|---|---|---|---|---|---|---|---|
| `$ip` | Present in trap payload context as `source.ip`; event output also contains `event.IPAddress` (mapped) | High | Built-in alias mapping now resolves `$ip` to `$.source.ip` in stub generation | Prefer authoritative ingress source (`source.ip`) | If source path unavailable in payload model, keep conditional stub | Usually no; validate behavior against sampled logs | `event.Node` may be DNS host value and not equivalent to raw IP |
| `$vX` positional varbinds | Present only when trap includes `trap.variables[]`; each entry contains `oid/type/value` | Medium to High (presence), Medium (semantic meaning) | Can map positionally when lineage is known; semantic naming may remain conditional | `trap.variables[index].value` (positional) | Keep conditional/manual when varbinds absent or ambiguous | Yes when MIB/varbind semantics are unknown; upload MIBs and rerun mapping | Without MIB context, semantic label inference is limited |
| Trap varbind OID semantics | Present when variables include per-varbind OID | Medium | Not fully semanticized into named fields automatically | Map with MIB-guided transform (varbind OID -> named field) | Keep conditional stubs for unresolved semantic fields | Yes, provide/upload MIBs for deterministic semantic mapping | Best done as a rerunnable mapping step |
| `$specific` | Derivable from enterprise trap OID suffix in many legacy patterns | Medium | Not universally auto-materialized as explicit runtime field in all flows | Best-effort derived value from trap OID tail | Mark as conditional with heuristic note | Validate derived value against rule intent/test traps | Heuristic may not hold for all vendor/object conventions |
| `$generic` | Not reliably visible as explicit runtime field in observed SNMPv2c logs | Low to Medium | Built-in heuristic currently maps `$generic` to literal `6` (enterpriseSpecific) for stub generation | Prefer explicit runtime generic field if available; otherwise heuristic literal `6` | Keep review note and allow user override | Yes, review strongly recommended when rule semantics depend on generic categories | Legacy v1 generic categories (coldStart/linkDown/etc.) may not be directly exposed in v2c payloads; heuristic may be wrong for some flows |
| `$Event->{Field}` references | Present directly in legacy expressions and already semantically aligned to event fields | High | Mostly direct conversion to `$.event.Field` | `$.event.<Field>` (post-scope usage) | Direct conversion where no ambiguous mixed vars remain | No, unless combined with unresolved vars | Follow post-scope constraint for `$.event.*` |
| Regex capture intermediates (e.g. `$extracted_value`) | Present when legacy rule extracts via regex then composes output | Medium | Marked conditional/manual for multi-step composition | `regex` + optional `if` + `set` chain | Keep conditional with template notes | Yes, review extraction source/path and branch logic | Needs source field identification and capture validation |

## Operational Guidance

1. Use runtime source facts first (`source.ip`, varbind arrays) over derived event output fields when reconstructing legacy variable intent.
2. If `trap.variables[]` is empty in a sample run, treat `$vX`-dependent mappings as unresolved for that run.
3. For unresolved `$vX` semantics, upload MIBs and rerun conversion/mapping so varbind OIDs can be interpreted.
4. Treat `$generic` as manual/conditional unless runtime evidence explicitly provides it.
5. Keep `$specific` as best-effort unless validated by object/rule behavior.

## Suggested User Workflow for Unresolved Variables

1. Run conversion and inspect conditional/manual stubs.
2. Upload MIB files for the relevant enterprise OIDs.
3. Rerun conversion (or mapping-only rerun when available).
4. Validate reduced conditional set and approve generated stubs.
5. Manually resolve remaining `$generic` or complex regex-branch cases.
