-- Supabase advisor follow-up for the notes migrations (applied 2026-11-02):
-- trigger functions must not be callable over /rest/v1/rpc, and every
-- function gets a fixed search_path.
REVOKE EXECUTE ON FUNCTION public.material_disputes_manager_gate() FROM anon, authenticated;
ALTER FUNCTION public.seller_balance_entries_append_only() SET search_path TO 'public';
REVOKE EXECUTE ON FUNCTION public.seller_balance_entries_append_only() FROM PUBLIC, anon, authenticated;
