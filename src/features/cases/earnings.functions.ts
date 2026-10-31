/**
 * Issue #461 Phase A — read-only earnings dashboard for the signed-in tutor.
 * Loads the tutor's matched cases, their lessons and #387 session logs, and
 * hands them to the pure engine in earnings.ts. Never selects parent contact.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db } from "@/features/cases/desk-db";
import { sweepDueSessionLogs } from "@/features/cases/experience.functions";
import { normalizeSplitMode } from "@/features/cases/fee-drop";
import { firstNameOf } from "@/features/cases/tutor/week-model";
import { requireOrgMembership } from "@/features/cases/centre-case.functions";
import {
  computeEarnings,
  earningsRange,
  parseSecondaryTier,
  summarizeForOrganisation,
  type EarningsCaseInput,
  type EarningsRangeKind,
  type EarningsResult,
  type OrgLessonSummary,
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
  tuition_status: string | null;
};

type LogRow = {
  id: string;
  case_id: string;
  log_date: string;
  start_minute: number;
  duration_min: number;
  status: string;
  tuition_status: string | null;
};

type RangeOut = { kind: EarningsRangeKind; from: string; to: string };

export type EarningsDashboard = EarningsResult & { range: RangeOut };
export type OrganisationLessonDashboard = OrgLessonSummary & { range: RangeOut };

const CASE_COLS =
  "id, case_code, title, hourly_rate_hkd, student_count, package_type, secondary_tier_applied, commission_split_mode, fee_rule_id, sor_status";

const RangeInput = z.object({ range: z.enum(["week", "month"]) });

/** Lessons + #387 logs for `cases`, mapped to engine inputs. Never selects contact. */
async function loadEarningsInputs(
  db: Db,
  cases: readonly CaseRow[],
  logTutorId: string | null,
): Promise<EarningsCaseInput[]> {
  if (cases.length === 0) return [];
  const caseIds = cases.map((c) => c.id);
  const [lessons, logs] = await Promise.all([
    selectRows<LessonRow>(
      db,
      "case_lessons",
      "id, case_id, sequence, starts_at, duration_min, status, tuition_status",
      [{ col: "case_id", op: "in", value: caseIds }],
    ),
    selectRows<LogRow>(
      db,
      "tutor_session_logs",
      "id, case_id, log_date, start_minute, duration_min, status, tuition_status",
      [
        { col: "case_id", op: "in", value: caseIds },
        ...(logTutorId ? [{ col: "tutor_id", op: "eq" as const, value: logTutorId }] : []),
      ],
    ),
  ]);
  return cases.map((c) => ({
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
        tuitionStatus: l.tuition_status,
      })),
    sessionLogs: logs
      .filter((s) => s.case_id === c.id)
      .map((s) => ({
        id: s.id,
        logDate: s.log_date,
        startMinute: s.start_minute,
        durationMin: s.duration_min,
        status: s.status,
        tuitionStatus: s.tuition_status,
      })),
  }));
}

const isLiveCase = (c: CaseRow) => c.sor_status !== null && c.sor_status !== "replaced";

export const getEarningsDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RangeInput.parse(input))
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
    const cases = (
      await selectRows<CaseRow>(
        db,
        "tutoring_cases",
        CASE_COLS,
        [{ col: "matched_tutor_id", op: "eq", value: tutorId }],
        { col: "created_at", asc: false, limit: MAX_CASES },
      )
    ).filter(isLiveCase);
    const inputs = await loadEarningsInputs(db, cases, tutorId);
    return {
      ...computeEarnings(inputs, range, now),
      range: { kind: data.range, from: range.from.toISOString(), to: range.to.toISOString() },
    };
  });

/**
 * #461 3d: the centre's view of lessons on its own cases (organisation_id),
 * for active members of an activated organisation. Lesson value and hours
 * only — no tutor net, admin fee or contact.
 */
export const getOrganisationLessonDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RangeInput.extend({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<OrganisationLessonDashboard> => {
    await requireOrgMembership(context.userId, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await sweepDueSessionLogs(db);

    const now = new Date();
    const range = earningsRange(data.range, now);
    const cases = (
      await selectRows<CaseRow>(
        db,
        "tutoring_cases",
        CASE_COLS,
        [{ col: "organisation_id", op: "eq", value: data.orgId }],
        { col: "created_at", asc: false, limit: MAX_CASES },
      )
    ).filter(isLiveCase);
    const inputs = await loadEarningsInputs(db, cases, null);
    return {
      ...summarizeForOrganisation(computeEarnings(inputs, range, now)),
      range: { kind: data.range, from: range.from.toISOString(), to: range.to.toISOString() },
    };
  });
