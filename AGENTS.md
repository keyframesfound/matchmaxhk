<!-- MODEL POLICY:BEGIN -->
> [!IMPORTANT]
> **MatchMax model policy — overrides any global/default agent model config.**
> Never use the user's DeepSeek API key or any `deepseek/*` model while working in this
> project (including subagents). The orchestrator runs on the paid OpenCode Go model
> `opencode-go/deepseek-v4.1-flash`; every other agent runs a free OpenCode model.
> Do not set, export, or reference `DEEPSEEK_API_KEY` here. If a task seems to need any
> other paid model, stop and ask instead of falling back to it.
<!-- MODEL POLICY:END -->

## Subagent dispatch (free first)

Project agents live in `.opencode/agents/` and override global agents of the same name.
The `orchestrator` is the one paid lane, on `opencode-go/deepseek-v4.1-flash`. Every
dispatched agent defaults to the free workhorse `opencode/deepseek-v4.1-flash-free`;
additional `opencode-go/*` use is escalation only, inside the $10 Go plan.

| Agent | Model | Use |
| --- | --- | --- |
| `orchestrator` | `opencode-go/deepseek-v4.1-flash` | default primary; decompose, dispatch, verify |
| `scout` | free `#low` | read-only recon before planning |
| `planner` | free `#high` | ordered file-level plan, read-only |
| `implementer` | free `#high` | one scoped coding task |
| `ui-dev` | free `#high` | React/Tailwind/shadcn work against DESIGN.md |
| `supabase-dev` | free `#high` | schema, RLS, migrations, queries |
| `i18n-guard` | free `#low` | en/zh-HK copy parity |
| `tester` | free `#high` | write and run tests |
| `reviewer` | free `#high` | read-only diff review |
| `debugger` | free `#high` | reproduce, localize, fix |
| `docs` | free `#low` | READMEs, ADRs, comments |
| `deploy-ops` | free `#high` | Cloudflare/Nitro build, Bun lockfile, env |
| `implementer-go` | `opencode-go/deepseek-v4.1-flash` | escalation after two free failures |
| `debugger-go` | `opencode-go/deepseek-v4.1-flash` | escalation after two free failures |
| `deep-coder` | `opencode-go/deepseek-v4.1-flash` | hard or ambiguous work, fresh approach |

Rules: retry a failed free task at most once. On the second failure, dispatch the
`-go` variant with the failed approach and evidence in the prompt. Never retry the
same approach a third time. The orchestrator's own Go model is the single sanctioned
default above the free tier; no dispatched agent may default above $1/M input tokens.

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

Free models are shared-quota. `#high`/`#low` are reasoning effort, not separate
buckets, so every free agent above competes for the same limit per model ID.

- Cap concurrent children at **8**, not 25, when they share one free model. Widen
  only by adding a different model, never by adding another child to the same one.
- Only `opencode/deepseek-v4.1-flash-free` is verified as a live free lane in this
  project. Do not cite other `*-free` model IDs from memory: a free model being
  listed on models.dev does not mean this project can call it, and
  `opencode debug config` does not enumerate the free registry (it reports
  `opencode-go` with zero models even while Go-plan models resolve and run).
  Before spreading a wave onto a second lane, prove that lane resolves *and*
  completes one trivial task, then record the evidence next to the ID. Where no
  second lane is proven, narrow the wave instead of inventing one.
- A 429 or quota error is an **escalation trigger, not a retry trigger**. Move that
  task to the `-go` variant or another free lane and say which limit was hit. Do
  not resubmit the same request to the same model and hope.
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
