-- Issues #201 + #205 + #292: Case becomes the system of record + notification bus tables.
--
-- The board status (case_request_status) keeps tracking the parent REQUEST.
-- The SoR match lifecycle lives in a NEW column tutoring_cases.sor_status:
--   draft → introduced → lesson_1_scheduled → lesson_1_done → lesson_2_scheduled
--   → lesson_2_done → fee_invoiced → fee_paid → active → replaced|closed; waived → closed.
-- Illegal jumps are rejected by a trigger and write no audit row; server fns
-- keep the canonical ALLOWED_TRANSITIONS map (tested in tests/cases/sor.test.ts).
--
-- All new tables are RLS-deny (no policies): every read/write goes through
-- TanStack server fns on the service-role client, mirroring
-- tutor_engagement_events. Explicit REVOKEs undo Supabase's default table
-- privileges for anon/authenticated.

-- ---------------------------------------------------------------------------
-- organisations: reuse the existing table (centre directory), add the SoR kind.
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'individual'
  CHECK (kind IN ('individual', 'centre'));
-- #201: organisations are created silently for every tutor, including tutors
-- without an account row; the Lovable-era NOT NULL on created_by would block those.
ALTER TABLE public.organizations ALTER COLUMN created_by DROP NOT NULL;
COMMENT ON COLUMN public.organizations.kind IS
  '#201: individual organisations are created silently per tutor (owner of their cases); centre kind is admin-inserted only, no product UI.';

CREATE INDEX IF NOT EXISTS idx_organizations_kind ON public.organizations (kind);

-- ---------------------------------------------------------------------------
-- organisation_members: every current tutor gets one owner row on their org.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organisation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'tutor' CHECK (role IN ('owner', 'tutor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, account_id)
);
CREATE INDEX IF NOT EXISTS idx_org_members_account ON public.organisation_members (account_id);

-- ---------------------------------------------------------------------------
-- tutoring_cases: SoR columns (all nullable — legacy board rows unaffected).
-- ---------------------------------------------------------------------------
ALTER TABLE public.tutoring_cases
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS concierge_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS hourly_rate_hkd numeric(10, 2),
  ADD COLUMN IF NOT EXISTS whatsapp_group_url text,
  ADD COLUMN IF NOT EXISTS replacement_of_case_id uuid REFERENCES public.tutoring_cases(id),
  ADD COLUMN IF NOT EXISTS internal_note text,
  ADD COLUMN IF NOT EXISTS sor_status text,
  ADD COLUMN IF NOT EXISTS sor_status_at timestamptz;

COMMENT ON COLUMN public.tutoring_cases.sor_status IS
  '#201 SoR match lifecycle: draft, introduced, lesson_1_scheduled, lesson_1_done, lesson_2_scheduled, lesson_2_done, fee_invoiced, fee_paid, active, replaced, closed, waived. NULL = board request not yet adopted as a match record. Transitions guarded by sor_case_transition_guard.';
COMMENT ON COLUMN public.tutoring_cases.whatsapp_group_url IS
  '#201 admin-only concierge WhatsApp group link. Never selected by parent/tutor-facing queries.';
COMMENT ON COLUMN public.tutoring_cases.hourly_rate_hkd IS
  '#201 agreed hourly rate in HKD. The admin fee uses the rate at invoice time; admin may lock it when lesson 1 is marked done.';
-- #201 import: phone-only cases (no parent account yet) have no parent_id;
-- the owner-RLS policies simply grant nobody, which is correct for admin-only rows.
ALTER TABLE public.tutoring_cases ALTER COLUMN parent_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cases_organisation ON public.tutoring_cases (organisation_id);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_tutor ON public.tutoring_cases (matched_tutor_id)
  WHERE matched_tutor_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- case_lessons: sequences 1 and 2 are the intro lessons (#201); 3+ are
-- calendar lessons (#204) on the same table.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK (sequence >= 1),
  tutor_id uuid REFERENCES public.tutors(id),
  starts_at timestamptz NOT NULL,
  duration_min integer NOT NULL DEFAULT 60 CHECK (duration_min BETWEEN 15 AND 480),
  location_or_link text,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'confirmed', 'done', 'no_show', 'cancelled', 'late_cancel')),
  confirmed_by_parent_at timestamptz,
  confirmed_by_tutor_at timestamptz,
  marked_done_by uuid,
  done_at timestamptz,
  private_note text CHECK (char_length(private_note) <= 500),
  buffer_exempt boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, sequence)
);
CREATE INDEX IF NOT EXISTS idx_case_lessons_tutor_time ON public.case_lessons (tutor_id, starts_at)
  WHERE status IN ('planned', 'confirmed', 'done');
CREATE INDEX IF NOT EXISTS idx_case_lessons_case ON public.case_lessons (case_id, sequence);
COMMENT ON COLUMN public.case_lessons.private_note IS
  '#204: tutor+admin only, max 500 chars. Never selected by parent-facing queries.';
COMMENT ON COLUMN public.case_lessons.buffer_exempt IS
  '#204: admin override of the 30-minute F2F buffer for this one lesson; the override reason lives in case_audit.';
COMMENT ON COLUMN public.case_lessons.tutor_id IS
  'Denormalized from tutoring_cases.matched_tutor_id at insert time to back the hard double-book guard (partial unique on tutor_id, starts_at).';

-- Two live lessons for the same tutor may not start at the same instant.
CREATE UNIQUE INDEX IF NOT EXISTS uq_case_lessons_tutor_start_live
  ON public.case_lessons (tutor_id, starts_at)
  WHERE status IN ('planned', 'confirmed', 'done') AND tutor_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- case_fees: the 1.5-lesson admin fee. Only one OPEN fee per case; a waived or
-- refunded row may be followed by a new invoice.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  rate_hkd numeric(10, 2) NOT NULL,
  multiplier numeric(4, 2) NOT NULL DEFAULT 1.5 CHECK (multiplier > 0),
  amount_hkd numeric(10, 2) NOT NULL CHECK (amount_hkd >= 0),
  status text NOT NULL DEFAULT 'not_due'
    CHECK (status IN ('not_due', 'invoiced', 'paid', 'waived', 'refunded')),
  fps_reference text,
  due_at timestamptz,
  paid_at timestamptz,
  marked_paid_by uuid,
  waive_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_case_fees_one_open
  ON public.case_fees (case_id)
  WHERE status IN ('not_due', 'invoiced', 'paid');
CREATE INDEX IF NOT EXISTS idx_case_fees_open_due ON public.case_fees (due_at)
  WHERE status = 'invoiced';
COMMENT ON TABLE public.case_fees IS
  '#201: admin fee rows. amount = rate_hkd * multiplier at invoice time. A custom one-lesson invoice stores multiplier 1 with a reason in case_audit.';

-- ---------------------------------------------------------------------------
-- case_audit: status transitions and admin overrides. Illegal jumps write nothing.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  actor_id uuid,
  from_status text,
  to_status text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_case_audit_case ON public.case_audit (case_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Notification bus (#205): events + per-recipient deliveries.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_table text,
  source_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  process_attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_case_events_pending ON public.case_events (created_at)
  WHERE status = 'pending';
COMMENT ON TABLE public.case_events IS
  '#205 event bus. Accepted unconsumed names (listing.viewed, listing.saved, entitlement.granted) are stored as skipped; unknown types are stored as failed, not dropped.';

CREATE TABLE IF NOT EXISTS public.event_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.case_events(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('in_app', 'email')),
  recipient_account_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  read_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, channel, recipient_account_id)
);
CREATE INDEX IF NOT EXISTS idx_event_deliveries_inbox ON public.event_deliveries (recipient_account_id, created_at DESC)
  WHERE channel = 'in_app';
CREATE INDEX IF NOT EXISTS idx_event_deliveries_unread ON public.event_deliveries (recipient_account_id)
  WHERE channel = 'in_app' AND read_at IS NULL AND status = 'sent';
COMMENT ON TABLE public.event_deliveries IS
  '#205: sending is idempotent on (event_id, channel, recipient). In-app inbox rows are channel=in_app; the bell red dot is the unread count and clears when the list is opened (#292).';

CREATE TABLE IF NOT EXISTS public.entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  key text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  source text,
  source_order_id uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_entitlements_account_key ON public.entitlements (account_id, key);
COMMENT ON TABLE public.entitlements IS '#205: no UI. Written by order flows.';

CREATE TABLE IF NOT EXISTS public.tutor_plus_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.tutor_plus_interest IS
  '#204: one interest row per account for the Tutor Plus HK$98/month banner. Does not charge or block.';

-- ---------------------------------------------------------------------------
-- case_reviews (#205 parent→tutor + #287 tutor→parent).
-- Comment bounds by direction: parent 20–600 (#205), tutor 20–400 (#287 P7).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES public.case_lessons(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('parent_to_tutor', 'tutor_to_parent')),
  author_account_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL,
  author_display_line text NOT NULL,
  status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'held', 'hidden', 'replaced')),
  held_reason text,
  hidden_by uuid,
  hidden_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- One visible review per case per direction (#205 "one visible review per case", P7 "one each way").
CREATE UNIQUE INDEX IF NOT EXISTS uq_case_reviews_one_visible
  ON public.case_reviews (case_id, direction)
  WHERE status = 'visible';
CREATE INDEX IF NOT EXISTS idx_case_reviews_tutor_visible ON public.case_reviews (tutor_id, created_at DESC)
  WHERE direction = 'parent_to_tutor' AND status = 'visible';
COMMENT ON COLUMN public.case_reviews.author_display_line IS
  'Snapshot at write time, e.g. "Parent of G11 IB Physics" (#205/#287). Derived from the case, stable if the case later changes.';
COMMENT ON COLUMN public.case_reviews.held_reason IS
  'Set when a comment contains a phone, email, or WhatsApp reference (#205: held, not published). Admin can release or keep hidden.';

-- ---------------------------------------------------------------------------
-- Transition guard: illegal sor_status jumps fail and write no audit row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sor_case_transition_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  _allowed text[] := ARRAY[
    'draft->introduced', 'draft->closed',
    'introduced->lesson_1_scheduled', 'introduced->closed',
    'lesson_1_scheduled->lesson_1_done', 'lesson_1_scheduled->closed',
    'lesson_1_done->lesson_2_scheduled', 'lesson_1_done->fee_invoiced', 'lesson_1_done->closed',
    'lesson_2_scheduled->lesson_2_done', 'lesson_2_scheduled->closed',
    'lesson_2_done->fee_invoiced',
    'fee_invoiced->fee_paid', 'fee_invoiced->waived',
    'fee_paid->active',
    'active->replaced', 'active->closed',
    'waived->closed'
  ];
BEGIN
  IF OLD.sor_status IS NULL OR NEW.sor_status IS NULL
     OR NEW.sor_status = OLD.sor_status THEN
    RETURN NEW;
  END IF;
  IF NOT (OLD.sor_status || '->' || NEW.sor_status) = ANY (_allowed) THEN
    RAISE EXCEPTION 'illegal case status transition % -> %', OLD.sor_status, NEW.sor_status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sor_case_transition_guard ON public.tutoring_cases;
CREATE TRIGGER trg_sor_case_transition_guard
  BEFORE UPDATE ON public.tutoring_cases
  FOR EACH ROW EXECUTE FUNCTION public.sor_case_transition_guard();

-- ---------------------------------------------------------------------------
-- Event emission triggers (bus producers). Payloads carry ids only; the drain
-- resolves display data so later renames never leak stale text.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.emit_case_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _type text;
  _payload jsonb;
BEGIN
  IF TG_TABLE_NAME = 'case_lessons' THEN
    IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
      _type := 'lesson.done';
      _payload := jsonb_build_object(
        'case_id', NEW.case_id, 'lesson_id', NEW.id,
        'sequence', NEW.sequence, 'starts_at', NEW.starts_at,
        'tutor_id', NEW.tutor_id);
    END IF;
  ELSIF TG_TABLE_NAME = 'case_fees' THEN
    IF NEW.status = 'invoiced' AND (OLD.status IS DISTINCT FROM 'invoiced') THEN
      _type := 'admin_fee.invoiced';
      _payload := jsonb_build_object(
        'case_id', NEW.case_id, 'fee_id', NEW.id,
        'amount_hkd', NEW.amount_hkd, 'due_at', NEW.due_at);
    END IF;
  ELSIF TG_TABLE_NAME = 'case_reviews' THEN
    IF NEW.status = 'visible' AND (OLD.status IS DISTINCT FROM 'visible') THEN
      _type := 'review.published';
      _payload := jsonb_build_object(
        'case_id', NEW.case_id, 'review_id', NEW.id,
        'direction', NEW.direction, 'rating', NEW.rating, 'tutor_id', NEW.tutor_id,
        'author_account_id', NEW.author_account_id);
    END IF;
  ELSIF TG_TABLE_NAME = 'material_orders' THEN
    IF NEW.delivered_at IS NOT NULL AND (OLD.delivered_at IS NULL OR OLD.delivered_at IS DISTINCT FROM NEW.delivered_at) THEN
      _type := 'note_order.delivered';
      _payload := jsonb_build_object(
        'order_id', NEW.id, 'material_id', NEW.material_id,
        'tutor_id', NEW.tutor_id, 'buyer_account_id', NEW.buyer_account_id,
        'gross_hkd', NEW.gross_hkd, 'tutor_net_hkd', NEW.tutor_net_hkd);
    END IF;
  END IF;

  IF _type IS NOT NULL THEN
    INSERT INTO public.case_events (event_type, payload, source_table, source_id)
    VALUES (_type, _payload, TG_TABLE_NAME,
            CASE TG_TABLE_NAME
              WHEN 'case_lessons' THEN NEW.id
              WHEN 'case_fees' THEN NEW.id
              WHEN 'case_reviews' THEN NEW.id
              ELSE NEW.id END);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_emit_case_lessons ON public.case_lessons;
CREATE TRIGGER trg_emit_case_lessons AFTER UPDATE ON public.case_lessons
  FOR EACH ROW EXECUTE FUNCTION public.emit_case_event();

DROP TRIGGER IF EXISTS trg_emit_case_fees ON public.case_fees;
CREATE TRIGGER trg_emit_case_fees AFTER UPDATE ON public.case_fees
  FOR EACH ROW EXECUTE FUNCTION public.emit_case_event();

DROP TRIGGER IF EXISTS trg_emit_case_reviews ON public.case_reviews;
CREATE TRIGGER trg_emit_case_reviews AFTER INSERT OR UPDATE ON public.case_reviews
  FOR EACH ROW EXECUTE FUNCTION public.emit_case_event();

DROP TRIGGER IF EXISTS trg_emit_material_orders ON public.material_orders;
CREATE TRIGGER trg_emit_material_orders AFTER UPDATE ON public.material_orders
  FOR EACH ROW EXECUTE FUNCTION public.emit_case_event();

-- ---------------------------------------------------------------------------
-- admin_create_sor_case: atomic organisation + member + case creation (#201
-- flow steps 1–4). Service role only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_sor_case(_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tutor_id uuid := (_payload->>'assigned_tutor_id')::uuid;
  _org_id uuid := (_payload->>'organisation_id')::uuid;
  _case_id uuid;
  _tutor_user_id uuid;
  _tutor_name text;
  _tutor_code text;
  _created_by uuid := coalesce((_payload->>'concierge_id')::uuid, (_payload->>'parent_account_id')::uuid);
BEGIN
  IF _tutor_id IS NULL THEN
    RAISE EXCEPTION 'assigned_tutor_id is required';
  END IF;

  SELECT t.user_id, t.display_name, t.tutor_code
    INTO _tutor_user_id, _tutor_name, _tutor_code
  FROM public.tutors t WHERE t.id = _tutor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tutor not found';
  END IF;

  IF _org_id IS NULL THEN
    -- Reuse an existing individual organisation owned by this tutor (#201:
    -- passing no organisation still must not spawn duplicates).
    SELECT om.organisation_id INTO _org_id
    FROM public.organisation_members om
    JOIN public.organizations o ON o.id = om.organisation_id
    WHERE om.account_id = _tutor_user_id AND om.role = 'owner'
    ORDER BY o.kind = 'individual' DESC, o.created_at
    LIMIT 1;
  END IF;

  IF _org_id IS NULL THEN
    INSERT INTO public.organizations (name, slug, kind, status, created_by)
    VALUES (
      _tutor_name,
      'tutor-' || lower(coalesce(_tutor_code, replace(gen_random_uuid()::text, '-', ''))),
      'individual',
      'active',
      coalesce(_created_by, _tutor_user_id))
    RETURNING id INTO _org_id;
  END IF;

  -- #201: every tutor with an account gets one owner member row. Tutors without
  -- an account (admin-created cards) have no account to link — the row is
  -- backfilled by a later import rerun or card claim.
  IF _tutor_user_id IS NOT NULL THEN
    INSERT INTO public.organisation_members (organisation_id, account_id, role)
    VALUES (_org_id, _tutor_user_id, 'owner')
    ON CONFLICT (organisation_id, account_id) DO NOTHING;
  END IF;

  INSERT INTO public.tutoring_cases (
    parent_id, title, organisation_id, concierge_id, matched_tutor_id, matched_at,
    hourly_rate_hkd, whatsapp_group_url, internal_note, source,
    exam_system, subjects, student_level, district, mode,
    contact_name, contact_phone,
    sor_status, sor_status_at
  ) VALUES (
    coalesce((_payload->>'parent_account_id')::uuid, (_payload->>'concierge_id')::uuid, _tutor_user_id),
    coalesce(_payload->>'student_display_name', _tutor_name),
    _org_id,
    (_payload->>'concierge_id')::uuid,
    _tutor_id, now(),
    (_payload->>'hourly_rate_hkd')::numeric,
    _payload->>'whatsapp_group_url',
    _payload->>'internal_note',
    coalesce(_payload->>'source', 'whatsapp'),
    _payload->>'curriculum',
    CASE WHEN _payload->>'subject' IS NULL THEN NULL
         ELSE ARRAY[_payload->>'subject'] END,
    _payload->>'level',
    _payload->>'station',
    CASE _payload->>'lesson_mode'
      WHEN 'f2f' THEN 'in_person'::case_mode
      WHEN 'online' THEN 'online'::case_mode
      ELSE NULL END,
    _payload->>'contact_name',
    _payload->>'contact_phone',
    'draft', now()
  ) RETURNING id INTO _case_id;

  RETURN _case_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Review summaries (#205 card block + #287 parent account average).
-- Public read via SECURITY DEFINER; averages use parent reviews only, parent
-- account average uses tutor reviews only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_tutor_review_summary(_tutor_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
STABLE
AS $function$
  SELECT jsonb_build_object(
    'average', (SELECT round(avg(rating)::numeric, 1) FROM public.case_reviews
                WHERE tutor_id = _tutor_id AND direction = 'parent_to_tutor' AND status = 'visible'),
    'count', (SELECT count(*) FROM public.case_reviews
              WHERE tutor_id = _tutor_id AND direction = 'parent_to_tutor' AND status = 'visible'),
    'latest', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                  'rating', r.rating, 'comment', r.comment,
                  'display_line', r.author_display_line, 'created_at', r.created_at)), '[]'::jsonb)
               FROM (SELECT rating, comment, author_display_line, created_at
                     FROM public.case_reviews
                     WHERE tutor_id = _tutor_id AND direction = 'parent_to_tutor' AND status = 'visible'
                     ORDER BY created_at DESC LIMIT 5) r)
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_parent_review_summary(_account_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
STABLE
AS $function$
  SELECT jsonb_build_object(
    'average', (SELECT round(avg(rating)::numeric, 1) FROM public.case_reviews
                WHERE case_reviews.author_account_id = _account_id AND direction = 'tutor_to_parent' AND status = 'visible'),
    'count', (SELECT count(*) FROM public.case_reviews
              WHERE case_reviews.author_account_id = _account_id AND direction = 'tutor_to_parent' AND status = 'visible')
  );
$function$;

-- ---------------------------------------------------------------------------
-- Lock down: RLS deny + grants only for service role (Supabase default table
-- privileges grant ALL to anon/authenticated — explicitly revoke).
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organisation_members', 'case_lessons', 'case_fees', 'case_audit',
    'case_events', 'event_deliveries', 'entitlements', 'tutor_plus_interest',
    'case_reviews'
  ] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Mutating RPC is service-role only.
REVOKE ALL ON FUNCTION public.admin_create_sor_case(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_sor_case(jsonb) TO service_role;

-- Summary RPCs are read-only summaries of held/moderated data: anon+authenticated may call them.
GRANT EXECUTE ON FUNCTION public.get_tutor_review_summary(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_parent_review_summary(uuid) TO anon, authenticated;

-- organizations.kind write path stays admin/service (existing org policies unchanged).
REVOKE ALL ON public.organisation_members FROM anon, authenticated;
