# Deliverables

This document lists the concrete deliverables currently present in the repository.

## Backend

- Express API with structured middleware and error handling
- UA client integration layer
- Session management + permissions enforcement
- Search indexer and overview aggregator
- Overrides and metadata utilities
- MIB browsing endpoints and utilities

Key files and directories:

- backend/src/server.ts
- backend/src/routes/
- backend/src/services/
- backend/src/utils/logger.ts
- backend/.env.example

## Frontend

- React + Vite application shell
- Feature modules for FCOM, PCOM, MIB, Overview
- Builder and override UI
- Friendly/Raw preview flow
- Zustand stores and API client

Key files and directories:

- frontend/src/App.tsx
- frontend/src/app/
- frontend/src/features/
- frontend/src/services/api.ts
- frontend/src/stores/

## Documentation

- README.md
- GETTING_STARTED.md
- BOOTSTRAP.md
- ROADMAP.md
- architecture/openapi-fcom-curation.yaml
- architecture/FCOM_Curation_UI_Plan.md

## Data & assets

- /root/navigator/coms (local COMs used for indexing)
- /root/navigator/ssl (optional local SSL assets)
