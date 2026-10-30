-- Epic #537 — Fee · Drop · Trust cluster (#536 SoT, #520, #525, #508, #535).
--
-- Schema only; every rule lives in the pure engine src/features/cases/fee-drop.ts
-- (resolveCaseFee) and ownership-window.ts, and the desk server fns write the
-- engine's result here. Nothing in this file computes a fee.
--
-- Exposure posture (same as #441 risk_flags / #443 short-case):
--   * tutoring_cases has COLUMN-level grants for authenticated (REVOKE in
--     20261026000000). The new drop / commission columns are deliberately NOT
--     granted: staff-only via service-role server fns. Parents never see the
--     proof note or the commission figure.
--   * tutors has a TABLE-level SELECT grant to anon (public profile source),
--     so only the PUBLIC promo toggles (#520 badges) land on tutors. Strikes
--     and shadowbans live in tutor_trust_state, staff-only.
--   * trust_blacklist / case_risk_flags / tutor_trust_state: RLS enabled, no
--     policies, zero grants to anon/authenticated (#383 case_flags posture).

-- ---------------------------------------------------------------------------
-- #520 / #525 / #528 / #529: case-level drop + commission state (staff-only)
-- ---------------------------------------------------------------------------
ALTER TABLE public.tutoring_cases
  ADD COLUMN IF NOT EXISTS promo_type text NOT NULL DEFAULT 'standard'
    CHECK (promo_type IN ('standard', 'free_online_trial', 'discounted_first')),
  ADD COLUMN IF NOT EXISTS first_lesson_discount_pct integer
    CHECK (first_lesson_discount_pct IS NULL OR first_lesson_discount_pct BETWEEN 1 AND 100),
  ADD COLUMN IF NOT EXISTS commission_split_mode text NOT NULL DEFAULT '100_50'
    CHECK (commission_split_mode IN ('100_50', '75_75')),
  ADD COLUMN IF NOT EXISTS drop_outcome text
    CHECK (drop_outcome IS NULL OR drop_outcome IN
      ('pre_l1_reject', 'trial_only_stop', 'l1_no_show', 'continued', 'stopped_after_l1')),
  ADD COLUMN IF NOT EXISTS drop_initiator text
    CHECK (drop_initiator IS NULL OR drop_initiator IN ('parent', 'centre', 'tutor', 'admin')),
  ADD COLUMN IF NOT EXISTS drop_reason_class text
    CHECK (drop_reason_class IS NULL OR drop_reason_class IN
      ('vague', 'tutor_fault', 'serious_misconduct', 'hostile_parent', 'tutor_flake', 'tutor_emergency')),
  ADD COLUMN IF NOT EXISTS drop_verification text NOT NULL DEFAULT 'none'
    CHECK (drop_verification IN
      ('none', 'pending', 'verified', 'rejected_tutor_fault', 'rejected_bypass')),
  ADD COLUMN IF NOT EXISTS drop_verified_by text
    CHECK (drop_verified_by IS NULL OR drop_verified_by IN ('parent_wa', 'centre_wa', 'admin_evidence')),
  ADD COLUMN IF NOT EXISTS drop_proof_note text
    CHECK (drop_proof_note IS NULL OR char_length(drop_proof_note) <= 2000),
  ADD COLUMN IF NOT EXISTS drop_recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS drop_recorded_by uuid,
  ADD COLUMN IF NOT EXISTS bypass_flag text NOT NULL DEFAULT 'none'
    CHECK (bypass_flag IN ('none', 'suspected', 'confirmed')),
  ADD COLUMN IF NOT EXISTS secondary_tier_applied text
    CHECK (secondary_tier_applied IS NULL OR secondary_tier_applied IN ('primary', '1', '2', '3', '4')),
  ADD COLUMN IF NOT EXISTS fee_rule_id text,
  -- The rule whose tutor counters (strike / drops / shadowban) were applied;
  -- re-saves apply only the delta against it, so nothing double-counts.
  ADD COLUMN IF NOT EXISTS consequences_rule_id text,
  ADD COLUMN IF NOT EXISTS final_commission_due numeric(10, 2)
    CHECK (final_commission_due IS NULL OR final_commission_due >= 0);

COMMENT ON COLUMN public.tutoring_cases.drop_verification IS
  '#525: pending / verified / rejected_tutor_fault / rejected_bypass. Only parent or centre verification can reduce the fee; tutor word alone never does.';
COMMENT ON COLUMN public.tutoring_cases.final_commission_due IS
  '#520/#536: whole-HKD snapshot of resolveCaseFee at the last desk decision; fee_rule_id names the rule. Staff-only (no authenticated grant).';
COMMENT ON COLUMN public.tutoring_cases.secondary_tier_applied IS
  '#508: retained tier snapshot (primary, 1..4) used for the fee at decision time.';

CREATE INDEX IF NOT EXISTS idx_tutoring_cases_drop_pending
  ON public.tutoring_cases (drop_recorded_at DESC)
  WHERE drop_verification = 'pending';

-- ---------------------------------------------------------------------------
-- #520: tutor-set promo toggles (PUBLIC — they drive the profile badges)
-- ---------------------------------------------------------------------------
ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS offers_free_trial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offers_first_lesson_discount boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_lesson_discount_pct integer NOT NULL DEFAULT 50
    CHECK (first_lesson_discount_pct IN (20, 30, 50));

COMMENT ON COLUMN public.tutors.offers_free_trial IS
  '#520: Free 15–20 min ONLINE intro only (never a free full lesson). Public badge.';
COMMENT ON COLUMN public.tutors.offers_first_lesson_discount IS
  '#520: tutor-funded % off the first paid lesson; the admin fee stays on full R. Public badge.';

-- ---------------------------------------------------------------------------
-- #528 / #529: tutor strikes + shadowban (staff-only, off the public table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tutor_trust_state (
  tutor_id uuid PRIMARY KEY REFERENCES public.tutors(id) ON DELETE CASCADE,
  shadowban_until timestamptz,
  strike_count integer NOT NULL DEFAULT 0 CHECK (strike_count >= 0),
  tutor_initiated_drop_count integer NOT NULL DEFAULT 0 CHECK (tutor_initiated_drop_count >= 0),
  quality_drop_count integer NOT NULL DEFAULT 0 CHECK (quality_drop_count >= 0),
  max_concurrent_first_lessons integer
    CHECK (max_concurrent_first_lessons IS NULL OR max_concurrent_first_lessons BETWEEN 1 AND 20),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.tutor_trust_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tutor_trust_state FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_trust_state TO service_role;
COMMENT ON TABLE public.tutor_trust_state IS
  '#528/#529: per-tutor strikes, 30-day shadowban and an optional per-tutor first-lesson cap override. Service-role only.';

-- ---------------------------------------------------------------------------
-- #535: trust_blacklist — parents or tutors, keyed by a phone hash
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trust_blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL CHECK (subject IN ('parent', 'tutor')),
  phone_hash text CHECK (phone_hash IS NULL OR phone_hash ~ '^[0-9a-f]{64}$'),
  parent_id uuid,
  tutor_id uuid REFERENCES public.tutors(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN (
    'HOSTILE_PARENT', 'SCAM_OVERPAYMENT', 'FEE_EVASION_BYPASS',
    'FAKE_CREDENTIALS', 'BAIT_AND_SWITCH', 'HARASSMENT')),
  evidence_note text CHECK (evidence_note IS NULL OR char_length(evidence_note) <= 500),
  source_case_id uuid REFERENCES public.tutoring_cases(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  lifted_at timestamptz,
  lifted_by uuid,
  CONSTRAINT trust_blacklist_has_key CHECK (num_nonnulls(phone_hash, parent_id, tutor_id) >= 1)
);
CREATE INDEX IF NOT EXISTS idx_trust_blacklist_phone_live
  ON public.trust_blacklist (phone_hash) WHERE lifted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_trust_blacklist_parent_live
  ON public.trust_blacklist (parent_id) WHERE lifted_at IS NULL;
ALTER TABLE public.trust_blacklist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trust_blacklist FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trust_blacklist TO service_role;
COMMENT ON TABLE public.trust_blacklist IS
  '#535/#529: human-set blacklist (never AI-set). Lifting stamps lifted_at instead of deleting, so the audit stays.';

-- ---------------------------------------------------------------------------
-- #535: case_risk_flags — many flags per case; the #511 classifier writes
-- source = ai_advisory rows into the same table later (no schema rewrite).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  flag_type text NOT NULL CHECK (flag_type IN (
    'HIGH_RISK_LOCATION', 'LATE_NIGHT_ADULT', 'SCAM_OVERPAYMENT', 'SCAM_BAIT_AND_SWITCH',
    'HOSTILE_OR_ABUSIVE_CLIENT', 'BYPASS_COLLUSION_RISK', 'SERIAL_HOPPER_PARENT',
    'TUTOR_GHOST_RISK', 'BLACKLISTED_CONTACT')),
  confidence numeric(4, 3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai_advisory', 'system')),
  source_channel text CHECK (source_channel IS NULL OR source_channel IN
    ('website_form', 'whatsapp_webhook', 'desk')),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);
CREATE INDEX IF NOT EXISTS idx_case_risk_flags_open
  ON public.case_risk_flags (case_id) WHERE resolved_at IS NULL;
-- One open flag per (case, type): re-raising the same type is a no-op.
CREATE UNIQUE INDEX IF NOT EXISTS uq_case_risk_flags_open_type
  ON public.case_risk_flags (case_id, flag_type) WHERE resolved_at IS NULL;
ALTER TABLE public.case_risk_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.case_risk_flags FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_risk_flags TO service_role;
COMMENT ON TABLE public.case_risk_flags IS
  '#535: multi-flag case risk table (manual / ai_advisory / system). Blocking types revoke tutor contact reveal while unresolved. Distinct from #441 risk_flags (single NONE/REVIEW/BLOCKED state).';

-- ---------------------------------------------------------------------------
-- #535: new-tutor concurrency cap default (configurable, app_settings is the
-- existing config surface). Value is a JSON number.
-- ---------------------------------------------------------------------------
INSERT INTO public.app_settings (key, value)
VALUES ('trust_new_tutor_first_lesson_cap', '2'::jsonb)
ON CONFLICT (key) DO NOTHING;
