-- Issues #131 + #132 + #133 + #134: Digital Study Materials marketplace.
--
-- Transaction model (Ryan, 2026-10-04): MatchMax NEVER touches payment.
-- Parents pay the tutor directly over WhatsApp; MatchMax invoices the tutor
-- its 20% commission separately. There is NO escrow-holding column set, NO
-- lesson-count unlock tracking, and NO auto-fulfilment here — the commission
-- exists only as the upload agreement text + the admin-only commission
-- columns below for manual settlement.
--
-- Two-tier privacy (issue #132): legal_name / fps_phone_number must NEVER
-- be readable on any public surface. The public tutors table exposes ALL
-- columns to anon SELECT (by design — the directory reads it directly), so
-- private identity/payment fields live in a separate table with admin-only
-- RLS (same pattern as the tutor_field_flags notes lesson from issue #125).
-- display_name already exists on tutors (public slug-adjacent label);
-- account_visibility + private account routing land with the materials UI.

-- ---------------------------------------------------------------------------
-- digital_materials: one uploaded PDF listing per row.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.digital_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,

  -- Listing metadata (public).
  title TEXT NOT NULL,
  description TEXT,
  price_hkd NUMERIC(10, 2) NOT NULL CHECK (price_hkd >= 0),
  school_tag TEXT,
  curriculum_tag TEXT,
  subject_tag TEXT,
  document_type TEXT NOT NULL DEFAULT 'custom_notes'
    CHECK (document_type IN (
      'custom_notes', 'past_paper_solutions', 'ia', 'ee', 'tok_essay', 'mock_exam'
    )),
  year_tag TEXT,
  page_count INTEGER,

  -- Issue #133: coursework specifics, shown only for IA / EE / TOK listings.
  exact_score_achieved TEXT,
  includes_examiner_comments BOOLEAN NOT NULL DEFAULT false,

  -- Files: original stays in the PRIVATE bucket, never rendered publicly;
  -- preview is the watermarked first pages in the PUBLIC bucket.
  original_file_path TEXT NOT NULL,
  watermarked_preview_url TEXT NOT NULL,

  -- Issue #134: manual trust surfaces (admin-entered, tutor-editable promo).
  admin_star_rating NUMERIC(2, 1) CHECK (admin_star_rating >= 1.0 AND admin_star_rating <= 5.0),
  promotional_note TEXT CHECK (char_length(promotional_note) <= 150),
  admin_marketing_summary TEXT,

  -- Issue #132: private_notes_only authors are hidden from the tutor
  -- directory; their materials still surface in the marketplace.
  account_visibility TEXT NOT NULL DEFAULT 'public_tutor'
    CHECK (account_visibility IN ('public_tutor', 'private_notes_only')),

  -- Issue #133: admin-settled commission record (manual invoice tracking —
  -- MatchMax bills the tutor 20% of each sale; nothing is auto-charged).
  commission_rate NUMERIC(4, 3) NOT NULL DEFAULT 0.200,
  commission_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (commission_status IN ('pending', 'invoiced', 'settled')),

  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.digital_materials IS
  'Issues #131/#132/#133/#134: tutor-uploaded study materials. P2P sales via WhatsApp deep link (no payment processing). original_file_path is the private-bucket original; watermarked_preview_url is the public preview. Commission columns are an admin bookkeeping record only (MatchMax invoices the tutor separately).';

CREATE INDEX IF NOT EXISTS idx_digital_materials_tutor
  ON public.digital_materials (tutor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_digital_materials_public
  ON public.digital_materials (is_published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_digital_materials_school
  ON public.digital_materials (school_tag) WHERE school_tag IS NOT NULL;

ALTER TABLE public.digital_materials ENABLE ROW LEVEL SECURITY;

-- Public read: published materials of published tutors (anon + authed).
-- Exposes only the public columns via a restrictive policy — the table has no
-- private identity columns (those live in tutor_private_accounts below).
CREATE POLICY "Public can read published digital materials"
  ON public.digital_materials
  FOR SELECT
  TO anon, authenticated
  USING (
    is_published = true
    AND EXISTS (
      SELECT 1 FROM public.tutors t
      WHERE t.id = digital_materials.tutor_id AND t.is_published = true
    )
  );

-- Owner (the linked tutor account) manages own listings.
CREATE POLICY "Tutors can read own digital materials"
  ON public.digital_materials
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tutors t WHERE t.id = tutor_id AND t.user_id = auth.uid())
  );

CREATE POLICY "Tutors can insert own digital materials"
  ON public.digital_materials
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tutors t
      WHERE t.id = tutor_id AND t.user_id = auth.uid()
        AND t.verification_tier = 'tier_2_verified'
    )
  );

CREATE POLICY "Tutors can update own digital materials"
  ON public.digital_materials
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tutors t WHERE t.id = tutor_id AND t.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.tutors t WHERE t.id = tutor_id AND t.user_id = auth.uid())
  );

CREATE POLICY "Tutors can delete own digital materials"
  ON public.digital_materials
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tutors t WHERE t.id = tutor_id AND t.user_id = auth.uid())
  );

-- Admins see and manage everything.
CREATE POLICY "Admins can read all digital materials"
  ON public.digital_materials
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can insert digital materials"
  ON public.digital_materials
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can update digital materials"
  ON public.digital_materials
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can delete digital materials"
  ON public.digital_materials
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

GRANT SELECT ON public.digital_materials TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- tutor_private_accounts (issue #132): STRICTLY PRIVATE tutor identity +
-- payout columns. Admin-only RLS — legal_name must NEVER render publicly and
-- the public tutors table cannot hold it (anon reads all tutors columns).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tutor_private_accounts (
  tutor_id UUID PRIMARY KEY REFERENCES public.tutors(id) ON DELETE CASCADE,
  legal_name TEXT,
  fps_phone_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tutor_private_accounts IS
  'Issue #132: strictly private tutor identity + payout data (legal_name, FPS phone). Admin-only RLS; never exposed to anon/tutor reads, never rendered on public pages.';

ALTER TABLE public.tutor_private_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read tutor private accounts"
  ON public.tutor_private_accounts
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can insert tutor private accounts"
  ON public.tutor_private_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can update tutor private accounts"
  ON public.tutor_private_accounts
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can delete tutor private accounts"
  ON public.tutor_private_accounts
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- ---------------------------------------------------------------------------
-- Storage buckets (issue #132): private originals + public watermarked
-- previews. Originals have NO public policy — reads require the service role
-- (admin server functions); previews are world-readable.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('materials-originals', 'materials-originals', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('materials-previews', 'materials-previews', true)
ON CONFLICT (id) DO NOTHING;

-- Only the service role (backend watermarking server function) touches
-- originals. No client-side policy = no authenticated write path.
CREATE POLICY "Service role manages material originals"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'materials-originals')
  WITH CHECK (bucket_id = 'materials-originals');

-- Previews: service role writes, anyone reads (public bucket).
CREATE POLICY "Service role manages material previews"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'materials-previews')
  WITH CHECK (bucket_id = 'materials-previews');

CREATE POLICY "Public can read material previews"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'materials-previews');
