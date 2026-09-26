-- Tutor referral program (issue #127): approved tutors share a unique link
-- (matchmax.hk/join?ref=CODE), referred applications are attributed on
-- submission, and admins manually track the 15% matching-fee bounty through
-- pending → ready_for_payout → paid (FPS payouts stay manual, outside Stripe).

-- Link a tutor card to the auth account that sees the dashboard referral tab.
ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Unique shareable code, e.g. JasonChan123. Generated automatically for every
-- tutor row (trigger below) so the referral link needs no extra setup.
ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

-- The tutor who referred this card, propagated from the accepted application.
ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.tutors(id) ON DELETE SET NULL;

-- Fill in a unique referral code from the display name whenever it is missing.
CREATE OR REPLACE FUNCTION public.generate_tutor_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  slug text;
  candidate text;
  attempt integer;
BEGIN
  IF NEW.referral_code IS NOT NULL AND NEW.referral_code <> '' THEN
    RETURN NEW;
  END IF;
  slug := regexp_replace(COALESCE(NEW.display_name, ''), '[^a-zA-Z]', '', 'g');
  IF slug IS NULL OR length(slug) < 2 THEN
    slug := 'Tutor';
  END IF;
  FOR attempt IN 1..25 LOOP
    candidate := slug || (100 + floor(random() * 900))::int::text;
    IF NOT EXISTS (
      SELECT 1 FROM public.tutors t WHERE t.referral_code = candidate
    ) THEN
      NEW.referral_code := candidate;
      RETURN NEW;
    END IF;
  END LOOP;
  NEW.referral_code := 'MM' || substring(NEW.id::text from 1 for 8);
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_tutors_referral_code
  BEFORE INSERT OR UPDATE OF referral_code ON public.tutors
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_tutor_referral_code();

-- Backfill codes for existing tutors (the trigger fills each row on update).
UPDATE public.tutors SET referral_code = NULL WHERE referral_code IS NULL;

-- Attribution written by the /join submission server function.
ALTER TABLE public.tutor_applications
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.tutors(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.tutor_applications.referred_by IS
  'Tutor whose referral code the applicant used at /join; NULL for organic applications.';

CREATE INDEX IF NOT EXISTS idx_tutor_applications_referred_by
  ON public.tutor_applications(referred_by)
  WHERE referred_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tutors_referred_by
  ON public.tutors(referred_by)
  WHERE referred_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tutors_user_id
  ON public.tutors(user_id)
  WHERE user_id IS NOT NULL;

-- Bounty ledger: one bounty per referred tutor (first case only). Amounts are
-- entered by admins as the 15% cut of the collected matching fee.
CREATE TYPE public.referral_bounty_status AS ENUM ('pending', 'ready_for_payout', 'paid');

CREATE TABLE public.referral_bounties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referred_tutor_id uuid NOT NULL UNIQUE REFERENCES public.tutors(id) ON DELETE CASCADE,
  referring_tutor_id uuid NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  status public.referral_bounty_status NOT NULL DEFAULT 'pending',
  ready_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.referral_bounties IS
  'Manual 15% referral bounty ledger. pending = first case in progress; ready_for_payout = fee collected, awaiting FPS; paid = FPS transfer sent.';

CREATE TRIGGER trg_referral_bounties_updated_at BEFORE UPDATE ON public.referral_bounties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_referral_bounties_referring
  ON public.referral_bounties(referring_tutor_id);

-- Tutors read their own card (even when unpublished) so the dashboard can
-- resolve their referral identity.
CREATE POLICY "tutors_owner_select" ON public.tutors
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE public.referral_bounties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_bounties_admin_select" ON public.referral_bounties
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.tutors t
      WHERE t.id = referral_bounties.referring_tutor_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "referral_bounties_admin_insert" ON public.referral_bounties
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "referral_bounties_admin_update" ON public.referral_bounties
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_bounties TO authenticated;

-- Dashboard aggregate for the signed-in tutor: SECURITY DEFINER so the friend
-- count can read tutor_applications the tutor must not see row-by-row.
CREATE OR REPLACE FUNCTION public.get_my_referral_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t public.tutors%ROWTYPE;
  friends integer;
  pending_cents bigint;
  ready_cents bigint;
  paid_cents bigint;
BEGIN
  SELECT * INTO t FROM public.tutors WHERE user_id = auth.uid() LIMIT 1;
  IF NOT FOUND OR t.referral_code IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO friends
  FROM public.tutor_applications
  WHERE referred_by = t.id AND status IN ('pending', 'accepted');

  SELECT
    COALESCE(sum(amount_cents) FILTER (WHERE status = 'pending'), 0),
    COALESCE(sum(amount_cents) FILTER (WHERE status = 'ready_for_payout'), 0),
    COALESCE(sum(amount_cents) FILTER (WHERE status = 'paid'), 0)
  INTO pending_cents, ready_cents, paid_cents
  FROM public.referral_bounties
  WHERE referring_tutor_id = t.id;

  RETURN jsonb_build_object(
    'referral_code', t.referral_code,
    'friends_joined', friends,
    'pending_cents', pending_cents,
    'ready_cents', ready_cents,
    'paid_cents', paid_cents
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_my_referral_dashboard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_referral_dashboard() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_referral_dashboard() TO authenticated;

-- Admin helper: resolve a MatchMax account email to a user id so a tutor card
-- can be linked to its owner. Returns NULL for non-admins and unknown emails.
CREATE OR REPLACE FUNCTION public.find_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT u.id
  FROM auth.users u
  WHERE lower(u.email) = lower(_email)
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
    )
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.find_user_id_by_email(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.find_user_id_by_email(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(text) TO authenticated;
