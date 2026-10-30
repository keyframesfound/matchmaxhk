/**
 * Issue #529 §E — /admin/trust-safety queue.
 *
 * One admin-gated read for the desk: every open case_risk_flags row with its
 * case, held (compliance_hold) cases first. Loading the queue also runs the
 * T-12h ghost sweep (#529 V1 item 6): a Lesson 1 starting within 12 h that the
 * tutor has not confirmed raises TUTOR_GHOST_RISK and pings ops once. The
 * sweep is lazy (on read), like the #387 session-log sweep; no cron needed.
 *
 * "Confirmed contact" has no column yet, so the tutor's Lesson 1 confirmation
 * (case_lessons.confirmed_by_tutor_at) is the proxy signal.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { requireAdmin, selectRows, selectRowsInRange, type Db } from "@/features/cases/desk-db";
import { GHOST_RISK_HOURS, isGhostRisk } from "@/features/trust/safety-screen";
import { insertOpenFlag } from "@/features/trust/trust.functions";

const QUEUE_LIMIT = 500;
const LESSON_SCAN_LIMIT = 500;

export type TrustQueueRow = {
  flagId: string;
  flagType: string;
  source: string;
  note: string | null;
  createdAt: string;
  caseId: string;
  caseCode: string | null;
  caseTitle: string | null;
  caseStatus: string | null;
};

const ENDED_SOR = new Set(["closed", "replaced", "waived"]);

/**
 * Raise TUTOR_GHOST_RISK once per case: a case that already carries the flag
 * (open OR resolved) is skipped, so resolving it never re-raises and re-pings
 * on the next load. Ended cases are ignored.
 */
async function sweepGhostRisk(db: Db, now: Date): Promise<number> {
  const lessons = await selectRowsInRange<{
    case_id: string;
    starts_at: string;
    status: string;
    confirmed_by_tutor_at: string | null;
  }>(
    db,
    "case_lessons",
    "case_id, starts_at, status, confirmed_by_tutor_at",
    [
      { col: "sequence", op: "eq", value: 1 },
      { col: "status", op: "in", value: ["planned", "confirmed"] },
    ],
    {
      col: "starts_at",
      from: now.toISOString(),
      to: new Date(now.getTime() + GHOST_RISK_HOURS * 60 * 60 * 1000).toISOString(),
      limit: LESSON_SCAN_LIMIT,
    },
  );
  const risky = lessons.filter((l) =>
    isGhostRisk(
      { startsAt: l.starts_at, status: l.status, confirmedByTutorAt: l.confirmed_by_tutor_at },
      now,
    ),
  );
  if (risky.length === 0) return 0;

  const caseIds = [...new Set(risky.map((l) => l.case_id))];
  const [cases, priorFlags] = await Promise.all([
    selectRows<{ id: string; sor_status: string | null }>(db, "tutoring_cases", "id, sor_status", [
      { col: "id", op: "in", value: caseIds },
    ]),
    selectRows<{ case_id: string }>(db, "case_risk_flags", "case_id", [
      { col: "case_id", op: "in", value: caseIds },
      { col: "flag_type", op: "eq", value: "TUTOR_GHOST_RISK" },
    ]),
  ]);
  const live = new Set(cases.filter((c) => !ENDED_SOR.has(c.sor_status ?? "")).map((c) => c.id));
  const alreadyFlagged = new Set(priorFlags.map((f) => f.case_id));

  let raised = 0;
  for (const l of risky) {
    if (!live.has(l.case_id) || alreadyFlagged.has(l.case_id)) continue;
    alreadyFlagged.add(l.case_id);
    const isNew = await insertOpenFlag(db, {
      case_id: l.case_id,
      flag_type: "TUTOR_GHOST_RISK",
      source: "system",
      source_channel: "desk",
      note: `Lesson 1 at ${l.starts_at} not confirmed by the tutor. Ping them and line up a backup.`,
      created_by: null,
    });
    if (!isNew) continue;
    raised += 1;
    const { notifyOps } = await import("@/lib/ops-webhook.server");
    void notifyOps("case.tutor_ghost_risk", { case_id: l.case_id, starts_at: l.starts_at }).catch(
      () => {},
    );
  }
  return raised;
}

export const listTrustQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: TrustQueueRow[]; ghostRaised: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    // The sweep is a side task: a failure there must never blank the queue.
    let ghostRaised = 0;
    try {
      ghostRaised = await sweepGhostRisk(db, new Date());
    } catch (e) {
      console.error("[trust] ghost-risk sweep failed:", e instanceof Error ? e.message : e);
    }
    const flags = await selectRows<{
      id: string;
      case_id: string;
      flag_type: string;
      source: string;
      note: string | null;
      created_at: string;
      resolved_at: string | null;
    }>(db, "case_risk_flags", "id, case_id, flag_type, source, note, created_at, resolved_at", [], {
      col: "created_at",
      asc: false,
      limit: QUEUE_LIMIT,
    });
    const open = flags.filter((f) => f.resolved_at === null);
    const caseIds = [...new Set(open.map((f) => f.case_id))];
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
    const rows = open.map((f) => {
      const c = byId.get(f.case_id);
      return {
        flagId: f.id,
        flagType: f.flag_type,
        source: f.source,
        note: f.note,
        createdAt: f.created_at,
        caseId: f.case_id,
        caseCode: c?.case_code ?? null,
        caseTitle: c?.title ?? null,
        caseStatus: c?.status ?? null,
      };
    });
    // Held cases first, then newest.
    rows.sort((a, b) => {
      const heldA = a.caseStatus === "compliance_hold" ? 0 : 1;
      const heldB = b.caseStatus === "compliance_hold" ? 0 : 1;
      return heldA - heldB || b.createdAt.localeCompare(a.createdAt);
    });
    return { rows, ghostRaised };
  });
