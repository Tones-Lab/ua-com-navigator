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
- Core FCOM object editor (form-based).
- Real-time schema validation in UI.
- Save/commit flow with commit message.
- Smarter defaults: show FCOM/PCOM folders by default, allow user overrides/favorites.
- Session state: remember last opened folder path and restore on reload.
- Remove temporary CastleRock quick link after testing.

## Later (P2)
- Diff viewer and history panel.
- Event config UI + trap variable helper.
- Preprocessor editor.
- Test single object + test all.

## Future (P3)
- Cross-server compare.
- Promotion workflow (file/folder).
- Bulk operations.
- MIB browser + stub generation.
