-- #726: in-app engagement notifications when someone saves a tutor profile,
-- a Marketplace note or a case. DB triggers so every save path (client or
-- server) is covered. Owner-only, anonymous (role label only), toggle-proof.
-- Applied to production 2026-11-15 (idempotent, no drops).

-- Dedupe: one notification per (actor, item, action), ever. Service role only.
create table if not exists public.engagement_notified (
  actor_id uuid not null,
  entity_type text not null check (entity_type in ('tutor', 'material', 'case')),
  entity_id uuid not null,
  action text not null default 'saved',
  created_at timestamptz not null default now(),
  primary key (actor_id, entity_type, entity_id, action)
);
alter table public.engagement_notified enable row level security;

create or replace function public.notify_engagement_saved(
  _actor uuid, _entity_type text, _entity_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _owner uuid;
  _label text;
  _link text;
  _context text;
  _actor_is_tutor boolean;
  _inserted integer;
begin
  if _actor is null then
    return;
  end if;

  if _entity_type = 'tutor' then
    select t.user_id, t.tutor_code, '/account' into _owner, _label, _link
      from public.tutors t where t.id = _entity_id;
    _context := 'teaching';
  elsif _entity_type = 'material' then
    select t.user_id, m.title, '/notes/' || coalesce(m.slug, m.id::text) into _owner, _label, _link
      from public.digital_materials m join public.tutors t on t.id = m.tutor_id
      where m.id = _entity_id;
    _context := 'teaching';
  elsif _entity_type = 'case' then
    select c.parent_id, c.case_code, '/tutor-requests/' || c.case_code into _owner, _label, _link
      from public.tutoring_cases c where c.id = _entity_id;
    _context := 'learning';
  else
    return;
  end if;

  -- No owner, or saving your own listing: never notify.
  if _owner is null or _owner = _actor then
    return;
  end if;

  -- Toggle-proof: one notification per (actor, item, action), ever.
  insert into public.engagement_notified (actor_id, entity_type, entity_id, action)
    values (_actor, _entity_type, _entity_id, 'saved')
    on conflict do nothing;
  get diagnostics _inserted = row_count;
  if _inserted = 0 then
    return;
  end if;

  select exists (
    select 1 from public.user_roles r where r.user_id = _actor and r.role = 'tutor'
  ) into _actor_is_tutor;

  -- Privacy: only an anonymous role label, never the saver's identity.
  insert into public.case_events (event_type, payload, source_table, source_id)
  values (
    'engagement.saved',
    jsonb_build_object(
      'recipient_account_id', _owner,
      'context', _context,
      'entity_type', _entity_type,
      'label', left(coalesce(_label, ''), 80),
      'link', _link,
      'actor_kind', case when _actor_is_tutor then 'user' else 'parent_or_student' end
    ),
    case _entity_type when 'tutor' then 'saved_tutors' when 'material' then 'saved_materials' else 'saved_cases' end,
    _entity_id
  );
exception when others then
  -- Notifications must never block the save itself.
  raise warning 'notify_engagement_saved failed: %', sqlerrm;
end;
$$;

revoke execute on function public.notify_engagement_saved(uuid, text, uuid) from public, anon, authenticated;

create or replace function public.trg_saved_tutors_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_engagement_saved(new.user_id, 'tutor', new.tutor_id);
  return new;
end;
$$;

create or replace function public.trg_saved_materials_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_engagement_saved(new.account_id, 'material', new.material_id);
  return new;
end;
$$;

create or replace function public.trg_saved_cases_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_engagement_saved(new.user_id, 'case', new.case_id);
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'saved_tutors_notify_owner') then
    create trigger saved_tutors_notify_owner after insert on public.saved_tutors
      for each row execute function public.trg_saved_tutors_notify();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'saved_materials_notify_owner') then
    create trigger saved_materials_notify_owner after insert on public.saved_materials
      for each row execute function public.trg_saved_materials_notify();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'saved_cases_notify_owner') then
    create trigger saved_cases_notify_owner after insert on public.saved_cases
      for each row execute function public.trg_saved_cases_notify();
  end if;
end $$;
