# Airbnb-style search pill bar: hover grey, full-height white pill, persistent panel

All changes are in `SearchPillBar` (`src/components/search/search-pill-bar.tsx`) — the three search bars (tutors/courses/tutor-requests) and the homepage inherit the behavior. Public API (`segments`, `openSegmentId`, `onOpenSegmentIdChange`) stays identical.

## 1. Hover state = slightly darker grey bar + white pill (fixes "looks off")
- Add `hoveredId` state; `activeId = openId ?? hoveredId`.
- The existing bar-level grey wash (`--foreground` at 10%, same as today's open state) shows whenever `activeId !== null` — so hovering the idle bar greys the whole bar like Airbnb, instead of today's 5% wash on just one segment.
- Remove the per-button `hover:bg-*` class; the bar wash + white pill replace it.

## 2. White pill fills the entire bar height (no grey strips)
- Highlight geometry changes from the button rect to: `x`/`width` from the active segment's button, `y: 0`, `height: form.clientHeight` — flush inside the border, rounded-full, like the Airbnb screenshot.
- Keep the existing spring machinery (`HIGHLIGHT_SPRING`, reduced-motion snap, ResizeObserver glue) but drive it from `activeId`, so the white pill morphs/slides between segments on hover and stays pinned to the open segment when the pointer leaves the bar.
- Segment dividers hide adjacent to the highlighted (not just open) segment.

## 3. Persistent panel — dropdowns don't disappear between segments
- Drop Radix `Popover` per segment; render ONE panel `<div>` (role="dialog") below the bar inside a `relative` wrapper: `top: calc(100% + 10px)`, width `w-[min(24rem,calc(100vw-2rem))]`, left-aligned to the active segment and clamped to the viewport (≥12px margins).
- Panel mounts/unmounts with a fade+scale only on open/close; content is keyed by `openId` and swaps instantly on segment switch — no close/reopen flash.
- Panel `x` animates with the same spring so it slides between segments; clamp recomputed on open/segment switch/resize.
- Interaction model: click opens; **hovering another segment while a panel is open switches to it** (Airbnb behavior); closes on outside pointerdown, Escape, submit, or when parents set `openSegmentId` to null (e.g., Filters button — already wired).

## 4. Cleanup
- Remove `panelClassName` from `PillSegment` and its two usages (`tutors-search.tsx:323`, `courses-search.tsx:159`) — panel width is now unified.

## Files touched
- `src/components/search/search-pill-bar.tsx` (main work)
- `src/components/search/tutors-search.tsx`, `courses-search.tsx` (one line each)

## Verification
- `npx tsc --noEmit`; targeted `eslint --fix` + re-lint on the 3 touched files; `npm run build`.
- Live browser test (dev server on port 3101 — 3000 is occupied by Docker): idle hover greys bar with full-height white pill morphing between segments; click opens panel; hover-switch between segments keeps the panel alive; outside click and Esc close it. Compare against the Airbnb screenshot. No shadows introduced (wash is an opacity layer; highlight is `bg-card` — flat design preserved).