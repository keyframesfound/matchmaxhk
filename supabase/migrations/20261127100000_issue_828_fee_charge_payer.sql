-- #828 AC-B4 / #760 22 Nov Lock #6: a pre-L1 <24h cancel or parent no-show is
-- billed to the PARENT (1.0xR collected via MatchMax); the tutor takes home $0
-- and owes no admin fee out of pocket. final_commission_due remains "whole HKD
-- due to MatchMax"; this column names who owes it.
alter table public.tutoring_cases
  add column if not exists fee_charge_payer text not null default 'tutor';

alter table public.tutoring_cases
  drop constraint if exists tutoring_cases_fee_charge_payer_check;
alter table public.tutoring_cases
  add constraint tutoring_cases_fee_charge_payer_check
  check (fee_charge_payer in ('tutor', 'parent'));

comment on column public.tutoring_cases.fee_charge_payer is
  '#828 AC-B4: who owes final_commission_due. parent = pre-L1 no-show or <24h late cancel under #760 Lock #6.';
