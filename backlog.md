# Project Backlog

## Now (P0)
- 🔥 Unify Global/Object processor palettes using a single registry source-of-truth.
  - Plan: architecture/processor-palette-unification-plan.md
- 🔥 Advanced Flow visibility + commit flow:
	- Object header pills: Override + Advanced Flow when object processors exist.
	- Global Advanced Flow badge in file header when pre/post flows exist.
	- Pending Advanced Flow banner until commit is confirmed.
	- Ensure Advanced Flow edits route through commit modal (SVN commit gate).
- 🔥 Processor override summaries in Friendly view:
	- Tooltip/card summary for field-level processors (type + key params).
	- “View in Advanced Flow” link + optional JSON toggle.
- RBAC gating for edit/execute:
	- Call UA roles/permissions API on login.
	- Verify user has edit + execute permissions on rules ACL.
	- Enable UI edit mode only when permissions allow (including field-level edits and new fields).
- Processor required fields audit:
	- Review required field rules per processor (including if/else).
	- Enforce required inputs in builder + validation messaging.
- Validate UA REST API endpoints and parameters against a real UA server.
- Confirm auth flows (basic + certificate) and session handling.
- Derive initial FCOM JSON Schema from representative /coms/trap files.
- Obtain and document COM JSON Schema (FCOM/PCOM) source-of-truth.
- Implement UA REST API integration in backend (replace mock routes).
- Build login UI (Oracle JET) with server selection and auth type.
- Cert-based auth cleanup: confirm UA cert→user mapping and enable certificate auth (currently 401).
- Docs reference: see architecture/fcom-processor-docs-summary.md (UA FCOM processor/override specs).

## Next (P1)
- ✅ File browser tree with search/filters.
- ✅ File preview pane.
- ✅ Favorites (server-side, per-user, per-server):
	- ✅ Separate collapsible sections for Favorite Files and Favorite Folders.
	- ✅ Star toggle in File Details header (files) and Folder Overview (folders).
	- ✅ Remove favorites only via star toggle (list removal later).
- ✅ Folder Overview (right pane for folder selection):
	- ✅ Summary: file count, object/notification count, schema error count.
	- ✅ Table (Top 25): File | #Schema Errors | #Unknown Fields.
	- ✅ Ranked by schema errors + unknown fields.
	- ✅ Cache results server-side (TTL) for performance.
- ✅ Events schema cache (UA Events table):
	- ✅ Backend endpoint to fetch/cache UA Events field definitions.
	- ✅ Use UA DB Query tool (DESCRIBE Event.Events) and cache at startup/TTL.
	- ✅ Unknown fields flagged as Critical.
- Core FCOM object editor (form-based).
- ✅ Real-time schema validation in UI.
- Generic value renderer/editor for event fields (string/int/eval/objects):
	- Render raw strings/ints normally; show eval badge for {eval: "..."}.
	- Single, reusable component for all fields (no per-field logic).
	- Edit mode supports Literal vs Eval with $vX autocomplete.
	- Inline validation using schema type (when available).
- Eval UI improvements (read-only):
	- ✅ Keep raw eval visible.
	- ⛔ $vX hover tooltip not implemented (currently click opens modal).
	- Optional hover on eval to show quick legend of referenced variables.
- Event field type validation using UA Events table schema:
	- Backend endpoint to fetch/cache Events table field definitions.
	- UI flags event fields missing from Events table as Critical (remove).
	- Unknown fields allowed only when explicitly whitelisted/extended.
- ✅ Save/commit flow with commit message.
- Smarter defaults: show FCOM/PCOM folders by default, allow user overrides/favorites.
- ✅ Session state: remember last opened folder path and restore on reload (URL-based via node/file params).
- ✅ Remove temporary CastleRock quick link after testing.
- ✅ Event field add-from-schema flow:
	- ✅ In Edit mode, allow “Add field” to pick from UA Events schema.
	- ✅ Modal lists all fields; gray out ones already present; exclude EventKey/EventID.
	- ✅ Selected field starts as empty string and becomes editable like defaults.
	- ✅ On save, any newly added field becomes an override (blank string allowed).
	- ✅ If override already exists, update it (including switching to eval/regex/etc.).
- Display conversions:
	- If a field has a display conversion (enum/lookup), show the converted value in UI.
	- Use display value alongside raw value to help users interpret fields.
- Global overrides awareness:
	- Detect and surface catch-all/global overrides in relevant files.
	- Summarize global overrides and link to their files from the UI.
- LLM assistant (server-side, suggestions-only, edit-gated):
	- Reuse UA chatbot LLM API integration (OpenAI + OCI).
	- RAG with vector store (FCOM/PCOM docs, UA docs, schema).
	- Context pack: current file + overrides + active edits/drafts.
	- Help entry point (modal/side panel) to ask for guidance (e.g., processor selection/build).
	- Future: generate new FCOM from MIBs via Mib2FCOM and MIB browser.
- Processor builder rollout (priority order):
	- Reference: architecture/fcom-processor-docs-summary.md (processor specs and constraints).
	1) set
	2) regex
	3) convert
	4) math
	5) append/concat
	6) map/lookup
	7) split
	8) substr
	9) strcase
	10) length
	11) date
- ✅ Processor builder coverage expansion + validation/examples:
	- Doc: architecture/backlog-processor-builder-coverage.md
- FCOM test trap fallback when `test` is missing:
	- Best-effort MIB match (OID/variables) via MIB browser data.
	- Prefill trap modal defaults from MIB definitions.
- ✅ Advanced Flow validation improvements (lane rules + error hints):
	- Doc: architecture/backlog-advanced-flow-validation.md
- ✅ Staged review usability improvements (object collapse + expand originals):
	- Doc: architecture/backlog-staged-review-improvements.md
- Staged review: add full diff view (side-by-side/inline, richer change visualization).
- Staged review: user preference to remember expand/collapse state.
- ✅ Search/navigation enhancements (jump-to-object, persist filters):
	- Doc: architecture/backlog-search-navigation.md
- ✅ Edit safety enhancements (dirty indicators + builder undo/redo):
	- Doc: architecture/backlog-edit-safety.md
- Builder link placement in event headers (re-evaluate with user feedback):
	- ✅ Option 1 (implemented today): right-aligned Builder link; pills remain next to field title.
	- Option 2: show Builder link only on hover/focus for a cleaner header.
	- Option 3: move Builder into an actions menu (⋯) alongside “Remove Override”.
- Documentation refresh (post-processor rollout):
	- Update install/prereqs, admin/backend notes, and UI workflow.

## Later (P2)
- Diff viewer and history panel.
- Event config UI + trap variable helper.
- Preprocessor editor.
- Test single object + test all.
- Create mature documentation: how-to, usage guide, and README updates.
- Human-editable COM forms (end goal):
	- Form-based editor that abstracts JSON structure into field-level UI.
	- Support editing evals via guided inputs (conditions/outcomes) without raw JSON.

## Future (P3)
- Cross-server compare.
- Promotion workflow (file/folder).
- Bulk operations.
- MIB browser + stub generation.
	- allow MIB updloads - individually, or even a zip, and unpack the zip as necessary to /distrib/mibs directory. 
	- need a way to sort / filter - user may add folders under that folder, or add other folders with mibs - need way to add 'folder' to make it viewable in the MIB browser
- MIB browser (requirements):
	- Load MIBs from /opt/assure1/distrib/mibs/ on UA presentation server; document install assumption.
	- Use `snmptranslate` (Net-SNMP) for MIB metadata extraction to ensure accurate OIDs/types/access/status.
	- Entity tags + filters: All | Notifications (Fault) | Metrics (Performance).
	- Map Notifications to FCOM (match by object name + OID via snmptranslate).
	- Map Metrics to PCOM placeholders (numeric OBJECT-TYPE: Counter32/64, Gauge32, Integer32, Unsigned32, TimeTicks).
	- Primary action button logic:
		- If FCOM exists: View FCOM.
		- If not: Create FCOM Override (override-first for new content).
		- Metrics: PCOM (Coming soon).
	- Trap send defaults: SNMP v2c + community "public" (make configurable later).
	- Future: pull SNMP profile definitions from UA for v2/v3 testing and config.
	- Recent targets: show recent/manual destinations alongside server list results.
- Integrate UA Mib2FCOM tools (MIB browser, stub generation, conversion workflows).


Tony Manual Edit - need to add details MIB browser ASAP, that integrates with FCOM and PCOM (to be created).

Advanced - Guided edit mode with 'highlight' section, and explain. this passes code into AI etc using the FCOM and documentation as reference. Then helps provide guidance and best action/steps$A1BASEDIR/bin/sdk/MIB2FCOM --in=<MIB_name>.mib --out=<MIB_name>-FCOM.json --use_parent_mibs