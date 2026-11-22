-- Issue #796 §2.7 — Household Briefing / Learning Goals panel (the #637 surface).
--
-- ADDITIVE ONLY: four new nullable columns on public.case_demand_side plus a
-- widening of its existing primary_goal CHECK. No table is created, no row is
-- rewritten, no column is dropped or renamed, and no grant/RLS change is made.
-- The four new columns are nullable and default to NULL, so every existing row
-- stays valid without a backfill.
--
-- New columns (all optional — the panel's copy is "Optional. Skip anything that
-- does not apply.", so an unset chip group simply stays NULL):
--   bottleneck        "Main bottleneck" chip group (plan_exam / brief section)
--   preferred_style   "Preferred tutor style" chip group
--   target_exam       Study Plan thin field, free text (e.g. "DSE Maths")
--   target_exam_date  Study Plan thin field, exam date
--
-- primary_goal widening: the original #637 CHECK only allowed
-- ('exam_boost','foundation','homework'), but the panel now also offers
-- 'top_grade' ("Public exam top grade") and 'coursework' ("IA / coursework
-- guidance"). The old value set is a strict subset of the new one, so no
-- existing row can fail the widened CHECK; the table is also currently empty.
--
-- Visibility is unchanged: service-role server fns only. RLS stays enabled with
-- no policies, exactly as #637 left it, and privileges are table-level in
-- Postgres so new columns inherit the table's existing ACL — nothing is widened.
--
-- Idempotent: `add column if not exists` plus `drop constraint if exists`
-- before each `add constraint`, so a re-run is a no-op.

-- ---------------------------------------------------------------------------
-- 1. bottleneck — "Main bottleneck" chip group
-- ---------------------------------------------------------------------------
alter table public.case_demand_side
  add column if not exists bottleneck text;

alter table public.case_demand_side
  drop constraint if exists case_demand_side_bottleneck_check;
alter table public.case_demand_side
  add constraint case_demand_side_bottleneck_check
  check (
    bottleneck is null
    or bottleneck in ('weak_concepts', 'careless_mistakes', 'slow_exam_speed', 'exam_technique')
  );

comment on column public.case_demand_side.bottleneck is
  '#796 §2.7 "Main bottleneck" chip group in the Learning Goals / household briefing panel. Optional and skippable: NULL means the family left it unanswered or cleared it.';

-- ---------------------------------------------------------------------------
-- 2. preferred_style — "Preferred tutor style" chip group
-- ---------------------------------------------------------------------------
alter table public.case_demand_side
  add column if not exists preferred_style text;

alter table public.case_demand_side
  drop constraint if exists case_demand_side_preferred_style_check;
alter table public.case_demand_side
  add constraint case_demand_side_preferred_style_check
  check (
    preferred_style is null
    or preferred_style in ('patient_step_by_step', 'fast_paced', 'past_paper_focused')
  );

comment on column public.case_demand_side.preferred_style is
  '#796 §2.7 "Preferred tutor style" chip group in the Learning Goals panel. Optional and skippable: NULL means no preference was stated.';

-- ---------------------------------------------------------------------------
-- 3. target_exam — Study Plan thin field (free text)
-- ---------------------------------------------------------------------------
alter table public.case_demand_side
  add column if not exists target_exam text;

alter table public.case_demand_side
  drop constraint if exists case_demand_side_target_exam_check;
alter table public.case_demand_side
  add constraint case_demand_side_target_exam_check
  check (
    target_exam is null
    or char_length(btrim(target_exam)) between 1 and 80
  );

comment on column public.case_demand_side.target_exam is
  '#796 §2.7 Study Plan "Target exam" field in the Learning Goals panel. Optional and skippable: NULL when omitted; trimmed length is capped at 80 chars so blank strings are rejected by the CHECK.';

-- ---------------------------------------------------------------------------
-- 4. target_exam_date — Study Plan thin field (no CHECK; a date is self-validating)
-- ---------------------------------------------------------------------------
alter table public.case_demand_side
  add column if not exists target_exam_date date;

comment on column public.case_demand_side.target_exam_date is
  '#796 §2.7 Study Plan "Exam date" field in the Learning Goals panel. Optional and skippable: NULL when the family has no fixed date yet.';

-- ---------------------------------------------------------------------------
-- 5. Widen the primary_goal CHECK to the two new panel options
-- ---------------------------------------------------------------------------
alter table public.case_demand_side
  drop constraint if exists case_demand_side_primary_goal_check;
alter table public.case_demand_side
  add constraint case_demand_side_primary_goal_check
  check (
    primary_goal is null
    or primary_goal in ('exam_boost', 'foundation', 'homework', 'top_grade', 'coursework')
  );

comment on column public.case_demand_side.primary_goal is
  '#637 primary-goal chips, widened by #796 §2.7 to add ''top_grade'' and ''coursework''. Optional and skippable: NULL means no goal chosen.';
