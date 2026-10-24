-- Issue #378 (soft hardening after #377), defense-in-depth item 1:
-- terms_acceptances and tutor_credential_edits are service-role write /
-- owner-SELECT tables. The #367 round removed INSERT/UPDATE/DELETE from
-- anon+authenticated, but the default table grant still leaves
-- TRUNCATE / REFERENCES / TRIGGER standing (PostgREST cannot use them,
-- yet the grants should not exist at all). Tighten both tables to
-- SELECT-only for client roles.
--
-- Item 2 of #378 (migration stamp reconcile) is live-only bookkeeping:
-- the 2026-10-18 hardening files (20261018100000..20261018103000) were
-- applied under MCP per-second stamps (20261018073951..074134). Their
-- content is idempotent (CREATE OR REPLACE / REVOKE), so the reconcile
-- inserts matching rows into supabase_migrations.schema_migrations for
-- the repo versions, and does the same for this file's own version when
-- it is applied via execute_sql. A future `supabase db push` will then
-- see them as applied instead of re-running them.

REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.terms_acceptances FROM anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.tutor_credential_edits FROM anon, authenticated;
