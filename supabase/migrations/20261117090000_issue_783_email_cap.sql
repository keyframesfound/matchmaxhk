-- #783 §2.3: promo-email cap (max 1 automated email / digest per 7 days per
-- user) and an explicit, unchecked marketing opt-in.
-- Applied to production 2026-11-17 (additive, idempotent).
alter table public.profiles
  add column if not exists marketing_email_opt_in boolean not null default false,
  add column if not exists last_automated_digest_sent_at timestamptz;

-- Atomically claims this user's 7-day automated-mail slot. True = the caller
-- may send now (opted in and nothing automated in the last 7 days); the slot
-- is stamped in the same statement so two sends cannot both pass.
-- Server only: anyone but the service role gets false.
create or replace function public.claim_automated_digest_slot(_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _claimed uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    return false;
  end if;
  update public.profiles
     set last_automated_digest_sent_at = now()
   where id = _user
     and marketing_email_opt_in
     and (last_automated_digest_sent_at is null
          or last_automated_digest_sent_at < now() - interval '7 days')
  returning id into _claimed;
  return _claimed is not null;
end;
$$;
