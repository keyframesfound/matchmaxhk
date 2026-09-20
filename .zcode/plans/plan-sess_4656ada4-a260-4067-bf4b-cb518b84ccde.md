# Mobile home: tighten hero spacing + make the search overlay full-screen

## Findings (from code exploration)

**Spacing** — `src/routes/index.tsx`: the hero section is `pt-6 pb-14 md:pt-10 md:pb-16` (line 421) and the categories wrapper is `mt-8 space-y-10 md:mt-10 md:space-y-12` (line 432). On mobile that means ~34px of grey between the mobile top bar and the search button, and a 32px gap before the tutor-category sections.

**"Start your search"** — it already opens `MobileSearchOverlay` (`src/components/search/mobile-search-overlay.tsx`), which is technically full-screen (`fixed inset-0`), but the form fields sit inside a floating `rounded-3xl border bg-card` card (line 143) with grey (`--surface-subtle`) background visible around and below it — that's why it reads as a popup.

## Changes

### 1. Tighten home hero spacing (mobile only, desktop values untouched)

`src/routes/index.tsx`:
- Line 421: `pt-6 pb-14 md:pt-10 md:pb-16` → `pt-2 pb-10 md:pt-10 md:pb-16` (less space between top nav bar and search block, and before the footer).
- Line 432: `mt-8` → `mt-4` (keep `md:mt-10`) — less space between the search/pills block and the category listings.
- `src/components/search/mobile-search-trigger.tsx`: tighten the trigger's own padding — search button `py-2.5` → `py-2`, pills row `mt-1.5 … pb-1` → `mt-1 … pb-0.5`.

### 2. Full-screen search overlay (no more popup look)

`src/components/search/mobile-search-overlay.tsx` (shared by tutors/courses/cases mobile overlays, so all three become consistent):
- Line 142: scroll area `px-3` → `px-0` (no side gutters).
- Line 143: replace the floating `rounded-3xl border border-border bg-card p-4 sm:p-5` card with a full-bleed surface: `min-h-full bg-card px-4 pt-3 pb-6` — no rounded corners, no border, fills the whole area between the tab row and the sticky footer, edge-to-edge.
- Tab row and sticky "Clear all + Search" footer stay as they are.

Constraints honored: no shadows anywhere (borders/surfaces only), no dependency changes, mobile-only spacing (md/lg layouts unchanged).

## Verification
- `npx tsc --noEmit`; targeted `eslint --fix --no-cache` on the three touched files.
- `npm run build`.
- Dev server on port 3101 (killed after): at 390×844 measure the nav-bar→search and search→categories gaps, screenshot the tightened hero; open "Start your search" and confirm the panel is edge-to-edge full-screen white (no floating card / grey popup look), tab row + footer intact; at 1440px confirm the desktop home hero and desktop pill bar are unchanged.
