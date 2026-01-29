# Project Backlog

## Now (P0)
- Validate UA REST API endpoints and parameters against a real UA server.
- Confirm auth flows (basic + certificate) and session handling.
- Derive initial FCOM JSON Schema from representative /coms/trap files.
- Obtain and document COM JSON Schema (FCOM/PCOM) source-of-truth.
- Implement UA REST API integration in backend (replace mock routes).
- Build login UI (Oracle JET) with server selection and auth type.
- Cert-based auth cleanup: confirm UA cert→user mapping and enable certificate auth (currently 401).

## Next (P1)
- File browser tree with search/filters.
- File preview pane.
- Favorites (server-side, per-user, per-server):
	- Separate collapsible sections for Favorite Files and Favorite Folders.
	- Star toggle in File Details header (files) and Folder Overview (folders).
	- Remove favorites only via star toggle (list removal later).
- Folder Overview (right pane for folder selection):
	- Summary: file count, object/notification count, schema error count.
	- Table (Top 25): File | #Schema Errors | #Unknown Fields.
	- Ranked by schema errors + unknown fields.
	- Cache results server-side (TTL) for performance.
- Events schema cache (UA Events table):
	- Backend endpoint to fetch/cache UA Events field definitions.
	- Use UA DB Query tool (DESCRIBE Event.Events) and cache at startup/TTL.
	- Unknown fields flagged as Critical.
- Core FCOM object editor (form-based).
- Real-time schema validation in UI.
- Generic value renderer/editor for event fields (string/int/eval/objects):
	- Render raw strings/ints normally; show eval badge for {eval: "..."}.
	- Single, reusable component for all fields (no per-field logic).
	- Edit mode supports Literal vs Eval with $vX autocomplete.
	- Inline validation using schema type (when available).
- Event field type validation using UA Events table schema:
	- Backend endpoint to fetch/cache Events table field definitions.
	- UI flags event fields missing from Events table as Critical (remove).
	- Unknown fields allowed only when explicitly whitelisted/extended.
- Save/commit flow with commit message.
- Smarter defaults: show FCOM/PCOM folders by default, allow user overrides/favorites.
- Session state: remember last opened folder path and restore on reload.
- Remove temporary CastleRock quick link after testing.

## Later (P2)
- Diff viewer and history panel.
- Event config UI + trap variable helper.
- Preprocessor editor.
- Test single object + test all.
- Create mature documentation: how-to, usage guide, and README updates.

## Future (P3)
- Cross-server compare.
- Promotion workflow (file/folder).
- Bulk operations.
- MIB browser + stub generation.
