-- #636 Thin schedule sync. case_lessons stays the only schedule store:
--   series_id          groups a weekly fill so "edit whole series" can find it
--   schedule_paused_at set by the desk; future lessons are released and new
--                      ones are refused until it is cleared
-- Ending, replacing or pausing a case cancels its future live lessons, so the
-- tutor's and learner's time frees up whichever path made the change.
alter table public.case_lessons
  add column if not exists series_id uuid,
  -- Series and moved lessons wait for a confirm; the #204 12h expiry is for
  -- one-off slot requests and would cancel them.
  add column if not exists no_request_expiry boolean not null default false;

create unique index if not exists case_lessons_series_start_uq
  on public.case_lessons (series_id, starts_at)
  where series_id is not null;

alter table public.tutoring_cases
  add column if not exists schedule_paused_at timestamptz,
  -- Also added by #656; repeated so the two migrations can land in either order.
  add column if not exists schedule_mode text,
  add column if not exists schedule_slots jsonb not null default '[]'::jsonb;

create or replace function public.release_future_lessons_on_case_stop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _released integer;
begin
  if not (
    (new.sor_status in ('closed', 'replaced') and old.sor_status is distinct from new.sor_status)
    or (new.schedule_paused_at is not null and old.schedule_paused_at is null)
  ) then
    return new;
  end if;

  update public.case_lessons
  set status = 'cancelled'
  where case_id = new.id
    and status in ('planned', 'confirmed')
    and starts_at > now();
  get diagnostics _released = row_count;

  if _released > 0 then
    insert into public.case_audit (case_id, actor_id, from_status, to_status, reason)
    values (
      new.id, null, new.sor_status, 'lessons_released',
      format('%s future lessons released (#636)', _released)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_release_future_lessons on public.tutoring_cases;
create trigger trg_release_future_lessons
  after update of sor_status, schedule_paused_at on public.tutoring_cases
  for each row execute function public.release_future_lessons_on_case_stop();

create or replace function public.guard_lesson_case_paused()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.tutoring_cases c
    where c.id = new.case_id and c.schedule_paused_at is not null
  ) then
    raise exception 'CASE_PAUSED';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_case_lessons_paused_guard on public.case_lessons;
create trigger trg_case_lessons_paused_guard
  before insert on public.case_lessons
  for each row execute function public.guard_lesson_case_paused();

revoke all on function public.release_future_lessons_on_case_stop() from public, anon, authenticated;
revoke all on function public.guard_lesson_case_paused() from public, anon, authenticated;

comment on column public.case_lessons.series_id is
  '#636 groups lessons created by one weekly fill; null for one-off lessons.';
comment on column public.tutoring_cases.schedule_paused_at is
  '#636 desk-confirmed pause: future lessons released, new lessons refused until cleared.';
