# Repo Rename Plan: fcom-curator → com-management

**Status:** Completed (folder renamed to `com-management`).

## Goal
Rename the application folder from `fcom-curator` to `com-management` to reflect the multi-surface scope (FCOM, PCOM, MIB Browser) while keeping the top-level repo name `navigator`.

---

## Scope of Changes
### 1) Folder Rename
- `fcom-curator/` → `com-management/`

### 2) Update Path References
Search and update references to the old path in:
- Docs (`README.md`, architecture docs)
- Scripts and configs
- Any build/run instructions
- Any hardcoded paths in backend/frontend code

### 3) Service Names (If Applicable)
Currently services are:
- `fcom-curator-backend.service`
- `fcom-curator-frontend.service`

**Decision point:**
- Option A: Keep service names as-is (lowest risk)
- Option B: Rename services to `com-management-*` and update systemd units

Recommendation: **Option A** until a maintenance window allows safe service rename.

### 4) CI/CD or Dev Scripts
If any pipeline or script refers to `fcom-curator`, update paths.

---

## Suggested Execution Steps
1) Inventory all path references:
   - `grep -R "fcom-curator" -n .`
2) Rename folder:
   - `git mv fcom-curator com-management`
3) Update references:
   - Replace `fcom-curator` → `com-management` in docs, configs, scripts, and code.
4) Validate build/run:
   - Ensure frontend and backend start successfully.
5) (Optional) Update service files if choosing Option B.

---

## Risks / Mitigations
- **Risk:** Hardcoded paths or service units break.
  - **Mitigation:** exhaustive search + staged validation.
- **Risk:** Service name change causes downtime.
  - **Mitigation:** keep service names unchanged for now.

---

## Acceptance Criteria
- Folder renamed.
- All references updated and build/run paths validated.
- Documentation reflects `com-management`.
- No broken links or missing assets.

