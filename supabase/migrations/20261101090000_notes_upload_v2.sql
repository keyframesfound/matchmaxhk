-- Notes upload v2: AI-assisted listing details, finer categories, seller-picked
-- previews, multi-format deliverables, buyer reviews and saved notes.
--
-- Additive only. Nothing here alters or drops an existing column, policy or
-- table; every statement is idempotent so a re-run is a no-op. Workers Builds
-- never applies migrations, so apply this by hand (Supabase SQL editor or
-- MCP) BEFORE deploying the notes-upload-v2 UI. The public shop and note page
-- fall back to the old column list when these columns are missing, but the
-- upload form needs them.

-- ---------------------------------------------------------------------------
-- 1. digital_materials: new listing columns (notes kinds only use them).
-- ---------------------------------------------------------------------------
ALTER TABLE public.digital_materials
  -- One-line "what is this" summary (Carousell-style subtitle), AI-suggested.
  ADD COLUMN IF NOT EXISTS summary TEXT,
  -- Finer category inside the curriculum: ia, ee, tok, paper_1, sba, ...
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  -- Extra search keywords (AI-suggested, seller-editable), any language.
  ADD COLUMN IF NOT EXISTS search_tags TEXT[] NOT NULL DEFAULT '{}',
  -- Language of the document itself: en, zh-Hant, zh-Hans, mixed.
  ADD COLUMN IF NOT EXISTS content_language TEXT,
  -- Zero-based page indices of the main PDF the seller picked for the
  -- public watermarked preview. NULL = the default first ~30% (cap 12).
  ADD COLUMN IF NOT EXISTS preview_page_indices INTEGER[],
  -- What the seller originally uploaded: pdf, images, docx, pptx, zip,
  -- video, link... Informational only (the buyer-facing format list).
  ADD COLUMN IF NOT EXISTS source_formats TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.digital_materials
  DROP CONSTRAINT IF EXISTS digital_materials_summary_len_check;
ALTER TABLE public.digital_materials
  ADD CONSTRAINT digital_materials_summary_len_check
  CHECK (summary IS NULL OR char_length(summary) <= 280);

ALTER TABLE public.digital_materials
  DROP CONSTRAINT IF EXISTS digital_materials_subcategory_len_check;
ALTER TABLE public.digital_materials
  ADD CONSTRAINT digital_materials_subcategory_len_check
  CHECK (subcategory IS NULL OR char_length(subcategory) <= 40);

ALTER TABLE public.digital_materials
  DROP CONSTRAINT IF EXISTS digital_materials_content_language_check;
ALTER TABLE public.digital_materials
  ADD CONSTRAINT digital_materials_content_language_check
  CHECK (content_language IS NULL OR content_language IN ('en', 'zh-Hant', 'zh-Hans', 'mixed'));

ALTER TABLE public.digital_materials
  DROP CONSTRAINT IF EXISTS digital_materials_search_tags_len_check;
ALTER TABLE public.digital_materials
  ADD CONSTRAINT digital_materials_search_tags_len_check
  CHECK (cardinality(search_tags) <= 20);

CREATE INDEX IF NOT EXISTS idx_digital_materials_subcategory
  ON public.digital_materials (curriculum_tag, subcategory)
  WHERE subcategory IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. material_files: extra deliverables (Word / PPT / ZIP / video / images)
--    and external links (Google Drive, Docs, Dropbox, OneDrive) attached to
--    a note. Delivered to buyers after purchase only, through short-lived
--    signed URLs minted by a server function. SERVICE ROLE ONLY: RLS is on
--    with no client policy, so neither anon nor authenticated can read paths
--    or links directly.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.material_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.digital_materials(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('file', 'link')),
  -- kind = 'file': object path inside the private materials-extras bucket.
  storage_path TEXT,
  -- kind = 'link': the https URL the seller pasted.
  url TEXT,
  file_name TEXT,
  label TEXT CHECK (label IS NULL OR char_length(label) <= 120),
  mime_type TEXT,
  size_bytes BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0),
  format TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT material_files_kind_payload CHECK (
    (kind = 'file' AND storage_path IS NOT NULL AND url IS NULL)
    OR (kind = 'link' AND url IS NOT NULL AND storage_path IS NULL)
  )
);

COMMENT ON TABLE public.material_files IS
  'Notes upload v2: extra deliverable files and links per note. Service-role only (RLS on, no client policies); buyers get signed URLs after purchase via a server function.';

CREATE INDEX IF NOT EXISTS idx_material_files_material
  ON public.material_files (material_id, position);

ALTER TABLE public.material_files ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. material_reviews: one rating (+ optional comment) per buyer per note.
--    Writes go through a server function that checks the buyer holds an
--    access-granting order; clients can only read reviews of published
--    notes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.material_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.digital_materials(id) ON DELETE CASCADE,
  buyer_account_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.material_orders(id) ON DELETE SET NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 2000),
  reviewer_label TEXT CHECK (reviewer_label IS NULL OR char_length(reviewer_label) <= 60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT material_reviews_one_per_buyer UNIQUE (material_id, buyer_account_id)
);

COMMENT ON TABLE public.material_reviews IS
  'Notes upload v2: verified-buyer ratings and comments. One per buyer per note; inserted only by the service-role server function after an access-granting order check.';

CREATE INDEX IF NOT EXISTS idx_material_reviews_material
  ON public.material_reviews (material_id, created_at DESC);

ALTER TABLE public.material_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read reviews of published notes" ON public.material_reviews;
CREATE POLICY "Public can read reviews of published notes"
  ON public.material_reviews
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.digital_materials m
      WHERE m.id = material_reviews.material_id AND m.status = 'published'
    )
  );

GRANT SELECT ON public.material_reviews TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. saved_materials: a signed-in account's saved notes (Taobao-style heart).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_materials (
  account_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.digital_materials(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, material_id)
);

COMMENT ON TABLE public.saved_materials IS
  'Notes upload v2: notes an account saved for later. Owner-only RLS.';

CREATE INDEX IF NOT EXISTS idx_saved_materials_account
  ON public.saved_materials (account_id, created_at DESC);

ALTER TABLE public.saved_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_materials owner select" ON public.saved_materials;
CREATE POLICY "saved_materials owner select"
  ON public.saved_materials FOR SELECT TO authenticated
  USING (account_id = auth.uid());

DROP POLICY IF EXISTS "saved_materials owner insert" ON public.saved_materials;
CREATE POLICY "saved_materials owner insert"
  ON public.saved_materials FOR INSERT TO authenticated
  WITH CHECK (account_id = auth.uid());

DROP POLICY IF EXISTS "saved_materials owner delete" ON public.saved_materials;
CREATE POLICY "saved_materials owner delete"
  ON public.saved_materials FOR DELETE TO authenticated
  USING (account_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.saved_materials TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. materials-extras bucket: private, service-role only (same pattern as
--    materials-originals). Browsers upload through signed upload URLs that a
--    server function mints for the note's owner; reads are signed URLs for
--    buyers. The 2 GB per-object limit also needs the project-wide storage
--    upload limit raised in the Supabase dashboard (Storage > Settings).
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('materials-extras', 'materials-extras', false, 2147483648)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Service role manages material extras" ON storage.objects;
CREATE POLICY "Service role manages material extras"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'materials-extras')
  WITH CHECK (bucket_id = 'materials-extras');
