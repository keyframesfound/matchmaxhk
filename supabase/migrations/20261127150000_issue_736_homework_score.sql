-- Issue #736 AC1: a graded homework row can carry an optional score, so
-- reviewed homework appears in the case gradebook. ADDITIVE ONLY: one nullable
-- column with a range check. case_assessments stays the manual score store;
-- this is the source for homework entries, keyed by reviewed_at.
alter table public.case_homework
  add column if not exists score_pct integer
  check (score_pct is null or score_pct between 0 and 100);

comment on column public.case_homework.score_pct is
  '#736 optional 0-100 score set by the tutor on review; null means reviewed without a score.';
