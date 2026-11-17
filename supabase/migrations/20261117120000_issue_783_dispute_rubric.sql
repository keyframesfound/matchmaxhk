-- #783 §2.1 (AC-559-2): staff dispute rubric + persistent seller strikes.
-- Additive only. The rubric verdict is stored on the order so every decision
-- keeps its audit trail; strikes live on profiles.strike_count (added in
-- 20261102090000_issue_573_option_a.sql), which is NOT reset by temporary
-- suspensions because suspensions only touch account_status.

alter table public.material_orders
  add column if not exists dispute_rubric jsonb,
  add column if not exists dispute_strike_recorded boolean not null default false;

-- Atomic +1 on the seller's strike count. Service role only (the staff desk
-- server fn), so users can never bump or reset their own count.
create or replace function public.record_seller_strike(_user uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.profiles
     set strike_count = strike_count + 1
   where id = _user
  returning strike_count into next_count;
  return next_count;
end;
$$;

grant execute on function public.record_seller_strike(uuid) to service_role;
