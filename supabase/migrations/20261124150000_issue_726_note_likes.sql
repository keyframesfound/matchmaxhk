-- Issue #726 (like half): Marketplace note likes.
--
-- Saves already ship end to end (20261115100000_issue_726_engagement_notifications.sql
-- emits engagement.saved from saved_materials). Likes did not exist anywhere in
-- the schema or code before this migration. Additive and idempotent: no drops,
-- no renames, safe to re-run.
--
-- Idempotence guarantee: ONE row per account per note, enforced by the unique
-- constraint below. A repeat like is a no-op. Toggling OFF deletes the row, so
-- re-liking inserts a NEW row and may notify the owner once more — the #726
-- anti-spam rule only forbids repeat notifications for the SAME saved state,
-- and a fresh like is a fresh interaction, not a repeat.
--
-- Privacy: RLS is enabled with NO policies (deny-all) and the table is
-- service-role only, exactly like case_reviews. Counts are computed server-side;
-- no caller ever receives a liker's identity.
--
-- Not applied here: applied via the Supabase MCP.

CREATE TABLE IF NOT EXISTS public.material_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.digital_materials(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT material_likes_material_id_account_id_key UNIQUE (material_id, account_id)
);

COMMENT ON TABLE public.material_likes IS
  '#726: one row per account per note is the idempotence guarantee (unique material_id+account_id); re-liking after an unlike is a NEW like and may notify the owner once more. Service-role only — liker identity is never exposed.';

-- Counts read by material_id (list cards + detail page).
CREATE INDEX IF NOT EXISTS idx_material_likes_material
  ON public.material_likes (material_id);

-- Deny-all posture (case_reviews precedent): RLS on, no policies, no anon or
-- authenticated grants. Only the service role reads/writes likes.
ALTER TABLE public.material_likes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.material_likes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_likes TO service_role;
