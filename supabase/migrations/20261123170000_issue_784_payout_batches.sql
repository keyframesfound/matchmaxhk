-- #784 §2.2: the weekly Monday FPS payout batch.
--
-- Ledger payout entries clear seller balances; this records which run did it,
-- for whom, and at what amounts, so a payout can always be traced back.
-- EXECUTE is service-role only: money writes never come from a browser session.

create table if not exists public.payout_batches (
  id uuid primary key default gen_random_uuid(),
  batch_date date not null,
  status text not null default 'paid' check (status in ('draft','paid','void')),
  seller_count integer not null default 0,
  total_hkd numeric not null default 0,
  adjustment_hkd numeric not null default 0,
  approved_by uuid,
  created_by uuid,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.payout_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.payout_batches(id) on delete cascade,
  user_id uuid not null,
  tutor_code text,
  seller_name text,
  balance_hkd numeric not null,
  paid_hkd numeric not null,
  method text,
  payee_name text,
  ledger_entry_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists payout_batch_items_batch_idx on public.payout_batch_items (batch_id);
alter table public.payout_batches enable row level security;
alter table public.payout_batch_items enable row level security;

create or replace function public.run_payout_batch(
  p_batch_date date,
  p_note text,
  p_items jsonb,
  p_created_by uuid,
  p_approved_by uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_batch_id uuid;
  v_item jsonb;
  v_count integer := 0;
  v_total numeric := 0;
  v_entry_id uuid;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A payout batch needs at least one seller.' using errcode = 'check_violation';
  end if;

  insert into public.payout_batches (batch_date, status, approved_by, created_by, note)
  values (p_batch_date, 'paid', p_approved_by, p_created_by, left(p_note, 500))
  returning id into v_batch_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if (v_item ->> 'paidHkd')::numeric <= 0 then
      raise exception 'Payout items must be positive.' using errcode = 'check_violation';
    end if;

    insert into public.seller_balance_entries (user_id, kind, amount_hkd, note, created_by)
    values (
      (v_item ->> 'userId')::uuid,
      'payout',
      -((v_item ->> 'paidHkd')::numeric),
      'Monday FPS batch ' || p_batch_date::text,
      p_created_by
    )
    returning id into v_entry_id;

    insert into public.payout_batch_items (
      batch_id, user_id, tutor_code, seller_name, balance_hkd, paid_hkd, method, payee_name, ledger_entry_id
    ) values (
      v_batch_id,
      (v_item ->> 'userId')::uuid,
      v_item ->> 'tutorCode',
      v_item ->> 'sellerName',
      (v_item ->> 'balanceHkd')::numeric,
      (v_item ->> 'paidHkd')::numeric,
      v_item ->> 'method',
      v_item ->> 'payeeName',
      v_entry_id
    );

    v_count := v_count + 1;
    v_total := v_total + (v_item ->> 'paidHkd')::numeric;
  end loop;

  update public.payout_batches b
  set seller_count = v_count, total_hkd = round(v_total, 2)
  where b.id = v_batch_id;

  return v_batch_id;
end;
$fn$;

revoke all on function public.run_payout_batch(date,text,jsonb,uuid,uuid) from public, anon, authenticated;
grant execute on function public.run_payout_batch(date,text,jsonb,uuid,uuid) to service_role;