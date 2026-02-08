# FCOM UI E2E Tests (Detailed)

This document describes each automated UI test in detail. All tests live in:
- com-management/frontend/tests/e2e/fcom.spec.ts

## Common behavior

- All tests log in using COM_UI_USERNAME/COM_UI_PASSWORD.
- All tests select the server by COM_UI_SERVER_LABEL when provided.
- The UI is opened via COM_UI_BASE_URL (HTTPS is expected).

## Test A: login routes to overview with a fresh URL

Goal:
- Verify login succeeds and the UI loads the Overview page with a fresh URL.

Steps:
1. Navigate to the Sign in page.
2. Select the server from the dropdown.
3. Fill username and password.
4. Click Sign in.
5. Verify Overview tab is selected.
6. Verify URL does not include file parameter and includes view=preview.

Pass criteria:
- Overview tab is active.
- URL has no file parameter and view=preview.

## Test B: navigate to A10 and open first file

Goal:
- Validate manual navigation through the folder tree and that two A10 files exist.

Steps:
1. Login.
2. Click FCOM tab.
3. Navigate the folder path:
   core -> default -> processing -> event -> fcom -> _objects -> trap -> a10
4. Verify two files exist:
   - A10-AX-MIB-FCOM.json
   - A10-AX-NOTIFICATIONS-FCOM.json
5. Click A10-AX-MIB-FCOM.json.
6. Verify the file header loads on the right panel.

Pass criteria:
- Both A10 files are visible.
- The selected file title matches A10-AX-MIB-FCOM.json.

## Test C: edit CastleRock severity and commit

Goal:
- Edit a single field and confirm the staged change count is 1.

Steps:
1. Login.
2. Navigate to CastleRock:
   core -> default -> processing -> event -> fcom -> _objects -> trap -> CastleRock
3. Open CASTLEROCK-MIB-FCOM.json.
4. Click Edit on the first object.
5. Change Severity to a new value (toggled between 2 and 5).
6. Confirm dirty indicator appears and Save is enabled.
7. Click Save.
8. Verify Review & Save shows (1) and Edited objects: 1.
9. Commit with a blank commit message.
10. Verify success banner and no error banner.

Pass criteria:
- Review & Save shows (1).
- Success banner mentions restart required.
- No error banner is shown.

Dependencies:
- None (standalone).

## Test D: remove CastleRock override and commit cleanup

Goal:
- Remove existing overrides and leave a clean object with no override pills.

Steps:
1. Login.
2. Open CASTLEROCK-MIB-FCOM.json.
3. Click Edit.
4. If override remove buttons are present, click all of them.
5. Save and commit the staged removal.
6. Verify no override pills remain in the object card.

Pass criteria:
- Override pills count is 0 after commit.

Dependencies:
- None. It skips the commit if no overrides exist.

## Test E: update two fields then remove all overrides

Goal:
- Change two fields, verify staged count is 2, then remove all overrides.

Steps:
1. Login.
2. Open CASTLEROCK-MIB-FCOM.json.
3. If Remove All Overrides is present, run cleanup and commit.
4. Click Edit.
5. Set Severity to 5 and Expire Time to 1.
6. Save.
7. Verify Review & Save shows (2) and Edited objects: 1.
8. Open Review staged changes and verify two field changes.
9. Commit with a blank commit message.
10. Re-open Edit, click Remove All Overrides, confirm Yes.
11. Save.
12. Verify Review & Save shows (2).
13. Commit and confirm success banner.
14. Verify no override pills remain.

Pass criteria:
- Review & Save shows (2) after the two-field edit.
- Review modal shows two staged field changes.
- Final state has zero override pills.

Dependencies:
- None. Includes cleanup before and after.

## Test F: add second override after first save

Goal:
- Validate sequential saves on the same object produce two staged changes.

Steps:
1. Login.
2. Open CASTLEROCK-MIB-FCOM.json.
3. Edit Severity, Save (stages 1 change).
4. Edit Expire Time, Save (stages 2 total changes).
5. Verify Review & Save shows (2).
6. Open Review and verify two staged changes.
7. Commit and confirm success banner.

Pass criteria:
- Review & Save shows (2).
- Review modal shows two field changes.
- Success banner shown and no error banner.

Dependencies:
- None.

## Running specific tests

Single test:
```
cd com-management/frontend
npx playwright test -g "Test D: remove CastleRock override and commit cleanup"
```

Group run (CastleRock only):
```
cd com-management/frontend
npx playwright test -g "Test [CDE]"
```

Full baseline:
```
cd com-management/frontend
npx playwright test -g "Test [ABCDEF]"
```
