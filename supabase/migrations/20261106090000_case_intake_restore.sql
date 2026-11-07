-- #656 Case Request intake restore (CEO 2026-11-05).
-- sessions_per_week / session_length_minutes / start_timing / schedule_note
-- / tags already exist; the form now writes them. New, all optional:
--   location_estate  coarse estate / building near the MTR (no street / unit)
--   schedule_mode    'flexible' (no fixed slots) | 'specific' (slots below)
--   schedule_slots   soft preferred slots: [{"day":"mon","period":"evening"}]
--                    (prefs only, never bookings; #636 / #605 read them)
--   learner_nickname how to call the learner when not a linked child
alter table public.tutoring_cases
  add column if not exists location_estate text,
  add column if not exists schedule_mode text,
  add column if not exists schedule_slots jsonb not null default '[]'::jsonb,
  add column if not exists learner_nickname text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tutoring_cases_schedule_mode_chk'
  ) then
    alter table public.tutoring_cases
      add constraint tutoring_cases_schedule_mode_chk
      check (schedule_mode is null or schedule_mode in ('flexible', 'specific'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'tutoring_cases_location_estate_len_chk'
  ) then
    alter table public.tutoring_cases
      add constraint tutoring_cases_location_estate_len_chk
      check (location_estate is null or char_length(location_estate) <= 80);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'tutoring_cases_learner_nickname_len_chk'
  ) then
    alter table public.tutoring_cases
      add constraint tutoring_cases_learner_nickname_len_chk
      check (learner_nickname is null or char_length(learner_nickname) <= 40);
  end if;
end $$;

comment on column public.tutoring_cases.schedule_slots is
  '#656 soft preferred slots [{day: mon..sun, period: morning|afternoon|evening}]; prefs only, never bookings.';
