Change the mobile nav menu's 01/02/03 item numbering to the site's signature blue:

1. In `src/components/layout/StaggeredMobileMenu.css` (lines 118–127), in the `.smm-menu-item a::after` rule, change `color: var(--muted-foreground)` to `color: var(--brand-link)` (`#1d9bf0`, the same azure used for hover states elsewhere in the file).

No other changes — the Connect block and footer stay untouched. Verify with `npx tsc --noEmit` (CSS-only change, but confirms nothing else broke).