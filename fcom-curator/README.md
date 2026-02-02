# FCOM Curation & Management Interface

Full-stack application for managing FCOM rule files across multiple Unified Assurance (UA) server environments.

## Project Structure

```
fcom-curator/
├── backend/              # Node.js/Express API server
│   ├── src/
│   │   ├── server.ts     # Express app setup
│   │   ├── routes/       # API route handlers
│   │   ├── services/     # Business logic & UA integration
│   │   ├── middleware/   # Auth, logging, etc.
│   │   ├── types/        # TypeScript interfaces
│   │   └── utils/        # Helpers & logger
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── frontend/             # React + Vite + Oracle JET
│   ├── src/
│   │   ├── components/   # Reusable UI components (JET-based)
│   │   ├── services/     # API client layer
│   │   ├── stores/       # Zustand state management
│   │   ├── types/        # Shared TypeScript types
│   │   ├── utils/        # Helper functions
│   │   ├── App.tsx       # Root component
│   │   └── main.tsx      # Entry point
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── .env.example
│
├── architecture/         # Documentation & API specs
│   ├── FCOM_Curation_UI_Plan.md        # Project plan
│   └── openapi-fcom-curation.yaml      # OpenAPI 3.0 spec
│
└── package.json          # Monorepo root (yarn workspaces)
```

## Quick Start

### Prerequisites
- Node.js 18+
- npm 9+ (or Yarn 3.x)

### Installation

```bash
# From project root (npm)
npm install

# Or install individual workspaces
cd backend && npm install
cd ../frontend && npm install
```

### Development

```bash
# Recommended: run individually (npm)
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev -- --host 0.0.0.0 --port 5173
```

Frontend will be available at `http://localhost:5173`
Backend API at `http://localhost:3001`

### Building for Production

```bash
# If using yarn workspaces
yarn build
```

### Running in Production

```bash
# Backend
cd backend && npm run start

# Frontend
cd frontend && npm run preview
```

## Architecture Overview

### Backend API
- **Framework:** Express.js (Node.js)
- **Authentication:** Basic auth + TLS certificate support against UA REST API
- **SVN Integration:** Proxies to UA REST API for SVN operations
- **Endpoints:**
  - Authentication (`/api/v1/auth/*`)
  - Server configuration (`/api/v1/servers/*`)
  - File browser (`/api/v1/files/browse`)
  - File editor (`/api/v1/files/read`, `/save`, `/diff`, `/history`)
  - Testing (`/api/v1/files/:id/test`, `/test-all`)
  - Schema (`/api/v1/schema`)

### Frontend UI
- **Framework:** React 18 + Vite
- **Design System:** Oracle Redwood (via JET/Preact components)
- **State Management:** Zustand
- **Key Features:**
  - Multi-server session management
  - File browser with search/filtering
  - Friendly/Raw view for FCOM objects
  - Overrides UI with per-field edit/preview
  - Eval builder (friendly + raw)
  - Add field from Events schema
  - Save + commit message flow
  - Real-time validation against FCOM JSON schema

## MIB Browser Definitions (Design)

- **Notification (Fault/FCOM):** `NOTIFICATION-TYPE` or `TRAP-TYPE` definitions. These map to FCOM objects.
- **Metric (Performance/PCOM):** `OBJECT-TYPE` with numeric/measurement syntax (e.g., Counter32/Counter64, Gauge32, Integer32, Unsigned32, TimeTicks). These map to PCOM items.
- **Primary action logic (UI):**
  - If matching FCOM exists (object name/OID via snmptranslate): **View FCOM**.
  - If missing: **Create FCOM Override** (override-first for new content).
  - Metrics: **PCOM (Coming soon)** placeholder.

**Design decision:** Use `snmptranslate` (Net-SNMP) for MIB parsing/metadata extraction to ensure consistency and accuracy in the UI.

## Authentication

### Basic Authentication
```json
{
  "server_id": "prod-ua-01",
  "auth_type": "basic",
  "username": "api",
  "password": "secret"
}
```

### Certificate-Based Authentication
```json
{
  "server_id": "prod-ua-01",
  "auth_type": "certificate",
  "cert_path": "/etc/ssl/User-api.crt",
  "key_path": "/etc/ssl/User-api.key",
  "ca_cert_path": "/etc/ssl/BundleCA.crt"
}
```

## API Integration Points

### Unified Assurance REST API
- **Rules endpoints:** `/api/rule/Rules/read`, `/update`, `/readDiff`, `readRevisionHistory`
- **Authentication:** Against UA server directly (proxied through backend)
- **SVN:** Commits/reverts handled via UA REST API

**Reference:** https://docs.oracle.com/en/industries/communications/unified-assurance/6.1.1/rest-api/

## Configuration

### Backend (.env)
```
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
LOG_LEVEL=info

# Auth flags
UA_AUTH_BASIC_ENABLED=true
UA_AUTH_CERT_ENABLED=true

# UA TLS options
UA_TLS_INSECURE=true
UA_TLS_CERT_PATH=
UA_TLS_KEY_PATH=
UA_TLS_CA_PATH=

# COMs indexing
COMS_ROOT=/root/navigator/coms
COMS_PATH_PREFIX=id-core/default/processing/event/fcom/_objects
```

### Frontend
No env required by default. The frontend proxies API calls to the backend.

## Admin/Backend Notes
- UA server list is configured in [backend/src/services/serverRegistry.ts](backend/src/services/serverRegistry.ts).
- Permissions: users without rule update rights see read-only UI (no Edit controls).
- Overrides are stored in `/core/default/processing/event/fcom/overrides/<vendor>.override.json`.

## UI Workflow (Quick)
1. Login (basic or certificate auth).
2. Browse folders or search.
3. Open a file (Friendly/Raw toggle).
4. Enable Edit (if permitted) to update event fields or overrides.
5. Use Builder for eval expressions or raw edit.
6. Save with a commit message.

## Development Workflow

1. **Schema First:** Start with the FCOM JSON Schema (Phase 1)
2. **Backend API:** Implement core routes (Phase 1-2)
3. **Frontend Layout:** Build navigation & shell (Phase 1)
4. **File Editor:** Implement read/edit/validate (Phase 2)
5. **Advanced Features:** Testing, comparison, promotion (Phase 3-4)

## Testing Strategy

- **Unit Tests:** Components, services, schema validation
- **Integration Tests:** API + UA server mocking
- **E2E Tests:** Critical workflows (login → edit → save → test)

## Deployment

- **Backend:** Node.js container (Docker recommended)
- **Frontend:** Static build deployed to CDN or web server
- **Reverse Proxy:** Nginx/HAProxy to serve both

## Support & Documentation

- **API Docs:** See `architecture/openapi-fcom-curation.yaml` (can be imported into Postman, Swagger UI, etc.)
- **Project Plan:** `architecture/FCOM_Curation_UI_Plan.md`
- **UA REST API:** https://docs.oracle.com/en/industries/communications/unified-assurance/6.1.1/rest-api/

## Next Steps

1. **Clarify UA API Details:** Confirm exact endpoints for file operations
2. **Derive FCOM Schema:** Analyze existing `.json` files → create JSON Schema
3. **Implement UA Service:** Build client for UA REST API calls
4. **Build Login UI:** Oracle JET form component
5. **Build File Browser:** Tree + search with preview pane
