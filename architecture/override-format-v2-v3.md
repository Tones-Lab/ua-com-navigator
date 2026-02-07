# Override Formats (v2 and v3)

This document summarizes the on-disk override formats used by FCOM processors. Source schemas:
- v2: /opt/assure1/var/docker/overlay2/.../app/schemas/override_file.json
- v3: /opt/assure1/var/docker/overlay2/.../app/schemas/override_file_v3.json

## Common Envelope (v2 and v3)
Each override object uses the same top-level envelope:

Required fields:
- name (string)
- domain (string)
- method (string) - e.g., trap or syslog
- scope (string) - where in processing the override runs
- @objectName (string) - object name or GLOBAL for all messages
- _type (string) - must be "override"
- processors (array)

Optional fields:
- description (string)

Note: The on-disk schema validates a single override object per file (object root). Array roots do not validate under the v2/v3 schemas observed in the conversation logs.

## v2 Format (Processor-based)

processors is an array of processor objects (set, regex, convert, etc.). Each item is a processor object
with a single key for the processor type. Example:

```json
{
  "name": "Example Override",
  "description": "Overrides for Example",
  "domain": "fault",
  "method": "trap",
  "scope": "post",
  "@objectName": "Vendor::Object",
  "_type": "override",
  "processors": [
    {
      "set": {
        "source": 5,
        "targetField": "$.event.Severity"
      }
    },
    {
      "set": {
        "source": 7200,
        "targetField": "$.event.ExpireTime"
      }
    }
  ]
}
```

Array roots are not supported by the schema and should be avoided.

## v3 Format (JSON Patch-based)

processors is an array of JSON Patch operations. Each item is one of:
- add / replace / test (requires path + value)
- remove (requires path)
- move / copy (requires path + from)

Paths use JSON Pointer syntax (RFC 6901).

Example:

```json
{
  "name": "Example Override",
  "description": "Overrides for Example",
  "domain": "fault",
  "method": "trap",
  "scope": "post",
  "@objectName": "Vendor::Object",
  "_type": "override",
  "processors": [
    {
      "op": "add",
      "path": "/event/Severity",
      "value": 5
    },
    {
      "op": "replace",
      "path": "/event/ExpireTime",
      "value": 7200
    }
  ]
}
```

Array roots are not supported by the schema and should be avoided.

## Findings From The Shared Conversation
- Validation does not guarantee execution; logs show overrides can validate but never run if matching fails.
- Matching is based on exact, case-sensitive `@objectName` equality with the resolved object name in logs (e.g., `A10-AX-NOTIFICATIONS::axSyslogTrap`).
- `domain`, `method`, and `scope` must also align with the processed message and phase for execution to occur.
- The schema requires a single override object per file; array roots fail validation and are not supported.
- A `GLOBAL` override is valid but still must match `domain`, `method`, and `scope` to execute.

## Application Adjustment Scope
- **Authoring UI/validation**: enforce a single override object per file and block array-root exports; surface schema errors early.
- **Object selection**: drive `@objectName` from the known resolved object list (exact, case-sensitive), not from user free-text.
- **Conflict prevention**: warn when multiple files target the same `@objectName` and scope, since only one is expected per file.
- **Execution visibility**: add a helper view or log hint to confirm whether an override executed (look for `Executing object overrides ...` lines).
- **Global override support**: allow `@objectName: "GLOBAL"` but still require explicit `domain`, `method`, `scope` fields.
- **Migration tooling**: if users attempt multi-object overrides, provide a splitter that writes one file per object.
- **Documentation**: update docs to state exact matching rules and the single-object-per-file constraint.

## Planning Considerations Before Code Changes
- **One file per object**: saving a single MIB edit may create or update 1-N override files; the save flow must handle partial failures and report per-file results.
- **Header UI change**: remove the single override file in the header; rely on per-object override pills.
- **Override pill hover**: show filename, last edit timestamp, and modified by for quick audit checks.
- **Direct rule links**: add per-object links using the embedded path format, for example: `https://lab-ua-tony02.tony.lab/#rule/rules/core/default/processing/event/fcom/overrides/%3Cfilename%3E`.
- **Object identity**: ensure `@objectName` is derived from the resolved object name (case-sensitive, fully qualified), not user free-text.
- **Filename rules**: define a canonical filename format, normalization, and handling of special characters; specify behavior when the object name changes.
- **Conflict detection**: detect and surface multiple overrides targeting the same object/scope/method/domain to avoid ambiguous behavior.
- **Schema version choice**: decide whether new files default to v2 or v3 and whether mixed versions are allowed per save.
- **Validation and preview**: validate each object override individually and show a per-object preview of the resulting file content before save.
- **Deletion semantics**: decide whether removing an override deletes its file or leaves a no-op file for audit purposes.
- **Atomicity**: decide whether saves should be all-or-nothing or best-effort; document rollback behavior.
- **Performance impact**: many per-object files may affect load and search; plan indexing or caching changes if needed.
- **Back-compat migration**: provide a safe migration path from any existing multi-object overrides to per-object files.
- **Security and path safety**: sanitize filenames and enforce path allowlists for rule links to prevent traversal issues.

## Confirmed Decisions
- New files default to v3 override format (JSON Patch operations).
- One file per object: `vendor.mib.object.override.json` (forced lowercase, normalized).
- Save is atomic: if any file write fails after 1-2 retries, the save fails and all prior writes are rolled back (delete new files, revert updated files).
- Removing an override leaves a schema-valid no-op file (full envelope with `processors: []`) for history.
- Per-object hover metadata uses SVN last-changed author/time from SVN metadata.

## Notes
- v2 is processor-based and aligns with existing FCOM processor definitions.
- v3 is patch-based and uses JSON Pointer paths; processors are patch operations.
- Both formats share the same envelope and required fields.
