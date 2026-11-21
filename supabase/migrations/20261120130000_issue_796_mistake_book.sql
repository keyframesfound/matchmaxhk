-- Issue #796 §2.2 — Digital Mistake Book (錯題本).
--
-- ADDITIVE ONLY: one new table, one private storage bucket, two helper
-- functions, indexes and RLS policies. Nothing existing is altered — in
-- particular the #785 50 MB case-file cap and this ticket's 5 MB per-image cap
-- stay independent (enforced in the server fn and mirrored by the bucket's
-- file_size_limit).
--
-- Model
--   case_mistakes  one row per mistake the STUDENT or PARENT uploads before
--                  class (tutor entry is never required — #767 stays the sole
--                  structured tutor write). The row carries the question
--                  (image and/or text), an optional correction / tutor tip
--                  (image and/or text), the syllabus #tag borrowed from the
--                  case's heatmap tags (#740/#767 vocabulary), and the
--                  REQUIRED error-reason pill:
--                    concept_gap | careless_mistake | exam_keyword | time_management
--                  Lifecycle: unresolved -> practiced_once -> mastered.
--
-- Scope + rematch history
--   student_id (or, when the case has no #459 child sub-profile, the owning
--   parent via owner_user_id) plus `subject` is the book's identity. A rematch
--   in the SAME subject creates a new tutoring_cases row, so the read policy
--   also lets a party of ANY case for that learner + subject read the earlier
--   rows: history survives the rematch without a second table.
--
-- Visibility (never public)
--   student (students.owner_user_id), linked parent (tutoring_cases.parent_id),
--   assigned tutor (tutoring_cases.matched_tutor_id -> tutors.user_id) and
--   Ops / Admin / Staff (public.has_role). No anon access, no sharing.
--
-- Images live in the private `case-mistakes` bucket, written and read only by
-- service-role server fns (signed URLs on read) — same as grade-slips.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.case_mistakes (
  id uuid primary key default gen_random_uuid(),
  -- The case the mistake was uploaded on. CASCADE: a purged case takes its
  -- rows with it; a REMATCH never deletes rows (it is a new case row).
  case_id uuid not null references public.tutoring_cases (id) on delete cascade,
  -- Learner scope for cross-case history: the #459 child sub-profile when the
  -- case has one, else null and owner_user_id (the parent) is the scope.
  student_id uuid references public.students (id) on delete set null,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  -- Denormalised from the case so the rematch lookup never has to join arrays.
  subject text not null check (char_length(btrim(subject)) between 1 and 80),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  source text check (source is null or char_length(source) <= 120),
  -- Syllabus #tag, same vocabulary as the #767 Super-Drawer / #740 heatmap.
  topic_tag text check (topic_tag is null or char_length(topic_tag) <= 60),
  error_reason text not null
    check (error_reason in ('concept_gap', 'careless_mistake', 'exam_keyword', 'time_management')),
  question_text text check (question_text is null or char_length(question_text) <= 2000),
  question_image_path text check (
    question_image_path is null
    or (char_length(question_image_path) <= 300 and question_image_path ~ '^[A-Za-z0-9/._-]+$')
  ),
  -- Optional correction (student) / exercise answer (tutor), text or image.
  solution_text text check (solution_text is null or char_length(solution_text) <= 2000),
  solution_image_path text check (
    solution_image_path is null
    or (char_length(solution_image_path) <= 300 and solution_image_path ~ '^[A-Za-z0-9/._-]+$')
  ),
  -- Tutor-written tip, kept apart from the learner's own correction so a
  -- later paid-lesson review never overwrites what the student wrote.
  tutor_tip_text text check (tutor_tip_text is null or char_length(tutor_tip_text) <= 1000),
  status text not null default 'unresolved'
    check (status in ('unresolved', 'practiced_once', 'mastered')),
  mastered_at timestamptz,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A mistake must carry a question: text or an uploaded image.
  constraint case_mistakes_question_present
    check (question_text is not null or question_image_path is not null)
);

comment on table public.case_mistakes is
  '#796 §2.2 Digital Mistake Book: student/parent-uploaded mistakes on a case. Parties + Ops only; never public.';

create index if not exists idx_case_mistakes_case_created
  on public.case_mistakes (case_id, created_at desc);
create index if not exists idx_case_mistakes_learner_subject
  on public.case_mistakes (owner_user_id, subject);
create index if not exists idx_case_mistakes_student_subject
  on public.case_mistakes (student_id, subject)
  where student_id is not null;

-- ---------------------------------------------------------------------------
-- updated_at touch (same shape as the #767 super-drawer trigger)
-- ---------------------------------------------------------------------------
create or replace function public.case_mistakes_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_case_mistakes_touch on public.case_mistakes;
create trigger trg_case_mistakes_touch before update on public.case_mistakes
  for each row execute function public.case_mistakes_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Party checks as SECURITY DEFINER helpers. They are called from the RLS
-- policies below, where a plain join to students / tutors / tutoring_cases
-- would itself be filtered by those tables' RLS. The helpers run as the owner
-- (same trick public.has_role already uses) and only ever answer a boolean.
-- ---------------------------------------------------------------------------
create or replace function public.mistake_book_case_party(_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tutoring_cases c
    left join public.tutors t on t.id = c.matched_tutor_id
    left join public.students s on s.id = c.student_id
    where c.id = _case_id
      and (
        c.parent_id = auth.uid()
        or t.user_id = auth.uid()
        or s.owner_user_id = auth.uid()
      )
  );
$$;

comment on function public.mistake_book_case_party(uuid) is
  '#796: true when auth.uid() is the parent, the claimed student or the assigned tutor of the case.';

create or replace function public.mistake_book_history_party(
  _student_id uuid,
  _owner_user_id uuid,
  _subject text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tutoring_cases c
    left join public.tutors t on t.id = c.matched_tutor_id
    left join public.students s on s.id = c.student_id
    where lower(_subject) = any (
        select lower(subject_value)
        from unnest(coalesce(c.subjects, array[]::text[])) as subject_value
      )
      and (
        (_student_id is not null and _student_id = c.student_id)
        or (_student_id is null and _owner_user_id = c.parent_id)
      )
      and (
        c.parent_id = auth.uid()
        or t.user_id = auth.uid()
        or s.owner_user_id = auth.uid()
      )
  );
$$;

comment on function public.mistake_book_history_party(uuid, uuid, text) is
  '#796: true when auth.uid() is a party of ANY case for the same learner + subject (rematch history).';

-- ---------------------------------------------------------------------------
-- RLS. pg_default_acl grants anon+authenticated FULL privileges on every new
-- public table, so the explicit REVOKE + deny-by-default RLS below is what
-- actually protects it.
-- ---------------------------------------------------------------------------
revoke all on public.case_mistakes from anon, authenticated;
grant select, insert, update, delete on public.case_mistakes to authenticated;
grant select, insert, update, delete on public.case_mistakes to service_role;

alter table public.case_mistakes enable row level security;

-- READ: parties of the row's case, rematch history for the same learner +
-- subject, and Ops / Admin / Staff. Nothing else, never anon.
drop policy if exists case_mistakes_party_select on public.case_mistakes;
create policy case_mistakes_party_select on public.case_mistakes
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'staff'::public.app_role)
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'super_admin'::public.app_role)
    or public.mistake_book_case_party(case_mistakes.case_id)
    or public.mistake_book_history_party(
      case_mistakes.student_id,
      case_mistakes.owner_user_id,
      case_mistakes.subject
    )
  );

-- WRITE: a party of the row's OWN case (self-upload / tutor exercise), plus
-- Ops. History rows from an earlier case stay read-only here.
drop policy if exists case_mistakes_party_insert on public.case_mistakes;
create policy case_mistakes_party_insert on public.case_mistakes
  for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'staff'::public.app_role)
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'super_admin'::public.app_role)
    or public.mistake_book_case_party(case_mistakes.case_id)
  );

drop policy if exists case_mistakes_party_update on public.case_mistakes;
create policy case_mistakes_party_update on public.case_mistakes
  for update to authenticated
  using (
    public.has_role(auth.uid(), 'staff'::public.app_role)
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'super_admin'::public.app_role)
    or public.mistake_book_case_party(case_mistakes.case_id)
  )
  with check (
    public.has_role(auth.uid(), 'staff'::public.app_role)
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'super_admin'::public.app_role)
    or public.mistake_book_case_party(case_mistakes.case_id)
  );

-- DELETE: whoever uploaded it (typo cleanup) plus Ops / Admin / Staff.
drop policy if exists case_mistakes_owner_delete on public.case_mistakes;
create policy case_mistakes_owner_delete on public.case_mistakes
  for delete to authenticated
  using (
    created_by = auth.uid()
    or owner_user_id = auth.uid()
    or public.has_role(auth.uid(), 'staff'::public.app_role)
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- ---------------------------------------------------------------------------
-- Storage: private mistake-photo bucket, service-role only (browsers never
-- touch it directly — the server fn uploads and mints signed read URLs).
-- 5 MB per OBJECT mirrors the ticket's image cap; it is NOT the #785
-- 50 MB case-file cap.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('case-mistakes', 'case-mistakes', false, 5242880)
on conflict (id) do nothing;

drop policy if exists "Service role manages case mistake photos" on storage.objects;
create policy "Service role manages case mistake photos"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'case-mistakes')
  with check (bucket_id = 'case-mistakes');
