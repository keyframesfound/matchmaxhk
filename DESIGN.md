---
name: MatchMax
description: Proof-first tutoring marketplace for Hong Kong — harbour-navy trust with teal transit energy, bilingual EN/zh-HK.
colors:
  harbour-midnight: "#041344"
  royal-navy: "#0A245F"
  royal-blue: "#1B2CC1"
  island-line-teal: "#1FA8B6"
  signal-periwinkle: "#ABD2FA"
  link-blue: "#0D47A1"
  paper-white: "#FFFFFF"
  paper-tint: "#F8FAFC"
  ink-on-light: "oklch(0.16 0.09 265)"
  muted-ink: "oklch(0.45 0.03 260)"
  hairline: "oklch(0.93 0.008 250)"
  status-destructive: "oklch(0.577 0.245 27.325)"
  status-success: "oklch(0.627 0.194 149.214)"
  status-warning: "oklch(0.666 0.179 58.318)"
  dark-canvas: "#090A0C"
  dark-card: "#111419"
  dark-border: "#242932"
  dark-muted-ink: "#9CA3AF"
typography:
  display:
    fontFamily: "Uber Move, Uber Move Text, DM Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 4.5rem)"
    fontWeight: 900
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Uber Move, Uber Move Text, DM Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(1.75rem, 2vw + 1.1rem, 2.45rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Uber Move, Uber Move Text, DM Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(1.35rem, 1.1vw + 1rem, 1.75rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  subtitle:
    fontFamily: "Uber Move, Uber Move Text, DM Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(1.1rem, 0.85vw + 0.9rem, 1.3rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Uber Move, Uber Move Text, DM Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Uber Move, Uber Move Text, DM Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.025em"
rounded:
  sm: "calc(0.7rem - 4px)"
  md: "calc(0.7rem - 2px)"
  control: "0.5rem"
  panel: "0.75rem"
  lg: "0.7rem"
  xl: "calc(0.7rem + 4px)"
  2xl: "calc(0.7rem + 8px)"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
  section: "80px"
components:
  button-primary:
    backgroundColor: "{colors.royal-navy}"
    textColor: "#FFFFFF"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.harbour-midnight}"
  button-accent:
    backgroundColor: "{colors.island-line-teal}"
    textColor: "#FFFFFF"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "8px 16px"
  button-accent-hover:
    backgroundColor: "#168590"
  button-outline:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.harbour-midnight}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "8px 16px"
  button-outline-hover:
    backgroundColor: "color-mix(in oklab, #1FA8B6 8%, transparent)"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.ink-on-light}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "4px 12px"
  card:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink-on-light}"
    rounded: "{rounded.xl}"
    padding: "24px"
  badge-default:
    backgroundColor: "{colors.harbour-midnight}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
  badge-secondary:
    backgroundColor: "{colors.island-line-teal}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
---

# Design System: MatchMax

## Overview

**Creative North Star: "Hong Kong Rapid Transit"**

MatchMax borrows the grammar of the city's transit system: a trusted network that moves you from where you are to where you need to be, with every stop clearly signed. Harbour Midnight (`#041344`) is the official ink — wayfinding signage, verification stamps, the authority of the network. Island Line Teal (`#1FA8B6`) is the moving line — the colour of progress, connectors, focus rings, and the actions that carry a parent from search to match. The system is confident, crisp, and proof-backed: real numbers set in heavy type, hairline borders instead of heavy chrome, and a navy-to-teal gradient that reads as the line map connecting navy authority to teal motion.

Density is product-like rather than editorial. Public pages persuade with bold black-weight display type and generous section rhythm; authenticated consoles compress into compact, sharply-cornered controls. Everything is bilingual-first — the Latin type stack (Uber Move, with DM Sans as the loaded web fallback) hands off to system CJK fonts for Traditional Chinese, so layouts must survive wider glyphs and never assume Latin-only line heights.

**Key Characteristics:**
- Two brand voices on every surface: navy ink for authority, teal for motion and progress
- Navy→teal brand gradient reserved for brand moments (wordmark, hero backdrops, key CTAs)
- Flat, hairline-bordered surfaces by default; soft brand-tinted ambient shadows on hero moments only
- Heavy display type (700–900) with tight tracking against a light 0.95rem body
- Compact control heights (36px buttons, 44px inputs) with tactile press (scale 0.97)
- Full dark theme that flips the primary to Signal Periwinkle (`#ABD2FA`) on deep navy text

## Colors

The palette is a signed transit map: deep navy infrastructure, teal as the active line, periwinkle as the night-mode signal. Statuses (green/amber/red) exist only for real states, never decoration.

### Primary
- **Harbour Midnight** (`#041344`): The ink of the system. Body and heading text on light surfaces (`--ink`), inverted primary surfaces (`--surface-invert`), primary buttons (hover end-state), the dark start of the brand gradient, and stepper "active" fills. The dark-theme text equivalent is `oklch(0.16 0.09 265)`.
- **Royal Navy** (`#0A245F`): Midnight's one-step-lighter sibling. Default primary-button rest state (`--surface-invert-hover`), gradient midpoint, dark-surface hovers. **Royal Blue** (`#1B2CC1`, `--brand-royal`) exists as a raw brand token but is rarely applied directly — treat as reserve.

### Secondary
- **Island Line Teal** (`#1FA8B6`): The active line. Secondary buttons, focus rings (`--ring`), in-app links' hover targets, progress connectors, completed-step fills, and 8–20% colour-mix tints for soft backgrounds (`bg-teal/10`, `saved-posts-reserve-card`). Its dark-mode hover deepens to `#168590`.

### Tertiary
- **Signal Periwinkle** (`#ABD2FA`): The night signal. Dark theme's primary (`--primary`), dark focus rings, dark link colour, and the logo's dark-mode recolor target. Also registered as `--brand-cyan`/`--brand-aqua` (same value, two names — do not treat as two colours).
- **Link Blue** (`#0D47A1`): Text links on light surfaces (`--brand-link`); nav links settle here on hover because teal-on-white fails contrast for small text.

### Neutral
- **Paper White** (`#FFFFFF`, `--surface`): Canvas and cards on light theme.
- **Paper Tint** (`#F8FAFC`, `--surface-subtle`): Subtle wells, header account pill, dot-grid visual grounds.
- **Muted Ink** (`oklch(0.45 0.03 260)`): Secondary text on light.
- **Hairline** (`oklch(0.93 0.008 250)`): Borders and input strokes on light.
- **Night Canvas** (`#090A0C`) / **Night Card** (`#111419`) / **Night Border** (`#242932`): Dark-theme canvas, cards, and hairlines ("Untitled UI"-style cool darks).
- **Statuses**: destructive `oklch(0.577 0.245 27.325)` (dark `#F04438`), success `oklch(0.627 0.194 149.214)` (dark `#5EE6A1`), warning `oklch(0.666 0.179 58.318)` (dark `#FFD37A`).

### Named Rules
**The Signal Rule.** Teal means *motion*: actions, progress, focus, and completion. It never paints static decoration, and it never carries small body text on white — links on light surfaces use Link Blue.

**The Inverted Signal Rule.** Dark mode flips the network, not just the lights: primary becomes Signal Periwinkle carrying Harbour Midnight text. Never reuse light-theme navy-on-white pairings in dark mode.

## Typography

**Display Font:** Uber Move / Uber Move Text (proprietary; web loads **DM Sans** 400/500/600/700 as the fallback, then system sans)
**Body Font:** Same stack as display — one voice throughout
**Label/Mono Font:** None distinct; labels are the same sans, uppercase

**Character:** A single geometric-humanist sans carries everything, the way one signage family runs a whole metro network. Authority comes from weight (700–900 headings) and tight tracking, not from a second typeface.

### Hierarchy
- **Display** (900*, `text-4xl→7xl` ≈ clamp(2.25rem, 5vw, 4.5rem), 1.05, tight): Hero headlines and the footer wordmark. *Note: DM Sans loads to 700, so 900 renders as 700 in fallback environments — design must not depend on the extra weight.*
- **Headline** (700, clamp(1.75rem, 2vw + 1.1rem, 2.45rem), 1.15): Page `h1` outside the hero.
- **Title** (700, clamp(1.35rem, 1.1vw + 1rem, 1.75rem), 1.15): Section `h2`s (e.g. "DSE tutors").
- **Subtitle** (700, clamp(1.1rem, 0.85vw + 0.9rem, 1.3rem), 1.15): `h3` card and subsection titles; `h4` drops to 1rem/600.
- **Body** (400, 0.95rem, 1.6): All running text; slightly compact base size keeps dense product views scannable. Controls and buttons sit at 500.
- **Label** (600–900, 0.7–0.75rem, wide tracking, uppercase): Eyebrows ("FIND TUTOR"), footer column headings (`text-sm`), step indicators.

### Named Rules
**The Single Signage Rule.** One font family everywhere; hierarchy is weight + size + tracking. Do not introduce display serifs or second sans families.

**The Two-Script Rule.** Every type decision must hold for Traditional Chinese system-font fallback: no fixed-height text containers narrower than the zh-HK glyph, no letter-spacing tricks on CJK, always test EN/zh-HK parity.

## Layout

Content rides on a max-width rail system. The site header and full-bleed marketing sections (how-it-works) run at `max-w-[1440px]` with `px-4 → sm:px-8 → lg:px-10/12`; standard landing/directory content uses `max-w-7xl` with `px-4 → md:px-6`; detail pages (tutor, course, business) tighten to `max-w-5xl`; consoles use `max-w-6xl/7xl` with `py-8–12`. A `PageContainer` utility offers narrow (`max-w-3xl`), default (`max-w-4xl`), wide (`max-w-5xl`) rails at `px-4 sm:px-6` for form-led pages. Auth cards cap at `max-w-[420px]`.

Spacing rhythm: marketing sections breathe at `py-20 sm:py-28`; standard pages `py-8–16`; card interiors `p-6`; grid gaps `gap-4 → gap-6`, hero columns `lg:gap-16`. Base grid is Tailwind's 4px scale. Breakpoints are Tailwind defaults: `sm 640 / md 768 / lg 1024 / xl 1280`. Mobile patterns: horizontal snap carousels (`snap-x snap-mandatory`) for tutor rows, full-width stacked CTAs, and the StaggeredMobileMenu.

### Named Rules
**The 1440 Rail Rule.** Header and hero rails stop at 1440px; inner content stops at `max-w-7xl`. Nothing stretches edge-to-edge except full-bleed tinted sections.

## Elevation & Depth

Flat by default, ambient lift on heroes. Light-theme separation is hairline borders first (`border-border` or `border-[color:var(--ink)]/10`); shadows are large-radius, low-opacity, brand-tinted washes reserved for hero CTAs, floating panels, and dark surfaces. Dark mode deepens into neutral elevation shadows because brand tints vanish against navy.

### Shadow Vocabulary
- **Brand wash** (`--shadow-brand`: `0 10px 30px -18px color-mix(in oklab, #041344 24%, transparent)`): Hero CTAs, floating shells (join-stepper uses a stronger `0 24px 60px -36px` at 35%).
- **Teal wash** (`--shadow-teal`: `0 12px 24px -16px color-mix(in oklab, #1FA8B6 28%, transparent)`): Teal accents that hover/float.
- **Focus ring** (`--focus-ring`: `0 0 0 3px` ring at 32%): Keyboard focus glow.
- **Night elevation** (dark: `0 16px 40px -24px rgba(0,0,0,0.78)` / `0 16px 32px -20px rgba(0,0,0,0.72)`): Dark-theme cards and popovers.
- **Component default**: `shadow-sm` on buttons/inputs; `shadow` on standard cards.

### Named Rules
**The Hairline First Rule.** Reach for a 1px border before a shadow. Shadows are a response to state or prominence (hero, hover, overlay), never the resting look of ordinary cards.

## Shapes

The radius scale derives from one base: `--radius: 0.7rem`, stepped by Tailwind (`sm = base−4px`, `md = base−2px`, `lg = base`, `xl = base+4px`, `2xl = base+8px`). Dedicated variables set controls at `--radius-control: 0.5rem` and panels at `--radius-panel: 0.75rem`. Standard cards use `rounded-xl` (≈15px); the join-stepper shell uses 24px for its most prominent panel. Dense landing controls (search bar, tutor cards, compact buttons) deliberately tighten to `rounded-sm` (≈7px) — a product-density signal. Corners are always symmetric; no asymmetric or notched silhouettes. Pills (`rounded-full`) are reserved for shape="pill" buttons, avatars, step circles, and connector bars. Borders are 1px hairlines; dividers use `border-border` or ink at 10–15% alpha. Photographic and patterned backdrops (hero pattern, "paper" texture with aqua radial + column rules + SVG noise) clip to their section, softened with gradient scrims rather than rounded frames.

## Components

For each component: confident signage — bold labels, one clear primary action, tactile feedback.

### Buttons
- **Shape:** Rounded rectangles at `--radius-control` (8px) by default; `shape="pill"` (full) and square offered; hero CTAs may override to `rounded-xl/md`. Compact landing variants use `rounded-sm`.
- **Primary** (`variant="default"`): Royal Navy fill, white text, `shadow-sm`; hovers deepen to Harbour Midnight. Hero variant starts at Harbour Midnight and lightens on hover. Height 36px (`h-9`), 40px (`lg`), 56px for hero CTAs.
- **Colour axis** (`color` prop sets `--btn/--btn-fg/--btn-hover`): accent teal `#1FA8B6→#168590`, blue `#0A245F→#041344`, green `#15803D→#166534`, amber `#B45309→#92400E`, neutral (ink), destructive. `variant="solid"` renders the colour flat; `variant="candy"` adds a vertical gradient, white/25 border, ring, and drop-shadow for marquee CTAs; `variant="soft"` renders the colour as a 12→18% tint.
- **Ghost / Link / Outline / Secondary:** Ghost = ink text, teal 10% hover wash with teal text; Link = teal, underlined on hover; Outline = white fill, ink/15 border that shifts to teal/40 border + teal/8 wash on hover; Secondary = teal/10 fill deepening to /20.
- **States:** All buttons press with `active:scale-[0.97]`, transition 150ms ease-out, focus-visible ring-2 teal/40 + offset, disabled at 50% opacity, optional animated loading spinner. `motion-reduce` disables the press.

### Badges / Chips
- **Style:** `rounded-md`, `px-2.5 py-0.5`, 0.75rem semibold. Default = navy fill/white text; Secondary = teal fill/white; Outline = hairline border, foreground text. Filter chips in product views follow the compact `rounded-sm` control language.

### Cards / Containers
- **Corner Style:** `rounded-xl` (≈15px) standard; `rounded-sm` on dense landing panels.
- **Background:** `bg-card` (white / `#111419` dark).
- **Shadow Strategy:** `shadow` at rest; see Elevation — borders do the separating.
- **Border:** 1px `border-border` (or ink/10 in composed marketing panels).
- **Internal Padding:** `p-6` standard; marketing search panel `p-2.5 sm:p-5`.

### Inputs / Fields
- **Style:** 44px tall, transparent fill, 1px `--input` stroke, `--radius-control` corners, base 15px text (sm breakpoints drop to 14px), 500 weight.
- **Focus:** Border shifts to ring colour + `ring-2` at 40% opacity; no glow.
- **Error / Disabled:** Destructive styling per shadcn form wiring; disabled at 50% opacity, cursor-not-allowed.

### Navigation
- Sticky 64px header: `bg-[color:var(--surface)]/95` with `backdrop-blur-sm`, hairline bottom border ink/10. Logo (32px) + "MatchMax" wordmark in `text-brand-gradient` at 700–900. Desktop links: 15px/600 ink at 85%, hover/focus shifts to Link Blue with a 2px navy underline sweeping in from the left (200ms). Account affordance is a bordered `surface-subtle` pill with a teal-initial avatar. Mobile uses the staggered full-screen menu; footer mirrors the header at `max-w-7xl` with uppercase 14px column headings, `foreground/70` links hovering to teal, and a 4xl/5xl black-weight "MatchMax" sign-off.

### Signature Components
- **Brand-gradient wordmark & text** (`text-brand-gradient`): navy→royal→teal at 135°, clipped to text; the one sanctioned place for gradient text.
- **Blur-highlight reveal** (`blur-highlight-text`): words arrive blurred (7px, 42% opacity) then snap sharp while an aqua highlighter sweeps beneath key phrases (560ms/720ms, cubic-bezier(0.22,1,0.36,1), staggered 130ms); fully disabled under `prefers-reduced-motion`.
- **Join stepper**: 36px circular steps with teal fill for active/complete, animated connector bars (240ms), card shell at 24px radius with the join-stepper's deep navy shadow; slide-forward/backward content transitions.
- **Hero backdrops**: patterned/photographic scrims (education pattern, tutor-network photo at `saturate(0.78) contrast(1.1)` with navy gradient overlays and a teal radial hotspot); dark mode dims imagery to 18% opacity and recolors the logo via the `.logo-dark-recolor` filter.
- **WhatsApp float button**: persistent circular teal-navy contact affordance on public pages.

## Do's and Don'ts

### Do:
- **Do** reserve the navy→teal brand gradient for brand moments: the wordmark, hero backdrops, and primary marketing CTAs — one gradient voice per viewport.
- **Do** keep interactive surfaces tactile: 150ms transitions, `active:scale-[0.97]` press, visible `focus-visible` teal rings.
- **Do** honour `prefers-reduced-motion` for every custom animation (blur reveal, marquee, stepper, press) — the incumbent code always pairs them.
- **Do** verify both EN and zh-HK renderings of any new copy or component; layouts must not assume Latin widths.
- **Do** use Link Blue (`#0D47A1`) for small text links on light surfaces; teal only for larger/secondary affordances and dark-mode links (periwinkle).
- **Do** dim photographic backdrops in dark mode (opacity ≈0.18) and recolor the logo with `.logo-dark-recolor`.

### Don't:
- **Don't** use teal as small body text or static decoration on white — it is the motion colour (actions, progress, focus).
- **Don't** add new accent hues; the sanctioned extra colours are the button palette (green/amber) and the three statuses.
- **Don't** use pure black shadows in light theme — shadows are navy/teal `color-mix` washes; neutral deep shadows belong to dark mode only.
- **Don't** introduce a second type family; hierarchy is weight/size/tracking within the Uber Move → DM Sans stack.
- **Don't** fix text to containers that break with CJK fallback fonts, and don't apply letter-spacing to Chinese text.
- **Don't** exceed the rails: 1440px for header/hero, `max-w-7xl` for content; no edge-to-edge text columns.
