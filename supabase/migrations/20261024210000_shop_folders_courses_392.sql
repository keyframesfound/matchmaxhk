-- Issue #392 (urgent sweep 2026-10-24): Topic Folders, Video & General Courses.
--
-- digital_materials stays the ONE listing table (gig precedent): three new
-- material_type kinds, covers now allowed on every kind, and child tables for
-- folder contents and course modules. Video lessons are unlisted YouTube /
-- Vimeo embeds ONLY — no self-serve MP4 upload path exists or is added
-- (CEO hosting pivot 2026-10-21: bandwidth stays off MatchMax).
--
-- Folder purchase model: the folder is a normal listing row (price_hkd = bulk
-- price) on the existing manual-cashier rail. Unlocking children reuses the
-- #250 grant shape — delivered is_grant rows at HK$0 per child, inserted when
-- the folder order is delivered (or immediately when proration reaches $0).

-- ---------------------------------------------------------------------------
-- Listing kinds
-- ---------------------------------------------------------------------------
ALTER TABLE public.digital_materials
  DROP CONSTRAINT IF EXISTS digital_materials_material_type_check;
ALTER TABLE public.digital_materials
  ADD CONSTRAINT digital_materials_material_type_check
  CHECK (material_type IN (
    'notes', 'mock', 'exemplar', 'flashcards', 'gig',
    'topic_folder', 'video_course', 'general_course'
  ));

-- document_type is NOT NULL: folder/course rows carry 'folder' / 'course'.
ALTER TABLE public.digital_materials
  DROP CONSTRAINT IF EXISTS digital_materials_document_type_check;
ALTER TABLE public.digital_materials
  ADD CONSTRAINT digital_materials_document_type_check
  CHECK (document_type IN (
    'custom_notes', 'ia', 'ee', 'tok_essay', 'mock_exam', 'gig',
    'course', 'folder'
  ));

-- Covers: every kind may carry one now (big-cover card UI). The gig coherence
-- CHECK is rewritten so cover_image_path leaves the gig-only field list.
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
      AND integrity_confirmed_at IS NULL
      AND document_type <> 'gig'
    )
  );

COMMENT ON COLUMN public.digital_materials.cover_image_path IS
  '#392: public cover (materials-previews bucket), allowed on every listing kind. Staff-reviewed for QR/contact at listing review; contact filter covers copy.';

-- ---------------------------------------------------------------------------
-- course_lessons: video_course / general_course modules (1–10, app-enforced
-- count at submit). Videos are reviewed unlisted YouTube/Vimeo links parsed
-- app-side (Drive/Loom/other hosts rejected); no video file ingest exists.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.course_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.digital_materials(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position BETWEEN 1 AND 10),
  title text NOT NULL CHECK (char_length(title) <= 120),
  video_url text,
  video_provider text CHECK (video_provider IN ('youtube', 'vimeo')),
  -- Watermarked module PDF (general_course worksheets), private bucket;
  -- signed only to buyers holding a delivered order.
  pdf_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, position),
  CONSTRAINT course_lessons_video_pair CHECK (
    (video_url IS NULL) = (video_provider IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_course_lessons_material
  ON public.course_lessons (material_id, position);
COMMENT ON TABLE public.course_lessons IS
  '#392: video_course requires every lesson to carry a video (app-enforced at submit); general_course modules may be video and/or watermarked PDF. Embeds render only to buyers with a delivered order.';

-- ---------------------------------------------------------------------------
-- topic_folder_items: 2–20 children (app-enforced at submit). Children are
-- the tutor's own published non-folder listings.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.topic_folder_items (
  folder_id uuid NOT NULL REFERENCES public.digital_materials(id) ON DELETE CASCADE,
  child_material_id uuid NOT NULL REFERENCES public.digital_materials(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position BETWEEN 1 AND 20),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (folder_id, child_material_id),
  UNIQUE (folder_id, position),
  CONSTRAINT topic_folder_no_nesting CHECK (folder_id <> child_material_id)
);
CREATE INDEX IF NOT EXISTS idx_topic_folder_items_child
  ON public.topic_folder_items (child_material_id);
COMMENT ON TABLE public.topic_folder_items IS
  '#392: folder → children. Bulk discount lives on the folder row price_hkd; child unlock = delivered is_grant material_orders rows inserted at folder delivery. Upgrade proration: adjusted = max(bulk − sum paid children, 0), app-side.';

ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_lessons FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_lessons TO service_role;

ALTER TABLE public.topic_folder_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.topic_folder_items FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topic_folder_items TO service_role;

-- ---------------------------------------------------------------------------
-- Discovery leak fix: get_home_notes / get_tutor_public_notes (as re-emitted
-- by 20261017110000) exclude only material_type <> 'gig', so folders and
-- courses would surface as NOTE cards on the home Notes row and the tutor
-- 'Authored notes' block. Same shapes, signatures and grants; only the WHERE
-- clause widens. Folders/courses render ONLY through the shop directory and
-- their detail pages.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_home_notes(p_limit int DEFAULT 8)
RETURNS TABLE (
  id                 uuid,
  title              text,
  slug               text,
  price_hkd          numeric,
  material_type      text,
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
      dm.price_hkd,
      dm.material_type,
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
      AND dm.material_type NOT IN ('gig', 'topic_folder', 'video_course', 'general_course')
    ORDER BY
      (
        SELECT count(*)
        FROM public.material_orders mo
        WHERE mo.material_id = dm.id
          AND mo.status = 'delivered'
      ) DESC NULLS LAST,
      dm.created_at DESC
    LIMIT GREATEST(p_limit, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tutor_public_notes(p_tutor_code text)
RETURNS TABLE (
  id                 uuid,
  title              text,
  slug               text,
  price_hkd          numeric,
  material_type      text,
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
      dm.price_hkd,
      dm.material_type,
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
      AND dm.material_type NOT IN ('gig', 'topic_folder', 'video_course', 'general_course')
      AND t.tutor_code = p_tutor_code
    ORDER BY
      (
        SELECT count(*)
        FROM public.material_orders mo
        WHERE mo.material_id = dm.id
          AND mo.status = 'delivered'
      ) DESC NULLS LAST,
      dm.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_home_notes(int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_tutor_public_notes(text) TO anon, authenticated;
