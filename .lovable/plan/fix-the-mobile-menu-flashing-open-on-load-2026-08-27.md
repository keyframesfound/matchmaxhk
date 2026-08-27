# Fix the mobile menu flashing open on load

## What's wrong

The slide-in mobile menu panel is only pushed off-screen by an animation script that runs once when the header first mounts. But the panel itself is rendered a moment later (it is attached to the page body only after the browser has hydrated). So on first load the script finds nothing to hide, the panel appears in its default position — fully visible on the right — and only snaps away once you tap the Menu button. That's the "menu opens by itself / button breaks" behaviour.

## The fix

1. Make "closed" the panel's real resting state in CSS: the panel and its coloured backing layers start pushed fully off-screen and non-interactive, so they can never be visible before any script runs.
2. Re-run the setup routine once the panel actually exists on the page (and again if it remounts), instead of only on the first render.
3. Keep the panel hidden from screen readers and pointer input while closed, so a stray tap near the edge can't trigger it.
4. Verify on a mobile viewport: load the site, confirm no menu flash, tap Menu (opens), tap Close / outside / Escape (closes), and confirm nothing shows on desktop.

## Technical notes

- Files: `src/components/layout/StaggeredMobileMenu.css`, `src/components/layout/StaggeredMobileMenu.tsx`.
- CSS: give `.smm-panel` and `.smm-prelayer` a default `transform: translateX(100%)`; add `pointer-events: none` / `visibility: hidden` on the closed state, restored via a `data-open`-driven class on the portal wrapper.
- TSX: move the initial `gsap.set(...)` into an effect keyed on `mounted` so it runs after `createPortal` renders; guard against re-running while the menu is open.
- No behaviour change to navigation links, footer controls, or the desktop header.
