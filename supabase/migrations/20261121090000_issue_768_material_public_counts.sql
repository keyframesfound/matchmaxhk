-- Issue #768 (Part 2 §3.A / §5 AC #4) — aggregate public counts for note /
-- course cards, so a card can render ONE muted social-proof line and never a
-- raw "0 sold".
--
-- Exposes ONLY aggregate integers. Saved notes live per-account in
-- public.saved_materials behind owner-only RLS, so the client can never derive a
-- material-level save count on its own; this SECURITY DEFINER aggregate is the
-- only read path. No account_id, no buyer identity and no order row ever leaves
-- the database through this function.
--
-- Returns exactly one row per input id that exists in public.digital_materials,
-- even when both counts are 0: the caller must be able to tell "known listing
-- with no traction" (0/0 -> "New release") apart from "unknown id" (zero rows).
-- Empty or NULL input returns zero rows.
--
-- Read-only, additive: no tables altered, no indexes added. Idempotent.

create or replace function public.get_material_public_counts(p_ids uuid[])
returns table (
  material_id uuid,
  sold_count int,
  saves_count int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id as material_id,

    -- Delivered/published order count, already denormalised on the listing.
    coalesce(m.sold_count, 0)::int as sold_count,

    -- Distinct accounts that saved the listing. Guarded with to_regclass so the
    -- function definition still resolves if public.saved_materials is ever
    -- absent in a fresh environment.
    case
      when to_regclass('public.saved_materials') is null then 0
      else (
        select count(*)::int
          from public.saved_materials s
         where s.material_id = m.id
      )
    end as saves_count

  from unnest(coalesce(p_ids, '{}'::uuid[])) as x(id)
  join public.digital_materials m on m.id = x.id
$$;

comment on function public.get_material_public_counts(uuid[]) is
  'Issue #768: aggregate-only public material counts (sold_count + distinct saves). One row per known listing id; zero rows for empty/NULL input.';

revoke all on function public.get_material_public_counts(uuid[]) from public;
grant execute on function public.get_material_public_counts(uuid[]) to anon, authenticated;
