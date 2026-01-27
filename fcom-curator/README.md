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
- Yarn 3.x

### Installation

```bash
# From project root
yarn install

# Or install individual workspaces
cd backend && yarn install
cd ../frontend && yarn install
```

### Development

```bash
# From project root - runs both backend and frontend
yarn dev

# Or individually:
# Terminal 1
cd backend && yarn dev

# Terminal 2
cd frontend && yarn dev
```

Frontend will be available at `http://localhost:5173`
Backend API at `http://localhost:3001`

### Building for Production

```bash
yarn build
```

### Running in Production

```bash
# Backend
cd backend && yarn start

# Frontend
cd frontend && yarn preview
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
  - File editor (`/api/v1/files/:id/read`, `/save`, `/diff`, `/history`)
  - Testing (`/api/v1/files/:id/test`, `/test-all`)
  - Schema (`/api/v1/schema`)

### Frontend UI
- **Framework:** React 18 + Vite
- **Design System:** Oracle Redwood (via JET/Preact components)
- **State Management:** Zustand
- **Key Features:**
  - Multi-server session management
  - File browser with search/filtering
  - Code editor with JSON validation
  - SVN diff & history viewer
  - Event testing (single & batch)
  - Real-time validation against FCOM JSON schema

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
```

### Frontend (.env)
```
VITE_API_BASE_URL=http://localhost:3001/api/v1
```

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
