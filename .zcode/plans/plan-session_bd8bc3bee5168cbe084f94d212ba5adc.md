# Premium primitives pass — make existing UI feel more alive (no new sections/components)

**Goal (per your direction):** upgrade the *feel* of existing buttons, cards, chips, inputs, tabs, lists and controls across the whole site (public + conversion + consoles). No new sections, no new components, no new buttons, no hero. Arc (uiarc.dev, free tier) is used as a **pattern source only** — I fetch its free component markdown pages (button, chip group, segmented control, tabs, accordion, switch, checkbox/radio, copy button, empty state, metric card, pagination, scroll area) and adapt their state/motion patterns **in place** into our existing shadcn-based primitives in `src/components/ui/`. Nothing is installed via the Arc CLI, so no parallel components, no new dependencies, no `bun.lock` churn (motion 13.1.1 already present).

**Hard constraints (DESIGN.md + AGENTS.md, enforced throughout):**
- No shadows anywhere (strip any Arc-derived shadow classes; the `.pill-elevate*` family stays the sole exception). ESLint rule will catch violations.
- Banned: per-card staggered fade-ups, bouncy scale-ins (springs capped at bounce 0.08–0.15), gradient blobs, shimmer (skeletons stay opacity-pulse, not shimmer), glow borders, particles, decorative marquees.
- Azure scarcity unchanged: azure stays on CTAs/links/focus/selected only. No new hues. Hairline borders over elevation.
- `PublicTutorCard` visuals are frozen by product decision — untouched.
- Zero new user-facing copy planned (premium pass is copy-neutral) → no i18n key changes; `check:i18n` run anyway as a guard.
- Every motion addition pairs `prefers-reduced-motion` handling.
- Motion vocabulary: CSS 150–300ms `cubic-bezier(0.22,1,0.36,1)`; springs only on state changes.

---

## Phase 1 — Shared primitives (inherits site-wide, incl. consoles)

1. **Button** (`src/components/ui/button.tsx`): unify hover treatment per variant (outline/default get border-deepen + hover-wash token; secondary deepens fill), consistent `focus-visible` azure ring on all variants/shapes, loading→idle transition smoothed, icon-child transitions (leading icon weight/translate on press). Keep API and resting states identical; `refined`/`hoverArrow` remain opt-in.
2. **Checkbox / Radio / Switch** (`checkbox.tsx`, `radio-group.tsx`, `switch.tsx`): check-mark draw-in (stroke-dashoffset) or scale-pop on check, radio dot scale-in, switch thumb spring settle (bounce 0.1) — matching the existing `mtr-station-select` checkbox pop language so all forms (dashboards, admin, filters) feel uniform.
3. **Tabs / Segmented control** (`tabs.tsx`; guide subpage tabs, help audience pills, playbook tabs): add a sliding active indicator (motion `layoutId`, same pattern as mobile bottom nav / DirectoryToggle thumb) instead of instant active swaps where structure allows — no API change.
4. **Accordion** (`accordion.tsx`, used by FAQ + rates `<details>` on tutor profile): content fade-in timing on open, trigger hover wash, consistent chevron rotate (bring the rates `transition-transform group-open:rotate-180` pattern into the shared trigger).
5. **Inputs** (`input.tsx`, `textarea.tsx`, `select`): smooth `transition-[border-color,box-shadow]` into the focus ring, subtle border deepen on hover — token-driven, no glow.
6. **Dialog / Sheet / Drawer entrances**: align entrance curves/timings to the system cubic-bezier and shorten overlay fade so modals feel snappier; no layout changes.
7. **Toast (sonner) styling audit**: verify flat (border-delineated) styling, no default shadows, timing consistency.
8. **Badge/Chip**: align interactive chip states (selected = azure, press = scale 0.97, hover = border deepen) across filter chips and form chips; static chips get consistent border tokens.
9. **Skeleton pulse timing** alignment; **empty-state containers** (notifications, group-classes, help no-results, console panels) get typography/icon/layout refinement in place — existing text only.

## Phase 2 — Flat-surface hover/state upgrades (existing elements only)

10. **Group-classes `CohortCard`** (`src/features/cases/group-classes-board.tsx:52`): add the sanctioned card hover (−1px lift + border deepen, 200ms, motion-reduce safe) matching `PublicTutorCard`'s pattern — the board currently has zero hover states.
11. **Tutor profile** (`src/routes/tutors.$tutorCode.tsx`): hover wash on rates rows (`:1136`) and lesson-detail rows, hover affordance on course/university chips (`:995`), section-level `Reveal` entrances (`src/components/ui/reveal.tsx` reused as-is) on the ProfileSection column below the header band. No changes to header band layout or CTAs.
12. **Notifications** (`src/routes/_authenticated.notifications.tsx:104`): state-change motion on mark-read — background fade via transition, unread-dot scale-out (AnimatePresence); this is exactly DESIGN.md's "state-change over entrance" preference.
13. **Help centre cards** (`help.index.tsx`): group-hover arrow nudge on `HelpArticleLink`/featured/topic cards (pattern already on guide cards), Reveal on the three sections.
14. **Footer links** (`SiteFooter.tsx`): add the header-nav-style underline sweep (200ms, from left) alongside the existing color hover; social icons get icon-button press feel.
15. **Guide hub** (`guide.index.tsx`): Reveal on the four sections, hover border deepen on the dark matching-flow cards and verification cards, comparison-table row hover wash. FAQ accordion benefits from #4.
16. **Console tables/panels** (`console-shell.tsx`, console-table surfaces, settings sections): row hover wash + selected-row state, consistent action-button focus rings, sticky-header border polish. Settings sections get subtle dividers/spacing rhythm only.
17. **Copy buttons** (help copy boxes `components.tsx:136`, any admin/report copy affordances): Arc copy-button pattern — icon morphs to check + quiet confirmation state, no text additions.

## Phase 3 — Consistency audit + dead-code cleanup

18. **Focus-ring sweep**: one consistent `focus-visible` azure ring across every interactive primitive and custom control (auth Google button, home rail arrows, pagination dots, bell menu).
19. **Reduced-motion sweep**: every pattern added above verified to have a `motion-reduce`/`prefers-reduced-motion` path.
20. **Dead-code deletion** (deletions, clearly flagged): `landing-tutor-marquee` CSS, `how-it-works-hero__image/-paper` CSS, unused `hero-08.tsx` + `hero-08-utils/`, unused `carousel.tsx`/`accordion-05.tsx` (or kept if Phase 1–2 found a use). `blur-highlight-text` stays in-tree (DESIGN.md signature component) but stays unwired per your no-new-sections direction; noted as an optional follow-up for the existing guide H1 only, skipped by default.

---

## Sourcing Arc patterns

Fetch (read-only WebFetch) the free-tier markdown pages at `uiarc.dev/components/<name>/markdown` for: button, chip-group, segmented-control, tabs, accordion, switch, checkbox, radio-group, copy-button, empty-state, metric-card, pagination, scroll-area. Extract their transition timings, state styling and confirmation micro-interaction patterns; re-implement against our tokens. The UI Arc MCP is still not registered in my session — this route gets the same source and doesn't block the work.

## Verification per phase

- `npx tsc --noEmit` after every TS-touching step.
- `npx eslint <touched files>` (with the hang workaround: `--no-cache`, output to file, if >60s).
- `npm run check:i18n` (guard; no copy changes expected).
- `npm run build` at each phase end.
- Visual spot-check via the dev server + in-app browser on: home, /tutors + one profile, /guide, /help, /auth, /group-classes, /dashboard, /admin (one table), /notifications — light and dark, EN and zh-HK.

## Out of scope (explicitly)

No hero/stats/marketing sections, no new components or buttons, no Arc Pro pieces, no dependency changes, no PublicTutorCard visual changes, no copy/i18n changes, no DB/infra touch.