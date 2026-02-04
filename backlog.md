# Project Backlog

## Now (P0)
- ✅ Persist active tab across refresh (preserve current page instead of defaulting to Overview).
- 🔥 Unify Global/Object processor palettes using a single registry source-of-truth.
  - Plan: architecture/processor-palette-unification-plan.md
- ✅ Advanced Flow visibility + commit flow:
	- ✅ Object header pills: Override + Advanced Flow when object processors exist.
	- ✅ Global Advanced Flow badge in file header when pre/post flows exist.
	- ✅ Pending Advanced Flow banner until commit is confirmed.
	- ✅ Ensure Advanced Flow edits route through commit modal (SVN commit gate).
- ✅ Processor override summaries in Friendly view:
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
- ✅ Core FCOM object editor (form-based).
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
- Override storage path follow-ups:
	- Backward-compat read for legacy /core/default/processing/event/fcom/overrides (read-only).
	- Add optional protocol scoping metadata to overrides for more precise reporting.
	- Add separate dashboard metric for override processor count (vs override objects).
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
- Responsive FCOM browser layout tweaks:
	- Enforce min-heights for folder/file navigation and search results (show at least 3 results); allow left panel to scroll if needed.
	- Make search bar sticky within the left panel on small screens.
	- Collapse Favorites and Search Results sections by default on small screens.
	- Add inline results count + quick clear/reset controls.
- Maybe (needs discussion): Responsive drawer for File Browser on narrow screens.
- Maybe (needs discussion): Minimum panel width / auto-hide left panel when content is in focus.
- Builder link placement in event headers (re-evaluate with user feedback):
	- ✅ Option 1 (implemented today): right-aligned Builder link; pills remain next to field title.
	- Option 2: show Builder link only on hover/focus for a cleaner header.
	- Option 3: move Builder into an actions menu (⋯) alongside “Remove Override”.
- Documentation refresh (post-processor rollout):
	- Update install/prereqs, admin/backend notes, and UI workflow.
- PCOM metrics discovery (vendor/enterprise):
	- PCOM root path (SNMP): /core/default/collection/metric/snmp/_objects/pcom.
	- Define directory conventions (vendor/model/enterprise).
	- Backend index for metric types + cache (searchable).
	- UI: filter/search by vendor/enterprise, list metric types, drill to PCOM file + override.
	- Add overrides visibility for PCOM (vendor-level).

## Later (P2)
- Diff viewer and history panel.
- Event config UI + trap variable helper.
- Preprocessor editor.
- ✅ Test single object + test all.
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

Tony Manual Edits - Features and Bug list

FEATURE - P2-feature002 - New Feature - need to add details MIB browser ASAP, that integrates with FCOM and PCOM (to be created).

FEATURE - P2-feature003 - NEW FEATURE - Guided edit mode with 'highlight' section, and explain. this passes code into AI etc using the FCOM and documentation as reference. Then helps provide guidance and best action/steps$A1BASEDIR/bin/sdk/MIB2FCOM --in=<MIB_name>.mib --out=<MIB_name>-FCOM.json --use_parent_mibs

FEATURE - P5-feature001 - ask AI to validate the COM created -- is this possible?

✅ - FEATURE - 
	create a 'send all traps' feature - that sends all traps in a given FCOM file to a selected server.  This is useful for testing large sets of traps quickly.
		- need to add ability to save 'recent' servers for trap testing - so user does not have to select from large list each time.
		- need to add ability to 'favorite' certain MIBs in the MIB browser for quick access.
		- need to add ability to 'search' MIBs by OID, name, description, etc.
		- need to add ability to 'filter' MIBs by vendor, status, type (notification/metric), etc.
		- need to add ability to 'sort' MIBs by name, OID, vendor, etc.
		- need to add ability to 'view MIB details' - showing all relevant info about the MIB, including its structure, definitions, etc.

BUG - P1-bug002 - Need to fix the folder refresh / cache - curernt broken if you click admin while selecting a folder under fcom. throw error in modal. need to resolve this.

BUG - P1-bug003 -Still not showing correct count of overrides in any of the review / summmary pages - why not?

✅ - BUG - If i click on a FCOOM file - and open the builder in edit mode, then click away to a new file, the builder should close and not be open on the new file / page. 

BUG - P0-bug001 - variables do not load the variables modal when typing $v_ - it should, but it doesn't.

Need more testing. What can we do? Need CoPilot to suggest testing options we can use for a UI etc. What is possible?

✅ - FEATURE - P0-testing - need to run individual vendor based file test - make sure updated logging works when sending 1-N tests at once.

✅ - BUG - Clicking ? breaks the UI - should show FCOM cache and path information

✅ - BUG -Doing a ssarch works in the left panel, but clicking the entry takes you to the file, but doesn't highlight in green and highlight the exact match/search term with yellow like it used to

✅ - BUG - A new field added to a COM definition - comes in as an override (correct). however, if i want to delete the new field entirely, so no longer  have it set to anything by default (as the override) - you cannot delete it via the UI - need a way to delete an override when original is 'not existent' or the hover = new 

✅ - FEATURE - remove all overrides needs to be smart in the deletion of fields that are NOT in the original file, those entries should be cleanly removed from the override file, and the entry in the object panel should also be removed entirely to cleanup the view of 'old' or 'stale' entries that are no longer used

FEATURE - P0-feature004 - PCOM (performance COM) should be supported.

BUG - I am using CloudFlare tunnel to open access to the UA-COM Management application externally. I use the hostname of ua-com.ccfc1986.us pointing to the internal IP of the server 192.168.3.42 on port 5173. However, when i try to login i get a CORS error. Is there a way we can resolve this issue on the server / application side? 

Global overrides - need ability to re-create a 'customer.rules' use case

✅ Feature - add ability to 'find next' override - override may exist, but be at bottom of file. if file knows an override exists, click next to see next override in file, or highlight the scroll bar (like you do in vscode or whatever) - to highlight where overrides are in the file. 

Feature - ability to restart FCOM processing microservice from the UI. check with TM if this might be possible. 

BUG - try to reproduct where builder is bar on right is shown, but not in the context of a field edit (all fields are editable, and no field is selected in the builder - shouldnt happen)

BUG - should remove hide button from the builder. we have the close, that is enough and hide is confusing.

FEATURE - default to friendly editor in the eval creation builder

BUG - need to highlight the staged work to be saved better

FEATURE - on nav away during staged save, user clicks cancel to keep working or save - highlight/flash the save button