# Copilot instructions for FCOM Curator

## Big picture
- Full-stack monorepo: React/Vite frontend + Express/TypeScript backend. Frontend calls backend; backend proxies to Unified Assurance (UA) REST API and SVN. See [fcom-curator/README.md](fcom-curator/README.md).
- Request flow: UI → backend `/api/v1/*` → UA REST API `/api/*`. The UA proxy client is in [fcom-curator/backend/src/services/ua.ts](fcom-curator/backend/src/services/ua.ts).
- Auth is cookie-based sessions (HTTP-only `FCOM_SESSION_ID`) stored in memory maps; restarts clear sessions. See [fcom-curator/backend/src/services/sessionStore.ts](fcom-curator/backend/src/services/sessionStore.ts) and [fcom-curator/backend/src/routes/auth.ts](fcom-curator/backend/src/routes/auth.ts).

## Key workflows
- Dev: `yarn dev` at repo root runs backend + frontend workspaces. Scripts defined in [fcom-curator/package.json](fcom-curator/package.json).
- Backend dev/build/test: `yarn workspace backend dev|build|test|lint` (see [fcom-curator/backend/package.json](fcom-curator/backend/package.json)).
- Frontend dev/build: `yarn workspace frontend dev|build|lint` (see [fcom-curator/frontend/package.json](fcom-curator/frontend/package.json)).

## Project-specific patterns
- Backend uses HTTPS if SSL certs exist (env `SSL_KEY_PATH`/`SSL_CERT_PATH`), otherwise HTTP; CORS allowlist is in [fcom-curator/backend/src/server.ts](fcom-curator/backend/src/server.ts).
- UA API calls are centralized in `UAClient`; routes build a client from session credentials with `UA_TLS_INSECURE` for TLS bypass. Example usage in [fcom-curator/backend/src/routes/fileEditor.ts](fcom-curator/backend/src/routes/fileEditor.ts).
- File editing uses `etag` for optimistic updates and fetches diff/history via UA endpoints. See [fcom-curator/backend/src/routes/fileEditor.ts](fcom-curator/backend/src/routes/fileEditor.ts).
- Frontend API base is `/api/v1` with `withCredentials: true` (cookie auth). See [fcom-curator/frontend/src/services/api.ts](fcom-curator/frontend/src/services/api.ts).
- Frontend schema validation is done client-side with `Ajv` using the schema from backend `/api/v1/schema`. See [fcom-curator/frontend/src/App.tsx](fcom-curator/frontend/src/App.tsx).
- Favorites are persisted server-side in `data/favorites.json` (not DB). See [fcom-curator/backend/src/services/favoritesStore.ts](fcom-curator/backend/src/services/favoritesStore.ts).
- Folder overview aggregates schema validation + unknown event fields using a cached UA DB query (`DESCRIBE Event.Events`). See [fcom-curator/backend/src/routes/folders.ts](fcom-curator/backend/src/routes/folders.ts) and [fcom-curator/backend/src/services/eventsSchemaCache.ts](fcom-curator/backend/src/services/eventsSchemaCache.ts).

## Integration points
- UA REST endpoints used by proxy: `/rule/Rules/read`, `/rule/Rules/{id}`, `/rule/Rules/readDiff`, `/rule/Rules/readRevisionHistory`, plus DB query endpoint. See [fcom-curator/backend/src/services/ua.ts](fcom-curator/backend/src/services/ua.ts).
- Server inventory is static in code (no DB). Update [fcom-curator/backend/src/services/serverRegistry.ts](fcom-curator/backend/src/services/serverRegistry.ts) for new UA targets.

## Where to look for examples
- Backend route shape and error handling: [fcom-curator/backend/src/server.ts](fcom-curator/backend/src/server.ts).
- Frontend state management with Zustand: [fcom-curator/frontend/src/stores/index.ts](fcom-curator/frontend/src/stores/index.ts).
- API contract reference: [architecture/openapi-fcom-curation.yaml](architecture/openapi-fcom-curation.yaml).
