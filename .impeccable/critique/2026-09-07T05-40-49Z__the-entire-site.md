---
target: the entire site
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/ryanyeung/Documents/VS Code/matchmaxhk/the entire site"
timestamp: 2026-09-07T05-40-49Z
slug: the-entire-site
---
⚠️ DEGRADED: single-context (no sub-agent tool exposed)

Target: the entire site (TanStack Start app, src/routes/** — sampled all public surfaces + shared chrome; 146 scannable files)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeletons/toasts/compare-count are good; filter draft-vs-URL state is ambiguous (sort applies instantly, others only sync on Search) |
| 2 | Match System / Real World | 2 | HK fluency (HKDSE, IB 40+, MTR, HK$) is excellent — but the fee model is stated two contradictory ways on how-it-works |
| 3 | User Control and Freedom | 3 | Clear-filters, collapsible form, compare Clear all exist; profile Back uses history.back() and dead-ends on deep links |
| 4 | Consistency and Standards | 2 | Same "Request tutor" action is azure on profile but neutral on cards; card radius 10px off-token; raw amber-500/red-50 palette; <a> full-reload next to <Link>; mixed translated/hardcoded copy |
| 5 | Error Prevention | 3 | 7-step wizard validates per step, constrains files (JPG/PNG ≤5MB), captcha with error fallback |
| 6 | Recognition Rather Than Recall | 2 | No active state on nav links, 7 top-level items, "Saved Posts" shown to logged-out users, no breadcrumbs |
| 7 | Flexibility and Efficiency | 3 | Compare ≤4 tutors, saved posts, searchable selects, WhatsApp deep links, language toggle |
| 8 | Aesthetic and Minimalist Design | 2 | Card type descends to 9–10px on the primary conversion surface; hero right column is empty; price 3xl competes with identity |
| 9 | Error Recovery | 2 | Field-level errors described well; route errorComponent prints raw error.message; "Contact coming soon" is a dead end; no draft recovery |
| 10 | Help and Documentation | 2 | Two-audience FAQ + WhatsApp tooltips are task-focused; nothing contextual in forms or dashboards |
| **Total** | | **24/40** | **Acceptable — significant improvements needed before users are happy** |

Mode: Persuade (public surfaces); no heuristics marked n/a.

## Design Specificity Verdict

**LLM assessment:** The core directory experience is genuinely authored for this product — anonymous tutor codes, component-level exam score chips (7s in HL, 5** papers, IA marks), MTR-station logistics, and WhatsApp-everywhere are MatchMax-specific, and they fuse form with the "proof-first" positioning. The proof is real: cards read like spec sheets. But the frame around that proof is generic and drifting: the how-it-works page and footer could belong to any marketplace, the "verified" claim — the one thing competitors cannot copy — is rendered as a whisper-quiet grey pill, and bilingual parity (a stated brand pillar) collapses outside the search panel.

**Deterministic scan (detector):** 169 findings — 13 warnings, 156 advisories. By rule: 120 font-size off-ramp (worst files: `src/features/tutors/public-tutor-card.tsx` 18, `src/routes/tutors.index.tsx` 13, `src/styles.css` 14, `src/components/ui/stepper.css` 9, admin cases 11, email templates ~10 each), 22 off-palette colors (`#55575d`/`#999999` in email templates, `#0f172a` in business.functions, `#0b1f3a`/`#7a8194` in the tutor-application email), 14 off-scale radii (stepper.css 1.5rem/0.75rem, StaggeredMobileMenu 2px), 9 off-family fonts (Arial/Courier in emails, Roboto in business.functions), 1 side-tab (border-l-2 in ApplicationForm). Detector agrees with the human review on the microscopic type scale; it also caught stepper/mobile-menu radius drift and Roboto that the human pass missed.

**False positives:** `gradient-text` in styles.css is the sanctioned brand wordmark; `layout-transition: width` is the documented nav underline sweep; `9999px` pill radii are the sanctioned pill shape (step circles are explicitly allowed); email-template fonts/colors cannot consume CSS variables and need a documented exception, not a refactor.

**Visual overlays:** Skipped — no browser automation tool is available in this session, so no user-visible overlay exists and no console evidence was collected. Fallback: CLI scan only.

## Overall Impression

The product's spine — browse verified tutors → compare → request via WhatsApp → human match — is clearly designed and mostly pleasant. The biggest opportunity is to make the trust story as loud as the design system intended: right now verification whispers, the fee story contradicts itself, and half the site forgets it is bilingual. Fix the trust surface and the copy parity, and this jumps a band.

## What's Working

1. **Proof-first execution.** Exam-component chips on cards ("IBDP: Math AA HL 7, IA 17/20"), verified badges, and transcript-verification notes deliver the positioning visually, not just rhetorically. This is the product's moat made interface.
2. **Disciplined conversion choreography.** Azure is reserved for money CTAs (hero Find a Tutor, Search, Post your request, Sign up), WhatsApp green appears only on WhatsApp affordances, and every empty state still offers a next step (clear filters / WhatsApp / post a case).
3. **State craft.** Skeletons everywhere, `pendingMinMs` on profile load, per-step form validation with human-readable field errors, share with clipboard fallback, `motion-reduce` paired on every custom animation, aria-labels on all icon-only controls.

## Priority Issues

1. **[P1] Bilingual parity is broken on the highest-traffic surfaces.** Desktop nav ("Saved Posts", "Become a Tutor", "Request a Tutor"), footer columns and links, directory h1 ("Find verified tutors"), card CTAs ("Request tutor", "WhatsApp us"), the tutor profile page, and the entire how-it-works page are hardcoded English — while the search panel translates properly. In zh-HK the primary nav and page titles stay English. PRODUCT.md declares EN/zh-HK equal citizens; the site currently isn't.
   *Why it matters:* For a Hong Kong parents' market, zh-HK-first visitors get a half-localised product, which reads as low-effort and erodes trust on the trust-obsessed pages.
   *Fix:* Extract every hardcoded string into `src/features/i18n/locales/`, then audit both locales side by side; pay special attention to nav, footer, directory/profile h1s, card CTAs, and all of how-it-works.
   *Suggested command:* `/impeccable harden`

2. **[P1] The money story contradicts itself on how-it-works.** Three sections promise a "fair 1.5-lesson fee (100% of the 1st lesson and 50% of the 2nd)", while the tutor FAQ says "you pay MatchMax our agency commission for the 1st and 11th lesson of that student contract". Two different fee models on one page.
   *Why it matters:* Tutors deciding whether to join will read the FAQ. A direct contradiction about money on a "radically transparent fees" pitch destroys the page's entire argument.
   *Fix:* Pick the true model, reconcile VALUE_PROPS, EDUCATOR_COMPARISON, TUTOR_STEPS, and FAQ_FOR_TUTORS to it.
   *Suggested command:* `/impeccable clarify`

3. **[P1] Zero draft persistence on high-stakes forms.** The 7-step tutor application (2,187 lines of collected state: qualifications, scores, achievements, uploads, MTR stations) and the case request form keep nothing across refreshes or accidental navigation.
   *Why it matters:* A tutor who spends 20 minutes and hits refresh loses everything — and tutors are the supply side of the marketplace. Same for a distracted parent mid-case-posting (Casey persona guaranteed).
   *Fix:* Persist form state to sessionStorage per step (and restore files metadata on remount where feasible), with a visible "draft saved" cue.
   *Suggested command:* `/impeccable harden`

4. **[P2] The verification promise is under-designed and the recovery paths dead-end.** The "Verified" badge is a grey pill with a muted icon — the single most important claim on the page is the quietest element. There is no explanation of what verification means on the profile itself (it lives only in the FAQ of another page). When no WhatsApp number is configured, the profile shows a disabled azure "Contact coming soon" button — an unfinished-sounding dead end with no fallback. Route error pages print raw `error.message`.
   *Why it matters:* Product principle #1 is "proof before promise", yet the proof moment has no hierarchy and failure states strand users.
   *Fix:* Give the badge weight (tokenized status styling + a one-line "transcript-checked by our team" microcopy linking to FAQ); replace the disabled CTA with an active "Post a case request" fallback; swap raw error.message for plain-language recovery with a "Browse tutors" action.
   *Suggested command:* `/impeccable polish`

5. **[P2] Type floor and interaction consistency drift on the directory surface.** PublicTutorCard descends to 9px (gender pill), 10px (chips, achievements), 11px (credential lines) — far under the system's 0.95rem body and punishing for Traditional Chinese glyphs. The same "Request tutor" action is azure on the profile page but neutral on every card. Sort applies instantly while every other filter waits for Search. Card radius is a hardcoded 10px (token scale is 1.3rem-derived). Nav mixes `<a href>` (full reload for How it works) with `<Link>`, and shows no active state.
   *Why it matters:* The card is the conversion surface; unreadable type and inconsistent affordances tax exactly the users you most want to convert.
   *Fix:* Set a 12px type floor on cards (bump token sizes), unify the request-tutor treatment (neutral everywhere, or azure only on profile — pick one and write it into DESIGN.md), route all filter changes through one commit model, move radii/colors to tokens, use Link + active states in the header.
   *Suggested command:* `/impeccable typeset` (then `/impeccable polish` for the interaction sweep)

## Persona Red Flags

**Jordan (Confused First-Timer, HK parent):** Lands on a profile from search and sees "MM-2087 • Male" with a grey "Verified" pill and no explanation of what was verified; the fee model in FAQ contradicts the pitch he read 2 minutes earlier; "Saved Posts" in the nav goes to a login wall he didn't expect; "Examiner/pro teachers" is unexplained jargon in the home category rail. Will WhatsApp before he trusts — which the site does make easy.

**Casey (Distracted Mobile User):** Home search panel stacks 4 selects + a dual-thumb slider + sort + WhatsApp button before any results — a long thumb-scroll before payoff. Card footer buttons are 36px tall (under the 44px touch minimum). CompareBar collision with the WhatsApp float is handled, but the compare dialog requires horizontal scrolling of a 36rem grid on a phone. Positive: hero CTA is full-width, carousels snap, state survives tab-switching.

**Riley (Deliberate Stress Tester):** Refreshes mid-application → everything gone (no persistence). Deep-links to a tutor profile and hits Back → leaves the site entirely (history.back() with no same-site history). Triggers a loader error → raw `error.message` on screen. Changes filters then clicks a tutor card → returning restores the URL filters, discarding the unsaved draft adjustments. Directs to `/case-request` → clean redirect (nice).

**Project persona — Cantonese-first parent (zh-HK default):** Switches to 中文 and the header still reads "Saved Posts / Become a Tutor / Request a Tutor", the directory h1 stays "Find verified tutors", cards still say "Request tutor", and how-it-works is 100% English. The brand's "two languages, one product" principle fails at first contact.

## Minor Observations

- Home hero: h1 + one CTA, empty right grid column, no subhead and no trust stats — PRODUCT.md promises live stats/reviews on the landing page; the current home renders none. The strongest proof surface asserts least.
- Category rails with zero tutors still render the heading and "View all" (e.g. a curriculum with no published tutors shows an empty shelf).
- OG image is hot-linked from a third-party `storage.googleapis.com/gpt-engineer-file-uploads/...` bucket — fragile for a business asset.
- Footer "Support" column contains exactly one link: "Home".
- JSON-LD Person uses `tutor_code` as `name` — consistent with the anonymity stance, but worth confirming intent for SEO.
- 7 desktop nav items and ~10 mobile menu items exceed the ≤5/≤4 guidance; "For Business" and pricing could group.
- Directory sort `onChange` navigates immediately while identical-looking selects only stage a draft — the one inconsistent control in an otherwise uniform filter bar.
- `bg-red-50 hover:text-red-600` sign-out states will flash light-on-dark in dark mode; use destructive tokens.
- Slider "+" suffix logic (`max_price === undefined`) is subtle but well done.

## Questions to Consider

- What if the verified badge carried the whole story — "Transcript-checked ✓ + date" — instead of whispering in grey? The moat deserves the loudest pixel on the page.
- What if the home hero's empty right column showed the live trust numbers (students matched, active tutors, districts) that PRODUCT.md says exist?
- Should "Request tutor" be azure everywhere, or never on cards? Right now the same verb wears two uniforms depending on the page.
- What would this site feel like if zh-HK were the default render — would the nav, footer, and how-it-works survive?
