---
name: MatchMax
description: Proof-first tutoring marketplace for Hong Kong. A calm, Arc-aligned interface (uiarc.dev rules) on the Twitter Azure palette (21st.dev, serafimcloud): ink-on-paper neutrals, hairline borders, one Azure signal, bilingual EN/zh-HK.
colors:
  ink: "#0F1419"
  azure: "#1D9BF0"
  azure-fill: "#0F7DB8"
  azure-fill-dark: "#1273B4"
  azure-deep: "#1DA1F2"
  link-blue: "#0B72B5"
  sky: "#8ECDF8"
  azure-wash: "#E3ECF6"
  card-tint: "#F7F8F8"
  input-tint: "#F7F9FA"
  hover-wash: "#EFF3F4"
  hairline: "#E1EAEF"
  secondary-ink: "#46535E"
  paper-white: "#FFFFFF"
  status-destructive: "#D61F2E"
  status-success: "#157F47"
  status-warning: "#F7B928"
  dark-canvas: "#121212"
  dark-header-band: "#17181B"
  dark-surface-subtle: "#1A1C1E"
  dark-card: "#1E1E1E"
  dark-raised: "#232327"
  dark-hover: "#26282C"
  dark-border: "#41454B"
  dark-secondary-ink: "#A3AAB1"
  dark-disabled-ink: "#8A8E93"
  dark-input: "#3E4B58"
  dark-success: "#4ADE80"
  dark-warning: "#FCD34D"
  dark-destructive: "#F87171"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, 'PingFang HK', 'Microsoft JhengHei', sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 4.5rem)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, 'PingFang HK', 'Microsoft JhengHei', sans-serif"
    fontSize: "clamp(1.75rem, 2vw + 1.1rem, 2.45rem)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'PingFang HK', 'Microsoft JhengHei', sans-serif"
    fontSize: "clamp(1.35rem, 1.1vw + 1rem, 1.75rem)"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  subtitle:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'PingFang HK', 'Microsoft JhengHei', sans-serif"
    fontSize: "clamp(1.1rem, 0.85vw + 0.9rem, 1.3rem)"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'PingFang HK', 'Microsoft JhengHei', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "-0.01em"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'PingFang HK', 'Microsoft JhengHei', sans-serif"
    fontSize: "0.75rem to 0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.01em"
rounded:
  control: "18px"
  panel: "26px"
  surface: "34px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
  section: "80px (marketing sections breathe across 64 to 120px)"
components:
  button-primary:
    backgroundColor: "{colors.azure-fill}"
    textColor: "#FFFFFF"
    rounded: "{rounded.control}"
    height: "36px (44px for mobile-primary CTAs, 50px for hero lg)"
    padding: "8px 16px"
    fontWeight: 500
  button-primary-hover:
    backgroundColor: "#0A6296"
  button-neutral:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "8px 16px"
    fontWeight: 500
  button-outline:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "8px 16px"
    fontWeight: 500
  button-outline-hover:
    backgroundColor: "{colors.hover-wash}"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "4px 12px"
    fontWeight: 400
  card:
    backgroundColor: "{colors.card-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "24px"
    border: "1px {colors.hairline}"
    shadow: "none (border-delineated at rest)"
  badge-default:
    backgroundColor: "{colors.ink}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
  badge-secondary:
    backgroundColor: "{colors.ink}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
---

# Design System: MatchMax (Azure, Arc-aligned)

## Overview

**Creative North Star: "The Signal, engineered calmly"**

MatchMax pairs the **Twitter Azure palette** (21st.dev community theme by serafimcloud: Ink `#0F1419` on Paper White, hairline borders, Azure `#1D9BF0` as the one colour that means *act now*) with the **Arc design bar** (uiarc.dev): a calm, neutral interface where type, spacing, and one considered interaction carry the character. No decoration performs for attention. The interface is confident because it is quiet: neutral surfaces, generous space, exact corners, and a single azure signal per view. The system is proof-backed: real numbers in tabular figures, hairlines instead of heavy chrome.

**Relationship to Arc.** Arc (uiarc.dev) is the style authority for type, geometry, copy, surfaces, and motion. When this document says "Arc", it cites the rule, not a package: nothing here requires installing Arc components. Existing shadcn-based components are styled toward these values; Arc components, patterns, and skills remain the first reference when building or reviewing UI (PR #455's in-place adaptations are the model).

**Key characteristics:**
- Calm type: Geist for large headings, Inter everywhere else, weights 400 and 500 only. Hierarchy comes from size, colour, and spacing, never from bold
- Scarcity of accent: azure fills appear only on money CTAs (~10% of buttons); everything else is white, grey, or ink monochrome
- Azure owns interaction: accent fills, links, focus rings, selected and active states, progress meters, data-viz series
- AA floor: every text and indicator pair passes WCAG AA in both themes (4.5:1 text, 3:1 non-text); the azure signal deepens on light surfaces to hold it, and never rides an alpha wash
- One purpose per surface: one `h1`, one primary action, one memorable detail
- Concentric geometry: controls 18px, panels 26px, surfaces 34px, nested corners parallel to their parents
- Flat surfaces, hairline borders; shadows exist only on layers that float above the page
- Motion explains a change; entrance choreography is retired from the system
- Sentence-case copy, no eyebrows, no em dashes, buttons are verbs with objects
- Full dark theme: dim `#121212` canvas on a luminosity ladder with visible night hairlines (`#41454B`), chrome bands that lift off the canvas (`#17181B`), and azure as the signal in both themes
- Bilingual-first: EN and zh-HK parity, CJK system-font fallback, layouts never assume Latin-only metrics

## Colors

The palette is a quiet news feed: ink text, paper and card-tint surfaces, hairline borders, and one azure signal. Statuses (green, amber, red) exist only for real states, never decoration. This section is Arc's "accent with intent" and "status means status" already in place, and it does not change.

### Primary
- **Azure** (an AA-scaled family around `#1D9BF0`): **the one accent.** Money-CTA fills (`--btn-accent`/`--primary`: `#0F7DB8` light, `#1273B4` dark; hover `#0A6296`/`#0E66A1`), text links and signature blue (`--brand-link`: `#0B72B5` light, `#1D9BF0` dark), focus rings (`--ring`: `#0B72B5` light, `#1DA1F2` dark), selected and active states, stepper and progress fills, and data-viz series. Raw `#1D9BF0` (`--brand-royal`/`--brand-teal`) stays the gradient and decorative blue; it carries no text and holds no white label (3.0:1 on white fails the AA floor). The `--color-brand` utility token (`hover:text-brand` in the footer) rides `--brand-link`.
- **Ink** (`#0F1419`, `--ink`/`--foreground`/`--brand-navy`): The text and neutral-button colour of the system. Body and heading text on light surfaces, ghost and neutral button fills (`color="neutral"`, `--secondary`), the dark start of the brand gradient, and dark-theme inverted surfaces.

### Secondary
- **Sky** (`#8ECDF8`, `--brand-cyan`/`--brand-aqua`): The gradient's light end (wordmark and hero backdrops only). Never in interactive states.
- **Azure Wash** (`#E3ECF6`, `--accent`): Hover washes and soft azure-tinted panels, always with ink text (`--accent-foreground` is ink; azure text on the wash is 2.5:1). The one azure-tinted surface; all other washes stay true neutral.

### Tertiary
- **Green** (`#157F47`, light), **Amber** (`#F7B928`, fill only, ink text on it), **Red** (`#D61F2E`, light): Statuses, AA in both the text-on-light and white-on-fill roles. Red is the theme destructive. The button colour axis keeps its own AA-safe derivations (`#00875A`, `#A16207`). In dark mode the status tokens lighten to `#4ADE80`/`#FCD34D`/`#F87171` with dark-ink text on fills (dark-mode guide §7).
- **WhatsApp Green** (`#25D366`, `--brand-whatsapp`): The single sanctioned non-palette colour, for WhatsApp contact affordances only. Hover `#1EBE57`.

### Neutral
- **Paper White** (`#FFFFFF`, `--surface`/`--background`): Canvas and default button fill on light.
- **Card Tint** (`#F7F8F8`, `--card`/`--sidebar`): Cards sit a half-step off the canvas.
- **Input Tint** (`#F7F9FA`, `--input`) and **Hover Wash** (`#EFF3F4`, `--surface-hover`): Wells and hover states.
- **Secondary Ink** (`#46535E`, `--muted-foreground`): Secondary text on light, and the only secondary grey: ad-hoc palette greys (`text-slate-*`, `text-gray-*`) and hardcoded status hexes are retired.
- **Hairline** (`#E1EAEF`, `--border`): Borders and separators on light.
- **Night Canvas** (`#121212`) / **Night Band** (`#17181B`) / **Night Card** (`#1E1E1E`) / **Night Border** (`#41454B`): Dark-theme surfaces on a luminosity elevation ladder, canvas `#121212`, the header and sticky search band `#17181B` (chrome lifts one step off the canvas, mirroring the grey band on light), subtle and sidebar `#1A1C1E`, cards and muted `#1E1E1E`, popovers and raised `#232327`, hovers `#26282C`; primary ink everywhere `#E7E9EA` (~15:1), secondary text `#A3AAB1` (~7.5:1), disabled text `#8A8E93`, input strokes `#3E4B58`, sidebar border `#41454B`. Dark statuses lighten for comfort, each with dark-ink text on fills, and the dark chart series ride the same lightened status hues (amber `#FCD34D`).

### Named Rules
**The Scarcity Rule.** Azure (`--btn-accent`/`--ring`/`--brand-link`) owns exactly three things: (1) money-CTA fills, the ~10% of buttons that start a conversion flow, (2) text links, (3) focus rings and selected or active states. Everything else is ink or neutral. Test: *does this button start a conversion flow?* If not, it is neutral (white or ink). Do not colour headings, card backgrounds, or every icon with it.

**The Constant Signal Rule.** Dark mode dims the world, not the signal: Azure keeps carrying accent fills, links, and focus in both themes. Dark neutral and secondary buttons use X's translucent slate fill (`rgba(91,112,131,0.4)`, `--btn-neutral`) with white text, deepening to `0.6` alpha on hover; the white pill is never a resting neutral in dark mode. The inverted CTA pill (`--surface-invert`) is white with ink text in dark, white text on ink in light; never hardcode `text-white` on an invert fill.

**The AA Floor Rule.** Every text token pair passes WCAG AA in both themes: 4.5:1 for text, 3:1 for indicators and non-text UI. Never dim text with opacity classes (`/40` through `/70` are retired; `/80` to `/90` on foreground are the only sanctioned softened-ink steps), never alpha-fade a focus indicator (rings and outlines are solid `--ring`), and never introduce a colour without checking its pairs against `background`, `card`, `muted`, and `accent`. Light-theme link blue is `#0B72B5`, not `#1D9BF0`, for exactly this reason.

## Typography

**Display font: Geist** (400/500) for headings 30px and up: heroes, page and section `h1`/`h2` at display sizes.
**Body font: Inter** (400/500) for body text, labels, controls, and small headings below 30px.
Load them as `--font-display` and `--font-body`. Both are Latin-only; zh-HK text falls back to the system CJK stack in both fonts, unchanged from today.

**Character:** hierarchy comes from size, colour (`--foreground` over secondary ink), and spacing. Weights are 400 and 500 only, never 600, 700, or 800. Display tracking is `-0.03em`, body and label tracking `-0.01em`. Never `text-transform: uppercase`, never wide tracking on small labels, never an eyebrow line above a heading (see Copy).

### The size scale
Sizes come from this ladder only: 11, 12, 14, 16, 18, 22, 28, 36, 52, 72px. 11px is the floor, for captions and dense meta only; nothing smaller ships.

- **Display** (500, 36 to 72px, 1.1 line-height, `-0.03em`): Marketing heroes, landing `h1`, how-it-works display headings.
- **Wordmarks** (the one sanctioned exception to 400/500, by owner decision): the header "MatchMax" label is legacy Open Sans 700 (`--font-wordmark-nav`), and the footer sign-off is Poppins 800 (`--font-wordmark`). Never restyle these back to 500.
- **Headline** (500, 22 to 28px): Page `h1`s and section `h2`s at product scale, dialog titles.
- **Title** (500, 18 to 22px): Card titles, prices, stat numbers, panel headings.
- **Subtitle** (400, 16 to 18px): The one supporting line under a heading, when it adds information.
- **Body** (400, 16px, 1.6): All running text. Small text at 14px, micro at 11 to 12px.
- **Label** (500, 12 to 14px, sentence case): Buttons, chips, form labels, table headers, step indicators.
- **The Heading Step Rule.** A heading sits at least one full ladder step above its content: page sections at 22 to 28px, panel and card-section headings at 18px minimum over 14 to 16px content. Inside a dense card, a section caption takes the Label role instead (12px, 500, secondary ink): it is signage for the group, not a title, and never competes with the card title.
- **Weight rationing.** 500 belongs to titles, labels, chips, controls, and key figures. Body copy, list content, and the supporting lines under a heading sit at 400. When a heading fails to stand out, the fix is a size step, a colour step, or demoting nearby content to 400; never a heavier weight.
- Numbers that change or align in columns use `font-variant-numeric: tabular-nums`.

### Named Rules
**The Two Faces Rule.** Geist lives only in large headings; Inter lives everywhere else. Keep Geist out of controls and small labels; keep Inter out of hero headlines. No third family.

**The No-Bold Rule.** Never set 600 or heavier, and never fake emphasis with bold. If two levels of text need to differ, change the size, the colour (foreground vs secondary ink), or the spacing around it.

**The Two-Script Rule.** Every type decision must hold for Traditional Chinese system-font fallback: no fixed-height text containers narrower than the zh-HK glyph, no letter-spacing tricks on CJK, always test EN and zh-HK parity.

## Copy

Arc copy rules, adopted in full. Copy is short, specific, and honest.

1. **Sentence case everywhere**: headings, buttons, tabs, menu items, table headers, badges. Capitalize only the first word and proper nouns. Never all caps, never `uppercase`.
2. **No eyebrow labels.** No kicker or overline above a heading ("For parents & students", "PRICING", "Why us"). If the context matters, put it in the heading or in the description below it. A badge beside a heading that carries information ("Beta", "Recommended") is not an eyebrow. Existing eyebrows fold into headings or descriptions as they are touched.
3. **No em dashes** (U+2014) in English copy. Use a period, comma, colon, or parentheses. Ranges read "2 to 5". zh-HK copy is unaffected: it uses 「」 quotes and written Cantonese, never em dashes.
4. **No period at the end of a heading**, and no ornamental punctuation (trailing dots, decorative slashes and arrows).
5. **Buttons are verbs with an object**: "Find a tutor", "Post your request", "Save changes". Not "Submit", "OK", or "Learn more". A bare verb is fine only when the object is named right beside it.
6. **One subtitle at most**, and only when it adds information the heading cannot. Drop it when the content explains itself.
7. **Honest claims.** No invented numbers, testimonials, customer logos, or awards. Every stat on screen is real and sourced (this is a proof-first brand; the proof is the product).
8. **Consistent terms.** One word per concept across the product: "tutor", "case", "request" mean the same thing everywhere.

Patterns:
- **Errors** say what happened and how to fix it, next to the field: "Enter an email like name@company.com".
- **Empty states** say why they are empty and offer one next step: "No saved tutors yet. Tutors you save appear here."
- **Destructive confirmations** name the object and the consequence.
- **Success** is a state change in place ("Saved", a check, the new value), not a paragraph. Toasts are for background work only, never the sole confirmation of a foreground action.
- **Numbers** use real formatting ("$1,240", "12.5%") and tabular numerals where they change. **Dates** are human and unambiguous ("Sep 24", "2 hours ago").

## Layout

Content rides on a max-width rail system. The site header and full-bleed marketing sections (how-it-works) run at `max-w-[1440px]` with `px-4 → sm:px-8 → lg:px-10/12`; standard landing and directory content uses `max-w-7xl` with `px-4 → md:px-6`; detail pages (tutor, course, business) tighten to `max-w-5xl`; consoles use `max-w-6xl/7xl` with `py-8 to 12`. A `PageContainer` utility offers narrow (`max-w-3xl`), default (`max-w-4xl`), wide (`max-w-5xl`) rails at `px-4 sm:px-6` for form-led pages. Auth cards cap at `max-w-[420px]`.

Spacing rhythm follows Arc's context rule: 16px inside groups, 24px between regions, 32 to 48px between long-form sections, 24 to 32px page padding; marketing sections breathe at 64 to 120px vertical (`py-20 sm:py-28` today). Card interiors `p-6`; grid gaps 16 to 24px. Base grid is Tailwind's 4px scale. Internal control spacing stays fixed as the viewport grows; only outer gutters grow. Breakpoints are Tailwind defaults. Mobile patterns: horizontal snap rails for tutor rows, full-width stacked CTAs, and the StaggeredMobileMenu.

### Named Rules
**The 1440 Rail Rule.** Header and hero rails stop at 1440px; inner content stops at `max-w-7xl`. Nothing stretches edge-to-edge except full-bleed tinted sections.

## Surfaces and elevation

Group with proximity first, a one-pixel `--border` second, a card only for a real boundary. Dark mode communicates elevation with luminosity (the night ladder), light mode with hairlines. Cards never rest on a shadow.

- **Cards rest on borders.** 1px `--border` hairline, `bg-card` fill, surface radius. No resting shadow on cards, buttons, or inputs. `shadow-sm` and friends are gone from the resting look.
- **Shadows float or they do not exist.** The only layers that may cast a shadow are layers that float above the page: dialogs, menus, popovers, sheets, the WhatsApp float, and the stuck mobile search pills (the sanctioned `.pill-elevate` treatments). Shadows there are neutral near-black at low opacity in light theme and per the night ladder in dark. Never coloured, never azure-tinted, never stacked. This is the single exception to the repo's flat-shadow ESLint ban; the rule needs amending (with a floating-layer carve-out) when floating shadows land in code.
- **Sibling cards share edges.** Cards in a row start at the same top, stretch to the same height, and sit flush with the content column. Separate them with a real gap (16 to 24px) or join them into one bordered group with hairline dividers. Never a 1 to 4px gap where two borders nearly touch.
- **No nested cards.** A card inside a card is a layout problem; solve it with dividers, spacing, or `--border-subtle` regions.
- **Theme switch** (`html.theme-switching` for ~300ms): 250ms ease on background, colour, border, fill, and stroke when the theme actually flips (dark-mode guide §10); media and reduced-motion users are excluded.

### Named Rules
**The Floating Shadow Rule.** If it does not float over the page, it does not get a shadow. Reach for a 1px border or a surface step before any elevation.

**The Night Ladder Rule.** In dark mode, fill steps between surfaces are near-invisible (1.1 to 1.2:1 at night luminances), so boundaries are carried by hairlines and the ladder is carried by named tokens:
- Night hairlines must be plainly visible: `--border` `#41454B` sits ~1.9:1 over the canvas. (Light hairlines survive at ~1.2:1; dark surrounds compress perceived contrast, so the night step is wider.) Input strokes get their own blue-tinged `--input` `#3E4B58`. Never ship a dark surface that separates by fill alone.
- Sticky chrome (site header, directory search band, mobile top and bottom bars) rides `--surface-header` `#17181B`, exactly one step above the canvas, the way the grey band reads on light. Never let band and canvas share a colour.
- Floating layers ride `--popover` `#232327` plus the night lift shadow; they are the only layers above the ladder.
- Dark is a first-class theme, not a derivative: every new surface, chart series, badge, and illustration is checked in dark before it ships (charts use the lightened dark status hues, photography dims to ~0.18 with `.logo-dark-recolor`, nav PNGs take the `dark:invert` treatment). The `.dark .bg-white` remap in styles.css is a safety net for stray paper fills, not a design tool; on always-ink sections, spell white accents explicitly (`bg-[#ffffff] dark:bg-[color:var(--surface-invert)]`, the tutor-playbook tray pattern) so the remap cannot strand dark artwork on a dark fill.

## Motion

Motion shows cause and effect: what opened, what changed, where it came from. If an animation explains nothing, remove it. Entrance choreography is retired: no section reveals, no hero text effects, no stagger. What remains is state-change motion only.

### The motion vocabulary
Springs via `motion/react`; CSS transitions use the matching duration and easing variables.

| Token | Value | Use for |
| --- | --- | --- |
| `spring.smooth` | 0.4s, bounce 0 | Panels, height, drawers, progress, layout shifts. Never overshoots: anything that reports a state lands without bounce |
| `spring.snappy` | 0.26s, bounce 0.12 | Press feedback, small indicators, icon swaps |
| `spring.morph` | 0.42s, bounce 0.16 | Shared highlights (`layoutId`), width that follows new content, shape morphs |
| durations | 0.12 / 0.16 / 0.18 / 0.24 / 0.48s | Colour, opacity, small fades. Exits are faster than entrances |

### What motion does here
- **Sliding indicators**: segmented controls, tab rows, and toggles slide their active pill or underline between positions (DirectoryToggle thumb, MobileBottomNav indicator, desktop-nav underline sweep) via `motion layoutId` with `spring.morph`. Never an instant swap.
- **Panels and disclosure**: height plus opacity together on `spring.smooth`, no overshoot; exits at the faster exit duration.
- **Presses**: `active:scale-[0.97]` on `spring.snappy`, except elements that anchor a popover or menu (the press positions against them); those answer with colour instead. The opt-in `refined` and `hoverArrow` Button props follow this vocabulary; they stay out of tutor cards (card visuals are frozen by product decision).
- **Numbers count** to their new value with tabular numerals and a stable width.
- **Rails**: horizontal scrollers use `.rail-scroll` (native scrollbar hidden; discovery comes from the next card peeking past the edge). Desktop rails get circular arrow buttons whose ends disable from live scroll state.

### Retired (the "AI-built" tells)
Per-card staggered fade-ups, bouncy scale-ins, gradient blobs, shimmer sweeps, glow borders, particles, decorative marquees, and now also: whole-section scroll reveals (the `Reveal` rise-and-fade wrapper), the blur-highlight hero text (blurred words snapping sharp with a sky sweep), and the announcement banner's entrance choreography. The banner's slide crossfade may remain while it carries multiple live announcements. Loops are allowed only for live status.

Every animation keeps its `motion-reduce` / `prefers-reduced-motion` branch, preserving final state, focus, and feedback.

## Shapes

Three radii and a pill, from Arc's concentric system:

- `--radius-control`: **18px**. Buttons, inputs, and compact controls.
- `--radius-panel`: **26px**. Menus, popovers, and nested panels.
- `--radius-surface`: **34px**. Cards and large surfaces.
- `--radius-pill`: **9999px**. Avatars, status marks, pill buttons, step circles, connector bars.

**The Concentric Rule.** A nested corner is the outer radius minus the padding between it and the parent, so the curves stay parallel:

```css
.card  { border-radius: var(--radius-surface); padding: 24px; }
.card > .media { border-radius: calc(var(--radius-surface) - 24px); } /* 10px */
```

Clamp the result at a small positive value (`max(6px, calc(...))`) when padding is large. Never nest the same radius inside itself; the same value inside and out makes a thick, uneven corner.

Corners are always symmetric. Borders are 1px hairlines; dividers use `border-border` or ink at 10 to 15% alpha. Photographic and patterned backdrops (hero pattern, paper texture with azure radial and SVG noise) clip to their section, softened with gradient scrims rather than rounded frames.

## Components

For each component: one clear primary action, calm signage, tactile feedback.

### Buttons
- **Shape:** `--radius-control` (18px). Heights: 36px default, 44px for mobile-primary and full-width CTAs, 50px for hero large. Weight 500, verb-plus-object labels.
- **Neutral default** (`variant="default"`): white fill, ink text, hairline `foreground/15` border, no shadow; hover washes to the hover wash and deepens the border. The resting state of ~90% of buttons.
- **Accent** (`variant="solid" color="blue"`, `color="accent"` is an alias): the money CTA. `--btn-accent` fill (`#0F7DB8` light, `#1273B4` dark) with white text, hover `#0A6296`/`#0E66A1`. Reserved for the conversion list: hero Find a Tutor, directory Search, Post your request (and submit), Join as Tutor (and final submit), Contact and Request Tutor, header Sign up, auth continue, pricing highlighted CTA, dashboard and case CTAs, Publish course, business signup.
- **Request-tutor decision:** the full-size "Request tutor" CTA on the tutor profile page is the one azure contact CTA; on tutor cards (home rails, directory, suggested tutors) the compact "Request tutor" WhatsApp button ships neutral so the card stays scannable and azure stays scarce. Do not flip card contact buttons to azure.
- **Colour axis** (`color` sets `--btn/--btn-fg/--btn-hover`): blue/accent (azure tokens), neutral (ink fill), green `#00875A→#006B47`, amber `#A16207→#854D0E`, destructive. `variant="candy"` adds a vertical gradient for marquee CTAs (legacy; no new uses). `variant="soft"` renders the colour as a 12 to 18% tint.
- **Ghost / Link / Outline / Secondary:** Ghost is ink text with a 6% hover wash; Link is azure, underlined on hover; Outline is surface fill with a `foreground/15` border shifting to `/25` plus a 4% wash on hover; Secondary is the neutral axis (`--btn-neutral`): ink fill with white text on light, translucent slate `rgba(91,112,131,0.4)` with `#F0F3F4` text on dark, hover deepens the same fill.
- **States:** press `active:scale-[0.97]` on `spring.snappy`, keyboard-only `focus-visible` azure ring (solid `--ring`) with offset, never a ring on pointer focus, disabled at 50% opacity, optional loading spinner. `motion-reduce` disables the press.

### Badges and chips
- **Style:** pill radius for status marks and tags, `px-2.5 py-0.5`, 11 to 14px at 500, sentence case. Default is ink fill with white text; Secondary is the `--secondary` ink axis; Outline is a hairline border with foreground text. Selected filter chips use the azure accent wash with ink text.

### Cards and containers
- **Corner:** `--radius-surface` (34px), concentric with any nested shapes.
- **Background:** `bg-card` (`#F7F8F8` light, `#1E1E1E` dark).
- **Separation:** 1px `border-border` hairline, no resting shadow; siblings share edges (real 16 to 24px gaps or joined groups with dividers).
- **Internal padding:** `p-6` standard; the marketing search panel keeps `p-2.5 sm:p-5`.

### Inputs and fields
- **Style:** 44px tall (`--control-height-md`), transparent fill, 1px `--input` stroke (`--border-strong` semantics on emphasis), `--radius-control` corners, 16px text (14px at sm breakpoints), 400 weight.
- **Focus:** border shifts to the ring colour plus a solid `ring-2` for keyboard focus only; no glow, no alpha washes, no ring on pointer focus.
- **Error and disabled:** destructive styling per shadcn form wiring, error text beside the field saying what to fix; disabled at 50% opacity with `cursor-not-allowed`.

### Icons
- `lucide-react` at 16, 20, or 24px, `strokeWidth={1.75}`. Decorative icons carry `aria-hidden="true"`.
- A plain icon beside its label. No icon inside a rounded tile or circle unless the shape is the control itself or carries status (the numbered stepper circles qualify). Decorative icon medallions are retired from the system; use a text label when it is clearer than an icon, especially for destructive or unfamiliar actions.
- Tutor-card icons in `--brand-link` azure are data markers, not decoration; they stay.

### Navigation
- Sticky 64px header: `bg-[color:var(--surface)]/95` with `backdrop-blur-sm`, hairline bottom border at ink/10. Logo (32px) plus "MatchMax" wordmark in `text-brand-gradient` at 700 in the legacy Open Sans wordmark face. Desktop links: 15px at 500, ink at 85%, hover and focus shift to azure with a 2px ink underline sweeping in from the left (`spring.morph`). The account affordance is a bordered `surface-subtle` pill with an ink-initial avatar; header Sign up is an azure money CTA. Mobile uses the staggered full-screen menu (ink, azure, sky layer colours). The footer mirrors the header at `max-w-7xl`: sentence-case 14px column headings at 500, `--muted-foreground` links hovering to azure (`--color-brand` rides `--brand-link`), and a 4xl/5xl "MatchMax" sign-off at 800 in the Poppins wordmark face.

### Signature components
- **Brand-gradient wordmark** (`text-brand-gradient`): ink, azure, sky at 135°, clipped to text (dark mode: sky to azure). The wordmark, the footer sign-off, and hero backdrops are the only gradient homes; banned on all other text, buttons, and component surfaces.
- **Join stepper**: 36px numbered circles (status shapes) with azure fill for active (`#0F7DB8` light, `#1273B4` dark), green for complete (`#157F47` light, `#4ADE80` dark), animated connector bars on `spring.smooth`, card shell at panel radius, slide-forward and back content transitions.
- **Hero backdrops**: patterned and photographic scrims (education pattern, tutor-network photo at `saturate(0.78) contrast(1.1)` with ink gradient overlays and an azure radial hotspot). Gradients here are subtle backdrops, never component fills. Dark mode dims imagery to 18% opacity and recolours the logo via `.logo-dark-recolor`.
- **WhatsApp float**: the persistent circular WhatsApp-green contact affordance on public pages; it floats, so it may use the floating shadow.

## Migration debt

The codebase still carries pre-Arc artifacts that this system retires. Fold them in as files are touched, or in a dedicated pass:
- Font swap: Open Sans to Geist (display) and Inter (body), loaded as `--font-display` and `--font-body`, with weights above 500 stripped from headings.
- Radius tokens: `--radius-control` 8px to 18px, cards ~25px to 34px, plus concentric nesting in composed cards.
- Eyebrow and kicker lines folded into headings or descriptions.
- `Reveal` wrappers, the blur-highlight hero text, and the banner entrance choreography removed; motion reduced to the state-change vocabulary above.
- Decorative icon tiles and medallions flattened to plain icons beside labels.
- The ESLint no-shadow rule amended with a floating-layer carve-out (dialogs, menus, popovers, sheets, the WhatsApp float, `.pill-elevate` pills).
- Any 600/700/800 font-weight utilities replaced with size, colour, or spacing hierarchy.

## Do's and Don'ts

### Do:
- **Do** ration azure: before adding `variant="solid" color="blue"`, apply the conversion test. If the button does not start a conversion flow (Find a Tutor, Post a request, Join, Contact, Sign up, Publish), ship it neutral.
- **Do** keep type calm: Geist and Inter at 400 and 500 only, sizes from the 11-to-72 ladder, tabular numerals for changing numbers.
- **Do** contrast-check every new colour: 4.5:1 for text, 3:1 for indicators, against `background`, `card`, `muted`, and `accent`, in both themes.
- **Do** write copy like a person: sentence case, verbs with objects on buttons, errors that say what to fix, empty states with one next step, real numbers only.
- **Do** keep corners concentric: inner radius equals outer radius minus the padding between them.
- **Do** keep interactive surfaces tactile: press at 0.97 on snappy springs, keyboard-only azure focus rings, interruptible spring transitions.
- **Do** pair every animation with a `prefers-reduced-motion` branch that preserves final state and feedback.
- **Do** verify both EN and zh-HK renderings of any new copy or component; layouts must not assume Latin widths.
- **Do** use azure (`--brand-link`) for text links in both themes, and dim photographic backdrops in dark mode (opacity ~0.18) with `.logo-dark-recolor`.
- **Do** check every new screen in dark before shipping it: borders visible on the night canvas, sticky chrome on `--surface-header`, chart and status colours on the lightened dark hues, no paper-white leftovers.

### Don't:
- **Don't** set font weights above 500, fake bold, uppercase transforms, or wide tracking on small labels.
- **Don't** dim text with opacity classes, invent ad-hoc greys or hardcoded status hexes, or alpha-fade focus rings; secondary text is `--muted-foreground`, statuses are tokens, rings are solid `--ring`.
- **Don't** add eyebrow lines, em dashes in English copy, or periods at the end of headings.
- **Don't** put icons in decorative rounded tiles or circles; plain icons beside labels, status shapes excepted.
- **Don't** use gradient text or gradient fills beyond the wordmark, footer sign-off, and hero backdrops.
- **Don't** give resting elements shadows; shadows belong to floating layers only, and are never coloured.
- **Don't** rely on fill-only separation in dark mode (surfaces a few luminance points apart read as one blob), and don't lean on the `.dark .bg-white` remap to rescue light-mode fills; write the dark variant explicitly.
- **Don't** nest cards, or leave 1 to 4px gaps between sibling card borders.
- **Don't** choreograph entrances: no section reveals, no staggered lists, no hero text effects, no loops except live status.
- **Don't** spread azure into passive decoration, add new accent hues, or use azure-tinted greys outside `--accent`; emphasis is hierarchy (size, weight is capped, position), never more colour.
- **Don't** introduce a third type family; and never fix text to containers that break with CJK fallback fonts or letter-space Chinese text.
- **Don't** exceed the rails: 1440px for header and hero, `max-w-7xl` for content; no edge-to-edge text columns.
