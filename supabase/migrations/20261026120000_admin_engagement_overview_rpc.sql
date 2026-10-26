-- Admin overview demand panel: /admin reads engagement aggregates without
-- direct access to tutor_engagement_events (RLS-deny, standing grants dropped
-- in 20261018101000_engagement_hardening.sql). Exposed only to admin roles.
create or replace function public.admin_engagement_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  result jsonb;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
  ) then
    raise insufficient_privilege;
  end if;

  with cur as (
    select * from public.tutor_engagement_events
    where event_day >= today - 13
  ),
  prev as (
    select * from public.tutor_engagement_events
    where event_day >= today - 14 and event_day < today - 7
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
