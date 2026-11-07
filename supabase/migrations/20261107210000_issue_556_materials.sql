-- #556 Materials upgrade.
-- 1. Collections organise a seller's Materials tab. They never have a price or
--    a checkout. RLS-deny; access only through owner-checked server fns.
create table if not exists public.material_collections (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);
create unique index if not exists material_collections_tutor_name_uq
  on public.material_collections (tutor_id, lower(btrim(name)));

revoke all on public.material_collections from anon, authenticated;
grant select, insert, update, delete on public.material_collections to service_role;
alter table public.material_collections enable row level security;

alter table public.digital_materials
  add column if not exists collection_id uuid
    references public.material_collections(id) on delete set null,
  -- Mock listings: the seller attests these are original or licensed papers.
  add column if not exists legal_originals_attested_at timestamptz;

create index if not exists idx_digital_materials_collection
  on public.digital_materials (collection_id)
  where collection_id is not null;

-- 2. Marking services: a missed deadline refunds in full, with no grace period.
-- The clock only exists once the buyer uploads a draft, so a buyer who has not
-- uploaded is never swept. Status-guarded, so it can only flip each order once.
create or replace function public.refund_missed_marking_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  refunded integer;
begin
  with missed as (
    update public.material_orders mo
    set status = 'refunded',
        refund_requested_at = now(),
        refund_reason = 'Marking deadline missed'
    from public.digital_materials dm
    where dm.id = mo.material_id
      and dm.material_type = 'gig'
      and dm.gig_category = 'document_review'
      and dm.gig_delivery_type = 'file_back'
      and mo.status in ('in_fulfillment', 'past_due')
      and mo.fulfillment_due_at is not null
      and mo.fulfillment_due_at <= now()
      and mo.delivered_at is null
    returning mo.id, mo.tutor_id
  ), strikes as (
    insert into public.tutor_ghost_strikes (tutor_id, order_id, reason)
    select tutor_id, id, 'Marking deadline missed, auto-refunded' from missed
    on conflict (order_id) do nothing
  )
  select count(*) into refunded from missed;
  return refunded;
end;
$$;

revoke all on function public.refund_missed_marking_orders() from public, anon, authenticated;
grant execute on function public.refund_missed_marking_orders() to service_role;

select cron.schedule(
  'refund-missed-marking-orders',
  '*/15 * * * *',
  'select public.refund_missed_marking_orders()'
);

-- 3. Replace File (v2): the same listing, sales and reviews with a new file.
-- Buyers' stamped copies are re-stamped from the new original on next download.
alter table public.digital_materials
  add column if not exists file_updated_at timestamptz;
alter table public.material_orders
  add column if not exists delivered_copy_at timestamptz;

create or replace function public.stamp_material_file_updated()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'published'
     and old.original_file_path is not null
     and new.original_file_path is distinct from old.original_file_path then
    new.file_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stamp_material_file_updated on public.digital_materials;
create trigger trg_stamp_material_file_updated
  before update on public.digital_materials
  for each row execute function public.stamp_material_file_updated();
