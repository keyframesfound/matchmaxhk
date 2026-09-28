Give the mobile "Start your search" + quick-nav pill bar the Airbnb treatment: full-width pills, Airbnb shadows, and a pressed 3D button feel — with shadows confined to exactly this component.

**Current state** (`src/components/search/mobile-search-trigger.tsx`): the three nav pills (Case / How it works / Become a Tutor) are fixed-width `shrink-0` items in a horizontal scroll row — they can't fill the screen, so the third pill hangs cut off at the edge and the row looks like it wastes width. The search pill is a flat bordered capsule. Shadows are banned repo-wide by an ESLint `no-restricted-syntax` rule on `**/*.{ts,tsx}` (CSS files are not linted).

**Changes**

1. `src/styles.css` — append a clearly-commented exception block defining two utility classes (the ONLY sanctioned shadow usage in the design system, scoped to this component):
   - `.pill-elevate` (quick pills): soft Airbnb drop shadow `0 1px 2px / 0 4px 12px rgba(15,23,42,.10/.08)`; `:active` = `translateY(1px)` + inset shadow (the 3D push); `.dark` variant uses a deeper black shadow.
   - `.pill-elevate-lg` (search bar): slightly larger shadow `0 2px 4px / 0 8px 20px`, same pressed behaviour.
   - A `prefers-reduced-motion` guard disables the transform/transition.
   - TSX never contains the word "shadow", so the ESLint guard stays intact and enforcing.

2. `src/components/search/mobile-search-trigger.tsx`:
   - **Pills row**: drop `overflow-x-auto`/`shrink-0`; each of the 3 pills becomes `flex-1 min-w-0` with centered content and a truncate fallback, so they distribute edge-to-edge across the full screen width. Slightly bigger touch targets (`py-2.5`), 18px icons, 13px labels.
   - **Pill styling, light mode**: borderless white `bg-card` pills — the Airbnb shadow carries the definition instead of a border; the active page pill gets Airbnb's grey wash (`bg-muted` + bold). Dark mode keeps the current border delineation (`dark:border-border`) plus the subtle dark shadow.
   - **Search pill**: taller Airbnb-style bar (`py-3.5`, `text-base`, 20px search icon), borderless in light / bordered in dark, with `pill-elevate-lg`.

Since the component is shared, the homepage, /courses, and /cases mobile entries all get the same upgrade consistently — shadows exist only inside these two classes.

**Verification**
- `npx eslint` on the touched TSX file (must stay clean without disables) + `npx tsc --noEmit`.
- IAB screenshot at a 393px mobile viewport on the dev server (port 3000) to visually confirm full-width pills, shadows, and dark mode.