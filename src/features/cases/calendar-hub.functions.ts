/**
 * Issue #461 amendment — the top-bar Calendar hub read. One call returns the
 * signed-in user's tutor view (lessons they teach, with the student's first
 * name) and parent view (lessons on their cases, with the tutor's display
 * name). No contact details, no admin-fee amounts.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db } from "@/features/cases/desk-db";
import {
  summarizeCalendar,
  type CalendarSummary,
  type HubLesson,
} from "@/features/cases/calendar-hub";

const CASE_LIMIT = 200;

type LessonRow = {
  id: string;
  case_id: string;
  starts_at: string;
  duration_min: number;
  status: string;
  confirmed_by_parent_at: string | null;
  confirmed_by_tutor_at: string | null;
};

export type CalendarHub = {
  isTutor: boolean;
  tutor: CalendarSummary | null;
  parent: CalendarSummary | null;
};

function firstName(title: string | null): string {
  return (title ?? "").trim().split(/\s+/)[0] || "-";
}

async function lessonsFor(db: Db, caseIds: string[]): Promise<LessonRow[]> {
  if (caseIds.length === 0) return [];
  return selectRows<LessonRow>(
    db,
    "case_lessons",
    "id, case_id, starts_at, duration_min, status, confirmed_by_parent_at, confirmed_by_tutor_at",
    [{ col: "case_id", op: "in", value: caseIds }],
  );
}

function toHub(
  rows: LessonRow[],
  cases: Map<string, { code: string; counterpart: string }>,
): HubLesson[] {
  return rows.flatMap((l) => {
    const c = cases.get(l.case_id);
    if (!c) return [];
    return [
      {
        id: l.id,
        caseId: l.case_id,
        caseCode: c.code,
        startsAt: l.starts_at,
        durationMin: l.duration_min,
        status: l.status,
        counterpart: c.counterpart,
        confirmedByTutor: l.confirmed_by_tutor_at !== null,
        confirmedByParent: l.confirmed_by_parent_at !== null,
      },
    ];
  });
}

export const getMyCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CalendarHub> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const now = new Date();

    const tutors = await selectRows<{ id: string }>(db, "tutors", "id", [
      { col: "user_id", op: "eq", value: context.userId },
    ]);
    const tutorId = tutors[0]?.id ?? null;

    let tutor: CalendarSummary | null = null;
    if (tutorId) {
      const cases = await selectRows<{ id: string; case_code: string; title: string | null }>(
        db,
        "tutoring_cases",
        "id, case_code, title",
        [{ col: "matched_tutor_id", op: "eq", value: tutorId }],
      );
      const map = new Map(
        cases
          .slice(0, CASE_LIMIT)
          .map((c) => [c.id, { code: c.case_code, counterpart: firstName(c.title) }]),
      );
      tutor = summarizeCalendar(toHub(await lessonsFor(db, [...map.keys()]), map), now);
    }

    const parentCases = await selectRows<{
      id: string;
      case_code: string;
      student_id: string | null;
      tutors: { display_name: string | null; tutor_code: string | null } | null;
    }>(db, "tutoring_cases", "id, case_code, student_id, tutors(display_name, tutor_code)", [
      { col: "parent_id", op: "eq", value: context.userId },
    ]);
    // #459 §4.4: a claimed child's schedule hidden from the parent stays hidden.
    const hidden = await selectRows<{ id: string }>(db, "students", "id", [
      { col: "parent_user_id", op: "eq", value: context.userId },
      { col: "status", op: "eq", value: "claimed_independent" },
      { col: "can_view_schedule", op: "eq", value: false },
    ]);
    const hiddenIds = new Set(hidden.map((h) => h.id));
    const visible = parentCases
      .filter((c) => !c.student_id || !hiddenIds.has(c.student_id))
      .slice(0, CASE_LIMIT);
    const parentMap = new Map(
      visible.map((c) => [
        c.id,
        { code: c.case_code, counterpart: c.tutors?.display_name ?? c.tutors?.tutor_code ?? "-" },
      ]),
    );
    const parent =
      visible.length === 0
        ? null
        : summarizeCalendar(toHub(await lessonsFor(db, [...parentMap.keys()]), parentMap), now);

    return { isTutor: tutorId !== null, tutor, parent };
  });
