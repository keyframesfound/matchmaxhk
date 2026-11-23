# Tutor timezone conversion (#798)

`tutors.timezone` (IANA, default `Asia/Hong_Kong`) and
`src/features/cases/tutor-timezone.ts` exist. This file records what the
conversion of the remaining surfaces must and must not do — written after
classifying all 69 HKT sites in `src`.

## The rule

**Stored values stay in HKT. Convert only at the render and match boundary.**

A tutor's availability is stored as bare hour integers and date keys with HKT
semantics. Re-reading them through a new zone silently shifts every existing
tutor's schedule by up to a day. `formatInTutorZone()` is for display; it must
never be used to derive a stored value.

## Buckets

| Bucket | Meaning | Count |
| --- | --- | --- |
| A | tutor-schedule surface (availability, slots, lesson clock) | ~33 rows / ~88 lines |
| B | MatchMax clock (payout, fee cut-off, SLA, digest, promo rotation) | ~26 rows / ~66 lines |
| C | display-only / comments | ~9 rows |
| D | unresolved | 1 |

Bucket B must stay HKT. Converting a payout Sunday 23:59 cut-off to a tutor's
zone moves a money deadline.

## Do not convert (stored-value hazards)

Each of these changes the meaning of rows already in the database:

1. `tutor_blackout_dates.blackout_date` — a stored `YYYY-MM-DD` re-mapped through
   `hktFromParts` in `slot.ts` / `schedule-fit.ts`.
2. `tutor_weekly_windows.start_minute` / `end_minute` — stored minutes with HKT
   semantics; converting rewrites when the tutor actually teaches.
3. `tutors.availability_grid` / `availability_grid_hourly` — bare hour integers,
   no zone column; a zone change shifts every legacy grid.
4. `students.availability_grid_hourly` — same for a child's grid.
5. `roster-logic.ts` `hktWallClockToUtcIso` — writes a stored instant from a
   wall clock; a zone change silently rewrites attendance.
6. `import.functions.ts` — inserts `case_lessons.starts_at` at 10:00 HKT.
7. `notes.functions.ts` `view_date` — mirrors the DB default
   `(now() AT TIME ZONE 'Asia/Hong_Kong')::date`; changing it breaks dedupe.

## Order of work (by user impact)

1. `availability-grid-model.ts` + `availability-hourly-grid.tsx` (the public grid)
2. `availability-occupancy.functions.ts` (occupied cells must match the open cells)
3. `tutor/calendar-windows-editor.tsx` (where the tutor authors it)
4. `sor.ts` (A half only) + `slot.ts`
5. `case-schedule.functions.ts` (blackout/window payload)
6. `schedule-fit.ts` + `availability-filter.ts`
7. `tutor/week-model.ts` + `week-view.tsx`
8. `case-schedule.ts` then `thin-calendar.tsx`, `billing-tab.tsx`, `calendar-hub.ts`
9. `parent.functions.ts` slot picker
10. `cohort-conflicts.ts` + `group-cohorts.ts`
11. `rosters/roster-logic.ts` (+ its test) and `checkin-modal.tsx`
12. `children/children.ts`
13. `ApplicationForm.tsx` AC-9 note (currently says the grid is HKT)
14. `weekly-digest-card.tsx` + `weekly-digest-email-logic.ts`

## Fixed already

`tutor/week-view.tsx` stamped lessons with a bare `format()`, which renders the
**device** zone while the day grouping above it is HKT — a 20:00 HKT lesson
appeared under Monday but typed 12:00 for a tutor in London. It now formats in
HKT via `formatInTutorZone`. When the grouping moves to the tutor's zone, this
call moves with it.

## Decision: stored values stay HKT

Blackout dates and roster wall-clock entry are inherently zone-relative, and
there are two ways to read them. The call (2026-11-23) is **keep HKT for every
stored value**:

- no migration, so no existing tutor's blackouts, weekly windows, availability
  grids or attendance times can shift;
- `tutors.timezone` then only affects how a surface *renders* a value that is
  already absolute (lesson instants) and how the grid is *labelled*;
- a non-HK tutor blocks a date and enters attendance in HKT — acceptable while
  the roster is overwhelmingly HK-based, and reversible later because the data
  was never reinterpreted.

If a non-HK cohort ever appears, the migration is: add a per-row zone column,
backfill `Asia/Hong_Kong`, then convert reads — never reinterpret in place.
