-- Referral automation (follow-up to 20260926000000_add_tutor_referrals):
-- capture which tutor won a case and when the Administrative Matching Fee
-- was collected, then auto-log the referrer's 15% bounty. One bounty per
-- referred tutor (first successful case only, enforced by the existing
-- UNIQUE constraint); amounts stay admin-editable and FPS payouts remain
-- manual.

alter table public.tutoring_cases
  add column matched_tutor_id uuid references public.tutors(id) on delete set null,
  add column matched_at timestamptz,
  add column fee_collected_at timestamptz,
  add column fee_amount_cents integer check (fee_amount_cents is null or fee_amount_cents > 0);

create index idx_tutoring_cases_matched_tutor on public.tutoring_cases (matched_tutor_id);

alter table public.referral_bounties
  add column source_case_id uuid references public.tutoring_cases(id) on delete set null;

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
  on conflict (referred_tutor_id) do nothing;

  return new;
end;
$$;

revoke execute on function public.create_referral_bounty_on_fee() from public, anon;

create trigger trg_cases_fee_referral_bounty
  after insert or update of matched_tutor_id, fee_collected_at, fee_amount_cents
  on public.tutoring_cases
  for each row execute function public.create_referral_bounty_on_fee();

comment on column public.tutoring_cases.matched_tutor_id is 'Tutor who won the case; set via admin case detail when marking the case matched.';
comment on column public.tutoring_cases.fee_collected_at is 'When the Administrative Matching Fee was received from the client (offline FPS).';
comment on column public.tutoring_cases.fee_amount_cents is 'Administrative Matching Fee collected from the client, in cents.';
comment on column public.referral_bounties.source_case_id is 'Case whose fee collection created this bounty, when automated.';
