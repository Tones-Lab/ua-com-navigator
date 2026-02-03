# Getting Started

This guide helps you run the COM Management app locally and understand the minimum configuration needed.

## Prerequisites

- Node.js 18+
- npm 9+ or Yarn 3+

## Install dependencies

```bash
cd /root/navigator/com-management
npm install
```

## Configure the backend

1) Copy the template:

```bash
cd /root/navigator/com-management/backend
cp .env.example .env
```

2) Edit .env as needed (see variable details in [README.md](README.md)).

Minimum values to verify:

- FRONTEND_URL
- UA_AUTH_BASIC_ENABLED / UA_AUTH_CERT_ENABLED
- UA_TLS_INSECURE (true for self‑signed test servers)
- COMS_ROOT (local indexer path)

## Run locally

### Backend

```bash
cd /root/navigator/com-management/backend
npm run dev
```

The backend listens on http://localhost:3001 by default. If SSL_KEY_PATH and SSL_CERT_PATH exist, HTTPS is enabled.

### Frontend

```bash
cd /root/navigator/com-management/frontend
npm run dev -- --host 0.0.0.0 --port 5173
```

Open: http://localhost:5173

## Login flow

1) Select a UA server
2) Choose auth type (basic or certificate)
3) Provide credentials or certificate paths
4) Backend sets FCOM_SESSION_ID cookie

## Smoke test

```bash
curl http://localhost:3001/health
```

## Common issues

- CORS blocked: verify FRONTEND_URL matches the frontend origin.
- UA TLS failures: set UA_TLS_INSECURE=true for test servers.
- Missing search data: ensure COMS_ROOT points at /root/navigator/coms.

## Documentation

- App overview: [README.md](README.md)
- Status summary: [BOOTSTRAP.md](BOOTSTRAP.md)
- Deliverables: [DELIVERABLES.md](DELIVERABLES.md)
