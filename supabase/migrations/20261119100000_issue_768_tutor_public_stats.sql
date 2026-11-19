-- Issue #768 — public tutor stats for the marketplace card / profile surface.
--
-- Exposes ONLY aggregate counts. No student names, no lesson titles, no earnings,
-- and no parent identities ever leave the database through this function.
--
-- Returns exactly one row per input tutor id that exists in public.tutors, even
-- when every count is 0. That is deliberate: the caller must be able to tell
-- "known tutor with no activity" apart from "unknown tutor" (zero rows).
-- Empty or NULL input returns zero rows.
--
-- LIMITATION (engagement_count): request_click rows in
-- public.tutor_engagement_events carry an anonymous browser viewer_key, not an
-- authenticated user id (see 20261016150000_tutor_engagement_events.sql). So
-- engagement_count is a count of distinct identities (user ids for saves,
-- viewer keys for requests), NOT a verified distinct-parent count.
--
-- Read-only, additive: no tables altered, no indexes added.

create or replace function public.get_tutor_public_stats(p_tutor_ids uuid[])
returns table (
  tutor_id uuid,
  active_cases int,
  engagement_count int,
  requests_14d int,
  saves_14d int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id as tutor_id,

    -- Mirrors activeStudents in src/features/channels/channel.functions.ts:88-91.
    (select count(*)::int from public.tutoring_cases c
      where c.matched_tutor_id = t.id
        and c.sor_status is not null
        and c.sor_status not in ('closed', 'replaced')) as active_cases,

    -- Distinct identities in the last 30 days: saves are attributable to a user
    -- id, requests only to an anonymous viewer_key. Excludes the tutor's own
    -- account where an identity is known.
    (select count(*)::int from (
       select s.user_id::text as ident
         from public.saved_tutors s
        where s.tutor_id = t.id
          and s.created_at >= now() - interval '30 days'
          and s.user_id is distinct from t.user_id
       union
       select e.viewer_key as ident
         from public.tutor_engagement_events e
        where e.tutor_id = t.id
          and e.event_type = 'request_click'
          and e.event_day > (now() at time zone 'Asia/Hong_Kong')::date - 30
     ) ids) as engagement_count,

    -- Same event table and day filter style as get_tutor_engagement.
    (select count(*)::int from public.tutor_engagement_events e
      where e.tutor_id = t.id
        and e.event_type = 'request_click'
        and e.event_day > (now() at time zone 'Asia/Hong_Kong')::date - 14) as requests_14d,

    -- Saves live in public.saved_tutors, not in the events table.
    (select count(*)::int from public.saved_tutors s
      where s.tutor_id = t.id
        and s.created_at >= now() - interval '14 days') as saves_14d

  from unnest(p_tutor_ids) as x(id)
  join public.tutors t on t.id = x.id
$$;

comment on function public.get_tutor_public_stats(uuid[]) is
  'Issue #768: aggregate-only public tutor stats (active cases, 30d distinct engagement identities, 14d requests, 14d saves). One row per known tutor id; zero rows for empty/NULL input.';

grant execute on function public.get_tutor_public_stats(uuid[]) to anon, authenticated;
