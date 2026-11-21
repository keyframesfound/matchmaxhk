-- Issue #794 §2.1 — close the ratings loop (CEO lock 2026-11-18).
--
-- Supersedes the #649 N=2 + fee-settled publish gates and the
-- hidden-average-until-3 constant. Nothing here is destructive: additive
-- columns, an additive private-report table, and re-emitted read helpers.
--
-- Locked rules encoded below:
--   1. ONE eligible COMPLETED lesson publishes a parent→tutor review.
--      There is NO fee-settlement gate and NO second-lesson gate.
--   2. Exactly one row per case per direction, edited in place.
--   3. The aggregate shows average + count from the FIRST published review
--      and a "New" cue until three. Zero published reviews → the block hides
--      (the RPC simply returns count 0; TS hides it).
--   4. Before any completed lesson there is no public review — only the
--      private desk report (case_desk_reports, desk-only).
--   5. tutor→parent rows are never publicly readable; the legacy
--      get_parent_review_summary anon grant is revoked.
--   6. Guests can never submit a review: case_reviews and case_desk_reports
--      are RLS-enabled with service-role-only grants (re-asserted).

-- ---------------------------------------------------------------------------
-- 1. case_reviews: private desk note + the "new lesson since last save" anchor.
-- ---------------------------------------------------------------------------
ALTER TABLE public.case_reviews
  ADD COLUMN IF NOT EXISTS desk_note text;
ALTER TABLE public.case_reviews
  ADD COLUMN IF NOT EXISTS desk_note_at timestamptz;
ALTER TABLE public.case_reviews
  ADD COLUMN IF NOT EXISTS completed_lessons_at_write integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.case_reviews.desk_note IS
  '#794 §2.1: optional private note to the desk from the rating sheet. Desk-only — never returned by any public RPC, never on TutorCard / profile.';
COMMENT ON COLUMN public.case_reviews.desk_note_at IS
  '#794 §2.1: when the private desk note was last written (null when none).';
COMMENT ON COLUMN public.case_reviews.completed_lessons_at_write IS
  '#794 §2.1: eligible completed-lesson count at the last save — a later completed lesson reopens the author''s edit window.';
COMMENT ON COLUMN public.case_reviews.held_reason IS
  '#794 §2.1: legacy ''pending_fee_settlement'' / ''pending_lesson_threshold'' holds are no longer written (fee and N=2 are not gates). ''comment_held: …'' records a #205 contact filter that stripped the public text; the star still publishes.';

-- ---------------------------------------------------------------------------
-- 2. One row per case per direction, edited in place (#794).
--    Older duplicate live rows (the pre-#794 replace-on-write path could
--    leave a visible + a held row) are folded first so the index always
--    builds; the newest row per (case, direction) wins.
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY case_id, direction
           ORDER BY updated_at DESC NULLS LAST, created_at DESC
         ) AS rn
  FROM public.case_reviews
  WHERE status IN ('visible', 'held', 'hidden')
)
UPDATE public.case_reviews r
SET status = 'replaced', updated_at = now()
FROM ranked
WHERE r.id = ranked.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_case_reviews_one_per_direction
  ON public.case_reviews (case_id, direction)
  WHERE status IN ('visible', 'held', 'hidden');

-- ---------------------------------------------------------------------------
-- 3. Private desk reports (#794): the only path before a completed lesson.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_desk_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.tutoring_cases(id) ON DELETE CASCADE,
  author_account_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_side text NOT NULL CHECK (author_side IN ('parent', 'tutor')),
  reason text NOT NULL CHECK (reason IN ('no_show', 'rude_unsafe', 'never_confirmed', 'other')),
  detail text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'actioned', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_desk_reports_case
  ON public.case_desk_reports (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_desk_reports_open
  ON public.case_desk_reports (status, created_at DESC);

COMMENT ON TABLE public.case_desk_reports IS
  '#794 §2.1: private participant→desk report (no-show / rude or unsafe / never confirmed / other). Never public; desk-only triage for rematch, flag or ban.';

-- ---------------------------------------------------------------------------
-- 4. Lock down: RLS on, service-role-only grants (re-asserted for
--    case_reviews, new for case_desk_reports). This is what stops a guest
--    from submitting a review against a public tutor profile URL.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['case_reviews', 'case_desk_reports'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Public aggregate RPC re-emitted for the CEO lock.
--    - average + count from the FIRST published parent→tutor review (no
--      hidden-average threshold; TS adds the "New" cue until three)
--    - only visible rows count; hidden/held never do, so a 0.0 is impossible
--    - `latest` carries written reviews only (a contact-stripped star has no
--      text and does not render as a blank quote)
--    - lazy publish for LEGACY held rows: one eligible completed lesson is
--      enough now; fee settlement is irrelevant
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_tutor_review_summary(_tutor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
VOLATILE
AS $function$
DECLARE
  _count integer;
BEGIN
  -- Legacy lazy publish (#794 supersedes #386/#649): a held row flips once
  -- the case has ONE eligible completed lesson. A completed lesson is
  -- status 'done' (Mark done / attendance) or a bilaterally confirmed
  -- 'confirmed' lesson — the same predicate as isEligibleReviewLesson in TS.
  UPDATE public.case_reviews r
  SET status = 'visible', updated_at = now()
  FROM public.tutoring_cases c
  WHERE r.case_id = c.id
    AND r.tutor_id = _tutor_id
    AND r.direction = 'parent_to_tutor'
    AND r.status = 'held'
    AND r.held_reason IN ('pending_fee_settlement', 'pending_lesson_threshold')
    AND EXISTS (
      SELECT 1 FROM public.case_lessons l
      WHERE l.case_id = c.id
        AND (
          l.status = 'done'
          OR (
            l.status = 'confirmed'
            AND l.confirmed_by_parent_at IS NOT NULL
            AND l.confirmed_by_tutor_at IS NOT NULL
          )
        )
    );

  SELECT count(*) INTO _count
  FROM public.case_reviews
  WHERE tutor_id = _tutor_id
    AND direction = 'parent_to_tutor'
    AND status = 'visible';

  RETURN jsonb_build_object(
    'average', (
      SELECT round(avg(rating)::numeric, 1)
      FROM public.case_reviews
      WHERE tutor_id = _tutor_id AND direction = 'parent_to_tutor' AND status = 'visible'
    ),
    'count', _count,
    -- TS owns the copy; this flags the thin sample so no client can render a
    -- bare average by forgetting the cue.
    'new_cue', (_count < 3),
    'latest', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'rating', r.rating, 'comment', r.comment,
               'display_line', r.author_display_line, 'created_at', r.created_at,
               'updated_at', r.updated_at)), '[]'::jsonb)
      FROM (
        SELECT rating, comment, author_display_line, created_at, updated_at
        FROM public.case_reviews
        WHERE tutor_id = _tutor_id
          AND direction = 'parent_to_tutor'
          AND status = 'visible'
          AND length(btrim(comment)) > 0
        ORDER BY created_at DESC
        LIMIT 5
      ) r
    )
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_tutor_review_summary(uuid) TO anon, authenticated;

-- tutor→parent never publishes: the legacy per-account summary is desk-only
-- from here on (it was anon-callable and exposed a parent-side average).
REVOKE ALL ON FUNCTION public.get_parent_review_summary(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_parent_review_summary(uuid) TO service_role;
