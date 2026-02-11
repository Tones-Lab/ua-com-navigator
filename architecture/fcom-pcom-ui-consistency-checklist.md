# FCOM/PCOM UI Consistency Checklist

Use this checklist to confirm FCOM and PCOM views stay visually and structurally aligned.

## File Header and Actions
- Title row uses shared `FileTitleRow` component
- Favorite star placement matches exactly
- View toggle uses shared `ViewToggle` component
- Action row spacing and button styles are identical

## Raw/Friendly Preview Container
- Preview is wrapped by shared `ComFilePreview`
- Raw preview uses `FcomRawPreview` for consistent markup
- `.file-preview` container fills the panel (no extra spacing)
- Raw preview background, padding, and typography match FCOM

## Empty States
- Same copy tone and placement between tabs
- Empty state uses the shared `.empty-state` style

## Visual Verification (Manual)
1) Open the same file name in FCOM and PCOM (if available) or any sample file.
2) Toggle Friendly/Raw in both tabs and compare:
   - Header layout and spacing
   - Raw preview height and scroll behavior
   - Match bar placement (when search highlights exist)
3) Resize window width and verify layout remains aligned.

## Regression Notes
- If a UI change is made in FCOM, check PCOM in the same session before merging.
