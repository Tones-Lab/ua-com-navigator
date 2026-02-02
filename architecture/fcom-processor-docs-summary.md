# FCOM Processor Docs Summary (UA 6.1.1)

Source:
- https://lab-ua-tony02.tony.lab/docs/implementation-guide/microservice/core/fcom-processor/
- https://docs.oracle.com/en/industries/communications/unified-assurance/6.1.1/implementation-guide/microservice/core/fcom-processor.html#fcom-overrides

## Overrides: ordering and scope
- Overrides can be **pre** or **post** conversion.
- `@objectName` can be `GLOBAL` or a specific object name.
- v2 processing order:
  - Pre: Global → Object
  - Post: Object → Global
- v3 overrides are **JSON PATCH** operations applied to COM definitions, but merge order follows v2 rules. Conflicts:
  - Pre: object-specific takes precedence
  - Post: global takes precedence

## Override format (v2)
Required fields:
- `name`, `domain` (fault), `method` (trap/syslog), `scope` (pre/post), `@objectName`, `_type` (override), `processors` (array)
Optional:
- `description`, `version` (v2/v3)

## Processor list (FCOM override processors)
- append
- appendToOutputStream
- break
- convert
- copy
- date
- discard
- foreach
- grok
- if
- interpolate
- kv
- length
- log
- lookup
- math
- regex
- remove
- rename
- replace
- set
- setOutputStream
- sort
- split
- strcase
- substr
- switch
- trim

## Common processor fields
Most processors support:
- `onFailure` (array of processors)
- `ignoreFailure` (bool)

## If processor (key detail)
- Supports `conditions` object with `and` / `or` arrays and nested `and`/`or`.
- Each condition uses `property`, `operator`, `value`.
- Operators: `==`, `!=`, `<`, `>`, `<=`, `>=`, `=~` (regex match; only when both property and value are text).
- `then` array required, `else` optional, `onFailure` optional, `ignoreFailure` optional.

## Regex processor (key detail)
- `pattern` uses Java regex; lookarounds not supported.
- Named capture groups: no underscores in group name.
- `targetField` empty string ("") captures variables from regex.

## JSON path references for overrides
- `$.lookups.<lookupfile>.<key>`
- `$.foreach.<keyField|valField>`
- `$.localmem` (per-event)
- `$.globalmem` (requires Coherence)
- `$.error.message`
- Java JSONPath syntax supported (e.g., `$.event.variables[1]`).

## Notes for UI alignment
- Global vs object overrides are explicit in docs.
- Pre/Post for global is documented via `scope` and ordering.
- `if` supports nested `and/or` structures, not explicit `elseif`—nest `if` inside `else` or use `switch`.

## v3 Overrides (JSON PATCH)
- Supported ops: `add`, `remove`, `replace`, `move`, `copy`, `test`
- `processors` array is JSON Patch operations to modify COM processors.

---
This summary is intentionally condensed to avoid copying large portions of the vendor documentation.
