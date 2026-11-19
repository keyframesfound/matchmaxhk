/**
 * Issue #782 §2.5 (was #703) — private pre-lesson behaviour reports +
 * concierge strikes, admin-gated server fns.
 *
 * Both tables are internal-only (deny-all, service-role writes only; see
 * migration 20261119200100). Ops file a concern against a case; the subject
 * is captured at report time so the strike survives later rematches. Every
 * report inserts exactly ONE concierge strike row (ledger design; see the
 * migration comments).
 *
 * AC-703-3 [UNVERIFIED]: no automatic consequences are implemented here.
 * No auto-quarantine, no auto-block of rematch / shortlist eligibility.
 * Thresholds await Ryan's decision (reconcile with #772 one-active-trial,
 * #760 and the #755 quarantine lock before building any).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { insertAudit, requireAdmin, selectRows, type Db, type Row } from "@/features/cases/desk-db";
import {
  BEHAVIOUR_CONCERN_MAX,
  isBehaviourSeverity,
  isBehaviourSubjectParty,
  type StrikeLedgerRow,
} from "@/features/trust/behaviour-strikes";

export type BehaviourReportRow = {
  id: string;
  createdAt: string;
  caseId: string;
  caseCode: string | null;
  caseTitle: string | null;
  caseStatus: string | null;
  subjectParty: string;
  subjectId: string | null;
  concern: string;
  severity: string;
  reportedBy: string | null;
};

export type BehaviourReportSummary = {
  reports: BehaviourReportRow[];
  strikeCounts: Record<string, number>;
};

const CONCERN_LIMIT = 200;

const inputSchema = z.object({
  caseCode: z.string().trim().min(2).max(32),
  subjectParty: z.string().refine(isBehaviourSubjectParty, "SUBJECT_PARTY"),
  severity: z.string().refine(isBehaviourSeverity, "SEVERITY"),
  concern: z.string().trim().min(1).max(BEHAVIOUR_CONCERN_MAX),
  // Optional explicit tutor override; defaults to the case's matched tutor.
  tutorId: z.string().uuid().nullable().optional(),
});

/** Resolve the subject id on the case (parent_id or matched_tutor_id). */
async function resolveSubjectId(
  db: Db,
  caseRow: { parent_id: string | null; matched_tutor_id: string | null },
  party: string,
  tutorOverride: string | null | undefined,
): Promise<string | null> {
  if (party === "parent") return caseRow.parent_id;
  return tutorOverride ?? caseRow.matched_tutor_id;
}

export const createBehaviourReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true; reportId: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const cases = await selectRows<{
      id: string;
      case_code: string;
      title: string;
      status: string;
      parent_id: string | null;
      matched_tutor_id: string | null;
    }>(db, "tutoring_cases", "id, case_code, title, status, parent_id, matched_tutor_id", [
      { col: "case_code", op: "eq", value: data.caseCode },
    ]);
    const caseRow = cases[0];
    if (!caseRow) throw new Error("CASE_NOT_FOUND");

    const subjectId = await resolveSubjectId(db, caseRow, data.subjectParty, data.tutorId ?? null);
    if (!subjectId) {
      throw new Error(data.subjectParty === "tutor" ? "NO_TUTOR_ON_CASE" : "NO_PARENT_ON_CASE");
    }

    const isParent = data.subjectParty === "parent";
    const report = {
      case_id: caseRow.id,
      subject_party: data.subjectParty,
      subject_parent_id: isParent ? subjectId : null,
      subject_tutor_id: isParent ? null : subjectId,
      concern: data.concern,
      severity: data.severity,
      reported_by: context.userId,
    };
    const { data: inserted, error } = await db
      .from<Row>("behaviour_reports")
      .insert(report)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const reportId = (inserted as { id: string } | null)?.id ?? "";
    if (!reportId) throw new Error("REPORT_INSERT_FAILED");

    // One strike per report (ledger). Recording only — no consequences.
    const { error: strikeError } = await db.from<Row>("concierge_strikes").insert({
      behaviour_report_id: reportId,
      case_id: caseRow.id,
      subject_parent_id: report.subject_parent_id,
      subject_tutor_id: report.subject_tutor_id,
      created_by: context.userId,
    });
    if (strikeError) throw new Error(strikeError.message);

    await insertAudit(db, caseRow.id, context.userId, "behaviour_report_filed", data.severity);
    return { ok: true, reportId };
  });

export const listBehaviourReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BehaviourReportSummary> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const reports = await selectRows<{
      id: string;
      case_id: string;
      subject_party: string;
      subject_parent_id: string | null;
      subject_tutor_id: string | null;
      concern: string;
      severity: string;
      reported_by: string | null;
      created_at: string;
    }>(
      db,
      "behaviour_reports",
      "id, case_id, subject_party, subject_parent_id, subject_tutor_id, concern, severity, reported_by, created_at",
      [],
      { col: "created_at", asc: false, limit: CONCERN_LIMIT },
    );
    const caseIds = [...new Set(reports.map((r) => r.case_id))];
    const cases =
      caseIds.length === 0
        ? []
        : await selectRows<{ id: string; case_code: string; title: string; status: string }>(
            db,
            "tutoring_cases",
            "id, case_code, title, status",
            [{ col: "id", op: "in", value: caseIds }],
          );
    const byId = new Map(cases.map((c) => [c.id, c]));

    const ledgerRows = await selectRows<StrikeLedgerRow & { id: string }>(
      db,
      "concierge_strikes",
      "id, subject_parent_id, subject_tutor_id",
      [],
      { col: "created_at", asc: false, limit: 2000 },
    );
    const { countStrikesBySubject } = await import("@/features/trust/behaviour-strikes");
    const strikeCounts = countStrikesBySubject(ledgerRows);

    return {
      reports: reports.map((r) => {
        const c = byId.get(r.case_id);
        return {
          id: r.id,
          createdAt: r.created_at,
          caseId: r.case_id,
          caseCode: c?.case_code ?? null,
          caseTitle: c?.title ?? null,
          caseStatus: c?.status ?? null,
          subjectParty: r.subject_party,
          subjectId: r.subject_tutor_id ?? r.subject_parent_id,
          concern: r.concern,
          severity: r.severity,
          reportedBy: r.reported_by,
        };
      }),
      strikeCounts,
    };
  });
