# FCOM Overrides: v2 vs v3

Last reviewed: 2026-02-05

## Summary

v2 overrides define a list of processors to run in pre or post conversion.
v3 overrides define JSON Patch operations that modify the COM definition (including processors) before conversion runs.

In practice, v2 is "run processors" and v3 is "patch the definition that will run."

## v2 overrides

- `processors` is a list of processor objects (set/copy/regex/if/etc.).
- Processors execute in order.
- Pre scope runs before conversion; post scope runs after conversion.
- `$.event.*` is only valid in post scope.
- Version is optional; default is v2 when omitted.

## v3 overrides

- `processors` is a JSON Patch list: `add`, `remove`, `replace`, `move`, `copy`, `test`.
- Patch paths use JSON Pointer.
- Patch ops modify the COM definition, which then runs its processors.
- Ordering follows v2 rules; conflict resolution differs:
  - Pre: object-specific overrides win.
  - Post: global overrides win.
- Version is set explicitly to `v3`.

## When to use v3

Use v3 when you need to:

- Modify the COM definition structure itself (insert, remove, or reorder processors).
- Make targeted edits without re-specifying a whole processor list.
- Keep overrides small and focused on specific definition changes.

Use v2 when you need to:

- Add or adjust processors directly without touching the base definition structure.
- Keep behavior explicit and easily readable as a processor list.

## Current state (this repo)

- The UI and override handling are v2-style processors.
- v3 JSON Patch authoring or validation is not implemented.

## Recommendation

- Short term: continue v2 for existing overrides; optionally stamp `version: "v2"` for clarity.
- Medium term: add v3 authoring and validation support; default new overrides to v3 while keeping v2 for legacy edits.
- Validation gaps to close for v3:
  - JSON Patch path validation
  - Scope rules (no `$.event.*` in pre scope)
  - Preview/diff of patched definition

## Where to define v3 now

There is no dedicated area in the UI yet. If you want to capture intent now:

- Document the v3 decision in backlog/architecture notes.
- Add explicit `version: "v2"` for current overrides to avoid ambiguity.
- Once v3 support lands, flip the default for newly created overrides.
