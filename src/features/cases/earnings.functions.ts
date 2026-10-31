/**
 * Issue #461 Phase A — read-only earnings dashboard for the signed-in tutor.
 * Loads the tutor's matched cases, their lessons and #387 session logs, and
 * hands them to the pure engine in earnings.ts. Never selects parent contact.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows } from "@/features/cases/desk-db";
import { sweepDueSessionLogs } from "@/features/cases/experience.functions";
import { normalizeSplitMode } from "@/features/cases/fee-drop";
import { firstNameOf } from "@/features/cases/tutor/week-model";
import {
  computeEarnings,
  earningsRange,
  parseSecondaryTier,
  type EarningsCaseInput,
  type EarningsResult,
} from "@/features/cases/earnings";

const MAX_CASES = 100;

type CaseRow = {
  id: string;
  case_code: string;
  title: string;
  hourly_rate_hkd: number | string | null;
  student_count: number | null;
  package_type: string | null;
  secondary_tier_applied: string | null;
  commission_split_mode: string | null;
  fee_rule_id: string | null;
  sor_status: string | null;
};

type LessonRow = {
  id: string;
  case_id: string;
  sequence: number;
  starts_at: string;
  duration_min: number;
  status: string;
};

type LogRow = {
  id: string;
  case_id: string;
  log_date: string;
  start_minute: number;
  duration_min: number;
  status: string;
};

export type EarningsDashboard = EarningsResult & {
  range: { kind: "week" | "month"; from: string; to: string };
};

export const getEarningsDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ range: z.enum(["week", "month"]) }).parse(input))
  .handler(async ({ context, data }): Promise<EarningsDashboard> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutors = await selectRows<{ id: string }>(db, "tutors", "id", [
      { col: "user_id", op: "eq", value: context.userId },
    ]);
    const tutorId = tutors[0]?.id;
    if (!tutorId) throw new Error("NO_TUTOR_CARD");

    // #387 lazy auto-verify so log statuses are current before totals.
    await sweepDueSessionLogs(db);

    const now = new Date();
    const range = earningsRange(data.range, now);
    const rangeOut = {
      kind: data.range,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    };

    const cases = (
      await selectRows<CaseRow>(
        db,
        "tutoring_cases",
        "id, case_code, title, hourly_rate_hkd, student_count, package_type, secondary_tier_applied, commission_split_mode, fee_rule_id, sor_status",
        [{ col: "matched_tutor_id", op: "eq", value: tutorId }],
        { col: "created_at", asc: false, limit: MAX_CASES },
      )
    ).filter((c) => c.sor_status !== null && c.sor_status !== "replaced");
    if (cases.length === 0) {
      return { ...computeEarnings([], range, now), range: rangeOut };
    }

    const caseIds = cases.map((c) => c.id);
    const [lessons, logs] = await Promise.all([
      selectRows<LessonRow>(
        db,
        "case_lessons",
        "id, case_id, sequence, starts_at, duration_min, status",
        [{ col: "case_id", op: "in", value: caseIds }],
      ),
      selectRows<LogRow>(
        db,
        "tutor_session_logs",
        "id, case_id, log_date, start_minute, duration_min, status",
        [
          { col: "case_id", op: "in", value: caseIds },
          { col: "tutor_id", op: "eq", value: tutorId },
        ],
      ),
    ]);

    const inputs: EarningsCaseInput[] = cases.map((c) => ({
      caseId: c.id,
      caseCode: c.case_code,
      studentLabel: firstNameOf(c.title),
      hourlyRateHkd: c.hourly_rate_hkd == null ? null : Number(c.hourly_rate_hkd),
      studentCount: Number(c.student_count ?? 1),
      packageType: c.package_type,
      tier: parseSecondaryTier(c.secondary_tier_applied),
      splitMode: normalizeSplitMode(c.commission_split_mode),
      feeRuleId: c.fee_rule_id,
      lessons: lessons
        .filter((l) => l.case_id === c.id)
        .map((l) => ({
          id: l.id,
          sequence: l.sequence,
          startsAt: l.starts_at,
          durationMin: l.duration_min,
          status: l.status,
        })),
      sessionLogs: logs
        .filter((s) => s.case_id === c.id)
        .map((s) => ({
          id: s.id,
          logDate: s.log_date,
          startMinute: s.start_minute,
          durationMin: s.duration_min,
          status: s.status,
        })),
    }));
    return { ...computeEarnings(inputs, range, now), range: rangeOut };
  });
