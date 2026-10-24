-- Issue #357 / #359 — go-live hotfix.
--
-- 1. Contact text must not land on a public card via the service-role INSERT
--    (the owner contact guard is BEFORE UPDATE only, and it skips
--    auth.uid() IS NULL). This trigger runs on every INSERT.
-- 2. One tutor card per normalized application email. Insert + link happen
--    in publish_tutor_from_application(), so a failed link rolls the card
--    back, and a second submit reuses the existing card.

-- Same patterns as tutors_owner_contact_guard (emails, URLs, phones,
-- channel words, wa.me, 小紅書). Kept as its own function so the INSERT
-- path can call it for scalars and for array / rate-row labels.
CREATE OR REPLACE FUNCTION public.tutor_public_text_has_contact(p_text text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(p_text, '') ~* '[\w.+-]+@[\w-]+\.[\w.-]+'
    OR COALESCE(p_text, '') ~* '(https?://|www\.)\S+|\m[a-z0-9-]{2,}\.(com|net|org|hk|io|co|me|edu|gov)([/.?#]\S*)?'
    OR COALESCE(p_text, '') ~* '(\+?852[\s-]?)?[2-9]\d{3}[\s-]?\d{4}\M|\m\d{2,4}[\s-]\d{3,4}[\s-]\d{3,4}\M'
    OR COALESCE(p_text, '') ~* '\m(whatsapp|wechat|instagram|ig|telegram|signal|qr)\M'
    OR COALESCE(p_text, '') ~* 'wa\.me'
    OR COALESCE(p_text, '') ~* '小紅書';
$function$;

REVOKE ALL ON FUNCTION public.tutor_public_text_has_contact(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.tutors_insert_contact_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Do NOT skip service-role or staff. Go-live publishes with the service
  -- role (auth.uid() IS NULL), which the owner UPDATE guard ignores.
  IF public.tutor_public_text_has_contact(NEW.display_name)
    OR public.tutor_public_text_has_contact(NEW.headline)
    OR public.tutor_public_text_has_contact(NEW.self_introduction)
    OR public.tutor_public_text_has_contact(NEW.qualifications_summary)
    OR public.tutor_public_text_has_contact(NEW.academic_headline)
    OR public.tutor_public_text_has_contact(NEW.travel_note)
    OR public.tutor_public_text_has_contact(NEW.rate_note)
    OR public.tutor_public_text_has_contact(NEW.secondary_school)
    OR public.tutor_public_text_has_contact(NEW.undergrad_university)
    OR public.tutor_public_text_has_contact(NEW.undergrad_degree)
    OR public.tutor_public_text_has_contact(NEW.undergrad_graduation_year)
    OR public.tutor_public_text_has_contact(NEW.postgrad_university)
    OR public.tutor_public_text_has_contact(NEW.postgrad_degree)
    OR EXISTS (
      SELECT 1
      FROM unnest(COALESCE(NEW.subjects, '{}'::text[])) AS item
      WHERE public.tutor_public_text_has_contact(item)
    )
    OR EXISTS (
      SELECT 1
      FROM unnest(COALESCE(NEW.languages, '{}'::text[])) AS item
      WHERE public.tutor_public_text_has_contact(item)
    )
    OR EXISTS (
      SELECT 1
      FROM unnest(COALESCE(NEW.stations, '{}'::text[])) AS item
      WHERE public.tutor_public_text_has_contact(item)
    )
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(NEW.rate_rows) = 'array' THEN NEW.rate_rows
          ELSE '[]'::jsonb
        END
      ) AS row
      WHERE public.tutor_public_text_has_contact(row->>'label')
    )
  THEN
    RAISE EXCEPTION 'contact details are not allowed on the public card'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_tutors_insert_contact_guard ON public.tutors;
CREATE TRIGGER trg_tutors_insert_contact_guard
  BEFORE INSERT ON public.tutors
  FOR EACH ROW
  EXECUTE FUNCTION public.tutors_insert_contact_guard();

-- Canonical "one card per application email". Not on tutors itself: anon can
-- SELECT published tutor rows, and the email must not become a public column.
CREATE TABLE IF NOT EXISTS public.tutor_live_card_emails (
  email text PRIMARY KEY,
  tutor_id uuid NOT NULL REFERENCES public.tutors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tutor_live_card_emails IS
  'Issue #357 / #359: one tutor card per normalized application email. Service-role only; not readable by anon or authenticated.';

ALTER TABLE public.tutor_live_card_emails ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.tutor_live_card_emails FROM PUBLIC;
REVOKE ALL ON TABLE public.tutor_live_card_emails FROM anon;
REVOKE ALL ON TABLE public.tutor_live_card_emails FROM authenticated;
GRANT ALL ON TABLE public.tutor_live_card_emails TO service_role;

CREATE INDEX IF NOT EXISTS idx_tutor_applications_linked_email
  ON public.tutor_applications (lower(btrim(data->>'email')))
  WHERE linked_tutor_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.jsonb_text_array(p_value jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    ARRAY(
      SELECT elem
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(p_value) = 'array' THEN p_value
          ELSE '[]'::jsonb
        END
      ) WITH ORDINALITY AS items(elem, ord)
      ORDER BY ord
    ),
    '{}'::text[]
  );
$function$;

REVOKE ALL ON FUNCTION public.jsonb_text_array(jsonb) FROM PUBLIC;

-- Insert the card and link the application in one transaction. A second
-- submit for the same normalized email reuses the existing card. Link
-- failure raises, which rolls the insert back.
CREATE OR REPLACE FUNCTION public.publish_tutor_from_application(
  p_application_id uuid,
  p_card jsonb
)
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
    SELECT tutor_code INTO v_existing_code
    FROM public.tutors
    WHERE id = v_linked;
    IF v_existing_code IS NOT NULL THEN
      INSERT INTO public.tutor_live_card_emails (email, tutor_id)
      VALUES (v_email, v_linked)
      ON CONFLICT (email) DO NOTHING;
      RETURN jsonb_build_object(
        'tutor_id', v_linked,
        'tutor_code', v_existing_code,
        'reused', true
      );
    END IF;
  END IF;

  SELECT t.id, t.tutor_code
  INTO v_existing_id, v_existing_code
  FROM public.tutor_live_card_emails e
  JOIN public.tutors t ON t.id = e.tutor_id
  WHERE e.email = v_email;

  IF v_existing_id IS NULL THEN
    -- Any status. A pending/rejected row that already points at a card is
    -- still that tutor's one live card.
    SELECT t.id, t.tutor_code
    INTO v_existing_id, v_existing_code
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
      'reused', true
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
      referred_by
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
      v_referred_by
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
      SELECT t.id, t.tutor_code
      INTO v_existing_id, v_existing_code
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
        'reused', true
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
    'reused', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.publish_tutor_from_application(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_tutor_from_application(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.publish_tutor_from_application(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.publish_tutor_from_application(uuid, jsonb) TO service_role;
