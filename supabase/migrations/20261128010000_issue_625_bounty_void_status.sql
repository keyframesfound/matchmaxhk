-- #625: a referral bounty can now be voided when the fee that created it is
-- waived or refunded before any cash was collected. The value is added in its
-- own migration because PostgreSQL cannot use a new enum label in the same
-- transaction that adds it.
ALTER TYPE public.referral_bounty_status ADD VALUE IF NOT EXISTS 'voided';
