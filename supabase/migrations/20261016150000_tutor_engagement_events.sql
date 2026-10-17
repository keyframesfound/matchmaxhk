-- Issues #102 + #151: engagement event storage + aggregation RPCs.
-- Anonymous event rows (profile views, inquiry/request clicks) power the
-- social-proof badges on tutor cards and the trending homepage carousel.
-- The table itself is fully locked down (RLS enabled, no policies): the
-- client only ever calls the SECURITY DEFINER RPCs below, which validate,
-- cap and dedupe writes and expose aggregate counts only.

create table if not exists public.tutor_engagement_events (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  event_type text not null check (event_type in ('profile_view', 'inquiry_click', 'request_click')),
  viewer_key text not null,
  event_day date not null default (now() at time zone 'Asia/Hong_Kong')::date,
  created_at timestamptz not null default now(),
  unique (tutor_id, event_type, viewer_key, event_day)
);

create index if not exists tutor_engagement_events_tutor_day_idx
  on public.tutor_engagement_events (tutor_id, event_type, event_day);

alter table public.tutor_engagement_events enable row level security;

-- One engagement row per (tutor, event, viewer, day). A viewer_key may
-- register at most 50 rows per day (a browsing cap — keeps a rotated
-- viewer_key bot from fabricating "High Demand" numbers). Junk event types,
-- empty/oversized viewer keys and unpublished tutors are silently ignored:
-- a public tracking endpoint must never 500 the caller.
create or replace function public.record_tutor_engagement(
  p_tutor_id uuid,
  p_event_type text,
  p_viewer_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event_type not in ('profile_view', 'inquiry_click', 'request_click') then
    return;
  end if;
  if p_viewer_key is null or length(btrim(p_viewer_key)) = 0 or length(p_viewer_key) > 64 then
    return;
  end if;
  if not exists (
    select 1 from public.tutors t
    where t.id = p_tutor_id and t.is_published
  ) then
    return;
  end if;
  if (
    select count(*)
    from public.tutor_engagement_events
    where viewer_key = p_viewer_key
      and event_day = (now() at time zone 'Asia/Hong_Kong')::date
  ) >= 50 then
    return;
  end if;

  insert into public.tutor_engagement_events (tutor_id, event_type, viewer_key)
  values (p_tutor_id, p_event_type, p_viewer_key)
  on conflict (tutor_id, event_type, viewer_key, event_day) do nothing;
end;
$$;

-- Aggregate counts for the badge surfaces. Counts only — no viewer data is
-- ever exposed. Saves come from saved_tutors (authed writes), so "save"
-- needs no event row of its own.
create or replace function public.get_tutor_engagement(p_tutor_ids uuid[])
returns table (
  tutor_id uuid,
  inquiries_7d bigint,
  views_30d bigint,
  requests_30d bigint,
  saves_total bigint,
  saves_30d bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    (select count(*) from public.tutor_engagement_events e
      where e.tutor_id = t.id
        and e.event_type = 'inquiry_click'
        and e.event_day > (now() at time zone 'Asia/Hong_Kong')::date - 7),
    (select count(*) from public.tutor_engagement_events e
      where e.tutor_id = t.id
        and e.event_type = 'profile_view'
        and e.event_day > (now() at time zone 'Asia/Hong_Kong')::date - 30),
    (select count(*) from public.tutor_engagement_events e
      where e.tutor_id = t.id
        and e.event_type = 'request_click'
        and e.event_day > (now() at time zone 'Asia/Hong_Kong')::date - 30),
    (select count(*) from public.saved_tutors s where s.tutor_id = t.id),
    (select count(*) from public.saved_tutors s
      where s.tutor_id = t.id and s.created_at >= now() - interval '30 days')
  from unnest(p_tutor_ids) as t(id);
$$;

-- Trending candidates: every published tutor's raw engagement plus a BASE
-- popularity score (views x1 + 30d saves x5 + 30d requests x15). The #151
-- quality multipliers (verified x1.2, top-scorer x1.5) are applied app-side
-- in src/features/tutors/engagement.ts where the approved grade labels and
-- verification tier already live — SQL ordering here is candidate selection
-- only, the app re-ranks the candidate set.
create or replace function public.get_trending_tutors(
  p_candidate_limit int default 24
)
returns table (
  tutor_id uuid,
  base_score bigint,
  inquiries_7d bigint,
  views_30d bigint,
  requests_30d bigint,
  saves_total bigint,
  saves_30d bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with eng as (
    select
      t.id,
      (select count(*) from public.tutor_engagement_events e
        where e.tutor_id = t.id
          and e.event_type = 'inquiry_click'
          and e.event_day > (now() at time zone 'Asia/Hong_Kong')::date - 7) as inquiries_7d,
      (select count(*) from public.tutor_engagement_events e
        where e.tutor_id = t.id
          and e.event_type = 'profile_view'
          and e.event_day > (now() at time zone 'Asia/Hong_Kong')::date - 30) as views_30d,
      (select count(*) from public.tutor_engagement_events e
        where e.tutor_id = t.id
          and e.event_type = 'request_click'
          and e.event_day > (now() at time zone 'Asia/Hong_Kong')::date - 30) as requests_30d,
      (select count(*) from public.saved_tutors s where s.tutor_id = t.id) as saves_total,
      (select count(*) from public.saved_tutors s
        where s.tutor_id = t.id and s.created_at >= now() - interval '30 days') as saves_30d
    from public.tutors t
    where t.is_published
  )
  select
    id,
    views_30d + saves_30d * 5 + requests_30d * 15,
    inquiries_7d,
    views_30d,
    requests_30d,
    saves_total,
    saves_30d
  from eng
  order by 2 desc, requests_30d desc, saves_30d desc, inquiries_7d desc
  limit greatest(p_candidate_limit, 1);
$$;

grant execute on function public.record_tutor_engagement(uuid, text, text) to anon, authenticated;
grant execute on function public.get_tutor_engagement(uuid[]) to anon, authenticated;
grant execute on function public.get_trending_tutors(int) to anon, authenticated;
