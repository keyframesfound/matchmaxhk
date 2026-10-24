-- Issues #326 + #327 + #328 + #329 (epic #325): freestyle micro-services.
--
-- Freestyle listings are SERVICE products on the notes marketplace rails:
-- same listing lifecycle (draft -> pending_review -> published/rejected/hidden,
-- same RLS public gate), same manual-cashier order table (FPS reference,
-- screenshot proof, 20%/80% money split), but fulfillment is human work by
-- delivery type instead of instant code. #316 (reshaped): document_review
-- publishes as a Buy Now flat-fee gig sold by a Verified tutor.
--
-- Design rules honoured here:
--   - digital_materials stays the ONE listing table: material_type gains
--     'gig' and gig-specific columns are nullable and physically forbidden
--     on non-gig rows (coherence CHECK below).
--   - material_orders gains the #328 fulfillment states. 'paid' stays a
--     notes-only transient; a gig order goes straight to 'in_fulfillment'
--     when staff mark the FPS payment (paid_at + due date recorded).
--   - The #328 ghosting fail-safe is a lazy sweep: a SECURITY DEFINER
--     function flips in_fulfillment gig orders past their turnaround +
--     24h grace to 'past_due'. Server fns call it on read paths; there is
--     no cron dependency.
--   - #329 bought counts: sold/bought = completed (delivered) orders only.
--     get_public_gigs() is the anon-safe RPC (material_orders is not
--     anon-readable), mirroring get_home_notes().
--   - #328 hidden strike: tutor_ghost_strikes is staff-SELECT-only; the
--     count never touches the anon-readable tutors table.

-- ---------------------------------------------------------------------------
-- digital_materials: gig listing fields (#326)
-- ---------------------------------------------------------------------------
ALTER TABLE public.digital_materials
  ADD COLUMN IF NOT EXISTS gig_category TEXT
    CHECK (gig_category IN ('document_review', 'speaking_mock', 'workshop_package', 'other')),
  ADD COLUMN IF NOT EXISTS gig_delivery_type TEXT
    CHECK (gig_delivery_type IN ('file_back', 'session_confirm', 'package_handoff')),
  -- Display string ("48 hours", "1 session"), 40 chars, app-enforced.
  ADD COLUMN IF NOT EXISTS turnaround_note TEXT,
  -- Machine-readable clock for the #328 fail-safe. Presets in the form;
  -- NULL means the 48-hour default applies. Free text alone cannot drive
  -- a deadline, so the two fields ride together.
  ADD COLUMN IF NOT EXISTS turnaround_hours INTEGER
    CHECK (turnaround_hours IS NULL OR (turnaround_hours BETWEEN 1 AND 336)),
  -- Public cover image (materials-previews bucket). Staff-reviewed for
  -- QR codes / contact details at listing review.
  ADD COLUMN IF NOT EXISTS cover_image_path TEXT,
  -- #326/#316: document_review integrity checkbox timestamp (set at
  -- submit; staff can still reject with an integrity reason).
  ADD COLUMN IF NOT EXISTS integrity_confirmed_at TIMESTAMPTZ;

-- Gigs join the listing kind family (#326: "same lifecycle as notes").
ALTER TABLE public.digital_materials
  DROP CONSTRAINT IF EXISTS digital_materials_material_type_check;
ALTER TABLE public.digital_materials
  ADD CONSTRAINT digital_materials_material_type_check
  CHECK (material_type IN ('notes', 'mock', 'exemplar', 'flashcards', 'gig'));

-- document_type is NOT NULL with a legacy CHECK; gig rows carry 'gig'.
ALTER TABLE public.digital_materials
  DROP CONSTRAINT IF EXISTS digital_materials_document_type_check;
ALTER TABLE public.digital_materials
  ADD CONSTRAINT digital_materials_document_type_check
  CHECK (document_type IN ('custom_notes', 'ia', 'ee', 'tok_essay', 'mock_exam', 'gig'));

-- Gigs have NO listing-level source file (file_back returns ride the order,
-- session/package gigs carry no file at all) and no watermarked preview.
ALTER TABLE public.digital_materials ALTER COLUMN original_file_path DROP NOT NULL;

-- Coherence: non-gig rows must never carry gig fields. Gig rows MAY have
-- NULL fields while in draft (partial saves mirror the notes drafts);
-- submit-time completeness is app-enforced by validateGigForSubmit.
ALTER TABLE public.digital_materials
  DROP CONSTRAINT IF EXISTS digital_materials_gig_fields_coherent;
ALTER TABLE public.digital_materials
  ADD CONSTRAINT digital_materials_gig_fields_coherent
  CHECK (
    material_type = 'gig'
    OR (
      gig_category IS NULL
      AND gig_delivery_type IS NULL
      AND turnaround_note IS NULL
      AND turnaround_hours IS NULL
      AND cover_image_path IS NULL
      AND integrity_confirmed_at IS NULL
      AND document_type <> 'gig'
    )
  );

CREATE INDEX IF NOT EXISTS idx_digital_materials_gig_public
  ON public.digital_materials (status, gig_category, created_at DESC)
  WHERE material_type = 'gig';

-- ---------------------------------------------------------------------------
-- material_orders: #328 fulfillment states + service delivery columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.material_orders
  ADD COLUMN IF NOT EXISTS in_fulfillment_at TIMESTAMPTZ,
  -- paid_at + listing turnaround (or 48h default). The +24h grace is
  -- applied by the sweep comparison, not stored.
  ADD COLUMN IF NOT EXISTS fulfillment_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS past_due_at TIMESTAMPTZ,
  -- file_back: the buyer's one source file (private bucket, service role).
  ADD COLUMN IF NOT EXISTS buyer_source_path TEXT,
  -- session_confirm / package_handoff: tutor's short completion note
  -- (<=300 chars, contact-filtered in the server fn).
  ADD COLUMN IF NOT EXISTS completion_note TEXT,
  -- Parent's past_due Request Refund timestamp (staff desk shows it).
  ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMPTZ;

ALTER TABLE public.material_orders
  DROP CONSTRAINT IF EXISTS material_orders_status_check;
ALTER TABLE public.material_orders
  ADD CONSTRAINT material_orders_status_check
  CHECK (status IN (
    'awaiting_payment', 'paid', 'stamping',
    'in_fulfillment', 'past_due',
    'delivered', 'stamp_failed', 'rejected', 'refunded'
  ));

-- The tutor's returned file reuses delivered_file_path (signed to the
-- buyer off delivered status, exactly like notes). Buyer-side check:
-- completion/return fields only make sense on gig orders.
ALTER TABLE public.material_orders
  DROP CONSTRAINT IF EXISTS material_orders_gig_fulfillment_coherent;
ALTER TABLE public.material_orders
  ADD CONSTRAINT material_orders_gig_fulfillment_coherent
  CHECK (
    (past_due_at IS NULL OR status IN ('past_due', 'refunded', 'delivered'))
    AND (refund_requested_at IS NULL OR status IN ('past_due', 'refunded', 'delivered'))
  );

CREATE INDEX IF NOT EXISTS idx_material_orders_fulfillment_sweep
  ON public.material_orders (fulfillment_due_at)
  WHERE status = 'in_fulfillment';

-- ---------------------------------------------------------------------------
-- #328 ghosting fail-safe: lazy sweep to past_due
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sweep_past_due_gig_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  flipped integer;
BEGIN
  UPDATE public.material_orders mo
  SET status = 'past_due',
      past_due_at = now()
  WHERE mo.status = 'in_fulfillment'
    AND mo.fulfillment_due_at IS NOT NULL
    AND mo.fulfillment_due_at + interval '24 hours' <= now()
    AND EXISTS (
      SELECT 1 FROM public.digital_materials dm
      WHERE dm.id = mo.material_id AND dm.material_type = 'gig'
    );
  GET DIAGNOSTICS flipped = ROW_COUNT;
  RETURN flipped;
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_past_due_gig_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_past_due_gig_orders() TO service_role;

-- ---------------------------------------------------------------------------
-- #328 hidden strike (staff/ops visibility only — never on the public card)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tutor_ghost_strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,
  -- One strike per refunded past-due order, enforced physically.
  order_id UUID NOT NULL UNIQUE REFERENCES public.material_orders(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_ghost_strikes_tutor
  ON public.tutor_ghost_strikes (tutor_id, created_at DESC);

ALTER TABLE public.tutor_ghost_strikes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read tutor ghost strikes"
  ON public.tutor_ghost_strikes
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Writes go through service-role server fns only; no INSERT/UPDATE/DELETE
-- policies on purpose.

GRANT SELECT ON public.tutor_ghost_strikes TO authenticated;

-- ---------------------------------------------------------------------------
-- #329 discovery: anon-safe public gigs RPC (bought = delivered orders only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_gigs(
  p_category text DEFAULT NULL,
  p_limit integer DEFAULT NULL
)
RETURNS TABLE (
  id                 uuid,
  title              text,
  slug               text,
  description        text,
  price_hkd          numeric,
  gig_category       text,
  gig_delivery_type  text,
  turnaround_note    text,
  cover_image_path   text,
  curriculum_tag     text,
  subject_tag        text,
  tutor_code         text,
  tutor_display_name text,
  verification_tier  text,
  bought_count       bigint,
  created_at         timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
    SELECT
      dm.id,
      dm.title,
      dm.slug,
      dm.description,
      dm.price_hkd,
      dm.gig_category,
      dm.gig_delivery_type,
      dm.turnaround_note,
      dm.cover_image_path,
      dm.curriculum_tag,
      dm.subject_tag,
      t.tutor_code,
      t.display_name AS tutor_display_name,
      t.verification_tier,
      (
        SELECT count(*)
        FROM public.material_orders mo
        WHERE mo.material_id = dm.id
          AND mo.status = 'delivered'
      ) AS bought_count,
      dm.created_at
    FROM public.digital_materials dm
    JOIN public.tutors t
      ON t.id = dm.tutor_id
     AND t.is_published = true
    WHERE dm.status = 'published'
      AND dm.material_type = 'gig'
      AND (p_category IS NULL OR dm.gig_category = p_category)
    ORDER BY bought_count DESC, dm.created_at DESC
    LIMIT CASE WHEN p_limit IS NULL THEN NULL ELSE p_limit END;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_gigs(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_gigs(text, integer) TO anon, authenticated;
