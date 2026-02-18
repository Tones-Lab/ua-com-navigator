# Legacy Conversion UX V2 — Review Checklist (Approval Sheet)

**Purpose:** Fast approval checklist for the detailed plan in [legacy-conversion-ux-v2-plan.md](legacy-conversion-ux-v2-plan.md).  
**Use:** Mark each item as Approve / Reject / Needs change, add notes, then implementation starts.

---

## A) Layout + Navigation

1. Sticky top command/status bar (threshold, preview/create, counts)  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

2. Primary split-pane review (left list, right detail)  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

3. Secondary panels (Match diffs / Traversal / Raw report) collapsed by default  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

4. Persist section open/closed state in session  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

---

## B) Suggested COM Review UX

5. Unified list for both “matched override” and “generated definition” items  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

6. Per-item explicit inclusion label (override vs generated)  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

7. Per-item dirty badge + field-level changed badge vs baseline  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

8. Friendly/Raw toggle as explicit two-state control (always visible in detail)  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

9. Raw JSON invalid state blocks create action  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

---

## C) Density + Scanning

10. Compact density as default for suggestion list/details  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

11. Responsive field grid in detail panel (1/2/3 columns by viewport)  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

12. Long expression fields can span wider columns automatically  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

13. Quick filters for list: Dirty, Matched, Generated, Conflict, Search  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

---

## D) Legacy Field Interpretation + Explainability

14. Show “Field dependencies” as detected legacy `$Event->{FIELD}` references  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

15. Show “Referenced only” table for dependency fields not mapped into suggestion  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

16. Include “why not mapped” + “suggested COM pattern” columns  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

17. For unresolved mapping, show explicit fallback message (not silent blank)  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

---

## E) RBAC + Safety

18. Edit-capable users can edit friendly and raw content  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

19. Read-only users can inspect all content but cannot edit  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

20. Create/apply actions remain permission-aware and guarded  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

---

## F) Performance + Accessibility

21. Keyboard navigation for list rows and mode toggle semantics (`role=tab`)  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

22. Virtualize long lists once row count threshold is exceeded  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

23. Debounced threshold recompute retained to avoid thrash  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

---

## G) Delivery Sequence Approval

24. Phase A first (sticky bar + collapses)  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

25. Phase B second (split-pane suggested review)  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

26. Phase C third (density + filters + scan controls)  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

27. Phase D fourth (advanced diagnostics separation)  
- Decision: [x] Approve [ ] Reject [ ] Needs change  
- Notes:

---

## H) Final Go/No-Go

- Overall decision: [x] Go [ ] No-Go [ ] Go with edits
- Blocking comments:
- Non-blocking comments:
- Reviewer:
- Date: 2026-02-18
