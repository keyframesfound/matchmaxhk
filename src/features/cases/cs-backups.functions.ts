/**
 * #825 §2.1 / §2.2 — CS backup lookalikes, server half. Staff only.
 *
 * getCsBackupTutors ranks up to 3 backups for a case; queueCsBackupWave
 * records the staff's pick as `tutor_pinged` rows in the existing #428
 * funnel ledger (request_source = staff_shortlist). Nothing is sent: the
 * desk sends the WhatsApp by hand (#797). No contact fields are returned.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { insertAudit, requireAdmin, selectRows, type Db } from "@/features/cases/desk-db";
import {
  CASE_COLUMNS,
  loadMatchTutors,
  toMatchCase,
  type CaseRow,
} from "@/features/cases/case-match-waves.functions";
import {
  RELAX_RATE_PCT,
  ghostingTutors,
  isManualOnlyCase,
  pendingPingTutors,
  pickCsBackups,
  queueRoom,
  type BackupPick,
  type BackupSeed,
  type BackupTutor,
  type PingEvent,
} from "@/features/cases/cs-backups";

const PING_TYPES = ["tutor_pinged", "tutor_replied_yes", "tutor_replied_no"];
const REMATCH_REASONS = ["RATE_TOO_HIGH", "TUTOR_QUIT", "PARENT_REQUESTED", "OTHER"] as const;

type CsCaseRow = CaseRow & {
  organisation_id: string | null;
  case_type: string | null;
  budget_max_hkd: number | null;
};

export type CsBackupResult =
  | { status: "manual_centre" }
  | {
      status: "ok";
      picks: (BackupPick & { displayName: string })[];
      pendingPings: number;
      queueRoom: number;
      relaxed: boolean;
      seedOptions: { tutorId: string; tutorCode: string; displayName: string }[];
    };

async function loadCase(db: Db, caseId: string): Promise<CsCaseRow> {
  const rows = await selectRows<CsCaseRow>(
    db,
    "tutoring_cases",
    `${CASE_COLUMNS}, organisation_id, case_type, budget_max_hkd`,
    [{ col: "id", op: "eq", value: caseId }],
  );
  if (!rows[0]) throw new Error("CASE_NOT_FOUND");
  return rows[0];
}

async function pingEvents(db: Db, filter: { col: string; value: string[] }): Promise<PingEvent[]> {
  if (filter.value.length === 0) return [];
  const rows = await selectRows<{
    case_id: string;
    tutor_id: string | null;
    event_type: string;
    created_at: string;
  }>(db, "case_funnel_events", "case_id, tutor_id, event_type, created_at", [
    { col: filter.col, op: "in", value: filter.value },
    { col: "event_type", op: "in", value: PING_TYPES },
  ]);
  return rows.flatMap((r) =>
    r.tutor_id
      ? [
          {
            caseId: r.case_id,
            tutorId: r.tutor_id,
            type: r.event_type as PingEvent["type"],
            at: r.created_at,
          },
        ]
      : [],
  );
}

async function declinedOn(db: Db, caseId: string): Promise<Set<string>> {
  const rows = await selectRows<{ tutor_id: string }>(db, "case_tutor_declines", "tutor_id", [
    { col: "case_id", op: "eq", value: caseId },
  ]);
  return new Set(rows.map((r) => r.tutor_id));
}

export const getCsBackupTutors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        seedTutorId: z.string().uuid().nullable().optional(),
        rematchReason: z.enum(REMATCH_REASONS).nullable().optional(),
        relax: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<CsBackupResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);
    const now = new Date();
    const c = await loadCase(db, data.caseId);
    if (isManualOnlyCase(c)) return { status: "manual_centre" };

    // Everyone already in this case's wave ledger, pinged, or declined.
    const [queue, caseEvents, declined] = await Promise.all([
      selectRows<{ tutor_id: string }>(db, "case_match_queue", "tutor_id", [
        { col: "case_id", op: "eq", value: c.id },
      ]),
      pingEvents(db, { col: "case_id", value: [c.id] }),
      declinedOn(db, c.id),
    ]);
    const priorIds = new Set([
      ...queue.map((q) => q.tutor_id),
      ...caseEvents.map((e) => e.tutorId),
      ...declined,
      ...(c.matched_tutor_id ? [c.matched_tutor_id] : []),
    ]);

    const tutors = await loadMatchTutors(db, [], now);
    const ids = tutors.map((t) => t.id);
    const extras = ids.length
      ? await selectRows<{
          id: string;
          hourly_rate: number | null;
          min_hourly_rate_hkd: number | null;
          is_fast_responder: boolean | null;
          approved_grade_labels: string[] | null;
          display_name: string | null;
        }>(
          db,
          "tutors",
          "id, hourly_rate, min_hourly_rate_hkd, is_fast_responder, approved_grade_labels, display_name",
          [{ col: "id", op: "in", value: ids }],
        )
      : [];
    const extraById = new Map(extras.map((e) => [e.id, e]));
    const rateOf = (id: string): number | null => {
      const e = extraById.get(id);
      const r = Number(e?.min_hourly_rate_hkd ?? e?.hourly_rate);
      return Number.isFinite(r) && r > 0 ? r : null;
    };
    const pool: BackupTutor[] = tutors.map((t) => ({
      ...t,
      rateHkd: rateOf(t.id),
      fastResponder: extraById.get(t.id)?.is_fast_responder === true,
      hasApprovedGrades: (extraById.get(t.id)?.approved_grade_labels ?? []).length > 0,
    }));

    // AC-CS-3: ghosts, from recorded ping / reply events (no new timer).
    const ghosts = ghostingTutors(await pingEvents(db, { col: "tutor_id", value: ids }), now);

    const seedRow = data.seedTutorId ? pool.find((t) => t.id === data.seedTutorId) : undefined;
    const seed: BackupSeed | null = seedRow
      ? {
          rateHkd: seedRow.rateHkd,
          targetStudents: seedRow.targetStudents,
          stations: seedRow.stations,
          district: seedRow.district,
          lessonMode: seedRow.lessonMode,
        }
      : null;
    const budget = Number(c.budget_max_hkd);
    const picks = pickCsBackups(
      {
        matchCase: toMatchCase(c),
        budgetMaxHkd: Number.isFinite(budget) && budget > 0 ? budget : null,
        seed,
        seedTutorId: data.seedTutorId ?? null,
        rematchReason: data.rematchReason ?? null,
        relaxRatePct: data.relax ? RELAX_RATE_PCT : 0,
        includeOnline: data.relax === true,
        excluded: new Set([...priorIds, ...ghosts]),
      },
      pool,
      now,
    );
    const pending = pendingPingTutors(c.id, caseEvents, declined);
    const seedIds = [
      ...new Set([
        ...caseEvents.map((e) => e.tutorId),
        ...(c.matched_tutor_id ? [c.matched_tutor_id] : []),
      ]),
    ];
    const seedNames = seedIds.length
      ? await selectRows<{ id: string; tutor_code: string | null; display_name: string | null }>(
          db,
          "tutors",
          "id, tutor_code, display_name",
          [{ col: "id", op: "in", value: seedIds }],
        )
      : [];
    return {
      status: "ok",
      picks: picks.map((p) => ({
        ...p,
        displayName: extraById.get(p.tutorId)?.display_name ?? "",
      })),
      pendingPings: pending.size,
      queueRoom: queueRoom(pending.size),
      relaxed: data.relax === true,
      seedOptions: seedNames.map((s) => ({
        tutorId: s.id,
        tutorCode: s.tutor_code ?? "",
        displayName: s.display_name ?? "",
      })),
    };
  });

/** AC-CS-2 / AC-UI-2: record the staff's pick; blocked above 3 pending pings. */
export const queueCsBackupWave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        tutorIds: z.array(z.string().uuid()).min(1).max(3),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ queued: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);
    const c = await loadCase(db, data.caseId);
    if (isManualOnlyCase(c)) throw new Error("MANUAL_CENTRE");
    const [events, declined] = await Promise.all([
      pingEvents(db, { col: "case_id", value: [c.id] }),
      declinedOn(db, c.id),
    ]);
    const pending = pendingPingTutors(c.id, events, declined);
    const fresh = [...new Set(data.tutorIds)].filter((id) => !pending.has(id));
    if (fresh.length > queueRoom(pending.size)) throw new Error("WAVE_CAP");
    const { logFunnelEvent } = await import("@/features/cases/funnel-events");
    for (const [i, tutorId] of fresh.entries()) {
      await logFunnelEvent(
        db,
        {
          case_id: c.id,
          tutor_id: tutorId,
          event_type: "tutor_pinged",
          request_source: "staff_shortlist",
          rank_position: i + 1,
          metadata: { source: "cs_backup_825" },
        },
        context.userId,
      );
    }
    await insertAudit(
      db,
      c.id,
      context.userId,
      c.status,
      `[#825] queued ${fresh.length} backup(s)`,
    );
    return { queued: fresh.length };
  });
