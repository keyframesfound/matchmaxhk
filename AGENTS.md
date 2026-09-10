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
```

Known gotchas:

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

## UI Assets (21st.dev MCP)

Use the 21st.dev MCP (`21st_search`, `21st_get_component`, `21st_get_theme`, etc.) freely when
the task needs UI assets — components, tooltips, themes, icons, or design inspiration. Prefer
searching the catalog before hand-writing new UI, and adapt fetched code to the existing
shadcn/ui conventions in `src/components/ui`.
