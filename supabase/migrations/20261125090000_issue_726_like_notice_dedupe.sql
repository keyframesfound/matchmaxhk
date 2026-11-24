-- #726 AC-4: one engagement notice per (actor, item, action), ever.
--
-- The save path already deduped through engagement_notified, but the new like
-- path inserted its own case_events row, so Like / Unlike / Like five times in
-- a row could produce several notifications. The notify RPC now takes the
-- action as an argument, dedupes on it, and stamps it into the payload so the
-- bell can pick like copy. The three-argument signature is dropped and
-- recreated with a defaulted fourth (_action = 'saved'), so existing callers
-- and the saved_* triggers keep working unchanged.

drop function if exists public.notify_engagement_saved(uuid, text, uuid);

create or replace function public.notify_engagement_saved(
  _actor uuid,
  _entity_type text,
  _entity_id uuid,
  _action text default 'saved'
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

  -- No owner, or acting on your own listing: never notify.
  if _owner is null or _owner = _actor then
    return;
  end if;

  -- Toggle-proof: one notification per (actor, item, action), ever. A like
  -- after an unlike finds the row already there and stays silent.
  insert into public.engagement_notified (actor_id, entity_type, entity_id, action)
    values (_actor, _entity_type, _entity_id, _action)
    on conflict do nothing;
  get diagnostics _inserted = row_count;
  if _inserted = 0 then
    return;
  end if;

  select exists (
    select 1 from public.user_roles r where r.user_id = _actor and r.role = 'tutor'
  ) into _actor_is_tutor;

  -- Privacy: only an anonymous role label, never the actor's identity.
  insert into public.case_events (event_type, payload, source_table, source_id)
  values (
    'engagement.saved',
    jsonb_build_object(
      'recipient_account_id', _owner,
      'context', _context,
      'entity_type', _entity_type,
      'action', _action,
      'label', left(coalesce(_label, ''), 80),
      'link', _link,
      'actor_kind', case when _actor_is_tutor then 'user' else 'parent_or_student' end
    ),
    case
      when _action = 'liked' then 'material_likes'
      when _entity_type = 'tutor' then 'saved_tutors'
      when _entity_type = 'material' then 'saved_materials'
      else 'saved_cases'
    end,
    _entity_id
  );
exception when others then
  -- Notifications must never block the action itself.
  raise warning 'notify_engagement_saved failed: %', sqlerrm;
end;
$$;

revoke execute on function public.notify_engagement_saved(uuid, text, uuid, text)
  from public, anon, authenticated;
