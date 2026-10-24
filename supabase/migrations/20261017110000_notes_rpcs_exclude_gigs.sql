-- Grok review 2026-10-17 on PR #373 (freestyle gigs, #326–#329):
-- discovery contamination. get_home_notes / get_tutor_public_notes
-- (migration 20261015140000) predate material_type='gig' and select every
-- published row, so once any gig is published it would surface as a NOTE
-- card on the home Notes row and the tutor 'Authored notes' block (wrong
-- chrome, distorts the >=3 notes cold start). Gigs render ONLY through
-- get_public_gigs + the Tutor services surfaces.
--
-- Recreates both RPCs with AND dm.material_type <> 'gig' (the notes kinds
-- notes/mock/exemplar/flashcards keep flowing through). Same signature and
-- grants as before, so callers need no change.

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
      AND dm.material_type <> 'gig'
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
      AND dm.material_type <> 'gig'
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

COMMENT ON FUNCTION public.get_home_notes(int) IS
  'Issue #312: public notes row for the home page. SECURITY DEFINER because bought_count counts material_orders, which is not anon-readable (RLS). Exposes only published notes of published tutors — gigs (material_type gig) excluded, they belong to get_public_gigs; bought_count = delivered orders only.';
