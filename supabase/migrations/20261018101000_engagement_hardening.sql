-- Issues #372 + #371: engagement RPC hardening (part of the 2026-10-18
-- hardening batch).

-- #372 items 1-2:
--   * `request_click` is retired from the accept list — no UI action sends
--     it today (the #102 inquiry surface is the only wired CTA), so keeping
--     it lets a script mint request events that score 15x on trending.
--     A real request action (issue #122 family) re-adds it deliberately.
--   * The 50/day cap is per viewer_key; rotating viewer UUIDs can inflate
--     inquiry/view counts that drive High demand / Parent Favorite / the
--     trending rail. New per-tutor per-day ceiling per event type (200)
--     bounds what a rotating-key bot can add while staying far above real
--     traffic (the trending cold-start floor currently qualifies 3 tutors).
CREATE OR REPLACE FUNCTION public.record_tutor_engagement(p_tutor_id uuid, p_event_type text, p_viewer_key text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_event_type not in ('profile_view', 'inquiry_click') then
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
  if (
    select count(*)
    from public.tutor_engagement_events
    where tutor_id = p_tutor_id
      and event_type = p_event_type
      and event_day = (now() at time zone 'Asia/Hong_Kong')::date
  ) >= 200 then
    return;
  end if;

  insert into public.tutor_engagement_events (tutor_id, event_type, viewer_key)
  values (p_tutor_id, p_event_type, p_viewer_key)
  on conflict (tutor_id, event_type, viewer_key, event_day) do nothing;
end;
$function$;

-- #371: the definer aggregate previously returned rows for ANY supplied
-- uuid, including unpublished tutors (probe returned a zero row for a draft
-- id). Join through tutors.is_published so unpublished ids return no row —
-- same publish gate the other two RPCs already apply.
CREATE OR REPLACE FUNCTION public.get_tutor_engagement(p_tutor_ids uuid[])
 RETURNS TABLE(tutor_id uuid, inquiries_7d bigint, views_30d bigint, requests_30d bigint, saves_total bigint, saves_30d bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  from unnest(p_tutor_ids) as t(id)
  join public.tutors tu on tu.id = t.id and tu.is_published;
$function$;

-- #372 item 4: the events table is write-via-RPC only (RLS deny-all with
-- zero policies already blocks direct access) — drop the standing grants so
-- a future policy slip cannot expose rows either. The RPCs are SECURITY
-- DEFINER and unaffected.
REVOKE ALL ON public.tutor_engagement_events FROM anon, authenticated;
