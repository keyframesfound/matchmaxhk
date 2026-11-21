/**
 * Issue #768: a child sub-profile's weekly availability is private by default
 * and is shared only with the tutor on an active case lead. This is the read
 * half: the matched tutor (and the case's own parent / child owner) may see the
 * student's hourly Open hours inside the case, nobody else can.
 *
 * `students` has RLS on with no anon/authenticated grants, so this read runs on
 * the service-role client and does its own authorization. Every refusal —
 * unknown case, no active lead, caller not a party, missing admin client, read
 * failure — returns null and never reveals whether the row exists.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db } from "@/features/cases/desk-db";
import {
  emptyHourlyOpenHours,
  isHourlyGridEmpty,
  parseHourlyOpenHours,
  type HourlyOpenHours,
} from "@/features/tutors/availability-grid-model";

/** Lead states where the tutor is matched and the share is live. */
const ACTIVE_LEAD_STATUSES = new Set(["fee_paid", "active", "waived"]);

type CaseRow = {
  id: string;
  parent_id: string | null;
  matched_tutor_id: string | null;
  student_id: string | null;
  sor_status: string | null;
};

type StudentRow = {
  id: string;
  display_name: string | null;
  owner_user_id: string | null;
  availability_grid_hourly: unknown;
};

export type CaseChildAvailability = {
  displayName: string;
  openHours: HourlyOpenHours;
};

/** The matched tutor is authorized by the user behind their tutors row. */
async function isMatchedTutor(db: Db, tutorId: string, userId: string): Promise<boolean> {
  const rows = await selectRows<{ user_id: string | null }>(db, "tutors", "user_id", [
    { col: "id", op: "eq", value: tutorId },
  ]);
  return rows[0]?.user_id === userId;
}

export const fetchCaseChildAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<CaseChildAvailability | null> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      if (!supabaseAdmin) return null;
      const db = asAdminDb(supabaseAdmin);

      const cases = await selectRows<CaseRow>(
        db,
        "tutoring_cases",
        "id, parent_id, matched_tutor_id, student_id, sor_status",
        [{ col: "id", op: "eq", value: data.caseId }],
      );
      const c = cases[0];
      if (!c?.matched_tutor_id || !c.student_id) return null;
      if (!c.sor_status || !ACTIVE_LEAD_STATUSES.has(c.sor_status)) return null;

      const students = await selectRows<StudentRow>(
        db,
        "students",
        "id, display_name, owner_user_id, availability_grid_hourly",
        [{ col: "id", op: "eq", value: c.student_id }],
      );
      const student = students[0];
      if (!student) return null;

      // Exactly three authorized parties: the case parent, the matched tutor's
      // user, or the student's owner. Anything else is a silent null.
      const isParent = c.parent_id === context.userId;
      const isOwner = student.owner_user_id === context.userId;
      const isTutor =
        !isParent && !isOwner && (await isMatchedTutor(db, c.matched_tutor_id, context.userId));
      if (!isParent && !isOwner && !isTutor) return null;

      // No grid and an empty grid both read as empty hours; the UI decides what
      // to say. No other student field ever leaves this function.
      const parsed = parseHourlyOpenHours(student.availability_grid_hourly);
      return {
        displayName: student.display_name ?? "",
        openHours: isHourlyGridEmpty(parsed) ? emptyHourlyOpenHours() : parsed,
      };
    } catch (e) {
      console.warn(
        "[child-availability] read failed, returning null:",
        e instanceof Error ? e.message : e,
      );
      return null;
    }
  });
