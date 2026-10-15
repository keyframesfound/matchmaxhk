-- Issue #312: 'Notes row on the home page'.
--
-- The home page is PUBLIC (anon), but material_orders is NOT anon-readable
-- (RLS: buyers see their own rows, tutors their own materials, admins all).
-- Bought counts therefore have to be computed inside the database by a
-- SECURITY DEFINER function that only exposes aggregates over already-public
-- rows: digital_materials.status='published' joined to tutors.is_published.
-- No buyer identity, no file links, no contact details ever leave the
-- function — just a per-material delivered-order count.
--
-- Shape note: suspended/banned tutors are handled by is_published=false
-- (unpublishing is how the tutor is taken off the public site), so the
-- tutors.is_published join is the single visibility gate.

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

-- Per-tutor variant for the 'Authored notes' block on the public tutor
-- profile: same row shape, one tutor, still only published notes of a
-- published tutor (an unpublished/suspended/banned tutor's profile is
-- unreachable, but the filter is repeated so the RPC can never leak).
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

-- The home page and tutor profiles call these as anon; authenticated users
-- get them too so the row works identically after sign-in.
GRANT EXECUTE ON FUNCTION public.get_home_notes(int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_tutor_public_notes(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_home_notes(int) IS
  'Issue #312: public notes row for the home page. SECURITY DEFINER because bought_count counts material_orders, which is not anon-readable (RLS). Exposes only published notes of published tutors; bought_count = delivered orders only (pending/refunded never count).';

COMMENT ON FUNCTION public.get_tutor_public_notes(text) IS
  'Issue #312: published notes of one tutor (by tutor_code) for the Authored notes block on the public profile. Same visibility rules and bought_count semantics as get_home_notes.';
