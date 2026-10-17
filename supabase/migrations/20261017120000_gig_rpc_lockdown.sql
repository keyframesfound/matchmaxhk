-- Grok review 2026-10-17 re-review on PR #373 head fe713e0:
-- sweep_past_due_gig_orders is a mutating SECURITY DEFINER function, but
-- Supabase default privileges grant EXECUTE on new functions to anon and
-- authenticated at creation time; the original migration's
-- "REVOKE ALL ... FROM PUBLIC" only stripped the PUBLIC grant, so the live
-- ACL stayed anon=X, authenticated=X. Anyone holding the anon key could
-- flip paid gig orders past due (and trigger ghost strikes). Same hole
-- found on increment_material_sold_count (sold-count tampering).
--
-- Both are called exclusively from server functions via the service-role
-- client, so anon/authenticated EXECUTE is revoked. service_role is
-- re-granted (idempotent) and postgres keeps its owner grant.

REVOKE EXECUTE ON FUNCTION public.sweep_past_due_gig_orders() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_material_sold_count(uuid) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sweep_past_due_gig_orders() TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_material_sold_count(uuid) TO service_role;
