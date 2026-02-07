# Per-Object Override Files Plan

## Goal
Move FCOM overrides to one file per object, using v3 JSON Patch format, with atomic saves, retries, and rollback. Provide per-object UI visibility and direct rule links.

## Decisions
- Format: v3 JSON Patch (JSON Pointer paths).
- One file per object: vendor.mib.object.override.json (forced lowercase, normalized).
- Save is atomic with 1-2 retries per failed file, then rollback of all prior writes.
- Removing an override leaves a schema-valid no-op file with processors: [].
- Per-object hover metadata uses SVN last-changed author/time.

## Scope
- Backend: save pipeline for 1-N files, validation, retries, rollback, SVN metadata reads.
- Frontend: per-object override pills, hover audit info, direct rule links, remove header override file.
- Migration: split any multi-object overrides into per-object files.

## Backend Changes
1. File naming
   - Implement normalization: lowercase, replace unsupported characters, ensure stable mapping from @objectName.
   - Store a mapping rule to show the original object name in the UI.

2. Save transaction
   - Build a per-object change set from the editor state.
   - Validate each object override payload (schema validation for v3).
   - For each file in the change set:
     - Retry write 1-2 times on failure.
     - Record whether it was create or update.
   - If any file still fails:
     - Roll back previously written files (delete new, revert updated).
     - Return a single root-cause error with per-file details.

3. Deletions
   - When override removed: write a no-op file with processors: [].
   - Do not delete files unless explicitly requested by a separate cleanup action.

4. SVN metadata
   - Query SVN last-changed author/time for each override file.
   - Expose metadata via API for per-object hover UI.

5. Direct rule links
   - Construct links using the embedded path format and URL-encode the filename.
   - Enforce allowlist path constraints and sanitize filename inputs.

## Frontend Changes
1. Editor UX
   - Remove the single override file indicator from the header.
   - Show per-object override pills with:
     - filename
     - last changed time
     - modified by
   - Indicate no-op overrides as empty (no processors) to avoid showing pills.

2. Save flow
   - Display per-object validation errors.
   - On save failure, show the root cause plus list of failed files.
   - Confirm rollback status when save fails.

3. Rule links
   - Add link icon on the override pill hover to open the rule file in the rules app.

## Migration Plan
- Detect existing multi-object override files.
- Split into one file per object using the canonical filename rule.
- Preserve original content and create a no-op file when needed.
- Provide a dry-run summary before applying changes.

## Testing
- Unit tests for filename normalization and mapping.
- Save transaction tests: success path, partial failure with rollback, retry behavior.
- Schema validation tests for v3 payloads and no-op files.
- SVN metadata fetch tests and missing metadata handling.
- UI tests for per-object pills, hover metadata, rule links, and save errors.

## Risks
- Existing duplicate overrides for the same object may cause ambiguity.
- Migration may require manual review for conflicts.
- SVN metadata access may add latency; cache results where possible.
