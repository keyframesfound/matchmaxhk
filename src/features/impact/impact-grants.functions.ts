/**
 * Issue #794 AC-400-4 — the desk's Impact grants, server half.
 *
 * Two staff-only actions hang off one flag:
 *   1. mark an account as Impact (NGO-referred), which the $0 shop grant keys on;
 *   2. give one unsold seat in a small group class to a referred student.
 *
 * The seat cap is enforced by the database (`CAP_REACHED`), so two desk staff
 * clicking at once cannot oversell the class; the pure helpers only drive the
 * copy. Nothing here is reachable by a case party, and none of it exposes the
 * family's need verification — tutors see the badge, not the paperwork.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { requireAdmin, selectRows, type Db } from "@/features/cases/desk-db";
import { SEAT_CAP } from "@/features/impact/seat-grant";

const MAX_STUDENT_HITS = 10;
/** The child-profile table is per-child, not per-case; this bounds the scan. */
const STUDENT_SCAN_LIMIT = 500;
const MAX_ACCOUNT_HITS = 10;
const ACCOUNT_SCAN_LIMIT = 500;

async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

export type SeatGrantRow = {
  id: string;
  studentId: string;
  studentName: string;
  note: string | null;
  createdAt: string;
};

export type CaseSeatState = {
  caseId: string;
  studentCount: number;
  cap: number;
  grants: SeatGrantRow[];
};

/** Mark (or unmark) an account as Impact. Owner writes are frozen by trigger. */
export type AccountHit = {
  id: string;
  email: string | null;
  displayName: string | null;
  impactAccount: boolean;
};

/**
 * The $0 shop grant needs a buyer account, and the desk knows families by email
 * or name, not by uuid. Bounded scan with the match done in JS, because
 * `selectRows` only speaks eq/in; `profiles` is one row per account.
 */
export const findAccountForGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().trim().min(2).max(120) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<AccountHit[]> => {
    const db = await adminDb();
    await requireAdmin(db, context.userId);

    const rows = await selectRows<{
      id: string;
      email: string | null;
      display_name: string | null;
      impact_account: boolean | null;
    }>(db, "profiles", "id, email, display_name, impact_account", [], {
      col: "created_at",
      asc: false,
      limit: ACCOUNT_SCAN_LIMIT,
    });

    const needle = data.query.toLowerCase();
    return rows
      .filter(
        (r) =>
          (r.email ?? "").toLowerCase().includes(needle) ||
          (r.display_name ?? "").toLowerCase().includes(needle),
      )
      .slice(0, MAX_ACCOUNT_HITS)
      .map((r) => ({
        id: r.id,
        email: r.email,
        displayName: r.display_name,
        impactAccount: r.impact_account === true,
      }));
  });

export const setImpactAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), impact: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await adminDb();
    await requireAdmin(db, context.userId);
    const { error } = await db
      .from<Record<string, unknown>>("profiles")
      .update({ impact_account: data.impact })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type StudentHit = {
  id: string;
  displayName: string;
  ownerUserId: string | null;
  ownerImpact: boolean;
};

/**
 * Staff pick a child by name. Bounded and name-only: the desk needs enough to
 * choose the right child, not a family's contact details.
 */
export const searchStudentsForGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().trim().min(2).max(60) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<StudentHit[]> => {
    const db = await adminDb();
    await requireAdmin(db, context.userId);

    // `selectRows` only speaks eq/in, so the name match is done in JS over a
    // bounded page. The child-profile table is small (one row per child, not per
    // case), so this stays well inside a single round trip.
    const all = await selectRows<{
      id: string;
      display_name: string;
      owner_user_id: string | null;
    }>(db, "students", "id, display_name, owner_user_id", [], {
      col: "display_name",
      asc: true,
      limit: STUDENT_SCAN_LIMIT,
    });
    const needle = data.query.toLowerCase();
    const rows = all
      .filter((r) => (r.display_name ?? "").toLowerCase().includes(needle))
      .slice(0, MAX_STUDENT_HITS);

    const ownerIds = [...new Set(rows.map((r) => r.owner_user_id).filter(Boolean))] as string[];
    const profiles = ownerIds.length
      ? await selectRows<{ id: string; impact_account: boolean | null }>(
          db,
          "profiles",
          "id, impact_account",
          [{ col: "id", op: "in", value: ownerIds }],
        )
      : [];
    const impactByOwner = new Map(profiles.map((p) => [p.id, p.impact_account === true]));

    return rows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      ownerUserId: r.owner_user_id,
      ownerImpact: r.owner_user_id ? (impactByOwner.get(r.owner_user_id) ?? false) : false,
    }));
  });

/** The case's seat ledger: what was sold, what was granted, what is left. */
export const listCaseSeatGrants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<CaseSeatState> => {
    const db = await adminDb();
    await requireAdmin(db, context.userId);

    const cases = await selectRows<{ id: string; student_count: number | null }>(
      db,
      "tutoring_cases",
      "id, student_count",
      [{ col: "id", op: "eq", value: data.caseId }],
    );
    const kase = cases[0];
    if (!kase) throw new Error("CASE_NOT_FOUND");

    const grants = await selectRows<{
      id: string;
      student_id: string;
      note: string | null;
      created_at: string;
      revoked_at: string | null;
    }>(db, "case_seat_grants", "id, student_id, note, created_at, revoked_at", [
      { col: "case_id", op: "eq", value: data.caseId },
      // `revoked_at is null` is filtered below: selectRows has no `is`.
    ]);

    const studentIds = [...new Set(grants.map((g) => g.student_id))];
    const students = studentIds.length
      ? await selectRows<{ id: string; display_name: string }>(db, "students", "id, display_name", [
          { col: "id", op: "in", value: studentIds },
        ])
      : [];
    const liveGrants = grants.filter(
      (g) => (g as { revoked_at?: string | null }).revoked_at == null,
    );
    const nameById = new Map(students.map((s) => [s.id, s.display_name]));

    return {
      caseId: kase.id,
      studentCount: kase.student_count ?? 0,
      cap: SEAT_CAP,
      grants: liveGrants.map((g) => ({
        id: g.id,
        studentId: g.student_id,
        studentName: nameById.get(g.student_id) ?? "Student",
        note: g.note,
        createdAt: g.created_at,
      })),
    };
  });

/**
 * Give one unsold seat away. `CAP_REACHED` comes from the DB trigger, not from
 * a read-then-write here, so a race between two staff cannot oversell.
 */
export const grantCaseSeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        studentId: z.string().uuid(),
        note: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await adminDb();
    await requireAdmin(db, context.userId);
    const { error } = await db.from<Record<string, unknown>>("case_seat_grants").insert({
      case_id: data.caseId,
      student_id: data.studentId,
      granted_by: context.userId,
      note: data.note?.trim() ? data.note.trim() : null,
    });
    if (error) {
      if (error.message.includes("CAP_REACHED")) throw new Error("CAP_REACHED");
      if (error.code === "23505") throw new Error("ALREADY_SEATED");
      throw new Error(error.message);
    }
    return { ok: true };
  });

/** Take a seat back. The grant row is kept, so the desk can see it happened. */
export const revokeCaseSeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ caseId: z.string().uuid(), grantId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await adminDb();
    await requireAdmin(db, context.userId);
    const rows = await selectRows<{ id: string; revoked_at: string | null }>(
      db,
      "case_seat_grants",
      "id, revoked_at",
      [
        { col: "id", op: "eq", value: data.grantId },
        { col: "case_id", op: "eq", value: data.caseId },
      ],
    );
    const grant = rows[0];
    if (!grant) throw new Error("GRANT_NOT_FOUND");
    // Already revoked is a no-op, not an error: two staff closing the same tab
    // should not surface a failure.
    if (grant.revoked_at) return { ok: true };

    const { error } = await db
      .from<Record<string, unknown>>("case_seat_grants")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.grantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * AC-400-4, second clause: a $0 grant **to an Impact account**.
 *
 * The mechanics are #250's (one delivered HK$0 `material_orders` row per pack,
 * `is_grant`, excluded from the payout export). What this adds is the one thing
 * #250 never had: the server checks the account is actually flagged, so the
 * Impact rule is not a property of the button we happened to render. Staff
 * grant buttons are admin-only UI, but a flag check that only exists in React
 * is not a rule.
 */
export const grantMaterialsToImpactAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        buyerAccountId: z.string().uuid(),
        materialIds: z.array(z.string().uuid()).min(1).max(50),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ granted: number }> => {
    const db = await adminDb();
    await requireAdmin(db, context.userId);

    const rows = await selectRows<{ id: string; impact_account: boolean | null }>(
      db,
      "profiles",
      "id, impact_account",
      [{ col: "id", op: "eq", value: data.buyerAccountId }],
    );
    const account = rows[0];
    if (!account) throw new Error("ACCOUNT_NOT_FOUND");
    if (account.impact_account !== true) throw new Error("NOT_IMPACT");

    const { staffGrantMaterialsCore } = await import("@/features/materials/orders.functions");
    return staffGrantMaterialsCore({
      buyerAccountId: data.buyerAccountId,
      materialIds: data.materialIds,
      reason: data.reason,
      grantedBy: context.userId,
    });
  });
