## UI motion polish — de-AI the chrome, keep the system

Three planned phases delivered as one PR (Ryan: "do all 3 PRs and put it as one big PR"). Scope agreed up front: public + consoles + admin; **tutor-card visuals frozen** (strict — nothing inside `PublicTutorCard` changes; the shared `Button` gets opt-in props only); restrained-professional motion personality.

### Phase 1 — public chrome
- `button.tsx`: opt-in `refined` (1px hover lift + 200ms icon transitions) and `hoverArrow` (trailing-icon nudge) props. Resting state byte-identical; not applied to any tutor-card button.
- SiteHeader: desktop nav underline now **sweeps in from the left** on hover (the DESIGN.md nav language) instead of an opacity flip. Custom nav icons (`/nav-*.png`) untouched per Ryan.
- AnnouncementBanner: **asymmetric crossfade** (out 200ms, in 500ms after 200ms delay) — the old symmetric 700ms fade had both slides readable on top of each other mid-rotation (the "glitched banner" on /tutors scroll). Plus a one-time 6px drop-in entrance.
- Home rails: trending rail gets prev/next arrows with live scroll-state disable (parity with curriculum rails); all snap rows use the new `.rail-scroll` utility — the native grey scrollbar under the rails is gone.
- DirectoryToggle (Tutors | Study Materials) + MobileBottomNav: sliding active thumb/indicator via `motion layoutId` — same resting visuals, the pill now springs between tabs.

### Phase 2 — motion layer
- New `Reveal` primitive: one-time 12px rise + fade, wrapped around whole home sections (notes, gigs, trending, curriculum) — never per-card. Reduced-motion renders a plain div.
- WhatsApp float: quiet scale/fade entrance 0.6s after load (reduced-motion renders immediately).
- Reviewed dialog/sheet/dropdown/mobile-search-overlay transitions — already conform (shadcn data-state animations, Airbnb-style slides); left as-is deliberately.

### Phase 3 — consoles + admin
- `ConsoleTableBody`: rows get a 3% hover wash (Stripe-style scan aid), reduced-motion safe.
- Audited dashboard home cards, settings option-cards, empty states, skeletons, charts: they already share the system (border hovers, pulse skeletons, EmptyState) and had no AI-tells — deliberately left alone rather than gold-plating.

### Deliberately NOT done
- The DB-driven stage pills row on /tutors ("Kindergarten / Primary & Secondary / University" — truncates on mobile) renders from a component I could not locate in `origin/main` source (labels exist nowhere in the repo; likely deploy drift or a data-driven path I couldn't trace). Nothing in this PR touches it. Flagging for follow-up: Ryan, can you point me at the component? The fix would be a scrollable pill row instead of truncation.
- Nav/banner **emoji-looking icons are Ryan's custom PNG assets** — preserved untouched.

### Motion rules (now documented in DESIGN.md → new "Motion" section)
150–300ms / `cubic-bezier(0.22,1,0.36,1)` for CSS; springs only on state changes (bounce ≤ 0.15); sliding indicators over instant swaps; section-level entrances only; banned list = per-card staggers, bouncy scale-ins, gradient blobs, shimmer sweeps, glow borders. Every animation pairs reduced-motion, per the incumbent rule.

### Gates
- `tsc --noEmit` clean · targeted eslint clean · `check:i18n` 2005 = 2005 (zero new copy) · vitest suite green (result in comments)
- No new dependencies (uses existing `motion` v13 + CSS)
- Screenshots attached (local dev; DB-backed rails render from live data)

Closes nothing — non-issue polish work per the `feat/` convention.
