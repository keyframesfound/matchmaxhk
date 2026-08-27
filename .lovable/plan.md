# Plan: Tighten tutor card "Show more" overlay

## Problem
The public tutor card currently has a frosted "Show more" button that expands the academic-achievement chips. In the current preview the third row of subject pills leaks slightly below the overlay, and the frosted blur is heavier than desired.

## Proposed fix
Adjust only the collapsed-state overlay in `src/features/tutors/public-tutor-card.tsx`:

1. Reduce the extra preview height buffer (currently `+ 44`) so the cut-off line sits cleanly between the second and third chip rows instead of letting the third row peek through.
2. Lower the backdrop blur intensity from `backdrop-blur-sm` to a softer value so the chips behind are visible but the overlay still reads as frosted.
3. Keep the button clickable across the full card width, preserve the "Show less" collapsed state, and maintain the existing color scheme and rounded corners.

No data, routing, or other components change.
