-- Issue #443 — [Ops / Fee] Short-Case Handling (≤5 lessons, 20% package fee).
--
-- CEO lock 2026-10-24: payer = the self-employed tutor. A SHORT package
-- (≤5 scheduled lessons) pays a platform fee of 20% of the scheduled package
-- value instead of the standard 1.5-lesson admin fee. $0 Pro-Bono wins over
-- the short 20% (fee = 0). The Paid/Settled gate (#255) is unchanged.
--
-- SHARED DURATION / RATE LOCK (CEO check 2026-10-24): no parallel
-- hours_per_lesson or agreed_hourly_rate column is created. Lesson duration
-- REUSES the existing tutoring_cases.session_length_minutes (int NOT NULL
-- DEFAULT 60 — admin-editable on the desk like any standard case) and the
-- fee/UI code derives hours_per_lesson = session_length_minutes / 60. The
-- rate basis REUSES the existing tutoring_cases.hourly_rate_hkd (#201) — the
-- single rate field MatchFeePanel and the case_fees invoice rows already use.
--
-- Additive only, nullable / defaulted so every legacy row stays valid.
--   is_short_case          — the fee-math source of truth (admin desk toggle)
--   scheduled_lesson_count — 1–5 while short (the "X Lessons" chip + package math)
--   short_case_fee         — HKD snapshot of 20% × (rate × hours × count)
--   short_case_confirmed_by / _at — WHO confirmed the fee with the payer
--                           (parent WhatsApp B2C / org WhatsApp B2B / CS note)
--                           and when; the pasted WA text itself is stored as a
--                           case_notes row (existing storage, no new column).
--
-- agreed_hourly_rate is NOT added (see rate lock above). No duplicate.
--
-- package_type reconciliation (#430): is_short_case is the fee-math source of
-- truth; the ADMIN WRITE PATH keeps package_type in sync (short flips on →
-- 'short_20', convert → 'ongoing_1_5'). Pro-bono cases never take the short
-- flag ($0 wins — enforced in the desk server fn; the columns stay independent
-- so no trigger has to guess).

ALTER TABLE public.tutoring_cases
  ADD COLUMN IF NOT EXISTS is_short_case boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_lesson_count integer,
  ADD COLUMN IF NOT EXISTS short_case_fee numeric(10, 2),
  ADD COLUMN IF NOT EXISTS short_case_confirmed_by text,
  ADD COLUMN IF NOT EXISTS short_case_confirmed_at timestamptz;

-- Shape guard: while short, the package inputs are REQUIRED and bounded
-- (count 1–5; duration rides on the EXISTING session_length_minutes column —
-- NOT NULL DEFAULT 60, so the predicate below just documents the "required
-- when short" lock). While not short the package length must be empty — a
-- stale lesson count on an ongoing case would make the payout math lie.
ALTER TABLE public.tutoring_cases ADD CONSTRAINT short_case_shape_chk CHECK (
  (
    is_short_case = false
    AND scheduled_lesson_count IS NULL
  )
  OR (
    is_short_case = true
    AND scheduled_lesson_count BETWEEN 1 AND 5
    AND session_length_minutes IS NOT NULL
    AND session_length_minutes > 0
    AND (short_case_fee IS NULL OR short_case_fee >= 0)
  )
);

ALTER TABLE public.tutoring_cases ADD CONSTRAINT short_case_confirmed_by_chk
  CHECK (
    short_case_confirmed_by IS NULL
    OR short_case_confirmed_by IN ('parent_wa', 'org_wa', 'cs_note')
  );

-- A confirmation source always carries its timestamp (and vice versa).
ALTER TABLE public.tutoring_cases ADD CONSTRAINT short_case_confirm_pair_chk CHECK (
  (short_case_confirmed_by IS NULL) = (short_case_confirmed_at IS NULL)
);

COMMENT ON COLUMN public.tutoring_cases.is_short_case IS
  '#443 short-case fee flag: true = tutor pays 20% of the scheduled package value (hourly_rate_hkd × (session_length_minutes/60) × scheduled_lesson_count), NOT the 1.5-lesson admin fee. Hours per lesson are DERIVED from session_length_minutes — no separate column. Study-Partner-Squad cases must never take this flag (see gap note below).';
COMMENT ON COLUMN public.tutoring_cases.scheduled_lesson_count IS
  '#443 scheduled package length while is_short_case (1–5). Drives the public package-total payout block and the tutor chip. Duration comes from the existing session_length_minutes column (required while short).';
COMMENT ON COLUMN public.tutoring_cases.short_case_fee IS
  '#443 INTERNAL HKD snapshot of the 20% package fee at confirm time. Never selected by public queries (not in PUBLIC_CASE_COLUMNS, not in the authenticated column grant).';
COMMENT ON COLUMN public.tutoring_cases.short_case_confirmed_by IS
  '#443 INTERNAL confirmation source: parent_wa (B2C parent WhatsApp) / org_wa (B2B org WhatsApp) / cs_note. Pasted WA text lives in case_notes.';

CREATE INDEX IF NOT EXISTS idx_cases_short_case
  ON public.tutoring_cases (is_short_case)
  WHERE is_short_case;

-- ---------------------------------------------------------------------------
-- STUDY-PARTNER-SQUAD GUARD — DOCUMENTED GAP (spec: do not invent a column).
-- grepped src/ + supabase/migrations/ for squad / study-partner markers:
-- tutoring_cases carries NO squad marker column today. The nearest concept is
-- group_cohort_id (#391 Small Group Classes, group cases pay 1.5 × per-student
-- rate), but equating cohorts with squads would be an invented equivalence, so
-- no DB guard is written here. The desk server fn (short-case.functions.ts)
-- refuses is_short_case=true on group_cohort cases AND on rows tagged with a
-- squad-ish tag as the closest safe backstops, and a future marker column
-- should add the real CHECK.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Authenticated column-SELECT extension (20261017170000 rule: every new column
-- must extend the grant or the staff desk hits permission denied). This file
-- is DATED AFTER 20261024200000_case_desk_81_55 and
-- 20261025230000_desk_language_451 on purpose: 81_55 REVOKEs and re-issues the
-- tutoring_cases grant (which would otherwise wipe the short-case columns
-- added here), and desk_language_451 added its column WITHOUT extending the
-- grant at all — so this re-issues the union of the 81_55 list + desk_language
-- + class_format_preference (#391) + the display-safe short-case inputs
-- (is_short_case, scheduled_lesson_count). short_case_fee /
-- short_case_confirmed_by / short_case_confirmed_at stay INTERNAL (service
-- role only, like hourly_rate_hkd). Hours per lesson are derived in code from
-- the already-granted session_length_minutes — nothing new to grant there.
-- ---------------------------------------------------------------------------
REVOKE SELECT ON public.tutoring_cases FROM authenticated;
GRANT SELECT (
  id, case_code, parent_id, title, description, subjects, exam_system,
  student_level, student_grade_current, student_school, district, mode,
  sessions_per_week, session_length_minutes, schedule_note, start_timing,
  preferred_gender, language_of_instruction, urgency, budget_min, budget_max,
  contact_name, contact_phone, status, tags, source, assigned_to,
  last_contacted_at, created_at, updated_at, board_published_at,
  requester_type, support_type, specific_component, target_pathway,
  target_school, interview_test, school_type, tutor_background,
  matched_tutor_id, matched_at, fee_collected_at, fee_amount_cents,
  budget_currency, budget_min_hkd, budget_max_hkd, sen_required,
  sen_categories, sen_details, organisation_id, concierge_id,
  replacement_of_case_id, sor_status, sor_status_at,
  academic_tier, uni_field, uni_name, uni_program, uni_course_codes,
  kindergarten_focus,
  who_for, student_gender, compliance_triage, compliance_note,
  package_type, student_count, rate_unit, class_format_preference,
  desk_language,
  is_short_case, scheduled_lesson_count
) ON public.tutoring_cases TO authenticated;
