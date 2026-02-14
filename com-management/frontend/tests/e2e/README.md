# E2E Lab Config

This folder includes a reusable lab config for Playwright runs:

- `lab-tony02.env`

## Run with saved lab config

From `com-management/frontend`:

```bash
set -a
source tests/e2e/lab-tony02.env
set +a
npx playwright test
```

## Run builder regressions only

```bash
set -a
source tests/e2e/lab-tony02.env
set +a
npx playwright test tests/e2e/test-g.spec.ts tests/e2e/test-h.spec.ts
```