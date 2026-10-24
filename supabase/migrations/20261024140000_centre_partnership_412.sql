-- Issues #412 (+ #423 B2B slice) — centre partnership compliance.
--
-- Three moves:
--   1. Partner-org onboarding hardening: legal/BR identity columns on
--      organizations + the admin BR-review stamp. The authority checkbox and
--      the centre_partnership terms acceptance are enforced in app code and
--      recorded in terms_acceptances; the columns here only store WHAT was
--      submitted so staff can review it.
--   2. Pre-matching triage: a `compliance_hold` board status on
--      case_status + the triage answers/hold reason stored on the case.
--      Held cases are excluded from the public board by the app queries and
--      locked in the admin desk until staff clear them.
--   3. Engagement summaries (#412 F): one row per adopted case, dual-party
--      confirmation timestamps, and change reports that can re-trigger a
--      hold. RLS-deny like the #201 SoR tables — every read/write goes
--      through service-role server fns.
--
-- ADDITIVE ONLY. ALTER TYPE ... ADD VALUE IF NOT EXISTS is transactional-safe
-- on PG12+ as long as the new values are not USED in the same transaction —
-- none of the DDL below references them.

-- ---------------------------------------------------------------------------
-- 1. Board status: compliance_hold.
--    The live board enum is `case_request_status` ('new','contacted',
--    'matched','closed','rejected') — the checked-in 2026-07 lineage created
--    `case_status` with the older pending/approved vocabulary, so the enum
--    that actually exists depends on how the database was provisioned. The
--    DO block adds the value to whichever exists (prod: case_request_status;
--    fresh rebuilds: both) — ADD VALUE IF NOT EXISTS is transactional-safe
--    on PG12+ as long as the value is not USED in this transaction, which
--    none of the DDL below does.
-- ---------------------------------------------------------------------------
DO $enum$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'case_request_status' AND n.nspname = 'public'
  ) THEN
    ALTER TYPE public.case_request_status ADD VALUE IF NOT EXISTS 'compliance_hold';
    EXECUTE 'COMMENT ON TYPE public.case_request_status IS ''#412: compliance_hold = triage flagged this request (employment-like duties, third-party engager, unsure gate answer). Held cases never reach the public board and admin actions that recommend tutors, circulate, or release contacts are locked until staff re-screen.''';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'case_status' AND n.nspname = 'public'
  ) THEN
    -- Defensive parity for databases rebuilt from migrations alone: the app
    -- has always written 'new'/'contacted'.
    ALTER TYPE public.case_status ADD VALUE IF NOT EXISTS 'new';
    ALTER TYPE public.case_status ADD VALUE IF NOT EXISTS 'contacted';
    ALTER TYPE public.case_status ADD VALUE IF NOT EXISTS 'compliance_hold';
  END IF;
END
$enum$;

-- ---------------------------------------------------------------------------
-- 2. Partner-org legal identity (#412 B). All nullable — existing orgs (and
--    the #201 silent per-tutor orgs) keep working; the join form enforces
--    the required fields for NEW centre submissions.
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS legal_entity_name text,
  ADD COLUMN IF NOT EXISTS trading_name text,
  ADD COLUMN IF NOT EXISTS br_number text,
  ADD COLUMN IF NOT EXISTS rep_name text,
  ADD COLUMN IF NOT EXISTS rep_role text,
  ADD COLUMN IF NOT EXISTS org_type text
    CHECK (org_type IN ('tutorial_centre', 'day_school', 'ngo')),
  ADD COLUMN IF NOT EXISTS edb_identifier text,
  ADD COLUMN IF NOT EXISTS charity_identifier text,
  ADD COLUMN IF NOT EXISTS authority_ack_at timestamptz,
  ADD COLUMN IF NOT EXISTS br_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS br_reviewed_by uuid REFERENCES auth.users(id);

COMMENT ON COLUMN public.organizations.legal_entity_name IS
  '#412: official registered company name (e.g. XYZ Education Limited) —
  distinct from the public trading `name`. Required for centre join.';
COMMENT ON COLUMN public.organizations.br_number IS
  '#412: Business Registration number or organisation identifier. Reviewed by
  staff before the org is activated (br_reviewed_at/by stamp the review).';
COMMENT ON COLUMN public.organizations.rep_name IS
  '#412: authorised representative full name; rep_role is their title. The
  join form requires an unticked authority checkbox binding this person.';
COMMENT ON COLUMN public.organizations.org_type IS
  '#412: Tutorial Centre / Day School / NGO — same form as the BR fields.';
COMMENT ON COLUMN public.organizations.edb_identifier IS
  '#412 optional: EDB school registration number, when the centre holds one.
  Charity_identifier is the parallel optional field for NGOs.';
COMMENT ON COLUMN public.organizations.br_reviewed_by IS
  '#412: staff account that reviewed the BR during activation. Centre kind
  stays admin-provisioned (20261018100000 lock trigger) — flipping kind to
  centre during this review is the admin bypass path.';

-- ---------------------------------------------------------------------------
-- 3. Case triage (#412 E). One JSONB column holds either the centre 4-part
--    answers or the two parent B2C questions; compliance_note is the free
--    text a tutor clarification or staff review attaches to the hold.
-- ---------------------------------------------------------------------------
ALTER TABLE public.tutoring_cases
  ADD COLUMN IF NOT EXISTS compliance_triage jsonb,
  ADD COLUMN IF NOT EXISTS compliance_note text;

COMMENT ON COLUMN public.tutoring_cases.compliance_triage IS
  '#412: triage answers captured at submit time.
  Centre shape: { scope: "centre", engagementCategory, contractingEntity,
  feeStructure, feeOpenToCounter, premisesProvider, scopeDescription,
  adminDutiesRequired, replacesVacancy, methodologyOwner, otherClientsAllowed,
  substitutionAllowed, confirmedAccurate }.
  Parent shape: { scope: "parent", engager, nonTutoringDuties }.
  Never selected by public queries — read by staff surfaces only.';
COMMENT ON COLUMN public.tutoring_cases.compliance_note IS
  '#412: hold/clarification note — tutor "clarify" submissions and staff
  re-screening remarks. Feeds the admin desk lock banner; not public.';

-- ---------------------------------------------------------------------------
-- 4. Engagement summaries + change reports (#412 F). RLS-deny like the SoR
--    tables: no policies, default privileges revoked — every access goes
--    through the service-role server fns (engagement.functions.ts).
--    payload keeps the rendered summary (scope, rate, payer, autonomy
--    answers, fee line) so a re-confirmation always shows the exact agreed
--    version; version increments when a material change is re-screened.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.engagement_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL UNIQUE REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  payload jsonb NOT NULL,
  tutor_confirmed_at timestamptz,
  customer_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.engagement_summaries IS
  '#412 F: the 1-page Engagement Summary per adopted case. Auto-created when
  a case reaches the engagement stage; both parties 1-click confirm the SAME
  payload version before contact details / lesson commencement are finalised.
  MatchMax is not a party to the resulting Contract for Services (ToS §§3,5).';
COMMENT ON COLUMN public.engagement_summaries.payload IS
  'Rendered summary fields: customerLegalName, educatorName, scope,
  rateStructure, paymentSchedule, payer, matchmaxFeeLine, autonomy notes,
  caseCode. Immutable per version — a material change writes version+1.';

CREATE TABLE IF NOT EXISTS public.engagement_change_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  engagement_id uuid REFERENCES public.engagement_summaries(id) ON DELETE CASCADE,
  reported_by_role text NOT NULL CHECK (reported_by_role IN ('tutor', 'customer', 'staff')),
  reported_by_user uuid,
  description text NOT NULL,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.engagement_change_reports IS
  '#412 F: "Report Material Change" — either party logs changes to duties,
  hours, or contracting structure. Unresolved reports put the case back into
  compliance_hold for re-screening (server fn side effect).';

CREATE INDEX IF NOT EXISTS idx_engagement_summaries_case
  ON public.engagement_summaries (case_id);
CREATE INDEX IF NOT EXISTS idx_engagement_change_reports_case
  ON public.engagement_change_reports (case_id);
CREATE INDEX IF NOT EXISTS idx_engagement_change_reports_open
  ON public.engagement_change_reports (case_id)
  WHERE resolved_at IS NULL;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['engagement_summaries', 'engagement_change_reports']
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

CREATE TRIGGER trg_engagement_summaries_updated_at
  BEFORE UPDATE ON public.engagement_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5. terms_acceptances: audit extras (#412 D) + the centre_partnership
--    surface. Rows are still written service-role only (no client INSERT
--    policy — unchanged); the new columns record WHERE and on behalf of
--    WHICH legal entity the acceptance happened, plus the exact checkbox
--    strings shown, so the paper trail survives UI copy changes.
-- ---------------------------------------------------------------------------
ALTER TABLE public.terms_acceptances
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS legal_entity_name text,
  ADD COLUMN IF NOT EXISTS acceptance_details jsonb;

COMMENT ON COLUMN public.terms_acceptances.ip_address IS
  '#412 D: request IP at acceptance time, captured server-side. Best-effort —
  may be null where the server fn has no request context.';
COMMENT ON COLUMN public.terms_acceptances.legal_entity_name IS
  '#412 D: for centre_partnership rows, the legal entity the representative
  bound with the authority checkbox.';
COMMENT ON COLUMN public.terms_acceptances.acceptance_details IS
  '#412 D: exact checkbox label strings accepted (JSONB array) so the audit
  trail stays readable even after copy changes.';

ALTER TABLE public.terms_acceptances
  DROP CONSTRAINT terms_acceptances_surface_check;
ALTER TABLE public.terms_acceptances
  ADD CONSTRAINT terms_acceptances_surface_check
  CHECK (surface = ANY (ARRAY['signup'::text, 'note_upload'::text, 'checkout'::text,
    'referral_signup'::text, 'case_request'::text, 'centre_partnership'::text]));
