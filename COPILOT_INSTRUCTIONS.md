# Copilot / Coding Agent Instructions (Repo Rules)

These rules keep operations safe and predictable in this repo.

## Service management (hard rule)

- **Do not run the app with `nohup`, backgrounding, or manual PID management.**
- **Do not write logs to `/var/log/*` from ad-hoc commands or by editing scripts to append there.**
- **Manage the app as systemd services only**:
  - Backend service: `fcom-curator-backend.service`
  - Frontend service: `fcom-curator-frontend.service`
  - Restart (canonical):
    - `systemctl restart fcom-curator-backend`
    - `systemctl restart fcom-curator-frontend`
  - Start/stop:
    - `systemctl start|stop fcom-curator-backend`
    - `systemctl start|stop fcom-curator-frontend`
  - Status:
    - `systemctl status fcom-curator-backend --no-pager`
    - `systemctl status fcom-curator-frontend --no-pager`
  - Logs:
    - `journalctl -u fcom-curator-backend -f`
    - `journalctl -u fcom-curator-frontend -f`

Reminder: after any code change, restart the affected service(s) before manual retesting.
Explicit requirement: if a code change requires a restart to take effect, you (the agent) must perform the restart of the affected service(s).

## Operational expectations

- If a service fails to start, check for **port conflicts** (e.g., previous `node` processes on 3001/5173) and stop the conflicting process before restarting the services.
- If a change requires altering runtime behavior, prefer **changing code/config**, not inventing new daemonization/log redirection behavior.

## Build/version discipline

- If API behavior changes (routes, response shapes, validation, auth flows), update:
  - [architecture/openapi-fcom-curation.yaml](architecture/openapi-fcom-curation.yaml)
  - Related README/plan docs when applicable.

## UA REST API payload rules (hard rule)

- **Only send fields explicitly documented or required by the UA REST API.**
- **Do not include extra/unknown keys** even if they appear to be tolerated by UA.

## Git commit messages

Prefer descriptive, multi-line commit messages that include what changed and why. Avoid one-line commits for non-trivial changes.

## Repo hygiene (hard rule)

- Do not commit `/coms` (large vendor data/config). It is ignored by `.gitignore`.
- Do not commit `agent.md` (local server notes). It is ignored by `.gitignore`.
- Do not commit `.env` files (use `.env.example` for documentation).

## Testing discipline

- Prefer deterministic unit tests and avoid tests that require external services by default.
- If you add integration tests, gate them behind a clear env flag (e.g., `RUN_UA_INTEGRATION=1`).

## Script standards

- All runnable scripts (repo-root `*.js|*.ts` entrypoints and `scripts/*`) must start with a module docstring or header comment describing:
  - Purpose
  - Usage (canonical CLI invocation)
  - Notes/Environment (side effects, key env vars)

## UI/Frontend conventions

- The frontend is served via Vite and should remain bound to all interfaces (`--host 0.0.0.0`) for remote access.
- Keep default ports consistent unless explicitly changed:
  - Backend: 3001
  - Frontend: 5173

## Why this exists

We had issues from:
- multiple manually started dev servers competing for ports
- ad-hoc log redirection outside systemd

This file is the canonical rule-set for avoiding those regressions.
