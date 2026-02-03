# Project Plan: COM Management Interface

**Goal:** To build a centralized, web-based application that interacts with multiple Unified Assurance (UA) server environments. It will allow users to safely view, search, edit, validate, test, and promote COM `.json` rule files (FCOM + PCOM) by interfacing directly with each UA server's REST API and its underlying SVN version control system.

---
## Phase 1: Multi-Server Architecture & Foundation

1.  **UI/UX Theming Strategy:**
    *   **Design System:** The user interface will be built using the **Oracle Redwood** design system to ensure a consistent and modern user experience.
    *   **Component Library:** This will be achieved by integrating the **Oracle JET (JavaScript Extension Toolkit) for Preact** component library. This provides official, production-ready components themed with Redwood.
    *   **Implementation:** The React frontend will import the necessary JET components and the Redwood theme CSS. Development will prioritize using these components (e.g., `<InputText>`, `<Button>`) over generic HTML elements.

2.  **Backend API (Proxy & Orchestrator):**
    *   **UA Server Management:** Build a secure system for managing connection details (hostname, credentials) for multiple UA presentation servers (e.g., Dev, Test, Prod).
    *   **API Abstraction Layer:** The backend will not access a local filesystem. Instead, it will act as a proxy, translating UI requests into REST API calls to the appropriate UA server.
    *   **SVN Integration:** All file operations (read, list, write) will be implemented by calling the UA REST API, which in turn interacts with SVN. The API will need to handle file check-outs, commits (saves), history logs, and diffs.
    *   **Security & Audit:** Enforce authN/authZ (e.g., OIDC + RBAC). All actions that modify files (edit, commit, promote) must be logged with user, timestamp, target server, and SVN revision info.

3.  **FCOM JSON Schema Definition:**
    *   **Derive & Host Schema:** Analyze the existing `.json` files and Oracle documentation to create a definitive JSON Schema (`.schema.json` file).
    *   **Schema API:** The backend will serve this schema via an API endpoint. The frontend will fetch it to build validation rules dynamically, ensuring consistency.

4.  **Frontend Setup (React + Vite):**
    *   **Environment Context:** The UI must be aware of the different UA server environments. A global selector will allow the user to switch the context of their entire session from one server to another.
    *   **Typed API Client:** Generate a typed client from an OpenAPI specification to ensure frontend-backend communication is robust.

---

## Phase 2: Core Browsing, Editing, and Validation

1.  **Multi-Server File Explorer:**
    *   The file browser will first prompt the user to select a UA server.
    *   It will then display the file/directory tree for that server by calling the backend API (which fetches from the server's SVN).
    *   Implement powerful search and filtering (by vendor, path, file content) that queries the selected server.

2.  **Core Editor & Validation:**
    *   **SVN-Aware Editing:** When a file is opened, it is effectively "checked out". The "Save" action triggers an SVN commit with a user-provided commit message.
    *   **Inline Diff & History:** The editor will show a real-time diff against the last committed version (HEAD from SVN). A "History" tab will display the SVN log for the file and allow users to view previous revisions.
    *   **Real-Time Schema Validation:** Use the centrally-managed schema to provide instant, field-level validation and errors.

3.  **Expert Mode:**
    *   Add a toggle to show a side-by-side view with the structured form and the raw JSON.
    *   The raw JSON editor should include syntax highlighting and **auto-formatting (pretty-printing)** for readability.

---

## Phase 3: Advanced Curation & Testing

1.  **Integrated Trap Testing:**
    *   **Single-Event Test:** Add a "Test" button within each object's editor section. This will call a backend endpoint that uses `FCOM2Test` to generate and send a test trap specifically for that single event definition.
    *   **Full-File Test:** Include a "Test All" button at the file level to iterate through all event objects and trigger a test for each one sequentially.
    *   The UI should display the outcome of these tests.

2.  **Event & Preprocessor Configuration:**
    *   (As before) Form-driven UI for `event` fields and `preProcessors`, with a helper panel showing available variables from the `trap` definition.

3.  **Processor Builder (Priority Rollout):**
    *   Roll out processor support in this order:
        1) set
        2) regex
        3) convert
        4) math
        5) append/concat
        6) map/lookup
        7) split
        8) substr
        9) strcase
        10) length
        11) date
    *   **UI concept:** Use a right-side Processor drawer (similar to Builder) with Select → Configure → Review steps to avoid crowding the Event panel.

4.  **Advanced Flow (Global + Object) — Persistence & Visibility**
    *   **Persistence:** Advanced flows are stored as override processors (global pre/post or object-level processors). They are not applied to a field unless explicitly added via Builder → Apply.
    *   **Commit Flow:** Advanced flow changes create a pending override update and trigger the commit modal. SVN commits only happen after a user confirms a commit message.
    *   **Visibility in Friendly View:**
        - Object header shows **Override** and **Advanced Flow** pills when object-level flows exist.
        - File header shows a **Global Advanced Flow** badge when global pre/post flows exist.
        - A “Pending Advanced Flow changes” banner appears when edits haven’t been committed.
    *   **Processor Summary UI:** Field-level processor overrides show a summary tooltip/card (type + key params), with a “View in Advanced Flow” link and optional JSON toggle.
    *   **Raw JSON Access:** The Advanced Flow modal keeps a JSON preview for power users. Friendly view avoids raw JSON unless explicitly requested.

---

## Phase 4: Cross-Environment Management

1.  **Cross-Server Diffing:**
    *   Implement a "Compare" feature that allows a user to select a file and then choose another server to compare it against (e.g., `diff my-rule.json on DEV vs. PROD`).
    *   The UI will display a side-by-side or merged diff view, highlighting differences.

2.  **File Promotion Workflow:**
    *   Create a "Promote" feature that allows a user to push a file from a source server (e.g., Dev) to a target server (e.g., Test or Prod).
    *   This workflow will include guardrails: display a final `diff` for review, require confirmation, and use the backend to orchestrate the check-out/commit operation on the target server's SVN repository.

---

## Phase 5: Quality, Observability, and Documentation

1.  **Testing Strategy:**
    *   Unit tests for UI components; integration tests for backend API calls to a mock UA server; and end-to-end tests for critical user flows like **Open -> Edit -> Validate -> Commit (Save)** and **Diff -> Promote**.
2.  **Observability & UX:**
    *   (As before) Structured logs, API metrics, and user-facing help (tooltips, doc links, undo functionality).
3.  **Operational Runbook:**
    *   Document the setup for connecting to UA servers, managing credentials, and the process for updating the central FCOM JSON schema.

---

## Phase 6: Future Enhancements (Post-Launch)

1.  **Rudimentary MIB Browser & Initial File Generation:**
    *   **Goal:** Streamline the creation of new **FCOM (Fault) and PCOM (Performance)** files directly from vendor MIBs, expanding the tool from a pure editor to a foundational rules-creation assistant.
    *   **MIB Upload & Parsing:** Implement a feature to upload one or more MIB files. The backend will parse them and make their structure browsable.
        *   **Design decision:** Use `snmptranslate` (Net-SNMP) as the source of truth for MIB parsing/metadata extraction to keep UI data consistent and accurate.
    *   **MIB Tree Viewer:** Add a new UI view that presents a classic MIB tree, allowing users to navigate OIDs.
    *   **FCOM/PCOM Stub Generation:** Allow users to select a `NOTIFICATION-TYPE` (for FCOM) or other OIDs (for PCOM) from the MIB tree and click a "Generate Stub" button. This action will trigger a backend process, similar to Oracle's `MIB2FCOM` utility, to create a basic, un-curated `.json` file. This new file can then be saved to the server and opened in the main editor for full curation.
    *   **Entity Definitions & UI Expectations:**
        - **Notification (Fault/FCOM):** `NOTIFICATION-TYPE` or `TRAP-TYPE` definitions. These map to FCOM objects.
        - **Metric (Performance/PCOM):** `OBJECT-TYPE` with numeric/measurement syntax (e.g., Counter32/Counter64, Gauge32, Integer32, Unsigned32, TimeTicks). These map to PCOM items.
        - **Primary actions:**
            - If a matching FCOM object exists: show **View FCOM**.
            - If no FCOM exists: show **Create FCOM Override** (new content should be override-first).
            - If metric: show **PCOM (Coming soon)** placeholder.
        - **Matching logic:** resolve by object name and OID using `snmptranslate` to avoid mismatches.

2.  **LLM Assistant (Server-Side, Suggestions-Only):**
    *   **Near-term scope:** Assist with discrete edits on existing FCOM files (e.g., recommend a processor or draft a processor configuration).
    *   **Access control:** Only available to users with edit permissions.
    *   **Context pack:** Current file + overrides + active drafts/unsaved edits are included in the request.
    *   **Providers:** OpenAI + OCI (reuse prior UA chatbot integration patterns).
    *   **RAG:** Optional vector store for UA/FCOM documentation, schemas, and internal guides.
    *   **UX:** A right-side “Help” drawer is preferred to keep editing context visible. Suggestions require user confirmation.
    *   **Long-term scope:** New FCOM generation from MIBs once MIB Browser/Mib2FCOM integration lands.