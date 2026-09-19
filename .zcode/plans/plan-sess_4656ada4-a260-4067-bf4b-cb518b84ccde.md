# Search pill bar: grey hover pill in both states, click-only panel switching

One file: `src/components/search/search-pill-bar.tsx`.

## Behavior (matching your two screenshots)
1. **Nothing selected + hover** → the hovered segment gets a full-height **grey pill** (same grey tone as the bar wash, `--foreground` at 10%), spring-morphing between segments as you move across the bar. The bar itself stays white and no white pill shows.
2. **One selected (panel open, clicked)** → unchanged: bar greys, **white pill** on the open segment. Hovering another segment now shows the **grey pill on the hovered segment** (slightly darker over the grey bar, like Airbnb) — the white pill and panel **stay put**.
3. **Panels switch on click only.** Removing the hover-steal: hovering no longer moves the panel or white pill; clicking another segment swaps the persistent panel in place (no close/reopen flash) and springs the white pill over. This also removes the `switchedByHover` click-suppression workaround.

## Implementation
- Reintroduce `hoveredId` (pointer enter/focus per segment; cleared on wrapper pointer-leave and focus-left).
- Second motion pill (`bg-[color:var(--foreground)]/[0.1]`) driven by its own motion values; generalize the existing `moveHighlight` into `movePill(x, width, segmentId, snap)` shared by both pills (both full bar height, shared spring, reduced-motion snap, ResizeObserver glue).
- Grey pill hides when the hovered segment *is* the open one (white pill already covers it).
- Dividers hide around whichever segment currently carries either pill.
- `onPointerEnter` no longer calls `setOpenId`; click toggles open/close as before.

## Verification
- `npx tsc --noEmit`, targeted eslint on the file, `npm run build`.
- Browser test on `/tutors` (dev server port 3101): idle hover → grey pill only, bar stays white; click → grey bar + white pill + panel; hover another segment while open → grey pill on it, panel and white pill unmoved; click it → panel swaps in place, white pill springs over; outside click / Esc still close.