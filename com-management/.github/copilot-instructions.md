# Copilot instructions for COM Management

## Big picture

- Full-stack monorepo: React/Vite frontend + Express/TypeScript backend. Frontend calls backend; backend proxies to Unified Assurance (UA) REST API and SVN. See ../README.md.
- Request flow: UI → backend `/api/v1/*` → UA REST API `/api/*`. The UA proxy client is in ../backend/src/services/ua.ts.
- Auth is cookie-based sessions (HTTP-only `FCOM_SESSION_ID`) stored in memory maps; restarts clear sessions. See ../backend/src/services/sessionStore.ts and ../backend/src/routes/auth.ts.

## Key workflows

- Dev: `npm run dev` at repo root runs backend + frontend workspaces. Scripts defined in ../package.json.
- Backend dev/build/test: `npm run -w backend dev|build|test|lint` (see ../backend/package.json).
- Frontend dev/build: `npm run -w frontend dev|build|lint` (see ../frontend/package.json).

## Project-specific patterns

- Backend uses HTTPS if SSL certs exist (env `SSL_KEY_PATH`/`SSL_CERT_PATH`), otherwise HTTP; CORS allowlist is in ../backend/src/server.ts.
- UA API calls are centralized in `UAClient`; routes build a client from session credentials with `UA_TLS_INSECURE` for TLS bypass. Example usage in ../backend/src/routes/fileEditor.ts.
- File editing uses `etag` for optimistic updates and fetches diff/history via UA endpoints. See ../backend/src/routes/fileEditor.ts.
- Frontend API base is `/api/v1` with `withCredentials: true` (cookie auth). See ../frontend/src/services/api.ts.
- Frontend schema validation is done client-side with `Ajv` using the schema from backend `/api/v1/schema`. See ../frontend/src/App.tsx.
- Favorites are persisted server-side in `data/favorites.json` (not DB). See ../backend/src/services/favoritesStore.ts.
- Folder overview aggregates schema validation + unknown event fields using a cached UA DB query (`DESCRIBE Event.Events`). See ../backend/src/routes/folders.ts and ../backend/src/services/eventsSchemaCache.ts.

## Integration points

- UA REST endpoints used by proxy: `/rule/Rules/read`, `/rule/Rules/{id}`, `/rule/Rules/readDiff`, `/rule/Rules/readRevisionHistory`, plus DB query endpoint. See ../backend/src/services/ua.ts.
- Server inventory is static in code (no DB). Update ../backend/src/services/serverRegistry.ts for new UA targets.
- When broker server read access is available, prefer validating inventory with `/broker/servers` (implemented in `UAClient.getBrokerServers`).

## Where to look for examples

- Backend route shape and error handling: ../backend/src/server.ts.
- Frontend state management with Zustand: ../frontend/src/stores/index.ts.
- API contract reference: ../../architecture/openapi-fcom-curation.yaml.
