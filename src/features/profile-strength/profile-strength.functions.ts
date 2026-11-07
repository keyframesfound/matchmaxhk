import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { selectRowsOrEmpty, type Db } from "@/features/cases/desk-db";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { isGridEmpty, parseAvailabilityGrid } from "@/features/tutors/availability-grid-model";
import {
  computeStrength,
  type ProfileStrength,
  type StrengthSignals,
} from "@/features/profile-strength/profile-strength";

type TutorRow = {
  id: string;
  subjects: string[] | null;
  hourly_rate: number | null;
  photo_url: string | null;
  is_published: boolean | null;
  availability_grid: unknown;
};

async function tutorSignals(db: Db, tutor: TutorRow): Promise<StrengthSignals> {
  const byTutor = [{ col: "tutor_id", op: "eq" as const, value: tutor.id }];
  const [windows, grades, edits] = await Promise.all([
    selectRowsOrEmpty<{ weekday: number }>(db, "tutor_weekly_windows", "weekday", byTutor),
    selectRowsOrEmpty<{ status: string }>(db, "tutor_grades", "status", byTutor),
    selectRowsOrEmpty<{ status: string }>(db, "tutor_credential_edits", "status", byTutor),
  ]);
  return {
    kind: "tutor",
    hasWindows: windows.length > 0 || !isGridEmpty(parseAvailabilityGrid(tutor.availability_grid)),
    hasSubjects: (tutor.subjects?.length ?? 0) > 0,
    hasRate: (tutor.hourly_rate ?? 0) > 0,
    hasPhoto: Boolean(tutor.photo_url),
    hasBlueTick: grades.some((g) => g.status === "approved"),
    blueTickInReview:
      grades.some((g) => g.status === "pending") || edits.some((e) => e.status === "pending"),
    isPublished: tutor.is_published === true,
  };
}

async function parentSignals(db: Db, userId: string): Promise<StrengthSignals> {
  const byUser = [{ col: "user_id", op: "eq" as const, value: userId }];
  const [cases, briefing, blocked] = await Promise.all([
    selectRowsOrEmpty<{ id: string }>(db, "tutoring_cases", "id", [
      { col: "parent_id", op: "eq", value: userId },
    ]),
    selectRowsOrEmpty<{ user_id: string }>(db, "household_defaults", "user_id", byUser),
    selectRowsOrEmpty<{ day: string }>(db, "user_blocked_slots", "day", byUser),
  ]);
  return {
    kind: "parent",
    hasCase: cases.length > 0,
    hasBriefing: briefing.length > 0,
    hasPreferredTimes: blocked.length > 0,
  };
}

/** Owner-only, computed on read. Missing tables degrade to "not done", never an error. */
export const getMyProfileStrength = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfileStrength & { handle: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutors = await selectRowsOrEmpty<TutorRow>(
      db,
      "tutors",
      "id, subjects, hourly_rate, photo_url, is_published, availability_grid",
      [{ col: "user_id", op: "eq", value: context.userId }],
    );
    const signals = tutors[0]
      ? await tutorSignals(db, tutors[0])
      : await parentSignals(db, context.userId);
    const profiles = await selectRowsOrEmpty<{ handle: string | null }>(db, "profiles", "handle", [
      { col: "id", op: "eq", value: context.userId },
    ]);
    return { ...computeStrength(signals), handle: profiles[0]?.handle ?? null };
  });
