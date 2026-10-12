-- Issues #203 + P8 (#288) + P9 (#289) + P13 (#293) + P14-notes (#294):
-- the notes marketplace lifecycle — listing status machine, slugs, counters,
-- the manual-cashier checkout columns, and the per-account view log.
--
-- Transaction model (Ryan, 2026-10-11, unchanged from #131-#134): MatchMax is
-- the seller of record; the parent pays MatchMax by FPS and staff are the
-- cashier (mark paid -> release -> delivered). The WhatsApp handoff stays as
-- the *notification* channel: checkout gives the parent an order reference and
-- a prefilled WhatsApp message stating what they are buying. Money never
-- flows tutor-direct for marketplace packs.
--
-- Live-table notes (verified 2026-10-11 before writing):
--   digital_materials has 0 rows, so every backfill below is a no-op kept
--   only for already-migrated environments.

-- ---------------------------------------------------------------------------
-- digital_materials: lifecycle columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.digital_materials
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT
    NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'published', 'hidden', 'rejected')),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sold_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preview_pages INTEGER,
  -- P9 (#289): a replaced PDF waits for staff approval in a staging path.
  -- NULL edit_status = no pending edit. The live original stays on sale
  -- until staff approve the swap.
  ADD COLUMN IF NOT EXISTS pending_original_file_path TEXT,
  ADD COLUMN IF NOT EXISTS edit_status TEXT
    CHECK (edit_status IN ('pending_review', 'rejected')),
  ADD COLUMN IF NOT EXISTS edit_rejection_reason TEXT;

-- One-time backfill (no-op on the empty live table; kept idempotent).
UPDATE public.digital_materials
SET status = CASE WHEN is_published THEN 'published' ELSE 'draft' END
WHERE status = 'draft' AND is_published;

CREATE UNIQUE INDEX IF NOT EXISTS idx_digital_materials_slug
  ON public.digital_materials (slug) WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_digital_materials_status
  ON public.digital_materials (status, created_at DESC);

-- #303 purge follow-through: the dangerous doc type must not be insertable
-- even by hand. (Live table empty; zod enum was already tightened in #303.)
ALTER TABLE public.digital_materials DROP CONSTRAINT IF EXISTS digital_materials_document_type_check;
ALTER TABLE public.digital_materials
  ADD CONSTRAINT digital_materials_document_type_check
  CHECK (document_type IN ('custom_notes', 'ia', 'ee', 'tok_essay', 'mock_exam'));

-- Reads/RLS move from is_published to status.
DROP POLICY IF EXISTS "Public can read published digital materials" ON public.digital_materials;
CREATE POLICY "Public can read published digital materials"
  ON public.digital_materials
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.tutors t
      WHERE t.id = digital_materials.tutor_id AND t.is_published = true
    )
  );

ALTER TABLE public.digital_materials DROP COLUMN IF EXISTS is_published;

-- ---------------------------------------------------------------------------
-- material_orders: manual-cashier + delivery columns (#203)
-- ---------------------------------------------------------------------------
ALTER TABLE public.material_orders
  -- Short order reference the parent quotes on the WhatsApp handoff and
  -- staff match against the FPS memo. App-generated, unique.
  ADD COLUMN IF NOT EXISTS reference TEXT,
  -- The one optional proof screenshot (<=5MB) the parent may attach.
  ADD COLUMN IF NOT EXISTS payment_screenshot_path TEXT,
  -- The stamped per-order copy in the private bucket (order id + buyer id
  -- footer). Signed only off this file, never the clean original.
  ADD COLUMN IF NOT EXISTS delivered_file_path TEXT,
  ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMPTZ,
  -- Which staff member marked the FPS payment as received (#203 marked_by).
  ADD COLUMN IF NOT EXISTS marked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_material_orders_reference
  ON public.material_orders (reference) WHERE reference IS NOT NULL;

-- ---------------------------------------------------------------------------
-- material_views (#203): view log unique on (listing, account, day).
-- Owner views and logged-out visits never increment view_count — enforced in
-- the recordMaterialView server fn, mirrored by tests.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.material_views (
  material_id UUID NOT NULL REFERENCES public.digital_materials(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  view_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Hong_Kong')::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT material_views_unique UNIQUE (material_id, account_id, view_date)
);

-- #203 owner stats: sold_count increments exactly once per release, from the
-- service-role release path only.
CREATE OR REPLACE FUNCTION public.increment_material_sold_count(p_material_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.digital_materials SET sold_count = sold_count + 1 WHERE id = p_material_id;
$$;

REVOKE ALL ON FUNCTION public.increment_material_sold_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_material_sold_count(uuid) TO service_role;

ALTER TABLE public.material_views ENABLE ROW LEVEL SECURITY;

-- Read access is never needed by clients (the count lives on the listing row);
-- writes go through the service-role server fn only.
GRANT SELECT ON public.material_views TO authenticated;

-- ---------------------------------------------------------------------------
-- orders-screenshots bucket: private, service-role only (same pattern as
-- materials-originals). Parents upload through the server fn, never directly.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('orders-screenshots', 'orders-screenshots', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Service role manages order screenshots"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'orders-screenshots')
  WITH CHECK (bucket_id = 'orders-screenshots');
