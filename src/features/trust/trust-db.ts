/**
 * Issue #535 — server-side trust reads shared by the tutor-facing gates
 * (applyToCase cap, getMyTutorCases progressive reveal). Service-role db in,
 * plain numbers out; the rules themselves stay in trust.ts.
 *
 * Verified platform hours (#459 V1 approximation until the hours ledger
 * lands): bilaterally confirmed done lessons + verified experience-log rows.
 */

import { selectRows, selectRowsOrEmpty, readSetting, type Db } from "@/features/cases/desk-db";
import {
  activeShadowbanUntil,
  FIRST_LESSON_CAP_SETTING_KEY,
  OPEN_FIRST_LESSON_STATUSES,
  resolveFirstLessonCap,
  verifiedHoursFromMinutes,
} from "@/features/trust/trust";

export type TutorTrustSnapshot = {
  verifiedHours: number;
  openFirstLessonCount: number;
  firstLessonCap: number;
};

export async function tutorVerifiedHours(db: Db, tutorId: string): Promise<number> {
  const [lessons, logs] = await Promise.all([
    selectRows<{
      duration_min: number;
      confirmed_by_parent_at: string | null;
      confirmed_by_tutor_at: string | null;
    }>(db, "case_lessons", "duration_min, confirmed_by_parent_at, confirmed_by_tutor_at", [
      { col: "tutor_id", op: "eq", value: tutorId },
      { col: "status", op: "eq", value: "done" },
    ]),
    selectRows<{ duration_min: number }>(db, "tutor_session_logs", "duration_min", [
      { col: "tutor_id", op: "eq", value: tutorId },
      { col: "status", op: "eq", value: "verified" },
    ]),
  ]);
  const confirmed = lessons.filter((l) => l.confirmed_by_parent_at && l.confirmed_by_tutor_at);
  return verifiedHoursFromMinutes([
    ...confirmed.map((l) => Number(l.duration_min)),
    ...logs.map((l) => Number(l.duration_min)),
  ]);
}

/** Tutors among `tutorIds` with a running #529 shadowban → its ISO end. */
export async function activeShadowbansByTutor(
  db: Db,
  tutorIds: readonly string[],
  now: Date,
): Promise<Map<string, string>> {
  if (tutorIds.length === 0) return new Map();
  const rows = await selectRowsOrEmpty<{ tutor_id: string; shadowban_until: string | null }>(
    db,
    "tutor_trust_state",
    "tutor_id, shadowban_until",
    [{ col: "tutor_id", op: "in", value: [...tutorIds] }],
  );
  const active = new Map<string, string>();
  for (const row of rows) {
    const until = activeShadowbanUntil(row.shadowban_until, now);
    if (until) active.set(row.tutor_id, until);
  }
  return active;
}

export async function tutorTrustSnapshot(db: Db, tutorId: string): Promise<TutorTrustSnapshot> {
  const [verifiedHours, openCases, override, setting] = await Promise.all([
    tutorVerifiedHours(db, tutorId),
    selectRows<{ id: string }>(db, "tutoring_cases", "id", [
      { col: "matched_tutor_id", op: "eq", value: tutorId },
      { col: "sor_status", op: "in", value: [...OPEN_FIRST_LESSON_STATUSES] },
    ]),
    // Tolerant: before the #537 migration lands the table is absent → default cap.
    selectRowsOrEmpty<{ max_concurrent_first_lessons: number | null }>(
      db,
      "tutor_trust_state",
      "max_concurrent_first_lessons",
      [{ col: "tutor_id", op: "eq", value: tutorId }],
    ),
    readSetting(db, FIRST_LESSON_CAP_SETTING_KEY),
  ]);
  const perTutor = override[0]?.max_concurrent_first_lessons;
  return {
    verifiedHours,
    openFirstLessonCount: openCases.length,
    firstLessonCap: resolveFirstLessonCap(perTutor ?? setting),
  };
}
