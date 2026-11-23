-- Issue #815 §2.4: study materials published "as Centre".
--
-- Attribution only. digital_materials keeps its tutor_id seller on the #784
-- tutor-seller rails (checkout/payout unchanged); organization_id adds a
-- display/attribution link to a Partner Centre. Additive: one nullable column,
-- one partial index, one guard trigger. No RLS policy change, no data backfill,
-- no drops beyond `drop trigger if exists` for the trigger created here.

alter table public.digital_materials
  add column if not exists organization_id uuid
    references public.organizations(id) on delete set null;

create index if not exists idx_digital_materials_organization
  on public.digital_materials(organization_id)
  where organization_id is not null;

-- Guard: an attributed listing must point at an active centre and its seller
-- account must be an active owner/admin of that centre.
--
-- Deliberately narrow on UPDATE: only re-validate when organization_id or
-- tutor_id actually changed. An unrelated edit (title, price, publish flag)
-- must not hard-fail just because a membership was revoked after the listing
-- was created — that would make the row uneditable.
create or replace function public.guard_material_organization()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.organization_id is not distinct from old.organization_id
     and new.tutor_id is not distinct from old.tutor_id then
    return new;
  end if;

  if not exists (
    select 1
    from public.organizations as o
    where o.id = new.organization_id
      and o.status = 'active'
  ) then
    raise exception 'Only an active Partner Centre can publish study materials.'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1
    from public.tutors as t
    join public.organization_members as m
      on m.user_id = t.user_id
    where t.id = new.tutor_id
      and m.organization_id = new.organization_id
      and m.status = 'active'
      and m.role in ('owner', 'admin')
  ) then
    raise exception 'Only a centre owner or admin can publish as that centre.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_digital_materials_org_guard on public.digital_materials;

create trigger trg_digital_materials_org_guard
  before insert or update of organization_id, tutor_id on public.digital_materials
  for each row execute function public.guard_material_organization();
