# PCOM Metrics Discovery (Vendor/Enterprise)

## Goal
Provide a PCOM discovery view to list metric types supported by vendor / model / enterprise, enable search, and allow drill‑down to PCOM files and overrides.

## Proposed Flow (Short‑Term)
1) **Discovery Inputs**
   - Filters: Vendor, Enterprise/Model, Search string.
2) **Results**
   - List metric types (OBJECT‑TYPE names / metric identifiers).
   - Show source (file path) and optional summary (units/type).
3) **Drill‑down**
   - Open PCOM file if present.
   - Open override file if present.

## Data Sources
- Use UA REST `rule/Rules/read` and `rule/Rules/read` browsing (same pattern as FCOM).
- PCOM root path: `/core/default/collection/metric/snmp/_objects/pcom`.
- Cache results similar to search index (build index in backend, expose `/pcom/metrics` API).

## Open Questions
- Confirm enterprise/model mapping (directory naming or metadata fields).
- Define “metric type” extraction rules from PCOM JSON.

## Follow‑ups
- Add protocol‑agnostic overrides for PCOM if needed.
- Add a separate “metric type” cache with scheduled refresh.
