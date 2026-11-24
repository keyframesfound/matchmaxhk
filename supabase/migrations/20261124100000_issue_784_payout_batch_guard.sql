-- #784 money-safety follow-up (read-only audit finding A).
--
-- Two holes in the Monday FPS batch, both closed without changing the RPC
-- signature so the caller in src/features/materials/payout-batch.functions.ts
-- keeps working:
--
--   1. Idempotency. Two admins (or a double POST) could each compute the same
--      dueHkd from a pre-read preview and both call run_payout_batch, paying a
--      seller twice. The run now serialises on an advisory lock, re-reads each
--      seller's live ledger balance inside that lock, and clamps every paid
--      amount to least(passed, live balance). Rows that clamp to zero are
--      skipped instead of being rejected, so a stale line never aborts the
--      whole run.
--   2. One live batch per batch_date. A partial unique index means a second
--      batch for the same Monday is impossible unless the first is voided.
--
-- Re-run safe: create or replace for the function, if not exists for the index.

-- Fail loudly (and readably) if the live table already holds duplicate
-- batches for one date, which is exactly the state the index would reject.
do $$
declare
  v_dupes text;
begin
  select string_agg(format('%s (%s live batches)', d.batch_date, d.n), ', ')
  into v_dupes
  from (
    select b.batch_date, count(*) as n
    from public.payout_batches b
    where b.status <> 'void'
    group by b.batch_date
    having count(*) > 1
  ) d;

  if v_dupes is not null then
    raise exception
      'payout_batches has duplicate live batches for: %. Void the extra batches before applying the payout batch guard.',
      v_dupes
      using errcode = 'unique_violation';
  end if;
end;
$$;

create unique index if not exists payout_batches_live_batch_date_uidx
  on public.payout_batches (batch_date)
  where status <> 'void';

comment on index public.payout_batches_live_batch_date_uidx is
  'One live FPS batch per Monday; a batch must be voided before the date can be re-run.';

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
  v_item     jsonb;
  v_seen     text[] := '{}';
  v_balances jsonb := '{}'::jsonb;
  v_resolved jsonb := '[]'::jsonb;
  v_count    integer := 0;
  v_total    numeric := 0;
  v_entry_id uuid;
  v_user     uuid;
  v_paid     numeric;
  v_live     numeric;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A payout batch needs at least one seller.' using errcode = 'check_violation';
  end if;

  -- Serialise the whole run. A concurrent admin blocks here, then re-reads the
  -- live balances below and finds nothing left to pay.
  perform pg_advisory_xact_lock(hashtext('payout_batch'));

  -- Live balances for every seller in the request, in one pass.
  select coalesce(jsonb_object_agg(b.user_id::text, b.balance), '{}'::jsonb)
  into v_balances
  from (
    select e.user_id, round(sum(e.amount_hkd), 2) as balance
    from public.seller_balance_entries e
    where e.user_id in (
      select distinct (i ->> 'userId')::uuid
      from jsonb_array_elements(p_items) i
      where i ->> 'userId' is not null
    )
    group by e.user_id
  ) b;

  -- Resolve first, write second: a run where every line clamps to zero must
  -- roll back before any batch row or ledger entry exists.
  for v_item in select value from jsonb_array_elements(p_items) loop
    if v_item ->> 'userId' is null then
      continue;
    end if;

    v_user := (v_item ->> 'userId')::uuid;

    -- A repeated seller would otherwise be paid twice against one balance.
    if v_user::text = any (v_seen) then
      continue;
    end if;
    v_seen := v_seen || v_user::text;

    v_paid := (v_item ->> 'paidHkd')::numeric;
    if v_paid is null or v_paid <= 0 then
      continue;
    end if;

    v_live := round(coalesce((v_balances ->> v_user::text)::numeric, 0), 2);
    v_paid := least(v_paid, v_live);
    if v_paid <= 0 then
      continue;
    end if;

    v_resolved := v_resolved || jsonb_build_object(
      'userId', v_user,
      'tutorCode', v_item ->> 'tutorCode',
      'sellerName', v_item ->> 'sellerName',
      'balanceHkd', v_live,
      'paidHkd', v_paid,
      'method', v_item ->> 'method',
      'payeeName', v_item ->> 'payeeName'
    );
  end loop;

  if jsonb_array_length(v_resolved) = 0 then
    raise exception 'No seller in this batch still has a payable balance.' using errcode = 'check_violation';
  end if;

  insert into public.payout_batches (batch_date, status, approved_by, created_by, note)
  values (p_batch_date, 'paid', p_approved_by, p_created_by, left(p_note, 500))
  returning id into v_batch_id;

  for v_item in select value from jsonb_array_elements(v_resolved) loop
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
