-- Issue #658: Tutor Status taxonomy — 6 primary codes + More, legacy bundled
-- backfill, and the 1-tap split write path.
--
-- The stored column stays `tutors.tutor_status` (free text). This migration is
-- additive only:
--   1. Widen `tutors_tutor_status_check` from the old 3-bucket vocabulary to
--      the #658 canonical set PLUS the legacy stored values, so pre-#658 rows
--      stay valid and no data backfill is needed. The query layer
--      (src/features/tutors/status-taxonomy.ts) maps legacy values:
--        uni_student          -> uni_undergrad (rename, same identity)
--        full_part_time_tutor -> legacy bundled (temporary chip, FT/PT backfill)
--   2. Add `split_tutor_status(p_status)` — the 1-tap split write path.
--      tutors_owner_verified_guard freezes tutor_status on ALL owner UPDATEs
--      (self-promotion guard), so a plain owner write cannot perform the
--      split. This SECURITY DEFINER RPC is the narrow exception: it only
--      accepts full_time | part_time, only for the caller's own card, and
--      only while the stored value is still the legacy bundled value. Any
--      other transition stays staff-only via the admin editor.

ALTER TABLE public.tutors
  DROP CONSTRAINT tutors_tutor_status_check;

ALTER TABLE public.tutors
  ADD CONSTRAINT tutors_tutor_status_check CHECK (
    tutor_status = ANY (ARRAY[
      -- #658 canonical (6 primary + 2 More)
      'uni_undergrad',
      'part_time',
      'full_time',
      'uni_grad',
      'school_teacher',
      'examiner',
      'sub_degree',
      'native_speaker',
      -- legacy pre-#658 stored values, query-layer mapped
      'uni_student',
      'full_part_time_tutor'
    ])
  );

CREATE OR REPLACE FUNCTION public.split_tutor_status(p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_next text;
  v_updated integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  v_next := lower(btrim(COALESCE(p_status, '')));
  IF v_next NOT IN ('full_time', 'part_time') THEN
    RAISE EXCEPTION 'split target must be full_time or part_time'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.tutors
  SET tutor_status = v_next
  WHERE user_id = auth.uid()
    AND tutor_status = 'full_part_time_tutor';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Idempotent: splitting an already-split (or non-bundled) card is a no-op
  -- that reports the current stored value, never an error.
  RETURN jsonb_build_object(
    'split', v_updated > 0,
    'tutor_status', v_next,
    'updated', v_updated
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.split_tutor_status(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.split_tutor_status(text) TO authenticated;
