# Multi-object Override Save Rejected

## Summary
Saving overrides for more than one object in a single override file is rejected. The UI allows editing multiple objects, but the backend save endpoint enforces a single override object, so the second object save fails.

## Steps to Reproduce
1. Open an FCOM file that already has an override for one object.
2. Enter Edit mode for a different object in the same file.
3. Add or change an override field (e.g., Severity) and attempt to save.
4. Observe the error.

## Actual Result
Save fails with an error similar to:
- "Override file must contain a single override object."

## Expected Result
Overrides should allow 1-N objects per override file. A user should be able to edit and save overrides for multiple objects within the same source file.

## Impact
- Blocks workflows where multiple objects in the same file need overrides.
- Creates user confusion because the UI supports multi-object edits, but the backend rejects them.

## Suspected Cause
Backend validation in override save requires a single override object (overrides.length === 1). This prevents multi-object saves regardless of UI state.

## Notes
- The error appears after committing changes to a second object in the same file.
- The UI currently displays override banners and edit affordances for multiple objects, which implies multi-object override support is intended.
