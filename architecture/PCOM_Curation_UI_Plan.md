# Project Plan: PCOM Curation UI

Goal: build a PCOM-focused UI that mirrors the FCOM experience where possible, while respecting PCOM file structure and workflows. Reuse existing CSS, layout conventions, and shared components where feasible.

## Scope (Phase 0: Discovery + UX Definition)
- Parse and document the PCOM file schema and common patterns.
- Define PCOM-specific friendly editor layout and raw JSON toggle behavior.
- Align with the existing FCOM UI look/feel and shared styling.
- Stub out "create new PCOM" UX (no file creation yet).

## PCOM File Schema (Observed)
Top-level object:
- @vendor: string
- mibs: string[]
- notes: string | string[]
- enterpriseOids: string[]
- aliases: string[]
- objects: object[]

Object entry fields:
- @objectName: string
- certification: string
- class: string (CPU, MEMORY, DISK, TEMPERATURE, FAN, NETWORK, etc.)
- description: string
- domain: string (commonly PERFORMANCE)
- measurement: string
- metaData: object (optional)
- method: string (commonly snmp)
- notes: string | string[] (optional)
- subClass: string
- weight: number
- snmp: object

SNMP block:
- discovery: { name, oid }
- factor: null | number | string | { name, oid }
- filter: null | array of { operator, property: { name, oid }, value }
- instance: null | string | { name, oid }
- maximum: null | number | string | { name, oid }
- values: array of value definitions
- aggregateValues: array of aggregate definitions (optional)

Value definition:
- field: string
- metricType: string | null
- name: string (OID name)
- oid: string (OID)
- valueType: string (Gauge32, Gauge64, Integer32, OCTET STRING, etc.)
- thresholds: string[] (optional)
- processors: array (optional)
- eval: string (optional)

Processor examples:
- extract: { type: "extract", data: ["regex"] }
- map: { type: "map", options: { unknownIncrement }, data: [{ find, replace }, ...] }

Aggregate definition:
- function: string (e.g., average)
- metricType: string
- value: string (field name)
- thresholds: string[] (optional)

## UI Layout (Friendly View)
1) Vendor Header
- @vendor (title)
- mibs, enterpriseOids, notes, aliases
- "MIB-2 handled" indicator when objects empty and notes call it out
- Link to MIB-2 PCOM file when vendor is MIB-2 handled

2) Object List Panel
- Table or cards: @objectName, class, measurement, subClass, weight
- Filters: class, measurement, domain, certification
- Search: objectName, metricType, oid, description

3) Object Detail Panel
- Summary fields (description, domain, class, measurement, subClass, weight)
- SNMP section (discovery, instance, filter, factor, maximum)
- Values section (list of metric outputs)
- Aggregate section (if present)
- Processors section (per value)

4) Raw JSON Toggle
- Inline toggle to show raw JSON for the current file
- Read-only unless edit mode is enabled

5) Edit Mode
- Follows the FCOM edit flow with commit gating and validation
- Same styling, same component system, PCOM-specific forms

## FCOM References (Alignment, Not 1:1 Mapping)
- Use the FCOM area as the visual and interaction baseline, but only adopt patterns when they fit PCOM cleanly.
- Reference the file browser shell (breadcrumbs, search, favorites) for layout consistency without forcing the same data model: [com-management/frontend/src/features/fcom/FcomBrowserPanel.tsx](com-management/frontend/src/features/fcom/FcomBrowserPanel.tsx#L120-L172).
- Reference the file header layout (friendly/raw toggle, action row) for accepted visuals, adapting actions for PCOM: [com-management/frontend/src/features/fcom/FcomFileHeader.tsx](com-management/frontend/src/features/fcom/FcomFileHeader.tsx#L163-L199).
- Reference the friendly view layout switch (summary vs edit) while allowing PCOM-specific panel composition: [com-management/frontend/src/features/fcom/FcomFilePreview.tsx](com-management/frontend/src/features/fcom/FcomFilePreview.tsx#L259).
- Reference the raw JSON container + match bar affordance, but PCOM decides match semantics: [com-management/frontend/src/features/fcom/FcomRawPreview.tsx](com-management/frontend/src/features/fcom/FcomRawPreview.tsx#L26-L34).
- Reference the folder overview summary grid + sortable table pattern for vendor-level rollups: [com-management/frontend/src/features/fcom/FcomFolderOverview.tsx](com-management/frontend/src/features/fcom/FcomFolderOverview.tsx#L51-L140).
- Reference the builder sidebar shell (open/collapsed, undo/redo/help), but keep PCOM-specific editors and processor flows: [com-management/frontend/src/features/fcom/FcomBuilderSidebar.tsx](com-management/frontend/src/features/fcom/FcomBuilderSidebar.tsx#L209-L240).
- Reuse shared layout and component styling from [com-management/frontend/src/App.css](com-management/frontend/src/App.css).
- Review and follow the UI consistency checklist: [architecture/fcom-pcom-ui-consistency-checklist.md](architecture/fcom-pcom-ui-consistency-checklist.md).

## UX Rules and Constraints
- Reuse existing CSS and components from the FCOM UI where possible.
- Do not duplicate FCOM logic; share shared components and utilities.
- No new dependencies unless required.
- New file creation is stubbed (UI only, no file writes yet).
- "MIB-2 handled" vendors should link to the MIB-2 PCOM file.
- Friendly view is the default for every file open; raw view does not persist across files or sections.

## Data Access (Initial CLI Mode)
- Read PCOM JSON files directly from:
  /opt/assure1/var/checkouts/core/default/collection/metric/snmp/_objects/pcom/
- Normalize mixed-type fields (notes, factor, instance, maximum).
- Build in-memory schema map for validation and UI hints.

## Validation Rules (Initial)
- Required fields: @vendor, objects (can be empty), object.@objectName, object.snmp.discovery
- Validate OID formats for fields that expect OIDs.
- Validate known valueType strings against observed set.
- Ensure eval expressions only reference available fields.

## Stubs for New File Creation (No Writes Yet)
- "Create PCOM" button opens a stub modal and captures:
  - Vendor name
  - MIBs list
  - Enterprise OIDs
  - Initial object templates (optional)
- UI only, no file system write

## Work Plan
Phase 1: Schema Baseline
- Enumerate all PCOM files and compile a schema map and stats.
- Identify all valueType, processor types, and aggregate functions used.

## Phase 1 Findings (Schema Inventory)
- Files scanned: 52
- Top-level keys observed in all files: @vendor, mibs, notes, enterpriseOids, aliases, objects
- Object keys observed: 12 distinct keys
- SNMP block keys observed: discovery, factor, filter, instance, maximum, values, aggregateValues
- Value keys observed: field, metricType, name, oid, valueType, thresholds, processors, eval, instance, applicable, utilizationField, weight, maximum
- Value types observed (case-sensitive): INTEGER, Gauge32, Integer32, OCTET STRING, Gauge64, OctetString, Counter32, Counter64, Unsigned32
- Processor types observed: map, extract
- Aggregate functions observed: average
- MIB-2 handled files (empty objects with notes pointing to MIB-2):
  - arista-PCOM.JSON
  - fireeye-PCOM.json
  - gigamonSnmp-PCOM.json
  - microsoft-PCOM.json
  - nai-PCOM.json
  - panRoot-PCOM.json
  - scc-PCOM.json

Schema inventory report: [architecture/pcom_schema_inventory.json](architecture/pcom_schema_inventory.json)

## Phase 2: UX Wireframe (Panel Composition)

### Global Layout (FCOM-aligned, PCOM-specific)
- Left column: File browser (folders/files, search, favorites).
- Main column: File header + friendly/raw toggle + file content.
- Right column: Builder/editor sidebar (only when editing).

### File Browser (PCOM)
- Mirror the FCOM browser layout and controls for user familiarity.
- Search scopes: name, content, all (same control pattern as FCOM).
- Favorites: support folders + files (same UI controls).

### File Header (PCOM)
- Title: vendor filename + favorite star.
- Path line: display full path.
- Friendly / Raw toggle (same switch style as FCOM).
- Actions (PCOM-specific):
  - View MIB-2 (only when MIB-2 handled; link to MIB-2 PCOM file).
  - Create PCOM (stub only; no file write yet).
  - Edit (enables friendly editing mode).

### Friendly View Layout
- Vendor summary card:
  - @vendor, mibs, enterpriseOids, aliases, notes.
  - MIB-2 handled indicator and link.
- Object list table:
  - Columns: @objectName, class, measurement, subClass, weight.
  - Filters: class, domain, certification.
  - Search: objectName, metricType, oid, description.
- Object detail panel (selected row):
  - Summary: description, class, domain, measurement, subClass, weight.
  - SNMP section: discovery, instance, factor, maximum, filter.
  - Values section: list of values with inline fields.
  - Aggregate section (if present).
  - Processors section (per value).

### Raw View Layout
- Raw JSON preview panel with search highlight.
- Match navigation bar when search is active.

### Edit Mode Layout
- Friendly view remains primary.
- Inline edit controls for:
  - Vendor metadata (mibs, enterpriseOids, notes, aliases).
  - Object fields.
  - SNMP block (discovery, instance, factor, maximum, filter).
  - Values and processors.
- Builder sidebar opens on field focus (reuse FCOM builder shell).
- Validation surfaced inline at field level.

### Interaction Notes
- MIB-2 handled vendors:
  - Show a badge + link to MIB-2 PCOM file.
  - Object list remains empty; detail panel shows guidance text.
- Raw toggle should be available even when no objects exist.
- Create PCOM stub opens a modal and stores draft state only.

## Phase 3: Friendly Editor Spec (Field-Level Interactions)

### Vendor Metadata Editor
- Editable fields: mibs, enterpriseOids, aliases, notes.
- Notes supports string or list; UI should allow toggling between single-line and list mode.
- MIB list and enterprise OIDs use chip input with validation (OID pattern).

### Object Editor (Header Fields)
- Editable fields: @objectName, certification, class, domain, measurement, subClass, weight, description, notes.
- Required fields must be validated on blur and before save.
- Provide a read-only hint for method (expect snmp in most cases).

### SNMP Block Editor
- Discovery:
  - name (text)
  - oid (validated OID pattern)
- Instance:
  - mode selector: null | string | { name, oid }
  - render appropriate inputs based on mode
- Factor:
  - mode selector: null | number | string | { name, oid }
  - preserve numeric precision and input type
- Maximum:
  - mode selector: null | number | string | { name, oid }
- Filter:
  - list editor with rows: operator, property(name+oid), value
  - allow empty list (removes filter)

### Values Editor
- Table-style editor for values[]
- Each row:
  - field, metricType, name, oid, valueType
  - thresholds (chips list)
  - eval (optional)
  - processors (optional, opens processor editor)
- ValueType uses a dropdown populated from observed inventory list.
- Eval builder:
  - raw text editor
  - helper to insert $field[$i] tokens

### Processor Editor (Initial)
- Support only observed types: map, extract.
- Map editor:
  - options.unknownIncrement
  - data list (find -> replace rows)
- Extract editor:
  - regex list
- Store processors inline on values[]

### Aggregate Values Editor (Optional)
- Read-only view in Phase 3 unless explicitly requested.
- If editing is enabled later, fields: function, metricType, value, thresholds.

### Validation + Error Display
- Inline field errors and summary banner at the top of the object panel.
- Validation rules:
  - Required fields for object and snmp discovery
  - Valid OID format when fields expect OIDs
  - ValueType must match known list (warning if unknown)
  - Eval references should resolve to known fields (warning-only)

### Save + Commit Gating
- Follow the same staged review + commit flow as FCOM.
- Friendly edits generate a diff view before commit.
- Raw view edits (if enabled) must pass schema validation.

## Phase 4: Validation + Save Flow

### Validation Stages
- Client-side schema validation on every edit (inline errors).
- Pre-save validation pass (blocks save if required fields missing).
- Pre-commit validation pass (blocks commit if schema invalid).

### Diff + Review
- Show friendly diff view for high-level changes (object count, values changed).
- Provide raw JSON diff in a collapsible panel for power users.
- Mark edits by section: vendor metadata, object header, snmp block, values, processors.

### Save + Commit Flow (Same UX Contract as FCOM)
- Save action generates staged changes.
- Commit modal requires a commit message.
- After commit, show success banner and clear staged state.
- If commit fails, keep staged changes and show retry option.

### Error Handling
- Normalize validation errors to user-friendly messages (OID pattern, missing discovery, unknown valueType).
- Provide link to the problematic object in the friendly view.
- Raw view shows a summary list of errors at the top.

Phase 2: UX Wireframe
- Define vendor list + object list + detail view layout.
- Define edit and raw JSON toggle behaviors.
- Define MIB-2 handled linking behavior.

Phase 3: Friendly Editor
- Build object editor forms (summary + snmp + values + processors).
- Build processor editor panels (extract/map + future types).
- Keep consistent styling with FCOM.

Phase 4: Validation + Save Flow
- Add schema validation in friendly editor.
- Add raw JSON diff preview and commit gating.

Phase 5: Stub Create UI
- Add create wizard (no file writes) with templates.
- Store draft in UI state only.
- PCOM tab stub uses the same split layout as FCOM (browser left, details right), with raw JSON preview only.
- Friendly view remains a placeholder until Phase 3+ is implemented.
- Default starting paths:
  - FCOM: /core/default/processing/event/fcom
  - PCOM: /core/default/collection/metric/snmp/_objects/pcom

## Open Questions
- Should "MIB-2 handled" vendors be editable or read-only?
- Should aggregateValues be editable in phase 1 or read-only?
- Any required naming/ordering conventions to preserve in file output?
