-- Issue #459 slice 6: child claim flow (§15.3, email channel only).
--
-- A parent invites a managed child to take over their own account: the
-- server fn stores a SHA-256 token hash (7-day expiry, raw token only ever
-- lives in the email link), the child signs in and accepts at
-- /account/claim-child. Accepting sets students.owner_user_id and flips the
-- sub-profile status to claimed_independent; the parent link stays for
-- view/billing (status semantics), rows are never deleted.
--
-- The table is service-role only like students (RLS on, no client grants);
-- every read/write goes through src/features/children/claim.functions.ts.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.students.owner_user_id IS
  'Issue #459: the student''s own auth account once they claim the profile (null while parent-managed).';

CREATE TABLE IF NOT EXISTS public.child_claim_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- SHA-256 of the raw token; the raw value only ever travels in the email.
  token_hash text NOT NULL UNIQUE,
  delivery_channel text NOT NULL DEFAULT 'email'
    CHECK (delivery_channel IN ('email', 'whatsapp')),
  delivery_target text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT child_claim_tokens_expiry CHECK (expires_at > created_at)
);

COMMENT ON TABLE public.child_claim_tokens IS
  'Issue #459: one-time 7-day magic-link tokens for a child to claim their sub-profile.';

CREATE INDEX IF NOT EXISTS idx_child_claim_tokens_active
  ON public.child_claim_tokens (student_id)
  WHERE used_at IS NULL AND revoked_at IS NULL;

ALTER TABLE public.child_claim_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.child_claim_tokens FROM anon, authenticated;
