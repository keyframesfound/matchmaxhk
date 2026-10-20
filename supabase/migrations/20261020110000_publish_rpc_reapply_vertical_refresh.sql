-- Issue #390: publish_tutor_from_application re-apply must refresh the
-- vertical columns on an existing card.
--
-- The INSERT path writes university_year_of_study, university_gpa,
-- university_courses and course_specific_grades (and, since
-- 20261018103000, the sen_* fields), but every reuse path — application
-- already linked (v_linked), same-email card lookup, and the
-- tutor_live_card_emails_pkey race backstop — returned { reused: true }
-- without touching the tutors row. A tutor re-applying after #190 went
-- live kept whatever vertical answers were on the card at first publish
-- (usually none), so /join vertical answers never reached the public card.
--
-- Each reuse branch now UPDATEs the linked card from the same p_card
-- expressions the INSERT uses, for the same field set that is otherwise
-- INSERT-only: sen_enabled, sen_categories, sen_experience and the four
-- university-vertical columns. This is a mirror of the INSERT column
-- list, not a new refresh policy: profile fields the owner can edit
-- in-app (display_name, rates, subjects, bios, ...) are deliberately NOT
-- refreshed, so a re-apply cannot clobber owner or staff edits on a live
-- card. Publication state is also untouched — a reused card is still
-- never re-published automatically.
--
-- The reused return shape (tutor_id, tutor_code, reused, published) and
-- every lock, guard interaction and privilege are unchanged; the contact
-- guards on tutors fire on this UPDATE exactly as they do on the INSERT,
-- since the payload is the same object.
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
      UPDATE public.tutors
      SET
        sen_enabled = COALESCE((p_card->>'sen_enabled')::boolean, false),
        sen_categories = CASE
          WHEN jsonb_typeof(p_card->'sen_categories') = 'array' THEN public.jsonb_text_array(p_card->'sen_categories')
          ELSE '{}'::text[]
        END,
        sen_experience = NULLIF(p_card->>'sen_experience', ''),
        university_year_of_study = NULLIF(p_card->>'university_year_of_study', ''),
        university_gpa = CASE
          WHEN p_card->'university_gpa' IS NULL OR jsonb_typeof(p_card->'university_gpa') = 'null' THEN NULL
          ELSE (p_card->>'university_gpa')::numeric
        END,
        university_courses = CASE
          WHEN jsonb_typeof(p_card->'university_courses') = 'array' THEN p_card->'university_courses'
          ELSE '[]'::jsonb
        END,
        course_specific_grades = CASE
          WHEN jsonb_typeof(p_card->'course_specific_grades') = 'object' THEN p_card->'course_specific_grades'
          ELSE '{}'::jsonb
        END
      WHERE id = v_linked;
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
    UPDATE public.tutors
    SET
      sen_enabled = COALESCE((p_card->>'sen_enabled')::boolean, false),
      sen_categories = CASE
        WHEN jsonb_typeof(p_card->'sen_categories') = 'array' THEN public.jsonb_text_array(p_card->'sen_categories')
        ELSE '{}'::text[]
      END,
      sen_experience = NULLIF(p_card->>'sen_experience', ''),
      university_year_of_study = NULLIF(p_card->>'university_year_of_study', ''),
      university_gpa = CASE
        WHEN p_card->'university_gpa' IS NULL OR jsonb_typeof(p_card->'university_gpa') = 'null' THEN NULL
        ELSE (p_card->>'university_gpa')::numeric
      END,
      university_courses = CASE
        WHEN jsonb_typeof(p_card->'university_courses') = 'array' THEN p_card->'university_courses'
        ELSE '[]'::jsonb
      END,
      course_specific_grades = CASE
        WHEN jsonb_typeof(p_card->'course_specific_grades') = 'object' THEN p_card->'course_specific_grades'
        ELSE '{}'::jsonb
      END
    WHERE id = v_existing_id;
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
      sen_experience,
      university_year_of_study,
      university_gpa,
      university_courses,
      course_specific_grades
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
      NULLIF(p_card->>'sen_experience', ''),
      NULLIF(p_card->>'university_year_of_study', ''),
      CASE
        WHEN p_card->'university_gpa' IS NULL OR jsonb_typeof(p_card->'university_gpa') = 'null' THEN NULL
        ELSE (p_card->>'university_gpa')::numeric
      END,
      CASE
        WHEN jsonb_typeof(p_card->'university_courses') = 'array' THEN p_card->'university_courses'
        ELSE '[]'::jsonb
      END,
      CASE
        WHEN jsonb_typeof(p_card->'course_specific_grades') = 'object' THEN p_card->'course_specific_grades'
        ELSE '{}'::jsonb
      END
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
      UPDATE public.tutors
      SET
        sen_enabled = COALESCE((p_card->>'sen_enabled')::boolean, false),
        sen_categories = CASE
          WHEN jsonb_typeof(p_card->'sen_categories') = 'array' THEN public.jsonb_text_array(p_card->'sen_categories')
          ELSE '{}'::text[]
        END,
        sen_experience = NULLIF(p_card->>'sen_experience', ''),
        university_year_of_study = NULLIF(p_card->>'university_year_of_study', ''),
        university_gpa = CASE
          WHEN p_card->'university_gpa' IS NULL OR jsonb_typeof(p_card->'university_gpa') = 'null' THEN NULL
          ELSE (p_card->>'university_gpa')::numeric
        END,
        university_courses = CASE
          WHEN jsonb_typeof(p_card->'university_courses') = 'array' THEN p_card->'university_courses'
          ELSE '[]'::jsonb
        END,
        course_specific_grades = CASE
          WHEN jsonb_typeof(p_card->'course_specific_grades') = 'object' THEN p_card->'course_specific_grades'
          ELSE '{}'::jsonb
        END
      WHERE id = v_existing_id;
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

REVOKE ALL ON FUNCTION public.publish_tutor_from_application(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_tutor_from_application(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.publish_tutor_from_application(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.publish_tutor_from_application(uuid, jsonb) TO service_role;
