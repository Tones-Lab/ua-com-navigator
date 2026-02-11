# UA Assistant Notes (Read-Only Mirror)

This is a local summary based on the read-only mirror at `.context/ua-assistant`.

## What it is
- A Python 3.9+ Flask service that exposes a chat API and admin/ops endpoints.
- Uses deterministic routing + plan-first orchestration (DecisionPlan) with audited tool calls.
- Connects to UA data sources: MySQL (live events + config), OpenSearch (historical + flow), InfluxDB (metrics), optional Neo4j (topology), UA REST API.

## Entry points and layout
- HTTP server: `.context/ua-assistant/api_server.py`
- Request facade: `.context/ua-assistant/chatbot.py`
- Core orchestration: `.context/ua-assistant/ua_assistant/orchestration/*`
- Tool definitions (LLM-callable): `.context/ua-assistant/tools.py`
- Configuration: `.context/ua-assistant/config.py`

## Primary API endpoints (from api_server.py)
- `/` serves the web UI (index.html)
- `/chat` main interaction endpoint (SSE stream)
- `/health` status/version/build
- `/metrics` usage stats
- `/metrics/prometheus` Prometheus text export
- `/mcp` JSON-RPC tool list/call + SSE session stream (optional token auth)
- `/cancel` request cancellation by session_id
- `/feedback` record LLM feedback
- `/exports/<path>` download generated files (session gated)
- `/admin/*` diagnostics and ops tools (datasource status, envelope metrics, routing trace, llm usage, config reload, etc.)

## Configuration highlights (config.py)
- All datasource locations/credentials come from env vars.
- UA REST defaults to basic auth; optional TLS cert paths are supported.
- Feature flags for plan-first routing per domain and global mode.
- Admin tool hook allows a direct tool execution via a chat string when enabled.
- MCP auth token can gate the `/mcp` endpoint.

## Orchestration flow (high level)
1. `api_server.py` receives `/chat` and streams SSE updates.
2. `chatbot.py` delegates to request pipeline and plan-first orchestration.
3. Request pipeline sanitizes input and applies routing policy.
4. DecisionPlan executes tools and collects audit data.
5. Results are rendered with envelope formatting and returned.

## Notable behaviors
- Input sanitizer strips table-like rows and logs sanitizer activations.
- Some ops endpoints are gated by `ADVANCED_LOGGING` but do not appear to require auth.
- MCP endpoint supports list/call with optional HMAC token validation.

## Questions / Unknowns
- What auth or network controls protect `/admin/*` endpoints in production?
- Is `/chat` always exposed publicly, or only behind a reverse proxy/tunnel with auth?
- What is the expected payload schema for `/chat` beyond `question`/`session_id`?
- Are there existing internal-only endpoints for COM curation workflows?
- Which tools are considered safe for direct use without human approval?
- What is the retention policy for `logs/audit_log.json` and metrics snapshots?
- What are the required UA REST endpoints and payload shapes for curation actions?
- Are there published SLAs or rate limits for backend datasource calls?
- What is the desired auth model for any new endpoint (token, mTLS, IP allowlist)?
