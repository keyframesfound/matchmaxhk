---
target: current tutor card (PublicTutorCard)
total_score: 27
max_score: 36
na_heuristics: 10
p0_count: 0
p1_count: 2
target_identity: "file:/Users/ryanyeung/Documents/VS Code/matchmaxhk/src/features/tutors/public-tutor-card.tsx"
target_fingerprint: "sha256:9037303bd83820b8488d55b276fb618ead948ab322490ef0dfa1794851e161cb"
target_path: /Users/ryanyeung/Documents/VS Code/matchmaxhk/src/features/tutors/public-tutor-card.tsx
timestamp: 2026-09-11T03-42-38Z
slug: src-features-tutors-public-tutor-card-tsx
---
# Critique: PublicTutorCard (`src/features/tutors/public-tutor-card.tsx`)

⚠️ DEGRADED: single-context (no sub-agent tool exposed in this session — Assessments A and B ran inline, sequentially, A before B)

Surface: home rail, /tutors directory, tutor profile page, saved posts, admin live preview. Critique ran on component source + DESIGN.md tokens (screenshot not available to reviewer context; no browser automation this session, DB-backed page cannot render locally).

## Design Specificity Verdict

**LLM assessment:** ~80% MatchMax, ~20% generic. Azure scarcity is correct (only the "more" link and compare-selected state carry azure), hairline structure right. Violates the system's signature weight ladder (800/700/600/500/400, "no uniform black-type mass"): `font-bold` on ~10 nodes — headline, tutor code, gender chip, both section headings, every chip, every grade, the "more" link, all three highlights, price. Hardcoded navy shadows `rgba(4,19,68,…)` instead of azure color-mix washes; white `--surface` bg instead of `--card` tint; ~6 off-ramp font sizes (11/13/14/17px literals).

**Deterministic scan:** 11 advisory findings, all `design-system-font-size` (lines 38, 205, 213×2, 222, 246, 268, 281, 294, 313, 325). Corroborates the off-ramp size finding; does not scan weights/shadows. No false positives. No browser overlay available.

## Design Health Score — 27/36 (Good, 75%)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Compare toggle flips color with no transition; no label |
| 2 | Match System / Real World | 4 | Grade chips, tutor codes, HK$ speak parents' language |
| 3 | User Control and Freedom | 4 | Expand/collapse chips, reversible compare/save |
| 4 | Consistency and Standards | 2 | Off-ramp sizes, uniform 700, navy shadows, pill-vs-badge grammar |
| 5 | Error Prevention | 3 | Photo onError fallback, emoji stripping |
| 6 | Recognition Rather Than Recall | 3 | Icon-only compare button unlabeled |
| 7 | Flexibility and Efficiency | 3 | Expand-all, compare workflow, full keyboard nav |
| 8 | Aesthetic and Minimalist | 2 | Bold mass; Award icon ×4 redundancy |
| 9 | Error Recovery | 3 | Silent photo fallback |
| 10 | Help and Documentation | n/a | Listing card embeds no help surface |

n/a heuristics: 10. Applicable max 36.

## Overall Impression

Well-engineered, badly voiced. Plumbing (keyboard, ARIA, overflow management, fallbacks) genuinely good. Visually every line shouts at the same volume, so a parent can't answer who/why/cost at a glance. Biggest opportunity: rebalance the weight ladder so proof (grades) pops, context recedes, price anchors the footer.

## What's Working

1. Azure scarcity is disciplined (neutral compare, azure only on "more" link + selected state).
2. Interaction plumbing: keyboard-openable card, focus-visible rings, aria-pressed compare, ResizeObserver chip overflow, photo error fallback, bilingual-safe line-clamp.
3. Three-zone anatomy (identity / proof / cost+action) is the right structure.

## Priority Issues

1. **[P1] Uniform bold mass collapses hierarchy.** ~10 nodes at 700. Fix: weight ladder — headline 700, highlights 600, section headings 600, chips/labels 500–600, supporting credentials + achievements 400. Suggested command: /impeccable typeset.
2. **[P1] Off-system color: white card + navy shadows.** Fix: bg-card, light resting shadow, azure-tinted hover wash (keep translate). Suggested command: /impeccable polish.
3. **[P2] Icon noise + mystery-meat compare.** Award icon in heading and every row; icon-only compare. Fix: drop per-row icons; add tooltip/visible affordance. Suggested command: /impeccable distill.
4. **[P2] No verified/trust marker on card.** Fix: small verified check beside tutor code (needs data check). Suggested command: /impeccable polish.
5. **[P3] 36px compare tap target (<44px), brittle md:pr-20 gap dodge.** Suggested command: /impeccable adapt.

## Persona Red Flags

- **Casey (mobile, one-handed):** 10+ equal-weight items reads as a wall on 375px; 36px compare target is a mis-tap magnet.
- **Jordan (first-timer):** Columns2 icon meaningless; no visible "verified" cue despite proof-first brand; "5**" grade chips land well.
- **Sam (a11y):** Azure "more" link at 12px ≈3.1:1 on white (below 4.5:1, systemic); role="link" card with nested buttons is workable but non-standard.

## Minor Observations

- Price at 3xl loud but acceptable once the rest stops shouting.
- `md:pr-20` gap hack breaks with longer zh-HK gender copy.
- Chips' `rounded-[4px]` off-scale but proportionally fine for micro-chips — keep.
