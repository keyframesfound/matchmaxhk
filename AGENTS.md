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

## UI Assets (21st.dev MCP)

Use the 21st.dev MCP (`21st_search`, `21st_get_component`, `21st_get_theme`, etc.) freely when
the task needs UI assets — components, tooltips, themes, icons, or design inspiration. Prefer
searching the catalog before hand-writing new UI, and adapt fetched code to the existing
shadcn/ui conventions in `src/components/ui`.
