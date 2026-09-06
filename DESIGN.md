---
name: MatchMax
description: Proof-first tutoring marketplace for Hong Kong — ink-on-paper calm with a single Azure signal, bilingual EN/zh-HK. Built on the "Twitter Azure" design system (21st.dev, serafimcloud).
colors:
  ink: "#0F1419"
  azure: "#1D9BF0"
  azure-bright: "#1E9DF1"
  azure-deep: "#1DA1F2"
  sky: "#8ECDF8"
  azure-wash: "#E3ECF6"
  card-tint: "#F7F8F8"
  input-tint: "#F7F9FA"
  hover-wash: "#EFF3F4"
  hairline: "#E1EAEF"
  secondary-ink: "#536471"
  paper-white: "#FFFFFF"
  status-destructive: "#F4212E"
  status-success: "#17BF63"
  status-warning: "#F7B928"
  dark-canvas: "#000000"
  dark-card: "#17181C"
  dark-border: "#242628"
  dark-secondary-ink: "#72767B"
  dark-hover: "#202327"
  dark-input: "#22303C"
typography:
  display:
    fontFamily: "Open Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 4.5rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "normal"
  headline:
    fontFamily: "Open Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(1.75rem, 2vw + 1.1rem, 2.45rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "normal"
  title:
    fontFamily: "Open Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(1.35rem, 1.1vw + 1rem, 1.75rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "normal"
  subtitle:
    fontFamily: "Open Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(1.1rem, 0.85vw + 0.9rem, 1.3rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "normal"
  body:
    fontFamily: "Open Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Open Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.025em"
rounded:
  sm: "calc(1.3rem - 4px)"
  md: "calc(1.3rem - 2px)"
  control: "0.5rem"
  panel: "1rem"
  lg: "1.3rem"
  xl: "calc(1.3rem + 4px)"
  2xl: "calc(1.3rem + 8px)"
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
    backgroundColor: "{colors.azure}"
    textColor: "#FFFFFF"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "#1A8CD8"
  button-neutral:
    backgroundColor: "{colors.ink}"
    textColor: "#FFFFFF"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "8px 16px"
  button-outline-hover:
    backgroundColor: "{colors.hover-wash}"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "4px 12px"
  card:
    backgroundColor: "{colors.card-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "24px"
  badge-default:
    backgroundColor: "{colors.ink}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
  badge-secondary:
    backgroundColor: "{colors.azure}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
---

# Design System: MatchMax (Twitter Azure)

## Overview

**Creative North Star: "The Signal"**

MatchMax runs on the **Twitter Azure** design system (21st.dev community theme by serafimcloud): a near-monochrome world of Ink (`#0F1419`) on Paper White, hairline borders, and soft tinted cards — where **Azure** (`#1D9BF0`) is the one colour that means *act now*, exactly the way a follow button works on Twitter/X. The interface is confident and flat: black-button-on-white mass, one azure signal per viewport, generous corner radii (the theme's `1.3rem` base) keeping everything friendly. The system is proof-backed: real numbers in heavy type, hairlines instead of heavy chrome.

Density is product-like rather than editorial. Public pages persuade with bold 700–800 display type and generous section rhythm; authenticated consoles compress into compact controls. Everything is bilingual-first — Open Sans hands off to system CJK fonts for Traditional Chinese, so layouts must survive wider glyphs and never assume Latin-only line heights.

**Key Characteristics:**
- Scarcity of accent: azure fills appear only on money CTAs (~10% of buttons); everything else is white/grey/ink monochrome
- Azure owns interaction: accent fills, links, focus rings, selected/active states, progress meters, data-viz series
- Ink→Azure→Sky brand gradient reserved for brand moments (wordmark, hero backdrops)
- Flat, hairline-bordered surfaces; soft azure-tinted ambient shadows on hero moments only
- Heavy display type (700–800) at 0em tracking against a light 0.95rem body
- Round geometry: `--radius: 1.3rem` base scale; inputs and compact controls tighten to 0.5rem
- Full dark theme: true-black canvas (`#000000`), `#17181C` cards, and azure stays the signal in both themes

## Colors

The palette is a quiet news feed: ink text, paper and card-tint surfaces, hairline borders — and one azure signal. Statuses (green/amber/red) exist only for real states, never decoration.

### Primary
- **Azure** (`#1D9BF0`, `--btn-accent`/`--brand-royal`; theme primary `#1E9DF1`, ring `#1DA1F2`): **the one accent.** Money-CTA fills, text links (`--brand-link`), focus rings (`--ring`), selected/active states, stepper/progress fills, and data-viz series. Hover `#1A8CD8`.
- **Ink** (`#0F1419`, `--ink`/`--foreground`/`--brand-navy`): The text and neutral-button colour of the system. Body/heading text on light surfaces, ghost/neutral button fills (`color="neutral"`, `--secondary`), the dark start of the brand gradient, and dark-theme inverted surfaces.

### Secondary
- **Sky** (`#8ECDF8`, `--brand-cyan`/`--brand-aqua`): The gradient's light end and the dark-mode gradient-text highlight; blur-highlight sweeps. Never in interactive states.
- **Azure Wash** (`#E3ECF6`, `--accent`): Hover washes and soft azure-tinted panels (`--accent-foreground` azure).

### Tertiary
- **Green** (`#17BF63`), **Amber** (`#F7B928`), **Red** (`#F4212E`): Statuses and the button colour axis (buttons use AA-safe darker derivations `#00875A`/`#A16207`). Red is the theme destructive.
- **WhatsApp Green** (`#25D366`, `--brand-whatsapp`): The single sanctioned non-palette colour, for WhatsApp contact affordances only. Hover `#1EBE57`.

### Neutral
- **Paper White** (`#FFFFFF`, `--surface`/`--background`): Canvas and default button fill on light.
- **Card Tint** (`#F7F8F8`, `--card`/`--sidebar`): Cards sit a half-step off the canvas.
- **Input Tint** (`#F7F9FA`, `--input`) and **Hover Wash** (`#EFF3F4`, `--surface-hover`): Wells and hover states.
- **Secondary Ink** (`#536471`, `--muted-foreground`): Secondary text on light.
- **Hairline** (`#E1EAEF`, `--border`): Borders and separators on light.
- **Night Canvas** (`#000000`) / **Night Card** (`#17181C`) / **Night Border** (`#242628`): Dark-theme surfaces; secondary text `#72767B`, hover `#202327`, inputs `#22303C`, dark sidebar border `#38444D`.

### Named Rules
**The Scarcity Rule.** Azure (`--btn-accent`/`--ring`/`--brand-link`) owns exactly three things: (1) money-CTA fills — the ~10% of buttons that start a conversion flow, (2) text links, (3) focus rings and selected/active states. Everything else is ink/neutral. Test: *does this button start a conversion flow?* If not, it is neutral (white or ink).

**The Constant Signal Rule.** Dark mode dims the world, not the signal: Azure keeps carrying accent fills, links, and focus in both themes (unlike palettes that invert the accent). Dark secondary buttons flip to white fill (`#F0F3F4`) with ink text — the X "white button on black" pattern.

## Typography

**Display Font:** **Open Sans** (Google Fonts, 400/500/600/700/800), system sans fallback — the Twitter Azure typeface
**Body Font:** Same stack as display — one voice throughout
**Label/Mono Font:** None distinct; labels are the same sans, uppercase. Code snippets use Tailwind's default `font-mono`.

**Character:** A single humanist sans carries everything, the way one product's UI voice runs every screen. Authority comes from weight (700–800 headings) at 0em tracking (the theme's `--letter-spacing: 0em`), not from a second typeface.

### Hierarchy
- **Display** (800, `text-4xl→7xl` ≈ clamp(2.25rem, 5vw, 4.5rem), 1.05): Hero headlines and the footer wordmark.
- **Headline** (700, clamp(1.75rem, 2vw + 1.1rem, 2.45rem), 1.15): Page `h1` outside the hero.
- **Title** (700, clamp(1.35rem, 1.1vw + 1rem, 1.75rem), 1.15): Section `h2`s (e.g. "DSE tutors").
- **Subtitle** (700, clamp(1.1rem, 0.85vw + 0.9rem, 1.3rem), 1.15): `h3` card and subsection titles; `h4` drops to 1rem/600.
- **Body** (400, 0.95rem, 1.6): All running text; slightly compact base size keeps dense product views scannable. Controls and buttons sit at 500.
- **Label** (600–800, 0.7–0.75rem, wide tracking, uppercase): Eyebrows ("FIND TUTOR"), footer column headings (`text-sm`), step indicators.

### Named Rules
**The Single Signage Rule.** One font family everywhere; hierarchy is weight + size. Do not introduce display serifs or second sans families.

**The Two-Script Rule.** Every type decision must hold for Traditional Chinese system-font fallback: no fixed-height text containers narrower than the zh-HK glyph, no letter-spacing tricks on CJK, always test EN/zh-HK parity.

## Layout

Content rides on a max-width rail system. The site header and full-bleed marketing sections (how-it-works) run at `max-w-[1440px]` with `px-4 → sm:px-8 → lg:px-10/12`; standard landing/directory content uses `max-w-7xl` with `px-4 → md:px-6`; detail pages (tutor, course, business) tighten to `max-w-5xl`; consoles use `max-w-6xl/7xl` with `py-8–12`. A `PageContainer` utility offers narrow (`max-w-3xl`), default (`max-w-4xl`), wide (`max-w-5xl`) rails at `px-4 sm:px-6` for form-led pages. Auth cards cap at `max-w-[420px]`.

Spacing rhythm: marketing sections breathe at `py-20 sm:py-28`; standard pages `py-8–16`; card interiors `p-6`; grid gaps `gap-4 → gap-6`, hero columns `lg:gap-16`. Base grid is Tailwind's 4px scale. Breakpoints are Tailwind defaults: `sm 640 / md 768 / lg 1024 / xl 1280`. Mobile patterns: horizontal snap carousels (`snap-x snap-mandatory`) for tutor rows, full-width stacked CTAs, and the StaggeredMobileMenu.

### Named Rules
**The 1440 Rail Rule.** Header and hero rails stop at 1440px; inner content stops at `max-w-7xl`. Nothing stretches edge-to-edge except full-bleed tinted sections.

## Elevation & Depth

Flat by default, ambient lift on heroes. Light-theme separation is hairline borders first (`border-border` or `border-[color:var(--ink)]/10`); shadows are large-radius, low-opacity, azure-tinted washes reserved for hero CTAs, floating panels, and dark surfaces. Dark mode deepens into neutral elevation shadows because brand tints vanish on black.

### Shadow Vocabulary
- **Brand wash** (`--shadow-brand`: `0 10px 30px -18px color-mix(in oklab, #1D9BF0 26%, transparent)`): Hero CTAs, floating shells (join-stepper uses a stronger `0 24px 60px -36px` at 35% navy-ink).
- **Azure wash** (`--shadow-teal`): Legacy token name, azure-tinted — progress/brand accents only, never interactive elements.
- **Focus ring** (`--focus-ring`: `0 0 0 3px` ring at 32%): Keyboard focus glow.
- **Night elevation** (dark: `0 16px 40px -24px rgba(0,0,0,0.78)` / `0 16px 32px -20px rgba(0,0,0,0.72)`): Dark-theme cards and popovers.
- **Component default**: `shadow-sm` on buttons/inputs; `shadow` on standard cards.

### Named Rules
**The Hairline First Rule.** Reach for a 1px border before a shadow. Shadows are a response to state or prominence (hero, hover, overlay), never the resting look of ordinary cards.

## Shapes

The radius scale derives from one generous base: `--radius: 1.3rem` (the theme's signature roundness), stepped by Tailwind (`sm = base−4px`, `md = base−2px`, `lg = base`, `xl = base+4px`, `2xl = base+8px`). Dedicated variables set controls at `--radius-control: 0.5rem` (inputs, compact buttons — the one tight corner in the system) and panels at `--radius-panel: 1rem`. Standard cards use `rounded-xl` (≈25px); the join-stepper shell uses 24px. Corners are always symmetric; pills (`rounded-full`) are reserved for shape="pill" buttons, avatars, step circles, and connector bars. Borders are 1px hairlines; dividers use `border-border` or ink at 10–15% alpha. Photographic and patterned backdrops (hero pattern, "paper" texture with azure radial + column rules + SVG noise) clip to their section, softened with gradient scrims rather than rounded frames.

## Components

For each component: confident signage — bold labels, one clear primary action, tactile feedback.

### Buttons
- **Shape:** Rounded rectangles at `--radius-control` (8px) by default; `shape="pill"` (full) and square offered; hero CTAs may override to `rounded-xl/md`. With the 1.3rem base, all token-driven radii read round and friendly.
- **Neutral default** (`variant="default"`): white fill, ink text, hairline `foreground/15` border, `shadow-sm`; hovers wash to the hover wash and deepen the border. This is the resting state of ~90% of buttons — the X-model monochrome mass.
- **Accent** (`variant="solid" color="blue"` — `color="accent"` is an alias): the money CTA. `--btn-accent` fill (`#1D9BF0` in both themes) with white text, hover `#1A8CD8`. Reserved for the conversion list: hero Find a Tutor, directory Search, Post your request (+ submit), Join as Tutor (+ final submit), Contact/Request Tutor, header Sign up, auth continue, pricing highlighted CTA, dashboard/case CTAs, Publish course, business signup.
- **Colour axis** (`color` prop sets `--btn/--btn-fg/--btn-hover`): blue/accent (azure tokens), neutral (ink fill), green `#00875A→#006B47`, amber `#A16207→#854D0E`, destructive. `variant="candy"` adds a vertical gradient for marquee CTAs; `variant="soft"` renders the colour as a 12→18% tint.
- **Ghost / Link / Outline / Secondary:** Ghost = ink text, 6% hover wash (text stays ink); Link = Azure, underlined on hover; Outline = white fill, `foreground/15` border shifting to `/25` + 4% wash on hover; Secondary = ink fill (`--secondary`) with white text on light, white fill with ink text on dark.
- **States:** All buttons press with `active:scale-[0.97]`, transition 150ms ease-out, focus-visible ring-2 azure (`--ring`) at 40% + offset, disabled at 50% opacity, optional animated loading spinner. `motion-reduce` disables the press.

### Badges / Chips
- **Style:** `rounded-md`, `px-2.5 py-0.5`, 0.75rem semibold. Default = ink fill/white text; Secondary = azure fill/white text; Outline = hairline border, foreground text. Filter chips in product views follow the compact control language; selected chips use the azure accent.

### Cards / Containers
- **Corner Style:** `rounded-xl` (≈25px) standard; compact landing panels tighten via tokens.
- **Background:** `bg-card` (`#F7F8F8` light / `#17181C` dark).
- **Shadow Strategy:** `shadow` at rest; see Elevation — borders do the separating.
- **Border:** 1px `border-border` (or ink/10 in composed marketing panels).
- **Internal Padding:** `p-6` standard; marketing search panel `p-2.5 sm:p-5`.

### Inputs / Fields
- **Style:** 44px tall, transparent fill, 1px `--input` stroke, `--radius-control` corners, base 15px text (sm breakpoints drop to 14px), 500 weight.
- **Focus:** Border shifts to ring colour + `ring-2` at 40% opacity; no glow.
- **Error / Disabled:** Destructive styling per shadcn form wiring; disabled at 50% opacity, cursor-not-allowed.

### Navigation
- Sticky 64px header: `bg-[color:var(--surface)]/95` with `backdrop-blur-sm`, hairline bottom border ink/10. Logo (32px) + "MatchMax" wordmark in `text-brand-gradient` at 700–800. Desktop links: 15px/600 ink at 85%, hover/focus shifts to Azure with a 2px ink underline sweeping in from the left (200ms). Account affordance is a bordered `surface-subtle` pill with an ink-initial avatar; header Sign up is an azure money CTA. Mobile uses the staggered full-screen menu (ink→azure→sky layer colours); footer mirrors the header at `max-w-7xl` with uppercase 14px column headings, `foreground/70` links hovering to Azure, and a 4xl/5xl heavy "MatchMax" sign-off.

### Signature Components
- **Brand-gradient wordmark & text** (`text-brand-gradient`): ink→azure→sky at 135°, clipped to text (dark mode: sky→azure); the one sanctioned place for gradient text.
- **Blur-highlight reveal** (`blur-highlight-text`): words arrive blurred (7px, 42% opacity) then snap sharp while a sky highlighter sweeps beneath key phrases (560ms/720ms, cubic-bezier(0.22,1,0.36,1), staggered 130ms); fully disabled under `prefers-reduced-motion`.
- **Join stepper**: 36px circular steps with azure fill for active, green (`#17BF63`) for complete, animated connector bars (240ms), card shell at 24px radius; slide-forward/backward content transitions.
- **Hero backdrops**: patterned/photographic scrims (education pattern, tutor-network photo at `saturate(0.78) contrast(1.1)` with ink gradient overlays and an azure radial hotspot); dark mode dims imagery to 18% opacity and recolors the logo via the `.logo-dark-recolor` filter.
- **WhatsApp float button**: persistent circular WhatsApp-green (`--brand-whatsapp`) contact affordance on public pages — the one brand-exception colour.

## Do's and Don'ts

### Do:
- **Do** reserve the ink→azure→sky brand gradient for brand moments: the wordmark and hero backdrops — one gradient voice per viewport.
- **Do** ration azure: before adding `variant="solid" color="blue"`, apply the conversion test — if the button doesn't start a conversion flow (Find a Tutor, Post a request, Join, Contact, Sign up, Publish), ship it neutral.
- **Do** keep interactive surfaces tactile: 150ms transitions, `active:scale-[0.97]` press, visible `focus-visible` azure rings.
- **Do** honour `prefers-reduced-motion` for every custom animation (blur reveal, marquee, stepper, press) — the incumbent code always pairs them.
- **Do** verify both EN and zh-HK renderings of any new copy or component; layouts must not assume Latin widths.
- **Do** use Azure (`--brand-link`) for text links in both themes.
- **Do** dim photographic backdrops in dark mode (opacity ≈0.18) and recolor the logo with `.logo-dark-recolor`.

### Don't:
- **Don't** spread azure into passive decoration — azure's homes are accent CTAs, links, focus/selected states, progress/data-viz, and brand backdrops. Nothing else.
- **Don't** make grey buttons azure "for emphasis" — emphasis is hierarchy (size, weight, position), and azure is spent on ~10% of buttons.
- **Don't** add new accent hues; the sanctioned extras are the button palette (green/amber), the three statuses, and WhatsApp Green for WhatsApp affordances only.
- **Don't** use azure-tinted greys — neutral washes (`--muted`, `--surface-hover`) stay true neutral; azure tint lives only in `--accent`.
- **Don't** use pure black shadows in light theme — shadows are azure `color-mix` washes; neutral deep shadows belong to dark mode only.
- **Don't** introduce a second type family; hierarchy is weight/size within the Open Sans stack.
- **Don't** fix text to containers that break with CJK fallback fonts, and don't apply letter-spacing to Chinese text.
- **Don't** exceed the rails: 1440px for header/hero, `max-w-7xl` for content; no edge-to-edge text columns.
