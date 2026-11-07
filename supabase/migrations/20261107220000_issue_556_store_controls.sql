-- #556 follow-up.
-- 1. Pack-only: a seller can stop a pack's items being bought on their own.
--    Default true keeps every existing pack's behaviour.
alter table public.digital_materials
  add column if not exists sell_children_separately boolean not null default true,
  -- 2. Light format variants: a sibling listing with its own files and price.
  add column if not exists variant_of_id uuid
    references public.digital_materials(id) on delete set null,
  add column if not exists variant_label text
    check (variant_label is null or char_length(btrim(variant_label)) between 1 and 30);

create index if not exists idx_digital_materials_variant_of
  on public.digital_materials (variant_of_id)
  where variant_of_id is not null;

-- 3. The 24h draft reminder, sent at most once per order. It goes through the
--    case_events bus, so the bell shows it to the buyer.
alter table public.material_orders
  add column if not exists draft_reminder_sent_at timestamptz;

create or replace function public.remind_marking_draft_uploads()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  reminded integer;
begin
  with due as (
    update public.material_orders mo
    set draft_reminder_sent_at = now()
    from public.digital_materials dm
    where dm.id = mo.material_id
      and dm.material_type = 'gig'
      and dm.gig_category = 'document_review'
      and dm.gig_delivery_type = 'file_back'
      and mo.status = 'in_fulfillment'
      and mo.buyer_source_path is null
      and mo.draft_reminder_sent_at is null
      and mo.in_fulfillment_at <= now() - interval '24 hours'
    returning mo.id, mo.material_id, mo.buyer_account_id
  ), events as (
    insert into public.case_events (event_type, payload, source_table, source_id)
    select
      'note_order.draft_needed',
      jsonb_build_object(
        'order_id', id,
        'material_id', material_id,
        'buyer_account_id', buyer_account_id
      ),
      'material_orders',
      id
    from due
  )
  select count(*) into reminded from due;
  return reminded;
end;
$$;

revoke all on function public.remind_marking_draft_uploads() from public, anon, authenticated;
grant execute on function public.remind_marking_draft_uploads() to service_role;

select cron.schedule(
  'remind-marking-draft-uploads',
  '0 * * * *',
  'select public.remind_marking_draft_uploads()'
);
