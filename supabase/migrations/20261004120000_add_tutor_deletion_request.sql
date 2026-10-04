-- Issue #101: tutor self-serve account-deletion requests.
-- A non-null `deletion_requested_at` marks the tutor's account status as
-- `deletion_pending`; the wipe itself happens only when an admin approves
-- (auth.users delete cascades). Denying the request resets it to null.
alter table public.tutors
  add column if not exists deletion_requested_at timestamptz;

comment on column public.tutors.deletion_requested_at is 'Set when the assigned tutor account requests account deletion (status: deletion_pending); null otherwise. Admin approval wipes the account, denial resets this to null.';
