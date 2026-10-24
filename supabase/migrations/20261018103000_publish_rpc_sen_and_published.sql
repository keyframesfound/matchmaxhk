-- Issue #358 items 1-2: SEN fields reach the card at go-live, and a reused
-- card reports its real publish state (part of the 2026-10-18 hardening
-- batch).
--
-- 1. buildTutorCardInsert mapped senEnabled/senCategories/senExperience, but
--    this RPC's INSERT column list is explicit and did not include the sen_*
--    columns — intake SEN answers never reached the public card. Added.
-- 2. Every reuse path returned { reused: true } without checking
--    tutors.is_published, so after staff unpublish a card, a same-email
--    resubmit still returned "success" and the app sent the "card is live"
--    email. Every reused return now carries `published` (COALESCE to true
--    for the theoretical NULL row); the caller skips the live email and the
--    success screen hides "View live card" when it is false. A reused card
--    is NEVER re-published automatically.
CREATE OR REPLACE FUNCTION public.publish_tutor_from_application(p_application_id uuid, p_card jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_referred_by uuid;
  v_linked uuid;
  v_existing_id uuid;
  v_existing_code text;
  v_existing_published boolean;
  v_tutor_id uuid;
  v_tutor_code text;
  v_max integer;
  v_constraint text;
BEGIN
  IF jsonb_typeof(p_card) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'tutor card payload must be an object' USING ERRCODE = '22023';
  END IF;

  SELECT
    lower(btrim(data->>'email')),
    referred_by,
    linked_tutor_id
  INTO v_email, v_referred_by, v_linked
  FROM public.tutor_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'application not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'application has no email' USING ERRCODE = '23502';
  END IF;

  -- Serialize every publish for this email. The primary key below is the
  -- backstop if two sessions still both try to insert.
  PERFORM pg_advisory_xact_lock(hashtext('mm-publish-email'), hashtext(v_email));

  IF v_linked IS NOT NULL THEN
    SELECT tutor_code, is_published
    INTO v_existing_code, v_existing_published
    FROM public.tutors
    WHERE id = v_linked;
    IF v_existing_code IS NOT NULL THEN
      INSERT INTO public.tutor_live_card_emails (email, tutor_id)
      VALUES (v_email, v_linked)
      ON CONFLICT (email) DO NOTHING;
      RETURN jsonb_build_object(
        'tutor_id', v_linked,
        'tutor_code', v_existing_code,
        'reused', true,
        'published', COALESCE(v_existing_published, true)
      );
    END IF;
  END IF;

  SELECT t.id, t.tutor_code, t.is_published
  INTO v_existing_id, v_existing_code, v_existing_published
  FROM public.tutor_live_card_emails e
  JOIN public.tutors t ON t.id = e.tutor_id
  WHERE e.email = v_email;

  IF v_existing_id IS NULL THEN
    -- Any status. A pending/rejected row that already points at a card is
    -- still that tutor's one live card.
    SELECT t.id, t.tutor_code, t.is_published
    INTO v_existing_id, v_existing_code, v_existing_published
    FROM public.tutor_applications ta
    JOIN public.tutors t ON t.id = ta.linked_tutor_id
    WHERE ta.id <> p_application_id
      AND ta.linked_tutor_id IS NOT NULL
      AND lower(btrim(ta.data->>'email')) = v_email
    ORDER BY ta.created_at DESC
    LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL AND v_existing_code IS NOT NULL THEN
    UPDATE public.tutor_applications
    SET status = 'accepted', linked_tutor_id = v_existing_id
    WHERE id = p_application_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'could not link tutor card to application' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.tutor_live_card_emails (email, tutor_id)
    VALUES (v_email, v_existing_id)
    ON CONFLICT (email) DO NOTHING;
    RETURN jsonb_build_object(
      'tutor_id', v_existing_id,
      'tutor_code', v_existing_code,
      'reused', true,
      'published', COALESCE(v_existing_published, true)
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('mm-tutor-code'), 0);
  SELECT COALESCE(MAX(substring(tutor_code FROM 5)::integer), 0)
  INTO v_max
  FROM public.tutors
  WHERE tutor_code ~* '^MM-T[0-9]+$';
  v_tutor_code := 'MM-T' || lpad((v_max + 1)::text, 3, '0');

  BEGIN
    INSERT INTO public.tutors (
      tutor_code,
      display_name,
      is_published,
      currency,
      lesson_mode,
      hourly_rate,
      online_rate,
      inperson_rate,
      rate_rows,
      travel_note,
      rate_note,
      pricing_tiers,
      subjects,
      languages,
      stations,
      target_students,
      exam_results,
      tutor_status,
      start_immediately,
      earliest_start_date,
      self_introduction,
      qualifications_summary,
      academic_headline,
      undergrad_university,
      undergrad_degree,
      undergrad_graduation_year,
      has_postgrad,
      postgrad_university,
      postgrad_degree,
      secondary_school,
      photo_url,
      portfolio_images,
      created_by,
      referred_by,
      sen_enabled,
      sen_categories,
      sen_experience
    ) VALUES (
      v_tutor_code,
      p_card->>'display_name',
      COALESCE((p_card->>'is_published')::boolean, true),
      COALESCE(NULLIF(p_card->>'currency', ''), 'HKD')::public.supported_currency,
      COALESCE(NULLIF(p_card->>'lesson_mode', ''), 'either')::public.case_mode,
      COALESCE((p_card->>'hourly_rate')::integer, 0),
      CASE
        WHEN p_card->'online_rate' IS NULL OR jsonb_typeof(p_card->'online_rate') = 'null' THEN NULL
        ELSE (p_card->>'online_rate')::integer
      END,
      CASE
        WHEN p_card->'inperson_rate' IS NULL OR jsonb_typeof(p_card->'inperson_rate') = 'null' THEN NULL
        ELSE (p_card->>'inperson_rate')::integer
      END,
      CASE
        WHEN jsonb_typeof(p_card->'rate_rows') = 'array' THEN p_card->'rate_rows'
        ELSE '[]'::jsonb
      END,
      COALESCE(p_card->>'travel_note', ''),
      COALESCE(p_card->>'rate_note', ''),
      CASE
        WHEN jsonb_typeof(p_card->'pricing_tiers') = 'array' THEN p_card->'pricing_tiers'
        ELSE '[]'::jsonb
      END,
      public.jsonb_text_array(p_card->'subjects'),
      public.jsonb_text_array(p_card->'languages'),
      public.jsonb_text_array(p_card->'stations'),
      public.jsonb_text_array(p_card->'target_students'),
      CASE
        WHEN jsonb_typeof(p_card->'exam_results') = 'array' THEN p_card->'exam_results'
        ELSE '[]'::jsonb
      END,
      NULLIF(p_card->>'tutor_status', ''),
      COALESCE((p_card->>'start_immediately')::boolean, true),
      NULLIF(p_card->>'earliest_start_date', '')::date,
      COALESCE(p_card->>'self_introduction', ''),
      COALESCE(p_card->>'qualifications_summary', ''),
      COALESCE(p_card->>'academic_headline', ''),
      NULLIF(p_card->>'undergrad_university', ''),
      NULLIF(p_card->>'undergrad_degree', ''),
      NULLIF(p_card->>'undergrad_graduation_year', ''),
      COALESCE((p_card->>'has_postgrad')::boolean, false),
      NULLIF(p_card->>'postgrad_university', ''),
      NULLIF(p_card->>'postgrad_degree', ''),
      NULLIF(p_card->>'secondary_school', ''),
      NULLIF(p_card->>'photo_url', ''),
      public.jsonb_text_array(p_card->'portfolio_images'),
      NULL,
      v_referred_by,
      COALESCE((p_card->>'sen_enabled')::boolean, false),
      CASE
        WHEN jsonb_typeof(p_card->'sen_categories') = 'array' THEN public.jsonb_text_array(p_card->'sen_categories')
        ELSE '{}'::text[]
      END,
      NULLIF(p_card->>'sen_experience', '')
    )
    RETURNING id INTO v_tutor_id;

    INSERT INTO public.tutor_live_card_emails (email, tutor_id)
    VALUES (v_email, v_tutor_id);
  EXCEPTION
    WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint IS DISTINCT FROM 'tutor_live_card_emails_pkey' THEN
        RAISE;
      END IF;
      SELECT t.id, t.tutor_code, t.is_published
      INTO v_existing_id, v_existing_code, v_existing_published
      FROM public.tutor_live_card_emails e
      JOIN public.tutors t ON t.id = e.tutor_id
      WHERE e.email = v_email;
      IF v_existing_id IS NULL OR v_existing_code IS NULL THEN
        RAISE;
      END IF;
      UPDATE public.tutor_applications
      SET status = 'accepted', linked_tutor_id = v_existing_id
      WHERE id = p_application_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'could not link tutor card to application' USING ERRCODE = 'P0001';
      END IF;
      RETURN jsonb_build_object(
        'tutor_id', v_existing_id,
        'tutor_code', v_existing_code,
        'reused', true,
        'published', COALESCE(v_existing_published, true)
      );
  END;

  UPDATE public.tutor_applications
  SET status = 'accepted', linked_tutor_id = v_tutor_id
  WHERE id = p_application_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'could not link tutor card to application' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'tutor_id', v_tutor_id,
    'tutor_code', v_tutor_code,
    'reused', false,
    'published', true
  );
END;
$function$;
