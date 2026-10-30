/**
 * Issue #81, case-applications server fns: 1-click Apply-to-staff, my
 * applied case codes (board pills), the staff applications list and the
 * staff status triage.
 *
 * case_applications is RLS-deny; everything runs on the service-role client.
 * Tutor writes are gated by tutors.user_id = auth uid (tutor.functions.ts
 * pattern); staff reads/writes by the has_role rpc (admin-desk pattern).
 * Applications never route to the parent, staff see them on the desk.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { asAdminDb } from "@/features/materials/storage-helpers";
import {
  APPLICATION_NOTE_MAX,
  APPLICATION_STATUS_TUPLE,
  canApplyToCase,
  validateApplicationNote,
  type CaseApplicationAdminRow,
} from "@/features/cases/applications";
import { checkFirstLessonCap } from "@/features/trust/trust";

type Row = Record<string, unknown>;
type Db = ReturnType<typeof asAdminDb>;
type DbError = { message: string } | null;

async function selectRows<T extends Row>(
  db: Db,
  table: string,
  cols: string,
  match: { col: string; op: "eq" | "in"; value: unknown }[],
  order?: { col: string; asc?: boolean; limit?: number },
): Promise<T[]> {
  let q = db.from<T>(table).select(cols);
  for (const m of match) {
    if (m.op === "eq") q = q.eq(m.col, m.value);
    else q = q.in(m.col, m.value as unknown[]);
  }
  if (order) q = q.order(order.col, { ascending: order.asc ?? true });
  if (order?.limit) q = q.limit(order.limit);
  const { data } = await q;
  return (data ?? []) as T[];
}

/** Staff gate: admin, super_admin OR staff (the desk route's role set). */
async function requireDeskAccess(db: Db, userId: string): Promise<void> {
  for (const role of ["admin", "super_admin", "staff"] as const) {
    const { data } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return;
  }
  throw new Error("FORBIDDEN");
}

/** Resolve the signed-in tutor's card (null when the account has no card). */
async function findMyTutor(
  db: Db,
  userId: string,
): Promise<{
  id: string;
  tutor_code: string | null;
  display_name: string | null;
  gender: string | null;
} | null> {
  const rows = await selectRows<{
    id: string;
    tutor_code: string | null;
    display_name: string | null;
    gender: string | null;
  }>(db, "tutors", "id, tutor_code, display_name, gender", [
    { col: "user_id", op: "eq", value: userId },
  ]);
  return rows[0] ?? null;
}

/** Client query key for "case codes I applied to" (board pills + detail). */
export const myAppliedCasesQueryKey = ["case-applications", "mine"] as const;

// ---------------------------------------------------------------------------
// Tutor side
// ---------------------------------------------------------------------------

export const applyToCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseCode: z.string().trim().min(1).max(40),
        note: z.string().max(APPLICATION_NOTE_MAX).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ applied: boolean; alreadyApplied: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    const tutor = await findMyTutor(db, context.userId);
    if (!tutor) throw new Error("JOIN_AS_TUTOR");

    const cases = await selectRows<{
      id: string;
      case_code: string;
      board_published_at: string | null;
      status: string;
      preferred_gender: string | null;
    }>(
      db,
      "tutoring_cases",
      "id, case_code, board_published_at, status, preferred_gender",
      [{ col: "case_code", op: "eq", value: data.caseCode }],
      { col: "created_at", asc: false, limit: 1 },
    );
    const caseRow = cases[0];
    if (!caseRow) throw new Error("CASE_NOT_FOUND");

    // Hard server-side gates. The centre screening radio is a UI-level gate
    // (the server cannot see it), so it is intentionally not re-checked here —
    // board visibility, status and the gender rule are the enforceable ones.
    const eligibility = validateEligibilityOnServer(caseRow, tutor);
    if (eligibility) throw new Error(eligibility);

    const note = validateApplicationNote(data.note);
    if (!note.ok) throw new Error(note.error);

    // Issue #535: new tutors (< 3 verified hours) hold at most N open first
    // lessons (app_settings / per-tutor override). Established tutors pass.
    // A re-apply stays the silent no-op below, so the cap is checked only for
    // a NEW application.
    const prior = await selectRows<{ id: string }>(db, "case_applications", "id", [
      { col: "case_id", op: "eq", value: caseRow.id },
      { col: "tutor_id", op: "eq", value: tutor.id },
    ]);
    if (prior.length > 0) return { applied: false, alreadyApplied: true };
    const { tutorTrustSnapshot } = await import("@/features/trust/trust-db");
    const trust = await tutorTrustSnapshot(db, tutor.id);
    const cap = checkFirstLessonCap({
      tutorVerifiedHours: trust.verifiedHours,
      openFirstLessonCount: trust.openFirstLessonCount,
      cap: trust.firstLessonCap,
    });
    if (!cap.ok) throw new Error(cap.reason);

    // UNIQUE (case_id, tutor_id), a re-apply is a no-op, not an error.
    // The structural AdminTable insert has no options; cast just this call
    // for ignoreDuplicates (deleteRow precedent in tutor.functions.ts).
    const tableAny = db.from<Row>("case_applications") as unknown as {
      insert: (
        row: unknown,
        opts?: unknown,
      ) => PromiseLike<{ data: { id: string } | null; error: DbError }>;
    };
    const { data: inserted, error } = await tableAny.insert(
      {
        case_id: caseRow.id,
        tutor_id: tutor.id,
        account_id: context.userId,
        note: note.note,
      },
      { onConflict: "case_id,tutor_id", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    if (!inserted) return { applied: false, alreadyApplied: true };

    // Issue #81: nudge ops over the webhook (app_settings key
    // `ops_webhook_url`, see ops-webhook.server.ts). Fire-and-forget.
    try {
      const { notifyOps } = await import("@/lib/ops-webhook.server");
      void notifyOps("case_application.created", {
        case_code: caseRow.case_code,
        tutor_code: tutor.tutor_code,
        tutor_name: tutor.display_name,
      }).catch(() => {});
    } catch {
      // Webhook dispatch is best-effort by contract.
    }

    return { applied: true, alreadyApplied: false };
  });

/** Map a DB case row onto canApplyToCase; returns the block reason or null. */
function validateEligibilityOnServer(
  caseRow: {
    board_published_at: string | null;
    status: string;
    preferred_gender: string | null;
  },
  tutor: { gender: string | null },
): string | null {
  const result = canApplyToCase(
    {
      boardPublishedAt: caseRow.board_published_at,
      status: caseRow.status,
      preferredGender:
        caseRow.preferred_gender === "male" || caseRow.preferred_gender === "female"
          ? caseRow.preferred_gender
          : "any",
    },
    { gender: tutor.gender },
  );
  return result.ok ? null : result.reason;
}

export const listMyAppliedCaseCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    // Guests-of-the-tutor-kind (no card) just never see pills, no error.
    const tutor = await findMyTutor(db, context.userId);
    if (!tutor) return [];
    const rows = await selectRows<{ tutoring_cases: { case_code: string } | null }>(
      db,
      "case_applications",
      "tutoring_cases(case_code)",
      [{ col: "tutor_id", op: "eq", value: tutor.id }],
      { col: "created_at", asc: false, limit: 200 },
    );
    return rows
      .map((row) => row.tutoring_cases?.case_code)
      .filter((code): code is string => Boolean(code));
  });

// ---------------------------------------------------------------------------
// Staff side (desk)
// ---------------------------------------------------------------------------

export const listCaseApplicationsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<CaseApplicationAdminRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskAccess(db, context.userId);
    const rows = await selectRows<CaseApplicationAdminRow>(
      db,
      "case_applications",
      "id, case_id, tutor_id, account_id, note, status, created_at, updated_at, tutors(tutor_code, display_name, subjects, verification_tier)",
      [{ col: "case_id", op: "eq", value: data.caseId }],
      { col: "created_at", asc: false, limit: 50 },
    );

    // #508 flag (not a block): applicants whose intro window with this case's
    // counterparty has closed — the fee engine prices those matches at $0,
    // the card just surfaces it before staff approve. Best-effort: a lookup
    // failure must never hide the application list.
    try {
      const cases = await selectRows<{ organisation_id: string | null; parent_id: string | null }>(
        db,
        "tutoring_cases",
        "organisation_id, parent_id",
        [{ col: "id", op: "eq", value: data.caseId }],
      );
      const c = cases[0];
      const party = c
        ? c.organisation_id
          ? { kind: "centre" as const, col: "organisation_id", id: c.organisation_id }
          : c.parent_id
            ? { kind: "parent" as const, col: "parent_id", id: c.parent_id }
            : null
        : null;
      if (party && rows.length > 0) {
        const { closedWindowEndsByTutor } =
          await import("@/features/cases/match-dispatch.functions");
        const closed = await closedWindowEndsByTutor(
          db,
          party,
          rows.map((r) => r.tutor_id),
          new Date(),
        );
        for (const row of rows) {
          const endsAt = closed.get(row.tutor_id);
          if (endsAt) {
            row.out_of_window = true;
            row.window_ends_at = endsAt;
          }
        }
      }
    } catch (flagError) {
      console.error("[applications] #508 out-of-window flag lookup failed:", flagError);
    }
    return rows;
  });

export const updateApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    // z.enum over the shared tuple: the exact APPLICATION_STATUSES set the
    // DB CHECK constraint enforces.
    z.object({ id: z.string().uuid(), status: z.enum(APPLICATION_STATUS_TUPLE) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskAccess(db, context.userId);
    const { error } = await db
      .from<Row>("case_applications")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
