# Make the header (and the /join progress bar) stay pinned while scrolling

## The cause

The site header already asks to be sticky, but the global stylesheet sets `width: 100vw; overflow-x: hidden` on `html`, `body` and `#root`. An `overflow` value other than `visible` on those ancestors turns them into scroll containers, which cancels sticky positioning for everything inside — so on every page the header scrolls away instead of floating.

## What changes

1. **Global CSS (`src/styles.css`)** — replace `overflow-x: hidden` with `overflow-x: clip` on `body` only, and drop `width: 100vw` (it forces a horizontal overflow equal to the scrollbar width). `clip` prevents sideways scrolling without creating a scroll container, so sticky works again. Result: the site header floats at the top of every page.

2. **/join progress bar (`src/routes/join.tsx`)** — switch the mobile progress bar from `sticky` to `fixed` at `top-16` (right under the 64px header) with a matching `z-index`, plus a 3px spacer so the page content does not jump. It then follows the scroll on mobile at all times and stays hidden on desktop.

## Verification

After the change, load the home page and `/join` in a mobile viewport, scroll down, and confirm the header stays pinned and the progress bar fills as you scroll — plus check no page gains a horizontal scrollbar.
