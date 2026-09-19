# Remove remaining grey around the search button (last segment active)

One-line geometry change in `src/components/search/search-pill-bar.tsx`, in `pillGeometry()`.

## Problem
When **Lesson mode** (the last segment) is active, its white pill spans only up to the submit button's left edge. The grey engagement wash therefore stays visible: in the small gap before the button, around the circular button, and across the bar's right cap — the grey area in your screenshot.

## Fix
Extend the last segment's pill (both the white clicked pill and the grey hover pill — they share `pillGeometry`) from "up to the submit button" to the bar's full inner width (`form.clientWidth - x`). The submit button renders above the pill, so it stays fully visible; the pill's `rounded-full` right end exactly matches the bar's rounded right cap, so the whole region around the button becomes white with no grey remainder. Middle segments keep the Airbnb grey to their right, and switching segments still springs the pill back to normal width.

## Verification
- `npx tsc --noEmit` + targeted eslint on the file.
- Browser test on `/tutors` (dev server port 3101): open Lesson mode → measure that the white pill's right edge meets the bar's right inner edge (no grey between pill and cap, button still on top); hover Lesson mode while another panel is open → grey pill covers the same span; switch to a middle segment → grey correctly shows right of the white pill again. Screenshot to confirm.