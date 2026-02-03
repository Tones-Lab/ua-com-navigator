# Copilot instructions for COM Management

## Big picture
- Full-stack monorepo: React/Vite frontend + Express/TypeScript backend. Frontend calls backend; backend proxies to Unified Assurance (UA) REST API and SVN. See [com-management/README.md](com-management/README.md).
- Request flow: UI → backend `/api/v1/*` → UA REST API `/api/*`. The UA proxy client is in [com-management/backend/src/services/ua.ts](com-management/backend/src/services/ua.ts).
- Auth is cookie-based sessions (HTTP-only `FCOM_SESSION_ID`) stored in memory maps; restarts clear sessions. See [com-management/backend/src/services/sessionStore.ts](com-management/backend/src/services/sessionStore.ts) and [com-management/backend/src/routes/auth.ts](com-management/backend/src/routes/auth.ts).

## Key workflows
- Dev: `yarn dev` at repo root runs backend + frontend workspaces. Scripts defined in [com-management/package.json](com-management/package.json).
- Backend dev/build/test: `yarn workspace backend dev|build|test|lint` (see [com-management/backend/package.json](com-management/backend/package.json)).
- Frontend dev/build: `yarn workspace frontend dev|build|lint` (see [com-management/frontend/package.json](com-management/frontend/package.json)).

## Project-specific patterns
- Backend uses HTTPS if SSL certs exist (env `SSL_KEY_PATH`/`SSL_CERT_PATH`), otherwise HTTP; CORS allowlist is in [com-management/backend/src/server.ts](com-management/backend/src/server.ts).
- UA API calls are centralized in `UAClient`; routes build a client from session credentials with `UA_TLS_INSECURE` for TLS bypass. Example usage in [com-management/backend/src/routes/fileEditor.ts](com-management/backend/src/routes/fileEditor.ts).
- File editing uses `etag` for optimistic updates and fetches diff/history via UA endpoints. See [com-management/backend/src/routes/fileEditor.ts](com-management/backend/src/routes/fileEditor.ts).
- Frontend API base is `/api/v1` with `withCredentials: true` (cookie auth). See [com-management/frontend/src/services/api.ts](com-management/frontend/src/services/api.ts).
- Frontend schema validation is done client-side with `Ajv` using the schema from backend `/api/v1/schema`. See [com-management/frontend/src/App.tsx](com-management/frontend/src/App.tsx).
- Favorites are persisted server-side in `data/favorites.json` (not DB). See [com-management/backend/src/services/favoritesStore.ts](com-management/backend/src/services/favoritesStore.ts).
- Folder overview aggregates schema validation + unknown event fields using a cached UA DB query (`DESCRIBE Event.Events`). See [com-management/backend/src/routes/folders.ts](com-management/backend/src/routes/folders.ts) and [com-management/backend/src/services/eventsSchemaCache.ts](com-management/backend/src/services/eventsSchemaCache.ts).

## Integration points
- UA REST endpoints used by proxy: `/rule/Rules/read`, `/rule/Rules/{id}`, `/rule/Rules/readDiff`, `/rule/Rules/readRevisionHistory`, plus DB query endpoint. See [com-management/backend/src/services/ua.ts](com-management/backend/src/services/ua.ts).
- Server inventory is static in code (no DB). Update [com-management/backend/src/services/serverRegistry.ts](com-management/backend/src/services/serverRegistry.ts) for new UA targets.

## Where to look for examples
- Backend route shape and error handling: [com-management/backend/src/server.ts](com-management/backend/src/server.ts).
- Frontend state management with Zustand: [com-management/frontend/src/stores/index.ts](com-management/frontend/src/stores/index.ts).
- API contract reference: [architecture/openapi-fcom-curation.yaml](architecture/openapi-fcom-curation.yaml).
