<!-- MODEL POLICY:BEGIN -->
> [!IMPORTANT]
> **MatchMax model policy — overrides any global/default agent model config.**
> Every agent in this project, primary and subagent, runs the paid OpenCode Go model
> `opencode-go/deepseek-v4.1-flash` (owner decision). Free lanes are retired here: the
> free tier is a per-session budget that exhausts after roughly 6-8 dispatches.
> Never use the user's DeepSeek API key, or any `deepseek/*` provider model: billing
> through the OpenCode Go subscription is sanctioned, the DeepSeek API key is not.
> Do not set, export, or reference `DEEPSEEK_API_KEY` here. Any model other than the
> sanctioned Go one needs explicit owner approval first.
<!-- MODEL POLICY:END -->

## Start every session from the latest main

**This repo moves fast: `main` gained 259 commits between 2026-11-19 12:00 and 18:00.**
On that date an entire feature (#768 hourly availability) was re-implemented from
scratch on a branch that had forked 259 commits earlier, duplicating work that was
already shipped. Do not let that recur — run this before planning or dispatching:

```sh
git fetch origin --prune
git rev-list --left-right --count origin/main...HEAD   # <behind> <ahead>
```

- If `behind` is anything other than 0, **stop** and sync before writing code:
  `git checkout main && git pull --ff-only`, then branch fresh from `main`.
- Never start work on a branch whose base predates today without checking what already
  landed. Before building a feature, prove it does not already exist:
  `git log --oneline origin/main -- <likely path>` and
  `git ls-tree -r --name-only origin/main | grep -i <feature>`.
- A tracker issue body can be stale. The code on `main` is the authority on what is
  shipped; the issue and the ticket text are not.
- Prefer many small branches merged same-day over one long-lived branch. A branch older
  than a day is a merge conflict factory in this repo.

## Subagent dispatch

Project agents live in `.opencode/agents/` and override global agents of the same name.
Every project agent runs the paid `opencode-go/deepseek-v4.1-flash` on the OpenCode Go
plan.

| Agent | Model | Use |
| --- | --- | --- |
| `orchestrator` | `opencode-go/deepseek-v4.1-flash` | default primary; decompose, dispatch, verify |
| `scout` | same | read-only recon before planning |
| `planner` | same | ordered file-level plan, read-only |
| `implementer` | same | one scoped coding task |
| `ui-dev` | same | React/Tailwind/shadcn work against DESIGN.md |
| `supabase-dev` | same | schema, RLS, migrations, queries |
| `i18n-guard` | same | en/zh-HK copy parity |
| `tester` | same | write and run tests |
| `reviewer` | same | read-only diff review |
| `debugger` | same | reproduce, localize, fix |
| `docs` | same | READMEs, ADRs, comments |
| `deploy-ops` | same | Cloudflare/Nitro build, Bun lockfile, env |
| `implementer-go` / `debugger-go` / `deep-coder` | same | escalation: different approach, never "a stronger model" |

- Cap concurrent children at **8**. File partitioning is the binding constraint: every
  child owns a disjoint set of paths. Widen by splitting work, never by sharing a file.
- Retry a failed task at most once. On the second failure dispatch the `-go` variant or
  `deep-coder` with the failed approach and its evidence, so it cannot repeat it.
- A 429 or quota error is an **escalation trigger, not a retry trigger**.

## GitHub issue hygiene

- **Never close or resolve an umbrella issue while any acceptance criterion, packed
  part, or linked child inside it is unfinished.**
- Track completion as an explicit ledger (AC → status → evidence), not as a feeling that
  "most of it shipped". Report partial progress as partial.
- Out-of-scope items delegated to another ticket are recorded as "owned elsewhere".
- Closing requires evidence per AC: a command result, a test name, a merged PR, or a row
  returned from the live database. "Implemented" without a verifiable check is not done.
- Land verified work by committing directly to the active branch; PRs are not required
  unless asked. Committing a slice is not closing its issue.

<!-- STACK:BEGIN -->
> [!IMPORTANT]
> This project is deployed and powered by Resend, Supabase, and Cloudflare
> (Workers Builds via Nitro/wrangler).
> Keep integrations aligned with those services, and avoid making changes that
> would break email delivery, database access, or Cloudflare deployment behavior.
<!-- STACK:END -->

## Dependencies

Cloudflare installs dependencies with Bun 1.2.15 and `--frozen-lockfile`.
Whenever `package.json`, `bunfig.toml`, or dependency overrides change, regenerate and commit
`bun.lock` with the deployment version, then verify the frozen install before finishing:

```sh
npx --yes bun@1.2.15 install
npx --yes bun@1.2.15 install --frozen-lockfile
```

Do not modify dependencies without committing the resulting `bun.lock` update.

## Verification Commands

Run checks with strict timeouts and bounded output — never let a command hang the session:

```sh
# Typecheck (fast, always run after TS changes)
npx tsc --noEmit

# Lint: always target only the files you touched, never the whole repo
npx eslint src/path/to/file.tsx

# Auto-fix prettier/format errors before re-linting
npx eslint --fix src/path/to/file.tsx

# i18n guard (always run after adding/changing any user-facing text)
npm run check:i18n
```

Known gotchas:

- **i18n has a single default `translation` namespace.** Never pass a namespace to
  `useTranslation()` — call it bare and prefix keys with their JSON subtree
  (`t("settings.title")`, `t("nav.how")`). Passing a namespace (or referencing a key missing
  from `src/features/i18n/locales/{en,zh-HK}.json`) makes `t()` silently render raw key text
  or nothing at all. Enforced by the `i18n-guards` ESLint rules (run automatically when you
  lint touched files) and `npm run check:i18n` (also checks en/zh-HK key parity and empty
  values). New copy must be added to BOTH locale files.
- **ESLint can hang** (stalled daemon / cache lock). If an eslint invocation exceeds ~60s,
  kill it (`pkill -f eslint`) and retry with `--no-cache`, redirecting output to a file
  (`> /tmp/lint.txt 2>&1; echo "exit=$?"`). Do not retry the same hanging command unchanged.
- **Vite dev server is slow here** (~80–90s cold start, listens on port 3000, not 5173).
  Only start it when actually needed, and always `kill` the PID when done.
- `.env.local` in this repo contains only Turnstile vars; Supabase server vars
  (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) are absent, so SSR pages that hit the DB
  return 500 locally. That is an environment gap, not a code bug — verify DB-backed pages
  via `npm run build` + typecheck instead of panicking over curl 500s.
- Prettier formatting is enforced via `prettier/prettier` ESLint rules. Run the targeted
  `eslint --fix` above instead of hand-aligning whitespace, and re-run typecheck after
  autofixes.
- On macOS, `strings` and other Xcode toolchain binaries may prompt installation and fail;
  prefer `grep -a` on binary-ish output.

## Design Conventions

**Shadows float or they do not exist** (see DESIGN.md, "The Floating Shadow Rule"). Resting
surfaces are flat and border-delineated; only layers that float above the page may cast a shadow:

- Never introduce `shadow-*` utilities (including `shadow-none`), `drop-shadow-*`,
  arbitrary `shadow-[...]` values, or ad-hoc `box-shadow` CSS from TSX. This is enforced by a
  `no-restricted-syntax` ESLint rule in `eslint.config.js`.
- Floating overlays (dialogs, menus, popovers, sheets, toasts) get their elevation from the
  `.mm-overlay-lift` class / `--lift-overlay` token in `styles.css`; the sanctioned
  `.pill-elevate*` search-pill treatments live there too. New shadow values go into
  `styles.css` as named classes, never into component markup.
- Express resting elevation with borders (`border-border`), surface colors (`bg-card` vs
  `bg-muted`), or solid contrast. Convert any ring-like shadows to plain `border`.
- `ring-*` classes are allowed for focus indicators only (accessibility, not decoration).
- Transition lists must not reference `box-shadow`/`shadow` from TSX.

## UI Arc (design authority)

The `ui-dev` subagent loads the **Frontend Design** skill
(`frontend-design`, https://claude.com/marketplace/plugins/frontend-design)
before touching UI: its process (purpose, audience, one aesthetic direction,
anti-generic defaults) is adopted, its visual liberties are not. DESIGN.md wins
every conflict — no decorative gradients or glow, no entrance choreography, the
fixed Geist/Inter ladder and the three radii, no shadows from TSX.

DESIGN.md follows the Arc (uiarc.dev) design bar: Geist display + Inter body on the weight
ladder 400 body / 500 labels / 600 controls and card titles / 700 headings (800 is wordmark-only,
see DESIGN.md "Weight ladder"), concentric radii (`--radius-control` 18px / `--radius-panel` 26px / `--radius-surface` 34px),
sentence-case copy with no eyebrows or em dashes in English, plain icons beside labels (no
decorative icon tiles), and motion that only explains state changes (no entrance choreography).
Restyle existing components toward these rules; do not add new sections or decorative flourishes.

## UI Assets (21st.dev MCP)

Use the 21st.dev MCP (`21st_search`, `21st_get_component`, `21st_get_theme`, etc.) freely when
the task needs UI assets — components, tooltips, themes, icons, or design inspiration. Prefer
searching the catalog before hand-writing new UI, and adapt fetched code to the existing
shadcn/ui conventions in `src/components/ui`.
