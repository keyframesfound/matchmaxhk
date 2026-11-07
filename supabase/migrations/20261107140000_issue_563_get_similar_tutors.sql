-- #563: bounded server-side similar tutors for the public profile. Returns ids
-- and a reason key only; cards load public columns through the normal RLS read.
CREATE OR REPLACE FUNCTION public.get_similar_tutors(
  seed_tutor_id uuid,
  active_filters jsonb DEFAULT '{}'::jsonb,
  limit_count integer DEFAULT 3
)
RETURNS TABLE (id uuid, match_reason_key text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  curricula constant text[] := ARRAY['A-Level','AP','GCSE','HKDSE','IBDP','IGCSE','MYP'];
  seed public.tutors%ROWTYPE;
  target_subject text;
  seed_rate numeric;
  seed_curricula text[];
  f jsonb := COALESCE(active_filters, '{}'::jsonb);
  capped_limit integer := LEAST(GREATEST(COALESCE(limit_count, 3), 1), 12);
  relax_stage integer;
  filter_curriculum text;
  filter_max_rate numeric;
  filter_district text;
BEGIN
  SELECT * INTO seed FROM public.tutors t
  WHERE t.id = seed_tutor_id AND t.is_published = true;
  IF NOT FOUND THEN RETURN; END IF;

  target_subject := lower(trim(COALESCE(NULLIF(f->>'subject', ''), seed.subjects[1], '')));
  IF target_subject = '' THEN RETURN; END IF;

  seed_rate := NULLIF(COALESCE(seed.min_hourly_rate_hkd, seed.hourly_rate), 0);
  seed_curricula := ARRAY(SELECT unnest(seed.target_students) INTERSECT SELECT unnest(curricula));

  -- Scenario 6: on zero results relax district, then the rate cap (+15%), then
  -- curriculum. The subject is never relaxed and the +15% cap stays in place.
  FOR relax_stage IN 0..3 LOOP
    filter_district := CASE WHEN relax_stage < 1 THEN NULLIF(f->>'district', '') END;
    filter_max_rate := NULLIF(f->>'max_rate_hkd', '')::numeric
      * (CASE WHEN relax_stage < 2 THEN 1 ELSE 1.15 END);
    filter_curriculum := CASE WHEN relax_stage < 3 THEN NULLIF(f->>'curriculum', '') END;

    RETURN QUERY
    WITH pool AS (
      SELECT
        t.id AS tutor_id,
        t.tutor_code,
        t.lesson_mode::text AS lesson_mode,
        NULLIF(COALESCE(t.min_hourly_rate_hkd, t.hourly_rate), 0) AS rate,
        (cardinality(seed_curricula) > 0 AND t.target_students && seed_curricula) AS same_curriculum,
        (
          (CASE WHEN t.target_students && seed_curricula THEN 30 ELSE 0 END)
          + (CASE
               WHEN seed_rate IS NULL OR NULLIF(COALESCE(t.min_hourly_rate_hkd, t.hourly_rate), 0) IS NULL THEN 0
               WHEN abs(COALESCE(t.min_hourly_rate_hkd, t.hourly_rate) - seed_rate) <= seed_rate * 0.15 THEN 20
               WHEN abs(COALESCE(t.min_hourly_rate_hkd, t.hourly_rate) - seed_rate) <= seed_rate * 0.30 THEN 10
               ELSE 0 END)
          + (CASE WHEN t.lesson_mode::text = 'either' OR seed.lesson_mode::text = 'either'
                    OR t.lesson_mode::text = seed.lesson_mode::text THEN 10 ELSE 0 END)
          + (CASE WHEN t.stations && seed.stations OR t.district = seed.district THEN 10 ELSE 0 END)
          + (CASE WHEN cardinality(t.approved_grade_labels) > 0 THEN 15 ELSE 0 END)
          + (CASE WHEN t.updated_at > now() - interval '30 days' THEN 10 ELSE 0 END)
        ) AS score
      FROM public.tutors t
      WHERE t.id <> seed_tutor_id
        AND t.is_published = true
        AND COALESCE(t.card_hidden_by_ban, false) = false
        AND COALESCE(t.owner_account_status, 'active') = 'active'
        AND EXISTS (SELECT 1 FROM unnest(t.subjects) s WHERE lower(trim(s)) = target_subject)
        AND (filter_curriculum IS NULL OR filter_curriculum = ANY(t.target_students))
        AND (NULLIF(f->>'grade_level', '') IS NULL OR f->>'grade_level' = ANY(t.target_students))
        AND (filter_max_rate IS NULL OR COALESCE(t.min_hourly_rate_hkd, t.hourly_rate) <= filter_max_rate)
        AND (NULLIF(f->>'mode', '') IS NULL OR t.lesson_mode::text = 'either' OR t.lesson_mode::text = f->>'mode')
        AND (filter_district IS NULL OR filter_district = ANY(t.stations) OR t.district = filter_district)
        AND (NULLIF(f->>'strict_gender', '') IS NULL OR lower(t.gender) = lower(f->>'strict_gender'))
    ),
    ranked AS (
      SELECT p.*, row_number() OVER (ORDER BY p.score DESC, p.tutor_code) AS position FROM pool p
    ),
    -- Slot 3: same subject + curriculum, 15-30% cheaper or online. Unlabeled in
    -- the rail; only the card's reason badge differs.
    diversify AS (
      SELECT r.tutor_id FROM ranked r
      WHERE capped_limit >= 3 AND r.position > capped_limit - 1 AND r.same_curriculum
        AND (
          (seed_rate IS NOT NULL AND r.rate BETWEEN seed_rate * 0.70 AND seed_rate * 0.85)
          OR r.lesson_mode IN ('online', 'either')
        )
      ORDER BY r.position
      LIMIT 1
    ),
    picked AS (
      SELECT r.tutor_id, r.position, r.same_curriculum, false AS is_diversify
      FROM ranked r
      WHERE r.position <= capped_limit - (SELECT count(*) FROM diversify)
      UNION ALL
      SELECT r.tutor_id, r.position, r.same_curriculum, true
      FROM ranked r JOIN diversify d USING (tutor_id)
    )
    SELECT
      p.tutor_id,
      CASE
        WHEN p.is_diversify THEN 'value'
        WHEN p.same_curriculum THEN 'strict'
        ELSE 'subject'
      END
    FROM picked p
    ORDER BY p.is_diversify, p.position;

    IF FOUND THEN RETURN; END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_similar_tutors(uuid, jsonb, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_similar_tutors(uuid, jsonb, integer) TO anon, authenticated;
