# COM Management - Getting Started

## ✅ What's Complete

The app now includes a working end-to-end flow (login → browse → edit → save) with real UA integrations.

### Deliverables

1. **OpenAPI 3.0 Specification** (`architecture/openapi-fcom-curation.yaml`)
   - Complete REST API contract for all 6 phases
   - Dual authentication (basic + certificate TLS)
   - 20+ endpoints mapped to UA server operations
   - Ready for Swagger UI, code generation, or manual testing

2. **Backend (Express.js + TypeScript)**
   - UA REST API proxy for rules read/save/diff/history
   - Overrides support + metadata
   - UA Events schema cache (DB query tool)
   - Session + permissions enforcement

3. **Frontend (React + Vite + Oracle JET)**
   - File browser + favorites + search
   - Friendly/Raw view of FCOM objects
   - Override editing + eval builder
   - Add field from Events schema
   - Save + commit message flow

4. **Monorepo Structure**
   - Yarn workspaces supported (optional)
   - npm supported via per-package scripts

5. **Documentation**
   - `README.md` – Overview, quick start, architecture
   - `ROADMAP.md` – 8-phase development plan
   - `BOOTSTRAP.md` – This bootstrap summary
   - `openapi-fcom-curation.yaml` – API contract
   - `FCOM_Curation_UI_Plan.md` – Updated with auth & promotion details

---

## 🎯 Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Backend scaffolding | ✅ Done | Ready for UA integration |
| Frontend scaffolding | ✅ Done | Ready for JET component build |
| API contract | ✅ Done | All endpoints defined |
| Authentication framework | ✅ Done | Session + cookie middleware |
| UA service client | ✅ Done | Ready to connect to real servers |
| State management | ✅ Done | Zustand stores set up |
| Build/dev setup | ✅ Done | Vite + TypeScript compiled |
| Documentation | ✅ Done | Comprehensive |

---

## 🚀 Next Focus

- Processor builder rollout (see backlog priority order)
- Display conversions (enum/lookup)
- Global overrides awareness

---

## 📁 File Structure

```
/root/navigator/
├── architecture/
│   ├── FCOM_Curation_UI_Plan.md          (updated with auth details)
│   └── openapi-fcom-curation.yaml        (REST API contract)
│
   └── com-management/                       (NEW - full project)
    ├── backend/
    │   ├── src/
    │   │   ├── server.ts                 (Express app)
    │   │   ├── routes/
    │   │   │   ├── auth.ts               (login/logout/session)
    │   │   │   ├── servers.ts            (server mgmt)
    │   │   │   ├── fileBrowser.ts        (list/preview)
    │   │   │   ├── fileEditor.ts         (read/save/diff/history/test)
    │   │   │   └── schema.ts             (JSON schema)
    │   │   ├── services/
    │   │   │   └── ua.ts                 (UA REST API client)
    │   │   ├── types/
    │   │   │   └── index.ts              (TypeScript interfaces)
    │   │   └── utils/
    │   │       └── logger.ts             (Pino logger)
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── .env.example
    │
    ├── frontend/
    │   ├── src/
    │   │   ├── main.tsx                  (entry point)
    │   │   ├── App.tsx                   (root component)
    │   │   ├── App.css
    │   │   ├── index.css
    │   │   ├── components/               (JET components - to be built)
    │   │   ├── services/
    │   │   │   └── api.ts                (API client layer)
    │   │   ├── stores/
    │   │   │   └── index.ts              (Zustand: session + editor)
    │   │   ├── types/
    │   │   │   └── index.ts              (TypeScript interfaces)
    │   │   └── utils/
    │   ├── index.html
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── tsconfig.node.json
    │   └── vite.config.ts
    │
    ├── package.json                      (monorepo root)
    ├── README.md                         (project overview)
    ├── ROADMAP.md                        (8-phase plan)
    └── BOOTSTRAP.md                      (this file)
```

---

## 💻 Local Development

```bash
# Install all dependencies
cd /root/navigator/com-management
npm install

# Terminal 1: Backend (port 3001)
cd backend && npm run dev

# Terminal 2: Frontend (port 5173)
cd ../frontend && npm run dev -- --host 0.0.0.0 --port 5173
```

---

## 🔐 Authentication Flow

1. **User visits frontend** → Redirected to login page
2. **User selects:**
   - UA server (from dropdown)
   - Auth method (basic or certificate)
   - Credentials (user/pass or cert path)
3. **Frontend calls** `POST /api/v1/auth/login`
4. **Backend:**
   - Creates session
   - Sets HTTP-only cookie
   - Returns session details
5. **Subsequent requests:**
   - Include cookie automatically
   - Backend validates session
   - Proxies request to UA server

---

## 🏗️ Architecture Layers

```
┌─────────────────────────────────────┐
│  Frontend (React + Oracle JET)      │
│  - Login page                       │
│  - File browser                     │
│  - FCOM editor                      │
│  - Diff/history viewer              │
│  - Test UI                          │
└──────────────┬──────────────────────┘
               │ HTTP/REST (JSON)
┌──────────────▼──────────────────────┐
│  Backend (Express + TypeScript)     │
│  - Auth & session management        │
│  - UA API proxy layer               │
│  - Validation & schema              │
│  - Error handling                   │
└──────────────┬──────────────────────┘
               │ HTTP/REST
┌──────────────▼──────────────────────┐
│  Unified Assurance (UA) Server      │
│  - REST API endpoints               │
│  - SVN integration                  │
│  - File storage & versioning        │
└─────────────────────────────────────┘
```

---

## 📋 Development Checklist

- [ ] **Day 1:** Validate UA API endpoints & authentication
- [ ] **Day 2:** Derive FCOM JSON Schema
- [ ] **Day 3:** Complete UA service integration
- [ ] **Day 4:** Build login page (Oracle JET)
- [ ] **Day 5-6:** File browser + preview
- [ ] **Day 7-8:** Core FCOM editor with validation
- [ ] **Day 9-10:** Event configuration + trap viewer
- [ ] **Day 11-12:** Testing UI (single + batch)
- [ ] **Day 13-14:** Diff & history viewer
- [ ] **Day 15-16:** Cross-server comparison & promotion
- [ ] **Day 17-18:** Error handling & UX polish
- [ ] **Day 19-20:** Testing (unit + integration + e2e)

---

## 🆘 Support

### Documentation
- **API:** See `openapi-fcom-curation.yaml`
- **Project:** See `FCOM_Curation_UI_Plan.md`
- **Roadmap:** See `ROADMAP.md`
- **UA REST API:** https://docs.oracle.com/en/industries/communications/unified-assurance/6.1.1/rest-api/

### Common Issues
- **Ports in use:** Change `PORT` in backend `.env` or `port` in Vite config
- **CORS errors:** Ensure frontend proxy is configured in `vite.config.ts`
- **Build fails:** Run `yarn install` in both backend and frontend directories

---

## 🎓 Key Technologies

- **Backend:** Node.js, Express, TypeScript, Axios, Pino, AJV
- **Frontend:** React 18, Vite, TypeScript, Zustand, Axios
- **Design:** Oracle JET, Redwood CSS
- **API:** OpenAPI 3.0, REST
- **Auth:** HTTP Basic + TLS Certificates
- **Tooling:** Yarn workspaces, ESLint, TypeScript

---

**You're ready to go!** All the infrastructure is in place. Focus on the 3 critical next steps: validate UA API endpoints, derive the FCOM schema, and integrate with real UA servers. 🚀
