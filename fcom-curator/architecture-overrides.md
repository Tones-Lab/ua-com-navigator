Architecture Plan (Override‑only editing)
1) Storage & Naming (Locked)
Base FCOM (read‑only): /core/default/processing/event/fcom
Overrides root: /core/default/processing/event/fcom/overrides
Single file per vendor: one JSON file containing 1–N override objects.
No raw JSON edits in UI. All edits emit overrides.
Override filename: <vendor>.override.json

Rule: UA REST Payloads (Hard Rule)
Only send fields explicitly documented/required by UA REST endpoints. Do not include extra keys.

2) Override File Model
File is a JSON array of override objects at the root (current supported format).
Each override object (per doc):
name, description (optional)
domain: "fault"
method: "trap" | "syslog"
scope: "post" (for event field edits)
@objectName
_type: "override"
processors: [...] (e.g., set)
Backlog: investigate supporting wrapper format (e.g., { "overrides": [] }).

3) UI/State Model
Load original FCOM file (read‑only).
Load vendor override file (if present).
Build index keyed by {method, scope, @objectName} → processors.
For each panel, compute “Override” badge if any processor targets that panel’s fields.
4) Editing Flow (Panel → Override)
Panel edit creates or updates one override object for that objectName.
If override object exists in file → update its processors (merge by targetField).
If not → append new override object to vendor file.
If no vendor override file → create vendor folder + file.
5) UX/Status
“Standard/Override” badge per panel and per object header.
“Revert panel” deletes matching processors from override object.
If override object becomes empty → remove it from vendor file.
Show “Restart FCOM Processor required” banner after save.
Backlog Items (Added)
Global overrides support (@objectName: GLOBAL).
Support for pre‑conversion overrides.
Support wrapper override format (e.g., { "overrides": [] }).
Detailed Implementation Steps (Checklist)
A. Discovery & Metadata
Resolve vendor from file path.
Locate vendor override path: /core/default/processing/event/fcom/overrides
Load override file if exists; parse to array.
Build override index: {method, scope, objectName} → processors.
B. Panel Mapping
Define field → panel mapping (Event, PreProcessors, Trap Variables).
Detect override processors targeting those fields (e.g., $.event.Severity).
C. UI Indicators
Show “Override” badge per panel when mapped targetField is present.
Show “Override” badge at object header if any panel overridden.
D. Save Edits → Override Write
On panel Save:
Create or update override object for that objectName/method/scope.
Merge processors by targetField (update existing, add new).
Persist vendor override file (update only; folder/file must exist).
E. Revert
“Revert Panel” removes processors for that panel.
If override object empty → remove it from array.
F. Operational
After override write, surface “Restart FCOM Processor required” banner.