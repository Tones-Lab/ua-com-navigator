# Eval + Processor Builder Plan (Design)

## Summary
We need a flexible, low‑friction way to create **plain text**, **eval expressions**, and **processor snippets** across most fields. Users will continue to edit fields freeform, but will also have a guided builder that can insert well‑formed expressions. The design combines:

1) **Helper Sidebar** (global, persistent when Edit mode is on)
2) **Per‑field Builder button** (contextual, quick launch)

Both entry points open the same builder UI and share data/logic.

---

## Goals
- Support the majority of common eval patterns (especially ternary `? :`).
- Make $vN variables first‑class and easy to insert.
- Allow complex or custom expressions through **freeform** editing.
- Avoid breaking existing workflows and keep backward compatibility.
- Provide clear preview of “effective output” and “raw eval string”.

## Non‑Goals (Phase 1)
- Full parsing of every legacy eval into a complete AST (can be added later).
- Complex expression types beyond ternary and simple comparisons.

---

## User Workflows

### A) Freeform Editing (unchanged)
- Users can always type directly in the field input.
- $v autocomplete remains available on input (already implemented).

### B) Per‑field Builder
- Each editable field gets a “Builder” button (when in Edit mode).
- Clicking opens the builder for that field.
- Builder shows quick templates for Eval or Processor and a structured form.
- On “Insert”, it writes into the field and returns the user to the panel.

### C) Helper Sidebar
- When Edit mode is on, a sidebar appears with:
  - **Eval Builder** section
  - **Processor Builder** section
  - **Examples** section
- Selecting a template in the sidebar inserts into the currently focused field.
- If no field is focused, the user is prompted to choose a target field.

---

## Data Model / Internal Representation

We maintain a small internal AST for “easy evals” (ternary‑style). Example:

```
EvalAST:
- type: "ternary"
- condition: Comparison
- whenTrue: Value
- whenFalse: Value | EvalAST (nested ternary)

Comparison:
- left: Value
- operator: "==" | "!=" | ">" | ">=" | "<" | "<="
- right: Value

Value:
- type: "var" | "number" | "string"
- value: "$v3" | 5 | "text"
```

This AST compiles to a UA eval string:

```
($v3==1) ? 3600 : 86400
($v2==2) ? 0 : (($v2==4) ? 3 : 4)
```

Notes:
- Nested ternary is the “else if” chain.
- Each “else if” becomes a nested ternary in `whenFalse`.

---

## Builder UX: Eval Templates

### Template: Simple Ternary
Form:
- If (variable/operator/value)
- Then value
- Else value

Result:
```
($v3==1) ? 3600 : 86400
```

### Template: Else‑If Chain
Form:
- Condition 1 -> Result 1
- Condition 2 -> Result 2
- Else -> Result 3

Result:
```
($v2==2) ? 0 : (($v2==4) ? 3 : 4)
```

### Template: Pass‑Through Variable
Form:
- Variable ($vN)

Result:
```
$v3
```

### Template: Conditional String
Form:
- Condition -> “string A” else “string B”

Result:
```
($v1==1) ? "Up" : "Down"
```

---

## Processor Builder

Processor builder should cover **all documented override processors** from Oracle UA docs:
https://docs.oracle.com/en/industries/communications/unified-assurance/6.1/implementation-guide/microservice/core/fcom-processor.html#fcom-override-processors

Documented processors (must be available in the builder where applicable):
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

Example template output (set):

```
{
  "set": {
    "source": 5,
    "targetField": "$.event.Severity"
  }
}
```

The builder should let users pick:
- Processor type (from the doc list)
- Target field (suggested list for event fields)
- Source (literal or $vN)
- Operator / pattern / conversion type, depending on processor

### Advanced Processor Flow (Wireframe MVP)
This is a **visual flow** for power users, separate from field-scoped edits.

**Basic functionality**
- Open “Advanced Processors” modal from the Processor Builder.
- Palette on the left with all processors (searchable).
- Drag from palette into the flow lane (root).
- Drag existing nodes between lanes (e.g., Then/Else).
- Remove nodes via the inline Remove action.

**Expectations (MVP)**
- Supports linear list plus basic `if` node with Then/Else lanes.
- Drag/drop only; no inline processor configuration yet.
- No persistence to override files yet (visual-only scaffold).
- No validation or field targeting enforcement in the flow.

**Limitations (MVP)**
- No switch/foreach nesting yet (future).
- No ordering controls besides drag/drop.
- No linking to specific event panel fields.
- No JSON output or “apply” to overrides yet.

---

## Advanced Flow: Persistence + Visibility (Design Update)

### Source-of-Truth
- Advanced flows (global pre/post or object flows) are stored as **override processors**.
- Field-scoped processors (via Builder → Apply) are also stored as override processors, but they target a specific field.

### Save + Commit Flow
1) User edits Advanced Flow (global or object) in the modal.
2) UI marks the flow as **pending changes** (visual badge/banner) until saved.
3) On save, the pending flow updates the override payload and opens the **commit modal**.
4) SVN commit occurs only after the user confirms the commit message.

### How Users Know Changes Exist
- **Object header pills:**
  - **Override**: any override exists for the object.
  - **Advanced Flow**: object has processors not tied to a single field (or untargeted processors).
- **Global indicator:**
  - A persistent badge or pill in the file header showing **Global Advanced Flow** active.
- **Pending change banner:**
  - When the Advanced Flow modal has unsaved edits, show a “Pending Advanced Flow changes” banner.

### Friendly Summary for Processor Overrides
- For field-level processors, add a **summary tooltip/card** similar to Eval’s friendly view.
- Summary should include processor type + key parameters (e.g., source, pattern, target).
- A “View in Advanced Flow” link jumps to the flow modal.

### Raw JSON Exposure
- Keep JSON preview inside Advanced Flow modal (for advanced users).
- In Friendly view, avoid raw JSON in field rows unless explicitly requested.
- Provide a “Show JSON” toggle in the tooltip/card for processor overrides.

### Processor-Specific Forms (MVP details)
Below is the **minimum form** for each processor type. Optional fields are shown and may be collapsed under “Advanced”.

**append**
- source (text/path/number/bool/object)
- array (path/array)
- targetField
- onFailure (processors array)
- ignoreFailure (bool)

**appendToOutputStream**
- source
- output (pulsar URI)
- onFailure, ignoreFailure

**break**
- no fields

**convert**
- source
- type (inttostring, stringtoint, oidtoip, oidtomac, stringtohexstring, octetstringtodateandtime, octetstringtomacaddress, octetstringtoipv4, octetstringtoipv6, octetstringtoipv4z, octetstringtoipv6z)
- targetField
- onFailure, ignoreFailure

**copy**
- source
- targetField
- onFailure, ignoreFailure

**date**
- source
- offset (duration)
- timezone
- targetField
- onFailure, ignoreFailure

**discard**
- no fields

**foreach**
- source
- keyField
- valField
- then (processors array)
- onFailure, ignoreFailure

**grok**
- source
- pattern
- targetField
- onFailure, ignoreFailure

**if**
- conditions (AND/OR builder)
- then (processors array)
- else (processors array)
- onFailure, ignoreFailure

**interpolate**
- source
- targetField
- onFailure, ignoreFailure

**kv**
- source
- targetField
- fieldSplit
- valueSplit
- onFailure, ignoreFailure

**length**
- source
- targetField
- onFailure, ignoreFailure

**log**
- source
- args (array)
- type (info/debug/error)

**lookup** (expandable sub‑forms by source)
- source (gdb, db, api, cache)
- properties (source‑specific)
- cache (enabled/object/keys/ttl)
- fallback (source‑specific)
- targetField
- onFailure, ignoreFailure

**math**
- source
- operation (+, -, /, *, %)
- value
- targetField
- onFailure, ignoreFailure

**regex**
- source
- pattern
- targetField ("" allowed to capture variables)
- onFailure, ignoreFailure

**remove**
- source (path)
- onFailure, ignoreFailure

**rename**
- source
- targetField
- onFailure, ignoreFailure

**replace**
- source
- pattern
- regex (bool)
- replacement
- targetField
- onFailure, ignoreFailure

**set**
- source
- args (array)
- targetField
- onFailure, ignoreFailure

**setOutputStream**
- output (pulsar URI)
- onFailure, ignoreFailure

**sort**
- source
- targetField
- onFailure, ignoreFailure

**split**
- source
- delimiter
- targetField
- onFailure, ignoreFailure

**strcase**
- source
- type (upper/lower/ucfirst/lcfirst)
- targetField
- onFailure, ignoreFailure

**substr**
- source
- start (number)
- end (number)
- targetField
- onFailure, ignoreFailure

**switch**
- source
- operator
- case[] (match/operator/then[])
- default[]
- onFailure, ignoreFailure

**trim**
- source
- cutset
- targetField
- onFailure, ignoreFailure

### Conditions Builder (for if/switch)
- Support AND/OR nesting
- Each condition uses: property, operator, value
- Operators: ==, !=, >, <, >=, <=, =~

### Processors Arrays
- A processors array UI should allow ordering, nesting, and inline creation.
- Provide “Add Processor” with full list above.

### Data Validation
- Required fields enforced.
- Show warnings when values are empty or invalid.
- Keep raw JSON preview for the final processor object.

---

## Processor Examples (Reference Snippets)

**append**
```
{ "append": { "source": "Example Value", "array": [], "targetField": "$.event.NewArray" } }
```

**appendToOutputStream**
```
{ "appendToOutputStream": { "source": "$.trap", "output": "pulsar+ssl:///assure1/event/sink" } }
```

**break**
```
{ "break": {} }
```

**convert**
```
{ "convert": { "source": "$.event.Count", "type": "inttostring", "targetField": "$.event.CountString", "ignoreFailure": true } }
```

**copy**
```
{ "copy": { "source": "$.event.Count", "targetField": "$.event.CopiedCount" } }
```

**date**
```
{ "date": { "source": "", "offset": "-2h45m", "timezone": "America/New_York", "targetField": "$.event.CurrentTimeInEST" } }
```

**discard**
```
{ "discard": {} }
```

**foreach**
```
{
  "foreach": {
    "source": "$.event.Details.trap.variables",
    "keyField": "i",
    "valField": "c",
    "then": [
      { "log": { "source": "The index is %s and the value is %s", "args": ["$.foreach.i", "$.foreach.c"], "type": "info" } },
      { "break": {} }
    ]
  }
}
```

**grok**
```
{ "grok": { "source": "$.syslog.datagram", "pattern": "%LINK-5-CHANGED: Interface %{VALUE:interface}, changed state to %{VALUE:status}", "targetField": "$.syslog.variables" } }
```

**if**
```
{
  "if": {
    "conditions": {
      "and": [
        { "property": "$.event.EventCategory", "operator": "==", "value": 3 }
      ]
    },
    "then": [ { "log": { "source": "The event category is 3." } } ],
    "else": [ { "log": { "source": "The event category is not 3." } } ]
  }
}
```

**interpolate**
```
{ "interpolate": { "source": "The $.event.EventType event expires in $.event.ExpireTime seconds", "targetField": "$.event.Summary" } }
```

**kv**
```
{ "kv": { "source": "ALARM_UC01::Communication-Fail ALARM_UC02::System-Fail", "fieldSplit": " ", "valueSplit": "::", "targetField": "$.event.Summary" } }
```

**length**
```
{ "length": { "source": "$.trap.oid", "targetField": "$.localmem.oidlength" } }
```

**log**
```
{ "log": { "source": "There are %d devices in the device catalog", "args": [100], "type": "info" } }
```

**lookup** (gdb example)
```
{
  "lookup": {
    "source": "gdb",
    "properties": { "database": "graph", "variables": { "zoneValue": 1 }, "query": "MATCH(v) WHERE v.ZoneID > $zoneValue RETURN v;" },
    "cache": { "enabled": true, "object": "Vertex", "keys": ["$.event.Node"] },
    "targetField": "$.localmem.gdbresults"
  }
}
```

**math**
```
{ "math": { "source": "$.event.Count", "operation": "*", "value": 2, "targetField": "$.localmem.CountTimesTwo" } }
```

**regex**
```
{ "regex": { "source": "Events are cleared", "pattern": "Events are (?<text>.*$)", "targetField": "" } }
```

**remove**
```
{ "remove": { "source": "$.trap.timeTicks" } }
```

**rename**
```
{ "rename": { "source": "$.event.Details", "targetField": "$.event.DetailsOld" } }
```

**replace**
```
{ "replace": { "source": "This is a test", "pattern": "a test", "replacement": "not a test", "targetField": "$.localmem.example" } }
```

**set**
```
{ "set": { "source": "$.event.%s", "args": ["Details"], "targetField": "$.event.Details2" } }
```

**setOutputStream**
```
{ "setOutputStream": { "output": "pulsar+ssl:///assure1/event/sink" } }
```

**sort**
```
{ "sort": { "source": "$.trap.variables", "targetField": "$.trap.sortedVariables" } }
```

**split**
```
{ "split": { "source": "1,2,3,4", "delimiter": ",", "targetField": "$.localmem.splitarr" } }
```

**strcase**
```
{ "strcase": { "source": "HELLO, WORLD", "type": "lower", "targetField": "$.localmem.lowercase" } }
```

**substr**
```
{ "substr": { "source": "Hello", "start": 1, "targetField": "$.localmem.substr" } }
```

**switch**
```
{
  "switch": {
    "source": "$.localmem.val1",
    "operator": "!=",
    "case": [
      { "match": 2, "then": [ { "discard": {} } ] },
      { "match": 5, "operator": "==", "then": [ { "discard": {} } ] }
    ],
    "default": [ { "log": { "type": "info", "source": "Do nothing since none of the cases were met" } } ]
  }
}
```

**trim**
```
{ "trim": { "source": "Hello", "cutset": "H", "targetField": "$.localmem.trim" } }
```

---

## $v Variable Integration

- $vN tokens are common across evals.
- The builder should include:
  - **Variable picker** (list of trap variables)
  - Quick insert ($v1, $v2, …)
- For freeform, typing `$v` opens the same picker (already implemented).

---

## Preview & Validation

- Always show a “Raw eval preview” as read‑only text.
- Optionally show a “Friendly preview” (text summary) when structured.
- Basic validation:
  - Missing condition parts
  - Empty results
  - Unknown operator

---

## Insertion & Editing Behavior

- Builder outputs into the current field (freeform input).
- If field already contains text:
  - Provide **Insert**, **Replace**, **Cancel** choices.
- The builder does not auto‑save; it only updates the input value.

---

## Backward Compatibility

- Freeform inputs remain unchanged.
- Existing evals are displayed as raw text.
- We only parse and “round‑trip” evals when they match known patterns.

---

## Phase Plan

### Phase 1 (MVP)
- Eval Builder supports ternary and else‑if chain.
- Processor Builder supports `set` and `copy`.
- Helper sidebar + per‑field builder button.
- Raw preview and insert/replace flow.

### Phase 2
- Add regex/grok processor builders.
- Add better parsing for existing eval strings.
- Add inline previews for “friendly” interpretation.

### Phase 3
- Full AST parsing for more advanced expressions.
- Visual builder options if needed.

---

## Open Questions
- Which fields should show the Builder button first (all, or only event fields)?
- Should builder auto‑detect and parse existing eval strings?
- Should we allow custom operators beyond `==`/`!=` in MVP?

---

## Examples from Repository (Observed)
- `$v3`
- `($v3==1) ? 3600 : 86400`
- `($v2==2) ? 0 : (($v2==4) ? 3 : 4)`
- `($v1==1) ? 1 : 2`

These are representative of the typical eval patterns and should be covered in MVP.
