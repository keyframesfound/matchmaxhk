-- #782 §2.4 (was #755/#216/#294): Urgent Safety reason on the shipped report
-- button + auto-quarantine (1 verified-matched / 3 authentic unmatched) + the
-- staff-only one-click Emergency Suspend. Additive only: two nullable stamp
-- columns on tutors, one on digital_materials, one new audit table. Reversible
-- by staff (clear the column + an audit row). Never stores reporter identity
-- anywhere the reported party can read.

-- ---------------------------------------------------------------------------
-- 1. Quarantine / suspend stamps (nullable = clean; set = hidden from public)
-- ---------------------------------------------------------------------------
alter table public.tutors
  add column if not exists quarantined_at timestamptz;

alter table public.tutors
  add column if not exists suspended_at timestamptz;

alter table public.digital_materials
  add column if not exists quarantined_at timestamptz;

comment on column public.tutors.quarantined_at is
  '#782 §2.4 auto-quarantine: set when an urgent safety report quarantines the public profile (1 verified-matched reporter, or 3 authentic unmatched). Cleared by staff to reverse.';
comment on column public.tutors.suspended_at is
  '#782 §2.4 Emergency Suspend: staff-only kill-switch stamp. Unpublishes the profile and listings, blocks new accepts/uploads/publishes (server fns gate on this). Cleared by staff to lift.';
comment on column public.digital_materials.quarantined_at is
  '#782 §2.4 auto-quarantine flag for a storefront listing (the report target was the listing itself). Public listing reads exclude quarantined rows; staff clear it to reverse.';

-- ---------------------------------------------------------------------------
-- 2. reports: allow the new P0 reason 'urgent_safety'
--    (appends to the existing list; existing reasons keep their positions)
-- ---------------------------------------------------------------------------
alter table public.reports drop constraint if exists reports_reason_check;

alter table public.reports add constraint reports_reason_check check (reason in (
  'contact_details',
  'inappropriate_image',
  'copyright',
  'fake_credentials',
  'not_as_described',
  'harassment',
  'spam',
  'impersonation',
  'other',
  'urgent_safety'
));

-- Re-assert both INSERT policies (same bodies as 20261011000000 +
-- 20261011200000) with the new reason added, so a client cannot insert the
-- value before the app schema knows it and nothing else changes.
drop policy if exists "Users can submit reports" on public.reports;

create policy "Users can submit reports"
  on public.reports
  for insert
  to authenticated
  with check (
    auth.uid() = reporter_id
    and status = 'open'
    and resolved_at is null
    and target_type in (
      'tutor_card', 'tutor_photo', 'tutor_introduction', 'material'
    )
    and reason in (
      'contact_details', 'inappropriate_image', 'copyright', 'fake_credentials',
      'not_as_described', 'harassment', 'spam', 'impersonation', 'other',
      'urgent_safety'
    )
    and (reason <> 'other' or (note is not null and length(btrim(note)) > 0))
  );

-- ---------------------------------------------------------------------------
-- 3. Audit trail for staff Emergency Suspend / quarantine actions
--    RLS on with no policies (service-role only), same pattern as
--    safety_attestations (20261119090000).
-- ---------------------------------------------------------------------------
create table if not exists public.trust_suspensions (
  id uuid primary key default gen_random_uuid(),
  -- 'suspend' | 'lift' | 'quarantine' | 'unquarantine'
  action text not null check (action in ('suspend', 'lift', 'quarantine', 'unquarantine')),
  tutor_id uuid references public.tutors(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  actor_id uuid not null references auth.users(id) on delete cascade,
  actor_email text,
  note text,
  -- Lift-time restore data: prev_is_published, hidden_listing_ids, target ids.
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_trust_suspensions_tutor
  on public.trust_suspensions (tutor_id, created_at desc);

alter table public.trust_suspensions enable row level security;

comment on table public.trust_suspensions is
  '#782 §2.4 audit rows for staff Emergency Suspend / lift and quarantine / unquarantine actions. Staff note lives here. RLS on, no policies: only the service role (admin-gated server fns) reads and writes.';

-- ---------------------------------------------------------------------------
-- 4. Public RPCs: exclude quarantined listings. Same shapes, signatures and
--    grants as 20261024210000; only the WHERE clause widens, so a quarantined
--    listing leaves the home Notes row and the tutor profile notes block
--    without touching the status machine.
-- ---------------------------------------------------------------------------
create or replace function public.get_home_notes(p_limit int default 8)
returns table (
  id                 uuid,
  title              text,
  slug               text,
  price_hkd          numeric,
  material_type      text,
  curriculum_tag     text,
  subject_tag        text,
  tutor_code         text,
  tutor_display_name text,
  verification_tier  text,
  bought_count       bigint,
  created_at         timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
    select
      dm.id,
      dm.title,
      dm.slug,
      dm.price_hkd,
      dm.material_type,
      dm.curriculum_tag,
      dm.subject_tag,
      t.tutor_code,
      t.display_name as tutor_display_name,
      t.verification_tier,
      (
        select count(*)
        from public.material_orders mo
        where mo.material_id = dm.id
          and mo.status = 'delivered'
      ) as bought_count,
      dm.created_at
    from public.digital_materials dm
    join public.tutors t
      on t.id = dm.tutor_id
     and t.is_published = true
    where dm.status = 'published'
      and dm.quarantined_at is null
      and dm.material_type not in ('gig', 'topic_folder', 'video_course', 'general_course')
    order by
      (
        select count(*)
        from public.material_orders mo
        where mo.material_id = dm.id
          and mo.status = 'delivered'
      ) desc nulls last,
      dm.created_at desc
    limit greatest(p_limit, 0);
end;
$$;

create or replace function public.get_tutor_public_notes(p_tutor_code text)
returns table (
  id                 uuid,
  title              text,
  slug               text,
  price_hkd          numeric,
  material_type      text,
  curriculum_tag     text,
  subject_tag        text,
  tutor_code         text,
  tutor_display_name text,
  verification_tier  text,
  bought_count       bigint,
  created_at         timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
    select
      dm.id,
      dm.title,
      dm.slug,
      dm.price_hkd,
      dm.material_type,
      dm.curriculum_tag,
      dm.subject_tag,
      t.tutor_code,
      t.display_name as tutor_display_name,
      t.verification_tier,
      (
        select count(*)
        from public.material_orders mo
        where mo.material_id = dm.id
          and mo.status = 'delivered'
      ) as bought_count,
      dm.created_at
    from public.digital_materials dm
    join public.tutors t
      on t.id = dm.tutor_id
     and t.is_published = true
    where dm.status = 'published'
      and dm.quarantined_at is null
      and dm.material_type not in ('gig', 'topic_folder', 'video_course', 'general_course')
      and t.tutor_code = p_tutor_code
    order by
      (
        select count(*)
        from public.material_orders mo
        where mo.material_id = dm.id
          and mo.status = 'delivered'
      ) desc nulls last,
      dm.created_at desc;
end;
$$;

grant execute on function public.get_home_notes(int) to anon, authenticated;
grant execute on function public.get_tutor_public_notes(text) to anon, authenticated;
