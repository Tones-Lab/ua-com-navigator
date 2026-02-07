# COM Management

Full‑stack application for browsing, editing, validating, and testing FCOM/PCOM content across Unified Assurance (UA) environments.

This README is the authoritative, up‑to‑date documentation for the application. It reflects the current architecture and code layout.

## Overview

The system is composed of:

- Backend API (Node.js/Express, TypeScript) that proxies UA REST endpoints and manages sessions.
- Frontend UI (React + Vite) with a modular feature layout (FCOM, PCOM, MIB, Overview).
- Local COMs indexer used for search and overview aggregation.

## Current capabilities

- Multi‑server UA sessions (basic or certificate auth)
- FCOM browser + favorites + search
- Friendly/Raw preview, inline edits, and override flows
- Builder (literal/eval/processor) with undo/redo
- Overrides management with metadata and history
- Overview dashboard with vendor summaries
- MIB browser with stub generation hooks
- Trap testing utilities

## Repository layout

```
com-management/
├── backend/
│   ├── src/
│   │   ├── server.ts
│   │   ├── routes/         # REST API endpoints
│   │   ├── services/       # UA client, session, indexing
│   │   ├── middleware/
│   │   ├── types/
│   │   └── utils/
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/            # App shell and tabs
│   │   ├── features/       # Feature modules (fcom, pcom, mib, overview)
│   │   ├── services/       # API client
│   │   ├── stores/         # Zustand stores
│   │   └── types/
│   ├── package.json
│   └── vite.config.ts
├── architecture-overrides.md
├── BOOTSTRAP.md
├── DELIVERABLES.md
├── GETTING_STARTED.md
├── ROADMAP.md
└── README.md
```

## Quick start

### Prerequisites

- Node.js 18+
- npm 9+

### Install

```bash
cd /root/navigator/com-management
npm install
```

### Run (recommended)

```bash
# Backend (port 3001)
cd backend && npm run dev

# Frontend (port 5173)
cd ../frontend && npm run dev -- --host 0.0.0.0 --port 5173
```

### Run via workspace

```bash
cd /root/navigator/com-management
npm run dev
```

## Configuration

Backend configuration is driven by environment variables (see [backend/.env.example](backend/.env.example)).

### Backend env vars

| Variable                     | Default                                         | Description                               |
| ---------------------------- | ----------------------------------------------- | ----------------------------------------- |
| PORT                         | 3001                                            | API port                                  |
| NODE_ENV                     | development                                     | Node environment                          |
| FRONTEND_URL                 | https://localhost:5173                          | Allowed CORS origin                       |
| LOG_LEVEL                    | info                                            | Logger level                              |
| SSL_KEY_PATH                 | /opt/assure1/etc/ssl/Web.key                    | Enable HTTPS if key+cert exist            |
| SSL_CERT_PATH                | /opt/assure1/etc/ssl/Web.crt                    | Enable HTTPS if key+cert exist            |
| COOKIE_SECURE                | false                                           | Force secure session cookies              |
| UA_AUTH_BASIC_ENABLED        | true                                            | Enable basic auth                         |
| UA_AUTH_CERT_ENABLED         | true                                            | Enable certificate auth                   |
| UA_TLS_INSECURE              | false                                           | Allow insecure TLS when calling UA        |
| UA_TLS_CERT_PATH             |                                                 | Client cert path (UA calls)               |
| UA_TLS_KEY_PATH              |                                                 | Client key path (UA calls)                |
| UA_TLS_CA_PATH               |                                                 | CA bundle path (UA calls)                 |
| COMS_ROOT                    | /root/navigator/coms                            | Local COMs root for indexing/search       |
| COMS_PATH_PREFIX             | id-core/default/processing/event/fcom/\_objects | Path prefix applied to search results     |
| SEARCH_MAX_CONTENT_BYTES     | 5242880                                         | Max file bytes indexed for content search |
| EVENTS_SCHEMA_TTL_MS         | 900000                                          | Cache TTL for event schema                |
| EVENTS_SCHEMA_PATH           | backend/data/events-schema.json                 | Fallback schema path                      |
| CACHE_TTL_MS                 | 600000                                          | Cache freshness window for stale refresh  |
| SEARCH_CACHE_TTL_MS          | 600000                                          | Search cache freshness window             |
| OVERVIEW_CACHE_TTL_MS        | 600000                                          | Overview cache freshness window           |
| FOLDER_OVERVIEW_TTL_MS       | 600000                                          | Folder cache freshness window             |
| OVERVIEW_PAGE_LIMIT          | 500                                             | UA page size for overview indexing        |
| OVERVIEW_REFRESH_INTERVAL_MS | 3600000                                         | Overview refresh interval                 |
| SEARCH_LIST_RETRIES          | 3                                               | Search list retry attempts                |
| SEARCH_LIST_RETRY_DELAY_MS   | 500                                             | Search list retry base delay (ms)         |
| SEARCH_READ_RETRIES          | 3                                               | Search read retry attempts                |
| SEARCH_READ_RETRY_DELAY_MS   | 500                                             | Search read retry base delay (ms)         |
| OVERVIEW_LIST_RETRIES        | 3                                               | Overview list retry attempts              |
| OVERVIEW_LIST_RETRY_DELAY_MS | 500                                             | Overview list retry base delay (ms)       |
| OVERVIEW_READ_RETRIES        | 3                                               | Overview read retry attempts              |
| OVERVIEW_READ_RETRY_DELAY_MS | 500                                             | Overview read retry base delay (ms)       |
| FOLDER_LIST_RETRIES          | 3                                               | Folder list retry attempts                |
| FOLDER_LIST_RETRY_DELAY_MS   | 500                                             | Folder list retry base delay (ms)         |
| FOLDER_READ_RETRIES          | 3                                               | Folder read retry attempts                |
| FOLDER_READ_RETRY_DELAY_MS   | 500                                             | Folder read retry base delay (ms)         |
| UA_DB_QUERY_ENDPOINT         | /database/queryTools/executeQuery               | UA DB query endpoint                      |
| UA_DB_QUERY_NAME             | Event                                           | UA query DB name                          |
| UA_DB_QUERY_ID               |                                                 | UA query DB id                            |
| UA_DB_QUERY_SHARD            |                                                 | UA query shard id                         |
| UA_DB_QUERY_LIMIT            | 100                                             | UA query limit                            |
| A1BASEDIR                    | /opt/assure1                                    | UA base directory for MIB tooling         |
| UA_MIB_DIR                   | $A1BASEDIR/distrib/mibs                         | MIB root for browsing                     |
| UA_MIB2FCOM_BIN              | $A1BASEDIR/bin/sdk/MIB2FCOM                     | MIB2FCOM binary path                      |
| UA_SNMP_TRAP_CMD             | snmptrap                                        | snmptrap executable                       |
| MIBS                         |                                                 | Extra MIB search path for SNMP tools      |

Frontend configuration is code‑driven; no env vars are required by default.

## Cache lifecycle (stale-while-revalidate)

Search, overview, and folder caches are designed to never disappear due to TTL expiry.
Instead, each cache entry stores an `expiresAtMs` timestamp:

- Fresh cache entries are served immediately.
- Stale cache entries are still served immediately, and a background rebuild is queued.
- Missing cache entries trigger a rebuild and return a 503 only when there is no cached data.

The `*_TTL_MS` values define the freshness window only. Redis keys are persisted without
expiration to preserve usability during transient outages.

When staleness is detected, the backend logs a line such as:

"Search cache stale; serving cached data and scheduling refresh"

Status endpoints expose `isStale` and `nextRefreshAt` so the UI can show refresh timing
without forcing users to wait for rebuilds.

## Monitoring and runbook

Recommended checks (systemd + journald):

```bash
systemctl status com-management-backend --no-pager
journalctl -u com-management-backend.service -n 200 --no-pager
```

Common log patterns:

- Cache completion: `Search index COMPLETE`, `Overview index COMPLETE`, `Folder cache COMPLETE`
- Stale serve + refresh: `cache stale; serving cached data and scheduling refresh`
- Warmup staleness: `Cache warmup: ... cache stale; scheduling refresh`
- Rebuild failures: `rebuild failed` / `rebuild error`

If rebuild failures persist, increase retry/backoff env vars and confirm UA connectivity.

## Tests

Backend unit tests (cache staleness):

```bash
cd /root/navigator/com-management/backend
npm test
```

## Backend API surface

Base path: /api/v1

- auth/ — login, logout, session
- servers/ — list and switch UA servers
- files/ — browse, read, save, diff, history, tests
- schema/ — FCOM JSON schema
- favorites/ — favorites CRUD
- folders/ — folder overview cache
- events/schema — UA events schema cache
- search/ — local COMs index search + rebuild
- overrides/ — override read/write/history
- broker/ — broker server data
- mibs/ — MIB browsing + stub generation
- overview/ — aggregated vendor overview

See [architecture/openapi-fcom-curation.yaml](../architecture/openapi-fcom-curation.yaml) for full details.

## Frontend architecture

Key locations:

- app/AppTabs.tsx — top‑level navigation
- features/fcom — FCOM browser, preview, builder, overrides
- features/overview — overview dashboard
- features/pcom — PCOM view
- features/mib — MIB browser
- services/api.ts — API client
- stores/ — session + UI state

## Sessions & permissions

Sessions are tracked by the FCOM_SESSION_ID cookie. The backend enforces read‑only sessions when UA permissions do not allow edits; the UI mirrors this by disabling edit controls.

## Favorites backup & restore (critical)

Favorites are stored in Redis. Use the helper scripts in backend/scripts to export and restore them when validating persistence or recovering from data loss.

Export current favorites to a JSON backup:

```bash
cd /root/navigator/com-management/backend
npx tsx scripts/export_favorites_from_redis.ts
```

Restore favorites from a JSON backup:

```bash
cd /root/navigator/com-management/backend
FAVORITES_JSON_PATH=/absolute/path/to/favorites.backup.json npx tsx scripts/migrate_favorites_to_redis.ts
```

Defaults and overrides:

- Export path default: backend/data/favorites.backup.json (override with FAVORITES_EXPORT_PATH)
- Import path default: backend/data/favorites.json (override with FAVORITES_JSON_PATH)

## Overrides model

Overrides are stored under:

```
/core/default/processing/event/fcom/overrides/<vendor>.override.json
```

Overrides are read and updated via /api/v1/overrides and merged into the friendly view for editing.

## Deployment notes

- Backend can run behind a reverse proxy or directly. If SSL key/cert are present, HTTPS is enabled.
- Frontend is built with Vite (static output) and can be served by any web server.
- CORS is controlled by FRONTEND_URL and default local origins.

## Documentation index

- Getting started: [GETTING_STARTED.md](GETTING_STARTED.md)
- Current status: [BOOTSTRAP.md](BOOTSTRAP.md)
- Deliverables: [DELIVERABLES.md](DELIVERABLES.md)
- Roadmap: [ROADMAP.md](ROADMAP.md)

## Support

UA REST API reference:
https://docs.oracle.com/en/industries/communications/unified-assurance/6.1.1/rest-api/
