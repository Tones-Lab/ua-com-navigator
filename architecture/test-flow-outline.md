# Test Flow Outline (Stabilization)

Date: 2026-02-17
Owner:
Scope: Local smoke + regression coverage for refactor stabilization

## What is a "test flow"?
A test flow is one complete user journey from start to finish (UI actions + expected outcomes).

- Example: Sign in -> open FCOM file -> edit one field -> save -> verify success state.
- Flows are broader than a unit test and narrower than full exploratory testing.
- We use flows to define what must be stable before resuming refactor work.
- Label rule: `Save & Review (X)` uses a numeric change count in parentheses. For the current single-change flows in this document, the value is `1` (`Save & Review (1)`).

---

## Global Environment Notes

- App mode/environment:
- Test account/role:
- Data source (synthetic fixture vs real data):
- Known environment constraints:
- Browser(s):

---

## Pre-Test Baseline Gate (SVN version check + optional revert)

Purpose: Ensure the override rules file starts on a known baseline revision/release (v2 processors) before flows that validate `Remove all Overrides` and `Convert to v3` behavior.

Baseline target (current validated value):
- File: `core/default/processing/event/fcom/overrides/castlerock.castlerock-mib.dummytrap.override.json`
- PathID: `id-core/default/processing/event/fcom/overrides/castlerock.castlerock-mib.dummytrap.override.json`
- Expected baseline revision id: `226`
- Expected baseline revision label: `r226 [2026-02-17] [admin] (edit) REQUIRED FOR TESTING - v2 processors in place`
- Processor expectation at baseline: `v2`

Validation + setup steps (run before dependent flows):
1. Resolve `file_id` for `core/default/processing/event/fcom/overrides/castlerock.castlerock-mib.dummytrap.override.json`.
2. Call `GET /api/v1/files/:file_id/history?limit=20&offset=0`.
3. Verify latest revision metadata matches the expected baseline marker.
4. If baseline does not match, call `POST /api/v1/files/:file_id/revert` with body:
	- `revision`: target baseline revision id.
	- `commit_message`: test baseline reset message.
5. Re-run history/read checks and verify `RevisionID`/`LastRevision` is `226`.
6. Start the next dependent test flow only after baseline check passes.
7. If baseline cannot be confirmed after revert, stop the run and mark the flow as blocked.

Mandatory prerequisite rule:
- For every dependent flow, this gate must pass first: check current version -> revert if different -> re-check version -> then continue with the test.

Pass criteria:
- File is confirmed at the expected baseline revision/release before tests begin.
- Baseline content reflects v2 processor state required by the test scenario.

---

## Flow Priority Model

- P0: Must pass before any new refactor work.
- P1: Important regression coverage (next wave).
- P2: Nice-to-have / broader confidence.

---

## Flow Entry Template (copy per flow)

### Flow ID: FLOW-XXX
- Priority: P0 | P1 | P2
- Area: Auth | FCOM | PCOM | MIB | Header | Modal | Save/Commit | Other
- Title:
- Intent (why this flow matters):

#### Preconditions
- User/session state:
- Required data fixture:
- App/tab starting point:

#### UI Steps (exact clicks)
1.
2.
3.

#### Expected Results
- UI outcome:
- Data/state outcome:
- API/network outcome (if relevant):

#### Known Issues / Exceptions
- Known bug reference:
- Temporary expected failure? Yes/No
- If Yes, current observed behavior:

#### Automation Notes (for Playwright)
- Candidate selectors:
- Flaky areas/race conditions to guard:
- Cleanup/reset needed after run:

---

## Suggested Initial P0 Flow Set

### FLOW-P0-001
- Priority: P0
- Area: Auth
- Title: Basic login (full access user)
- Intent (why this flow matters): Verify successful authentication and full-access authorization behavior for FCOM/PCOM editing surfaces.

#### Preconditions
- User/session state: Logged out.
- Required data fixture: Server option `Lab UA (Tony02) (lab-ua-tony02.tony.lab)` is available.
- App/tab starting point: Login page at `https://lab-ua-tony02.tony.lab:5173/`.

#### UI Steps (exact clicks)
1. Navigate to `https://lab-ua-tony02.tony.lab:5173/`.
2. In server dropdown, select `Lab UA (Tony02) (lab-ua-tony02.tony.lab)`.
3. Enter username `admin`.
4. Enter password `admin`.
5. Submit login.
6. Verify tabs are visible at top; click `FCOM`, then `PCOM`.
7. Verify `READ-ONLY ACCESS` pill is NOT visible in top-left area.
8. Go to `FCOM` tab.
9. In navigation tree, click `_objects`.
10. Click `trap`.
11. Click `CastleRock`.
12. Click `CASTLEROCK-MIB-FCOM.json`.

#### Expected Results
- UI outcome:
	- Login succeeds.
	- Top tabs are visible.
	- `READ-ONLY ACCESS` pill is not shown.
	- File path opens in FCOM browser.
	- Under object `CASTLEROCK-MIB::dummyTrap`, an `Edit` button exists in the top-right corner of that object section.
- Data/state outcome: Session resolves with full-access permissions.
- API/network outcome (if relevant): Auth request succeeds; file browse/file load requests succeed.

#### Known Issues / Exceptions
- Known bug reference: None provided.
- Temporary expected failure? No

#### Automation Notes (for Playwright)
- Candidate selectors: `TBD by team for top-right Edit button in object section CASTLEROCK-MIB::dummyTrap`.
- Flaky areas/race conditions to guard: Wait for tree node and file load completion before asserting edit controls.
- Cleanup/reset needed after run: Logout (or clear session) before next auth flow.

### FLOW-P0-002
- Priority: P0
- Area: Auth
- Title: Basic login (restricted read-only user)
- Intent (why this flow matters): Verify read-only authorization behavior prevents edit operations while preserving navigation access.

#### Preconditions
- User/session state: Logged out.
- Required data fixture: Server option `Lab UA (Tony02) (lab-ua-tony02.tony.lab)` is available.
- App/tab starting point: Login page at `https://lab-ua-tony02.tony.lab:5173/`.

#### UI Steps (exact clicks)
1. Navigate to `https://lab-ua-tony02.tony.lab:5173/`.
2. In server dropdown, select `Lab UA (Tony02) (lab-ua-tony02.tony.lab)`.
3. Enter username `admin1`.
4. Enter password `admin1`.
5. Submit login.
6. Verify tabs are visible at top; click `FCOM`, then `PCOM`.
7. Verify `READ-ONLY ACCESS` pill IS visible in top-left area.
8. Go to `FCOM` tab.
9. In navigation tree, click `_objects`.
10. Click `trap`.
11. Click `CastleRock`.
12. Click `CASTLEROCK-MIB-FCOM.json`.

#### Expected Results
- UI outcome:
	- Login succeeds.
	- Top tabs are visible.
	- `READ-ONLY ACCESS` pill is shown.
	- File path opens in FCOM browser.
	- Under object `CASTLEROCK-MIB::dummyTrap`, an `Edit` button does NOT exist in the top-right corner of that object section.
- Data/state outcome: Session resolves with restricted/read-only permissions.
- API/network outcome (if relevant): Auth request succeeds; file browse/file load requests succeed.

#### Known Issues / Exceptions
- Known bug reference: None provided.
- Temporary expected failure? No

#### Automation Notes (for Playwright)
- Candidate selectors: `TBD by team for top-right Edit button in object section CASTLEROCK-MIB::dummyTrap`.
- Flaky areas/race conditions to guard: Wait for tree node and file load completion before asserting absence of edit controls.
- Cleanup/reset needed after run: Logout (or clear session) before next flow.

### FLOW-P0-003
- Priority: P0
- Area: FCOM
- Title: Open file and render preview/friendly sections

### FLOW-P0-008
- Priority: P0
- Area: FCOM
- Title: Edit single field and commit override (Severity 4 -> 5)
- Intent (why this flow matters): Verify end-to-end edit/save/review/commit workflow and post-commit override visualization for a single-field change.

#### Preconditions
- User/session state: Logged in as full-access user (`admin` / `admin`).
- Required data fixture: Server `Lab UA (Tony02) (lab-ua-tony02.tony.lab)`; file path available (`_objects` -> `trap` -> `CastleRock` -> `CASTLEROCK-MIB-FCOM.json`).
- App/tab starting point: `FCOM` tab with `CASTLEROCK-MIB-FCOM.json` opened.

#### UI Steps (exact clicks)
1. Navigate/login using the full-access flow and open `CASTLEROCK-MIB-FCOM.json` (same path as FLOW-P0-001).
2. Find object `CASTLEROCK-MIB::pollStatusTestFail`.
3. Click `Edit` for that object.
4. Locate field `Severity` (current value `4`) and change it from `4` to `5`.
5. Click `Save`.
6. Click `Save & Review (1)`.
7. Click `Continue to Commit`.
8. Enter a test commit string that includes a test number and date/time in the commit input box (example format: `TEST-008 2026-02-17 14:30`).
9. Click `Commit Changes`.
10. Wait for completion and observe success toast/message.
11. Re-open/review object `CASTLEROCK-MIB::pollStatusTestFail`.
12. Verify `Severity` shows an `Override` pill next to the field name.
13. Hover the `Override` pill and verify original value shown is `4`.

#### Expected Results
- UI outcome:
	- Edit mode opens for `CASTLEROCK-MIB::pollStatusTestFail`.
	- Severity update from `4` to `5` is accepted.
	- Review modal indicates one change (`Save & Review (1)`).
	- Commit succeeds and success toast/message appears.
	- Commit message includes test number + date/time format for traceability.
	- Post-commit, `Severity` shows `Override` pill.
	- Hover details for the pill include original value `4`.
- Data/state outcome:
	- One override/staged change is committed for `Severity` on `CASTLEROCK-MIB::pollStatusTestFail`.
- API/network outcome (if relevant):
	- Save/review/commit requests succeed without error.

#### Known Issues / Exceptions
- Known bug reference: None provided.
- Temporary expected failure? No

#### Automation Notes (for Playwright)
- Candidate selectors: `TBD by team for object edit button, Severity input, review/commit buttons, and Override pill tooltip`.
- Flaky areas/race conditions to guard: wait for save/review modal transitions and commit completion toast before final assertions.
- Cleanup/reset needed after run: if test data must remain unchanged, define rollback/reset path for Severity override.

### FLOW-P0-009
- Priority: P0
- Area: FCOM
- Title: Friendly vs Raw toggle behavior
- Intent (why this flow matters): Verify view-mode toggle switches correctly between object-friendly rendering and raw JSON code view.

#### Preconditions
- User/session state: Logged in as full-access user (`admin` / `admin`) or any user with access to view FCOM file contents.
- Required data fixture: Server `Lab UA (Tony02) (lab-ua-tony02.tony.lab)`; file path available (`_objects` -> `trap` -> `CastleRock` -> `CASTLEROCK-MIB-FCOM.json`).
- App/tab starting point: `FCOM` tab with `CASTLEROCK-MIB-FCOM.json` opened.

#### UI Steps (exact clicks)
1. Navigate/login and open `CASTLEROCK-MIB-FCOM.json` using the same path as FLOW-P0-001.
2. Verify `Friendly` is selected in the view toggle.
3. In Friendly view, verify first object entry is `CASTLEROCK-MIB::dummyTrap`.
4. In Friendly view, verify object sections such as `Summary`, `Severity`, etc. are shown.
5. Confirm raw JSON code viewer is not shown while `Friendly` is selected.
6. Click `Raw` in the view toggle.
7. Verify view changes to code viewer displaying raw JSON for the file.

#### Expected Results
- UI outcome:
	- Default/open state shows `Friendly` selected.
	- Friendly object rendering appears with `CASTLEROCK-MIB::dummyTrap` as first entry and sectioned fields (e.g., `Summary`, `Severity`).
	- Raw JSON code viewer is hidden in Friendly mode.
	- Switching to `Raw` shows code-view layout with raw JSON displayed.
- Data/state outcome:
	- View-mode state toggles from Friendly to Raw without reloading away from current file context.
- API/network outcome (if relevant):
	- No additional requirement specified.

#### Known Issues / Exceptions
- Known bug reference: None provided.
- Temporary expected failure? No

#### Automation Notes (for Playwright)
- Candidate selectors: `TBD by team for friendly/raw toggle buttons and raw code-view container`.
- Flaky areas/race conditions to guard: wait for file load completion before initial Friendly assertions and after Raw toggle click.
- Cleanup/reset needed after run: none specified.

### FLOW-P0-010
- Priority: P0
- Area: FCOM
- Title: Test all CastleRock SNMP traps (send + progress + completion)
- Intent (why this flow matters): Verify trap-test modal default target selection and end-to-end bulk-send progress/completion UX.

#### Preconditions
- User/session state: Logged in with access to run trap tests.
- Required data fixture: Server `Lab UA (Tony02) (lab-ua-tony02.tony.lab)`; file path available (`_objects` -> `trap` -> `CastleRock` -> `CASTLEROCK-MIB-FCOM.json`).
- App/tab starting point: `FCOM` tab with `CASTLEROCK-MIB-FCOM.json` opened.

#### UI Steps (exact clicks)
1. Navigate/login and open `CASTLEROCK-MIB-FCOM.json` using the same path as FLOW-P0-001.
2. Click `Test All CastleRock SNMP Traps`.
3. In the server list/selector, confirm `lab-ua-tony02.tony.lab` is selected by default.
4. Click `Send Traps`.
5. Verify a status/progress bar appears and increases as traps are sent.
6. Wait for progress to complete.
7. Verify the progress bar is removed and replaced by a completion/progress report.
8. Verify completion report text matches pattern: `Completed: X/Y sent, Z failed`.
9. Click `Close`.

#### Expected Results
- UI outcome:
	- Trap test modal opens from CastleRock file context.
	- Default selected server is `lab-ua-tony02.tony.lab`.
	- Sending starts and progress bar updates incrementally.
	- On completion, progress bar is replaced by report text in form `Completed: X/Y sent, Z failed`.
	- Modal closes when `Close` is clicked.
- Data/state outcome:
	- Trap send run reaches terminal state (complete) and exposes final sent/failed counters.
- API/network outcome (if relevant):
	- Trap send request(s) execute and return completion status.

#### Known Issues / Exceptions
- Known bug reference: None provided.
- Temporary expected failure? No

#### Automation Notes (for Playwright)
- Candidate selectors: `TBD by team for Test All button, server selector, Send Traps button, progress bar, completion summary, Close button`.
- Flaky areas/race conditions to guard: wait for async send completion before asserting final summary text.
- Cleanup/reset needed after run: none specified.

### FLOW-P0-011
- Priority: P0
- Area: FCOM
- Title: Remove existing Severity override and commit removal
- Intent (why this flow matters): Verify override-removal workflow and committed removal state for a previously overridden field.

#### Preconditions
- User/session state: Logged in as full-access user (`admin` / `admin`).
- Required data fixture:
	- Server `Lab UA (Tony02) (lab-ua-tony02.tony.lab)`.
	- File path available (`_objects` -> `trap` -> `CastleRock` -> `CASTLEROCK-MIB-FCOM.json`).
	- **Dependency:** FLOW-P0-008 must have already completed successfully so `CASTLEROCK-MIB::pollStatusTestFail` has a Severity override present.
- App/tab starting point: `FCOM` tab with `CASTLEROCK-MIB-FCOM.json` opened.

#### UI Steps (exact clicks)
1. Navigate/login and open `CASTLEROCK-MIB-FCOM.json` using the same path as FLOW-P0-001.
2. Find object `CASTLEROCK-MIB::pollStatusTestFail`.
3. Click `Edit`.
4. Click the `Override x` pill for the overridden field to remove override.
5. In confirmation popup, click `Yes`.
6. Verify UI shows `Removed` as a red pill next to the item.
7. Click `Save`.
8. Click `Save & Review (1)`.
9. Click `Continue to Commit`.
10. Enter commit message with test number + date/time.
11. Click `Commit Changes`.
12. Verify success toast appears at top of main page.
13. Re-check `CASTLEROCK-MIB::pollStatusTestFail` and confirm `Severity` no longer has an `Override` marker.

#### Expected Results
- UI outcome:
	- Override removal confirmation works (`Yes` path).
	- `Removed` red pill appears before save.
	- Review step reports one change (`Save & Review (1)`).
	- Commit succeeds and success toast appears.
	- Post-commit, `Severity` no longer shows override indicator.
- Data/state outcome:
	- Prior Severity override is removed and persisted via commit.
- API/network outcome (if relevant):
	- Save/review/commit requests complete successfully.

#### Known Issues / Exceptions
- Known bug reference: None provided.
- Temporary expected failure? No

#### Automation Notes (for Playwright)
- Candidate selectors: `TBD by team for Override x pill, removal confirmation, Removed pill, Save & Review / Continue to Commit buttons, success toast`.
- Flaky areas/race conditions to guard: wait for confirmation modal close, review modal transition, and commit completion toast before final assertions.
- Cleanup/reset needed after run: none specified (this flow is the cleanup for FLOW-P0-008 override addition).

### FLOW-P0-012
- Priority: P0
- Area: FCOM
- Title: Edit Sub Node device then revert override to original (no net change)
- Intent (why this flow matters): Verify the staged-change indicator and toast behavior correctly clear when a temporary edit is reverted back to the original value before commit.

#### Preconditions
- User/session state: Logged in as full-access user (`admin` / `admin`).
- Required data fixture: Server `Lab UA (Tony02) (lab-ua-tony02.tony.lab)`; file path available (`_objects` -> `trap` -> `CastleRock` -> `CASTLEROCK-MIB-FCOM.json`).
- App/tab starting point: `FCOM` tab with `CASTLEROCK-MIB-FCOM.json` opened.

#### UI Steps (exact clicks)
1. Navigate/open `CASTLEROCK-MIB-FCOM.json` using the same path as FLOW-P0-001.
2. Click `Edit` for object `CASTLEROCK-MIB::dummyTrap`.
3. Click `Edit` for `Sub Node`.
4. Append `1` to current value `Device` so the new value is `Device1`.
5. Click `Save`.
6. Verify `Save & Review (1)` is enabled and visually pulsing/blinking.
7. Click `Edit` again on object `CASTLEROCK-MIB::dummyTrap`.
8. Click `Override x` for the `Sub Node` value to remove the override.
9. In confirmation popup, click `Yes`.
10. Click `Save`.
11. Verify no `Staged...` toast appears.
12. Verify `Save & Review` is disabled and does not show `(1)`.

#### Expected Results
- UI outcome:
	- After first save, one staged change is shown via enabled `Save & Review (1)` with pulsing/blinking state.
	- After removing override and saving, no staged-change toast (`Staged...`) is shown.
	- After removing override and saving, the review button returns to disabled state and no longer shows `(1)`.
- Data/state outcome:
	- Net staged change count returns to zero because the value is restored to original (`Device`).
- API/network outcome (if relevant):
	- Save actions complete without error.

#### Known Issues / Exceptions
- Known bug reference: Not assigned yet (needs bug ID).
- Temporary expected failure? Yes
- If Yes, current observed behavior: `Staged...` toast currently appears after revert-to-original save, but it should not.

#### Automation Notes (for Playwright)
- Candidate selectors: `TBD by team for dummyTrap Edit button, Sub Node edit control, Device input, Override x, confirmation Yes, Save, Save & Review state, staged toast`.
- Flaky areas/race conditions to guard: wait for edit-mode transitions and any toast event window before asserting absence of `Staged...`.
- Cleanup/reset needed after run: none specified (flow ends at original value state).

### FLOW-P0-013
- Priority: P0
- Area: FCOM
- Title: Remove all dummyTrap overrides then redeploy processor
- Intent (why this flow matters): Validate bulk override removal, strict staged/commit file count, and post-commit redeploy flow from staged-changes indicator.

#### Preconditions
- User/session state: Logged in as full-access user (`admin` / `admin`).
- Required data fixture:
	- Baseline gate has passed for override baseline revision (see Pre-Test Baseline Gate).
	- `CASTLEROCK-MIB::dummyTrap` currently has override entries present for `Severity` and `ExpireTime`.
- App/tab starting point: `FCOM` tab with CastleRock override context opened using the same navigation path as prior CastleRock flows.

#### UI Steps (exact clicks)
1. Navigate to CastleRock override file context (same steps as prior CastleRock flows).
2. Click `Edit` for object `CASTLEROCK-MIB::dummyTrap`.
3. Click `Remove All Overrides`.
4. In confirmation popup, click `Yes`.
5. Confirm `Severity` and `ExpireTime` each show `Removed` state for prior override pills (crossed-out style).
6. Click `Save`.
7. Confirm toast indicates `Staged 2...`.
8. Confirm `Save & Review (2)` is clickable and pulsing.
9. Click `Save & Review (2)`.
10. Click `Continue to Commit`.
11. Enter commit message with test number + date/time.
12. Click `Commit Changes`.
13. In commit progress popup, confirm exactly 1 file/object is listed.
14. Confirm that item transitions from `queued` to `saved`.
15. If more than 1 file/object appears, fail the test immediately.
16. Confirm refresh icon is pulsing; on hover confirm tooltip text: `Changes staged. Redeploy FCOM Processor to apply them.`
17. Click the pulsing refresh icon.
18. In popup, confirm text `Changes staged. Redeploy FCOM Processor to apply them.`
19. Click `Redeploy` for `FCOM Processor`.
20. Confirm redeploy completes without `Missing CustomValues` error.
21. Confirm success toast text is exactly `FCOM Processor redeployed`.

#### Expected Results
- UI outcome:
	- `Remove All Overrides` marks expected fields (`Severity`, `ExpireTime`) as `Removed` before save.
	- Save operation stages exactly two changes and enables `Save & Review (2)`.
	- Commit popup shows exactly one target entry and progresses `queued` -> `saved`.
	- Staged-changes refresh affordance pulses and tooltip/modal text matches `Changes staged. Redeploy FCOM Processor to apply them.`
	- Redeploy action returns success and no `Missing CustomValues` error is displayed.
	- Success toast after redeploy matches `FCOM Processor redeployed`.
- Data/state outcome:
	- Override removals for `dummyTrap` are committed as a single-file/object change set.
	- Post-commit staged state aligns with redeploy-required state and clears after successful processor action.
- API/network outcome (if relevant):
	- Save/review/commit and redeploy requests succeed without validation errors.

#### Known Issues / Exceptions
- Known bug reference: None (this flow now acts as validation against prior `Missing CustomValues` defect).
- Temporary expected failure? No

#### Automation Notes (for Playwright)
- Candidate selectors: `TBD by team for Remove All Overrides button, Removed pills, staged toast, Save & Review (2), commit progress rows/status, pulsing refresh icon/tooltip, redeploy popup CTA`.
- Flaky areas/race conditions to guard: wait for commit progress transition (`queued` -> `saved`) and microservice redeploy completion state before final assertion.
- Cleanup/reset needed after run: if downstream tests require overrides present, restore baseline via Pre-Test Baseline Gate.

### FLOW-P0-004
- Priority: P0
- Area: FCOM
- Title: Edit field and verify staged/save path behavior

### FLOW-P0-005
- Priority: P0
- Area: PCOM
- Title: Open file, select object, switch raw/friendly view

### FLOW-P0-006
- Priority: P0
- Area: MIB
- Title: Browse/search and open details panel

### FLOW-P0-007
- Priority: P0
- Area: Modal
- Title: Open/close critical modals (microservice, review, advanced settings)

---

## Known Bug Registry (for expected failures)

| Bug ID | Flow ID | Summary | Current Behavior | Desired Behavior | Blocker? |
|---|---|---|---|---|---|
|  |  |  |  |  | Yes/No |

---

## Go/No-Go Gate (resume refactor)

- [ ] All P0 flows pass locally OR are documented as known failures with approved bug IDs.
- [ ] No untracked critical regression discovered during P0 execution.
- [ ] Playwright smoke suite runs reliably in local dev mode.
- [ ] Team agrees on remaining known-failure risk.

Decision:
- GO (resume refactor) / NO-GO (continue stabilization)
- Date:
- Approver(s):
