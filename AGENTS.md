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

## Subagent dispatch

Project agents live in `.opencode/agents/` and override global agents of the same name.
Every project agent runs the paid `opencode-go/deepseek-v4.1-flash` on the OpenCode Go
plan. There is no free lane in this project any more: the free tier is a per-session
budget that dies after roughly 6-8 dispatches, so a free-first ladder just burns round
trips.

| Agent | Model | Use |
| --- | --- | --- |
| `orchestrator` | `opencode-go/deepseek-v4.1-flash` | default primary; decompose, dispatch, verify |
| `scout` | `opencode-go/deepseek-v4.1-flash` | read-only recon before planning |
| `planner` | `opencode-go/deepseek-v4.1-flash` | ordered file-level plan, read-only |
| `implementer` | `opencode-go/deepseek-v4.1-flash` | one scoped coding task |
| `ui-dev` | `opencode-go/deepseek-v4.1-flash` | React/Tailwind/shadcn work against DESIGN.md |
| `supabase-dev` | `opencode-go/deepseek-v4.1-flash` | schema, RLS, migrations, queries |
| `i18n-guard` | `opencode-go/deepseek-v4.1-flash` | en/zh-HK copy parity |
| `tester` | `opencode-go/deepseek-v4.1-flash` | write and run tests |
| `reviewer` | `opencode-go/deepseek-v4.1-flash` | read-only diff review |
| `debugger` | `opencode-go/deepseek-v4.1-flash` | reproduce, localize, fix |
| `docs` | `opencode-go/deepseek-v4.1-flash` | READMEs, ADRs, comments |
| `deploy-ops` | `opencode-go/deepseek-v4.1-flash` | Cloudflare/Nitro build, Bun lockfile, env |
| `implementer-go` | `opencode-go/deepseek-v4.1-flash` | escalation after two failed attempts |
| `debugger-go` | `opencode-go/deepseek-v4.1-flash` | escalation after two failed attempts |
| `deep-coder` | `opencode-go/deepseek-v4.1-flash` | hard or ambiguous work, fresh approach |

Rules: retry a failed task at most once. On the second failure, dispatch the `-go`
variant or `deep-coder` with the failed approach and its evidence in the prompt, so it
cannot repeat the same mistake. Never retry the same approach a third time. Model tier
is no longer the escalation axis — every agent is on the same paid model, so escalation
means a different approach, more context, or a smaller scope, never "a stronger model".

### GitHub issue hygiene

- **Never close or resolve an umbrella issue while any acceptance criterion, packed
  part, or linked child inside it is unfinished.** A packed ticket like #768 is only
  closable when every in-body AC checkbox in every Part is satisfied and every
  historical child listed in its Part 3 has actually been closed against it.
- Track completion as an explicit ledger (AC → status → evidence), not as a feeling
  that "most of it shipped". Partial progress is reported as partial.
- Out-of-scope items explicitly delegated to another ticket are recorded as
  "owned elsewhere", never silently counted as done and never counted as a blocker.
- Closing requires evidence per AC: a command result, a test name, or a merged PR.
  "Implemented" without a verifiable check is not done.
- Land verified work by committing directly to the active branch. Pull requests are
  not required in this project unless explicitly asked for; do not open one by default.
  Committing a slice is not closing its issue — the closure rule above still applies.

### Rate limits

Every agent shares one model (`opencode-go/deepseek-v4.1-flash`) on one Go subscription,
so concurrency draws on a single quota.

- Cap concurrent children at **8**. That is my standing choice, not a provider limit:
  eight is wide enough for the real parallel groups in this repo, while keeping local
  `tsc`/`vitest` runs from thrashing each other and keeping the report backlog small
  enough to actually verify every claim. The binding constraint is file partitioning,
  not model quota: every child must own a disjoint set of paths, so widen the wave by
  splitting work into more independent units, never by letting two children share a file.
- Prefer many small, fully-specified dispatches over a few large ones. A wide wave with
  exact contracts beats a narrow wave with vague ones.
- Free lanes are retired. Measured 2026-11-19: the free tier serves roughly 6-8 child
  dispatches per session, then every further free child fails instantly with "Free usage
  limit reached" — including children that never started. That shape is not a bad prompt
  and not a transient throttle.
- A 429 or quota error is an **escalation trigger, not a retry trigger**. Do not resend
  the same request to the same model and hope. Either narrow the waves (fewer children,
  larger scopes) or tell the owner the Go budget is the constraint.
- `opencode debug config` does not enumerate the free registry — it reports
  `opencode-go` with zero models even while Go-plan models resolve and run. Use
  `opencode debug agents` to confirm what an agent will actually call.
- On repeated throttling, narrow the wave rather than re-running it: fewer children
  with larger scopes beat a 25-wide wave that half-fails.

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
