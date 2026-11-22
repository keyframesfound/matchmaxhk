-- ---------------------------------------------------------------------------
-- Issue #816 §2.5 — audit the three desk fields edited straight from the browser
-- ---------------------------------------------------------------------------
-- The admin desk edits `board_published_at`, `priority_tier` and `tags` with a
-- direct PostgREST UPDATE from the browser (`cases_admin_all`, authenticated).
-- Those three had no audit trail at all: only status, fee, schedule-pause and
-- lesson transitions were recorded, and each of those is audited from app code
-- or from a column-scoped trigger. A code hook would miss whichever new call
-- path is added next, so the trail is enforced at the table instead.
--
-- Column-scoped on purpose: this trigger must never fire for `sor_status`,
-- whose audit is written by app code (and whose side effects belong to
-- trg_release_future_lessons / trg_award_community_champion). Status keeps its
-- own separate trigger, trg_case_board_status_audit (AFTER UPDATE OF status).
--
-- case_audit is service-role/staff shaped: RLS enabled, no policies, and no
-- grants to anon/authenticated. That is why this function is SECURITY DEFINER —
-- the browser writes tutoring_cases as `authenticated` and can never insert the
-- audit row itself; the function runs as the table owner and can.
-- ---------------------------------------------------------------------------

create or replace function public.audit_desk_case_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Each insert is revised in its own sub-block: an audit failure must never
  -- abort the desk's edit, and one failing insert must not swallow the other
  -- two. Warnings still surface in the Postgres logs for follow-up.
  if new.board_published_at is distinct from old.board_published_at then
    begin
      insert into public.case_audit (case_id, actor_id, from_status, to_status, reason)
      values (
        new.id,
        auth.uid(),
        null,
        case when new.board_published_at is null then 'board_unpublished' else 'board_published' end,
        case when new.board_published_at is null then 'unpublished' else 'published' end
      );
    exception when others then
      raise warning 'audit_desk_case_fields: board_published_at audit failed for case %: %', new.id, sqlerrm;
    end;
  end if;

  if new.priority_tier is distinct from old.priority_tier then
    begin
      insert into public.case_audit (case_id, actor_id, from_status, to_status, reason)
      values (
        new.id,
        auth.uid(),
        null,
        'priority_tier',
        left(
          coalesce(old.priority_tier, 'none') || ' -> ' || coalesce(new.priority_tier, 'none'),
          200
        )
      );
    exception when others then
      raise warning 'audit_desk_case_fields: priority_tier audit failed for case %: %', new.id, sqlerrm;
    end;
  end if;

  if new.tags is distinct from old.tags then
    begin
      insert into public.case_audit (case_id, actor_id, from_status, to_status, reason)
      values (
        new.id,
        auth.uid(),
        null,
        'tags_updated',
        left(
          coalesce(cardinality(old.tags), 0)::text || ' tags -> '
            || coalesce(cardinality(new.tags), 0)::text || ' tags',
          200
        )
      );
    exception when others then
      raise warning 'audit_desk_case_fields: tags audit failed for case %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;

comment on function public.audit_desk_case_fields() is
  '#816 §2.5: records board publish/unpublish, priority tier and tag changes made '
  'from the admin desk. Those three columns are updated directly from the browser, '
  'so the audit trail is enforced here rather than in a caller that a future code '
  'path could forget. Column-scoped to board_published_at, priority_tier and tags: '
  'never fires for sor_status or status, whose audits belong to app code and '
  'trg_case_board_status_audit. SECURITY DEFINER because case_audit has no grants '
  'to anon/authenticated. Inserts are exception-guarded so an audit failure cannot '
  'abort the desk edit.';

drop trigger if exists trg_audit_desk_case_fields on public.tutoring_cases;
create trigger trg_audit_desk_case_fields
  after update of board_published_at, priority_tier, tags
  on public.tutoring_cases
  for each row
  execute function public.audit_desk_case_fields();
