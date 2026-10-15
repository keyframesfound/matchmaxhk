-- Issue #308: suspend / ban an account + block list.
--
-- Decisions (issue thread):
--   * profiles.account_status: 'active' (default) | 'suspended' | 'banned'.
--     Suspended users can sign in and read; banned users are signed out,
--     blocked from signing in and their tutor card is unpublished.
--   * public.account_blocklist stores email (+ Google subject id) of banned
--     accounts and of emails admins preemptively block. A BEFORE INSERT
--     trigger on auth.users rejects signups (email OR Google sub match), so
--     a banned user cannot re-register or link a second Google account.
--   * tutors.owner_account_status mirrors the owner's status so public
--     queries (anon-readable tutors rows) can hide the Request-tutor action
--     for suspended owners without exposing profiles. The ban flow also
--     unpublishes the card (is_published = false + card_hidden_by_ban
--     marker so restore republishes exactly what the ban hid, never a card
--     the tutor had deliberately unpublished before).
--
-- Additive only; every statement is idempotent. No destructive changes.

-- ---------------------------------------------------------------------------
-- 1. Account status on profiles
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'suspended', 'banned'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status_reason TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.account_status IS
  'Issue #308: active | suspended | banned. Suspended: can sign in, sees the reason, cannot request/apply/upload/message. Banned: session ended, cannot sign in or re-register, tutor card unpublished.';

COMMENT ON COLUMN public.profiles.account_status_reason IS
  'Issue #308: staff-facing reason shown to the suspended user. Never names a reporter.';

CREATE INDEX IF NOT EXISTS idx_profiles_account_status
  ON public.profiles (account_status);

-- ---------------------------------------------------------------------------
-- 2. Tutor card mirror + ban-unpublish marker
-- ---------------------------------------------------------------------------

ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS owner_account_status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS card_hidden_by_ban BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tutors.owner_account_status IS
  'Issue #308: mirror of profiles.account_status for the owning account (trigger-maintained). Public listing reads this to hide the Request-tutor action for suspended owners.';

COMMENT ON COLUMN public.tutors.card_hidden_by_ban IS
  'Issue #308: true while a ban unpublished this card; restore republishes only these rows.';

-- Keep the mirror in sync on every profile insert/update (INSERT covered for
-- safety even though blocked signups make a non-active insert impossible).
CREATE OR REPLACE FUNCTION public.sync_tutor_owner_account_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.tutors
  SET owner_account_status = NEW.account_status
  WHERE user_id = NEW.id
    AND owner_account_status IS DISTINCT FROM NEW.account_status;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tutor_owner_account_status ON public.profiles;
CREATE TRIGGER trg_sync_tutor_owner_account_status
  AFTER INSERT OR UPDATE OF account_status ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_tutor_owner_account_status();

-- ---------------------------------------------------------------------------
-- 3. Block list (service-role only: RLS on, no client policies)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.account_blocklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  -- Google OAuth subject id, when known (banned accounts).
  google_sub TEXT,
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive email uniqueness; a Google sub may only block one entry.
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_blocklist_email
  ON public.account_blocklist (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_blocklist_google_sub
  ON public.account_blocklist (google_sub)
  WHERE google_sub IS NOT NULL;

COMMENT ON TABLE public.account_blocklist IS
  'Issue #308: emails / Google subject ids refused at signup. Banned accounts are stored here automatically; admins may also block an email that has no account yet. Restore removes the entry.';

ALTER TABLE public.account_blocklist ENABLE ROW LEVEL SECURITY;

-- No policies: clients (anon + authenticated) have no read/write path.
-- Staff act exclusively through admin-gated server functions using the
-- service-role client, which bypasses RLS.
REVOKE ALL ON public.account_blocklist FROM anon, authenticated;
GRANT ALL ON public.account_blocklist TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Refuse signup / OAuth linking for blocked emails + Google subjects
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reject_blocked_account_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  blocked_email TEXT;
  blocked_sub TEXT;
BEGIN
  IF NEW.email IS NOT NULL THEN
    SELECT email INTO blocked_email
    FROM public.account_blocklist
    WHERE lower(email) = lower(NEW.email)
    LIMIT 1;
  END IF;

  IF blocked_email IS NULL THEN
    SELECT email INTO blocked_sub
    FROM public.account_blocklist
    WHERE google_sub IS NOT NULL
      AND google_sub <> ''
      AND google_sub = COALESCE(NEW.raw_user_meta_data ->> 'sub', '')
    LIMIT 1;
  END IF;

  IF blocked_email IS NOT NULL OR blocked_sub IS NOT NULL THEN
    RAISE EXCEPTION 'This account is blocked from MatchMax. Contact support.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_blocked_account_signup ON auth.users;
CREATE TRIGGER trg_reject_blocked_account_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_blocked_account_signup();
