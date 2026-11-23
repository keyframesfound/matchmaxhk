-- Issue #782 (was #755) AC-755-A1: a tutor card must not be re-published
-- without the Safety Attestation on file.
--
-- The UI gate already exists (src/features/trust/safety-attestation.functions.ts
-- + the dashboard check). It is not a boundary: the settings visibility toggle
-- (src/features/settings/sections/my-tutor-profile-section.tsx:795) and any
-- direct PostgREST call under the tutors_owner_update policy both write
-- tutors.is_published straight from the browser. This migration moves the rule
-- into the database so the toggle and REST share one enforcement point.
--
-- What it does, and what it deliberately does not do:
--
--   * Gated: UPDATE that takes a card from not-published to published, on a
--     row that has an owner (user_id is not null). That is the tutor's own
--     re-publish, and it requires a signed safety_attestations row.
--   * Exempt: INSERT. publish_tutor_from_application() creates the card
--     already published (supabase/migrations/20261028110000_*.sql:191,
--     is_published defaults to true) before the tutor has ever seen the
--     dashboard gate, so gating INSERT would break /join for every new tutor.
--     Every reuse branch of that RPC deliberately leaves is_published alone,
--     so a re-apply cannot reach this trigger either.
--   * Exempt: staff and system writes. The ban-restore flow republishes a card
--     it hid (src/features/admin-users/account-status.functions.ts:202,
--     service role), and admins hold their own UPDATE policy on tutors. Those
--     are staff decisions about a card, not the tutor republishing their own
--     profile, and the restore call does not check the update's error, so
--     gating it would silently leave a restored tutor hidden. The exemption is
--     keyed on the effective request role (service_role, or an admin/
--     super_admin JWT) - never reachable from a tutor's own session.
--   * Not gated: unpublish. Hiding a card is always allowed.
--
-- The accepted attestation_version is not pinned here: the database has no
-- knowledge of SAFETY_ATTESTATION_VERSION, so it requires "a signed version".
-- Version currency (a bump re-prompts) stays in the app rule, which compares
-- the accepted versions against the current constant.
--
-- Additive only: one trigger function, one trigger. No RLS policy change, no
-- column, policy or grant change. Drop-and-recreate the trigger so a re-run is
-- idempotent.

create or replace function public.guard_tutor_publish_attestation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_role text := coalesce(current_setting('role', true), '');
  v_jwt_role text := coalesce(auth.role(), '');
begin
  -- Only the transition from hidden to published is gated; an INSERT is exempt
  -- because the join RPC publishes the brand-new card, and an unowned card
  -- (user_id is null) has no account to attest.
  if new.is_published is not true
     or tg_op <> 'UPDATE'
     or coalesce(old.is_published, false)
     or new.user_id is null then
    return new;
  end if;

  -- Staff and system paths keep the authority they had before this trigger.
  -- SECURITY DEFINER means current_user is this function's owner, so the
  -- request's real role is read from the role GUC / JWT claim instead.
  if v_request_role in ('service_role', 'postgres', 'supabase_admin')
     or v_jwt_role = 'service_role'
     or (v_jwt_role = 'authenticated' and (
           public.has_role(auth.uid(), 'admin'::public.app_role)
           or public.has_role(auth.uid(), 'super_admin'::public.app_role)
         )) then
    return new;
  end if;

  if not exists (
    select 1
    from public.safety_attestations a
    where a.user_id = new.user_id
      and a.safety_attestation_accepted_at is not null
      and a.attestation_version is not null
  ) then
    raise exception 'Complete the Safety Attestation before publishing your profile.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.guard_tutor_publish_attestation() is
  'Issue #782 AC-755-A1: blocks a tutor re-publishing their own card (is_published false -> true) without a signed safety_attestations row. INSERT and staff/system writes are exempt; see the migration header.';

drop trigger if exists trg_tutor_publish_attestation on public.tutors;
create trigger trg_tutor_publish_attestation
  before update of is_published
  on public.tutors
  for each row
  execute function public.guard_tutor_publish_attestation();
