# UI Test Suite (Playwright)

This folder contains the Playwright end-to-end UI tests for COM Curation & Management.

## What is configured

- Playwright test runner with Chromium-only project.
- HTTPS base URL by default (self-signed certs allowed).
- Screenshots and traces captured on failure.

Config location:
- com-management/frontend/playwright.config.ts

Tests location:
- com-management/frontend/tests/e2e/fcom.spec.ts

## Prerequisites

- Frontend service running on the same host.
- Backend service running and reachable from the UI.
- A UA server configured in the login dropdown.
- Test data available:
  - A10 trap folder with exactly two files.
  - CastleRock trap folder with CASTLEROCK-MIB-FCOM.json.

## Environment variables

- COM_UI_BASE_URL: Base URL for the UI (default https://localhost:5173)
- COM_UI_SERVER_LABEL: Server dropdown label to select (optional)
- COM_UI_USERNAME: Login username (default admin)
- COM_UI_PASSWORD: Login password (default admin)

Example:
```
COM_UI_BASE_URL=https://lab-ua-tony02.tony.lab:5173 \
COM_UI_SERVER_LABEL="Lab UA (Tony02)" \
COM_UI_USERNAME=admin \
COM_UI_PASSWORD=admin \
npm -w com-management/frontend run test:e2e
```

## Run all tests

```
npm -w com-management/frontend run test:e2e
```

## Run a single test by name

```
cd com-management/frontend
npx playwright test -g "Test C: edit CastleRock severity and commit"
```

## Run a group of tests

Use a regex pattern:

```
cd com-management/frontend
npx playwright test -g "Test [CDEF]"
```

## Test independence

- Tests are designed to run independently.
- Test D and Test E both include cleanup so they can run standalone.
- If you want a full baseline sequence, run: Test A, Test B, Test C, Test D, Test E, Test F.

## Outputs

- HTML report: playwright-report/
- Artifacts: test-results/

These folders are ignored by git.
