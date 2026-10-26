-- Fix admin_engagement_overview (shipped in 20261026120000) — it could never
-- return data. Three defects, all fixed here:
--
-- 1. The admin gate queried profiles.role, a column that does not exist
--    (roles live in user_roles via public.has_role) — every execution raised
--    42703 and the /admin demand panel permanently rendered "unavailable".
--    plpgsql does not validate columns at CREATE time, so the broken version
--    applied cleanly.
-- 2. The "previous" window was 7 days against a 14-day current window, so
--    funnel deltas were structurally ~+100% on flat traffic. Both windows
--    are now the preceding 14 days.
-- 3. "today" was UTC while tutor_engagement_events.event_day rows are Hong
--    Kong calendar days (20261016150000 writes Asia/Hong_Kong dates and
--    20261018101000 hardening computes day caps in HKT), so live events fell
--    outside the window for 8 hours a day. Day math is now HKT.
--
-- Plus repo-convention hygiene: explicit EXECUTE grants (default PUBLIC
-- execute was the only gate) and an index for the day-range scan the RPC
-- runs every 60s per open admin tab (existing indexes lead with tutor_id,
-- so none of them serve it).

create index if not exists tutor_engagement_events_day_idx
  on public.tutor_engagement_events (event_day);

create or replace function public.admin_engagement_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Hong_Kong')::date;
  result jsonb;
begin
  if not (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'super_admin')
  ) then
    raise insufficient_privilege;
  end if;

  with cur as (
    select * from public.tutor_engagement_events
    where event_day >= today - 13
  ),
  prev as (
    select * from public.tutor_engagement_events
    where event_day >= today - 27 and event_day < today - 13
  ),
  cur_totals as (
    select
      count(*) filter (where event_type = 'profile_view') as views,
      count(*) filter (where event_type = 'inquiry_click') as inquiries,
      count(*) filter (where event_type = 'request_click') as requests
    from cur
  ),
  prev_totals as (
    select
      count(*) filter (where event_type = 'profile_view') as views,
      count(*) filter (where event_type = 'inquiry_click') as inquiries,
      count(*) filter (where event_type = 'request_click') as requests
    from prev
  ),
  daily as (
    select event_day,
      count(*) filter (where event_type = 'profile_view') as views
    from cur group by event_day
  )
  select jsonb_build_object(
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', to_char(s.day, 'YYYY-MM-DD'),
        'views', coalesce(d.views, 0)
      ) order by s.day), '[]'::jsonb)
      from generate_series(today - 13, today, interval '1 day') as s(day)
      left join daily d on d.event_day = s.day
    ),
    'totals', to_jsonb(cur_totals),
    'prev', to_jsonb(prev_totals),
    'unique_viewers', (select count(distinct viewer_key) from cur)
  )
  into result
  from cur_totals, prev_totals;

  return result;
end;
$$;

revoke execute on function public.admin_engagement_overview() from public, anon;
grant execute on function public.admin_engagement_overview() to authenticated;
