-- Referral bounty follows a corrected Administrative Matching Fee.
--
-- The 20261001120000 trigger inserted the 15% bounty with
-- "on conflict (referred_tutor_id) do nothing", so when ops corrected
-- fee_amount_cents afterwards the trigger re-fired but kept the stale amount.
-- It now upserts the amount while the bounty is still 'pending'; a settled
-- (ready_for_payout / paid) bounty is never rewritten.
--
-- Everything else is preserved verbatim: the 15% rate, round-half-away
-- rounding, the guard clauses, SECURITY DEFINER and search_path.
--
-- Re-run safe: create or replace, no trigger change.

create or replace function public.create_referral_bounty_on_fee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
  v_amount   integer;
begin
  if new.matched_tutor_id is null or new.fee_collected_at is null or new.fee_amount_cents is null then
    return new;
  end if;

  v_amount := round(new.fee_amount_cents * 0.15)::int;
  if v_amount < 1 then
    return new;
  end if;

  select referred_by into v_referrer from public.tutors where id = new.matched_tutor_id;
  if v_referrer is null then
    return new;
  end if;

  insert into public.referral_bounties
    (referred_tutor_id, referring_tutor_id, amount_cents, status, source_case_id)
  values
    (new.matched_tutor_id, v_referrer, v_amount, 'pending', new.id)
  on conflict (referred_tutor_id) do update
    set amount_cents   = excluded.amount_cents,
        source_case_id = excluded.source_case_id
    where public.referral_bounties.status = 'pending';

  return new;
end;
$$;

revoke execute on function public.create_referral_bounty_on_fee() from public, anon;
