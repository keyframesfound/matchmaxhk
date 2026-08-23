# Join page: remove dark blue banner + mobile scroll progress bar

## What changes

1. **Remove the dark blue hero bar** at the top of `/join`. The heading, subtitle and consent line stay, but rendered on the normal light page background directly above the form (navy text on white instead of white text on a navy block). Nothing else on the page moves.

2. **Mobile-only scroll progress bar.** On screens below the `lg` breakpoint, a thin (3px) teal-to-navy gradient bar sits directly under the sticky site header and fills left-to-right as the user scrolls the page. Hidden entirely on desktop.

## Technical notes

- File: `src/routes/join.tsx` only.
- Replace the `<section className="bg-[color:var(--brand-navy)] ...">` block (lines ~355-365) with a plain padded section using brand-navy text and muted subtitle.
- Add a small `MobileScrollProgress` component in the same file: `useState` for percent, `useEffect` with a passive `scroll` + `resize` listener computing `scrollY / (scrollHeight - innerHeight)`, rendered in a `sticky top-[64px] z-40 lg:hidden` wrapper so it tracks under the 64px header. Starts at 0 on SSR to avoid hydration mismatch.
- Progress bar width driven by inline `style={{ width: pct% }}`, colours from existing brand CSS variables (no hardcoded hex).
