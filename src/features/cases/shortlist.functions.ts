/**
 * Issue #816 §2.7 / AC-428-3 — staff shortlist pin/override, server half.
 *
 * Three desk-gated (staff/admin/super_admin) service-role fns:
 *   * getShortlistPin  — read the pin, returning available:false instead of
 *                        failing when this environment has not applied the
 *                        migration yet (deploy-order guard).
 *   * setShortlistPin  — pin (or unpin) one tutor on a case shortlist. Writes
 *                        tutoring_cases.shortlist_pinned_tutor_id, appends a
 *                        recommendation_used funnel event (staff_shortlist,
 *                        rank = the tutor's current 1-based RPC index) and a
 *                        case_audit row.
 *   * findTutorForPin  — resolve one published tutor by tutor_code so staff
 *                        can pin a tutor who is outside the Top 8.
 *
 * Rank lookup uses the caller's JWT, not the service role: the RPC gates on
 * auth.uid(), so a service-role call would raise 'forbidden'. The write, the
 * audit row and the funnel row use asAdminDb (the column has an additive
 * authenticated SELECT grant only, and case_audit / case_funnel_events are
 * service-role shaped).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb, type DbError } from "@/features/materials/storage-helpers";
import { insertAudit, requireDeskStaff, selectRows } from "@/features/cases/desk-db";
import { SHORTLIST_LIMIT } from "@/features/cases/shortlist";

type TutorRow = {
  id: string;
  tutor_code: string | null;
  display_name: string | null;
  is_published: boolean;
};

export type ShortlistPinResult = {
  pinnedTutorId: string | null;
  /** 1-based index in the current RPC result; null when pinned from outside. */
  rankPosition: number | null;
};

/** unavailable = the #816 column is not in this environment yet. */
export type ShortlistPinState = {
  pinnedTutorId: string | null;
  available: boolean;
};

/** PostgreSQL 42703 / PostgREST's wording for a column the DB does not have. */
function isMissingColumnError(error: DbError): boolean {
  if (!error) return false;
  if (error.code === "42703") return true;
  const message = error.message.toLowerCase();
  return message.includes("column") && message.includes("does not exist");
}

export type PinCandidate = {
  id: string;
  tutorCode: string;
  displayName: string;
};

async function loadCaseStatus(db: ReturnType<typeof asAdminDb>, caseId: string): Promise<string> {
  const rows = await selectRows<{ id: string; status: string }>(
    db,
    "tutoring_cases",
    "id, status",
    [{ col: "id", op: "eq", value: caseId }],
  );
  const row = rows[0];
  if (!row) throw new Error("CASE_NOT_FOUND");
  return row.status;
}

/** Escape LIKE metacharacters so a code is matched literally (case-insensitive). */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Read the pin without coupling deploy order to the admin case list. The
 * browser never selects this column itself: the desk list stays on
 * ADMIN_CASE_SELECT_COLUMNS (pre-migration safe), and this service-role read
 * degrades to available:false when the column has not been created yet.
 */
export const getShortlistPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<ShortlistPinState> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskStaff(db, context.userId);
    await loadCaseStatus(db, data.caseId);

    const { data: row, error } = await db
      .from<{ shortlist_pinned_tutor_id: string | null }>("tutoring_cases")
      .select("shortlist_pinned_tutor_id")
      .eq("id", data.caseId)
      .maybeSingle();
    if (error) {
      if (isMissingColumnError(error)) return { pinnedTutorId: null, available: false };
      throw new Error(error.message);
    }
    return { pinnedTutorId: row?.shortlist_pinned_tutor_id ?? null, available: true };
  });

export const setShortlistPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        /** null unpins. */
        tutorId: z.string().uuid().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<ShortlistPinResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskStaff(db, context.userId);
    const status = await loadCaseStatus(db, data.caseId);

    let tutor: TutorRow | null = null;
    let rankPosition: number | null = null;

    if (data.tutorId) {
      const tutors = await selectRows<TutorRow>(
        db,
        "tutors",
        "id, tutor_code, display_name, is_published",
        [{ col: "id", op: "eq", value: data.tutorId }],
      );
      tutor = tutors[0] ?? null;
      if (!tutor || !tutor.is_published) throw new Error("TUTOR_NOT_PINNABLE");

      // Staff JWT: the RPC's owner-or-staff gate needs auth.uid(). A failure
      // here must not block the pin — the rank is analytics, not the action.
      const { data: ranked, error: rankError } = await context.supabase.rpc(
        "match_tutors_for_case",
        { _case_id: data.caseId, _limit: SHORTLIST_LIMIT },
      );
      if (rankError) {
        console.warn(
          `[shortlist] rank lookup failed, pinning without position: ${rankError.message}`,
        );
      } else if (ranked) {
        const index = ranked.findIndex((row) => row.id === data.tutorId);
        rankPosition = index >= 0 ? index + 1 : null;
      }
    }

    const { error } = await db
      .from<Record<string, unknown>>("tutoring_cases")
      .update({ shortlist_pinned_tutor_id: data.tutorId })
      .eq("id", data.caseId);
    if (error) throw new Error(error.message);

    if (tutor) {
      const { logFunnelEvent } = await import("@/features/cases/funnel-events");
      await logFunnelEvent(
        db,
        {
          case_id: data.caseId,
          tutor_id: tutor.id,
          event_type: "recommendation_used",
          request_source: "staff_shortlist",
          rank_position: rankPosition,
          metadata: { source: "shortlist_pin_816" },
        },
        context.userId,
      );
      await insertAudit(
        db,
        data.caseId,
        context.userId,
        status,
        `[#816] pinned ${tutor.tutor_code ?? tutor.id}`,
      );
    } else {
      await insertAudit(db, data.caseId, context.userId, status, "[#816] shortlist unpinned");
    }

    return { pinnedTutorId: data.tutorId, rankPosition };
  });

export const findTutorForPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        tutorCode: z.string().trim().min(1).max(60),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<PinCandidate | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskStaff(db, context.userId);
    await loadCaseStatus(db, data.caseId);

    // The structural Rows builder has no ilike; cast just this chain
    // (desk-search.functions.ts:55 precedent). No wildcards: the trimmed code
    // is escaped so '%' and '_' in it match literally.
    type TutorLookupChain = {
      eq: (col: string, value: unknown) => TutorLookupChain;
      limit: (n: number) => PromiseLike<{ data: TutorRow[] | null; error: DbError }>;
    };
    const tutorsAny = db.from<Record<string, unknown>>("tutors") as unknown as {
      select: (cols: string) => {
        ilike: (col: string, value: string) => TutorLookupChain;
      };
    };

    const { data: rows, error } = await tutorsAny
      .select("id, tutor_code, display_name, is_published")
      .ilike("tutor_code", escapeLike(data.tutorCode))
      .eq("is_published", true)
      .limit(1);
    if (error) throw new Error(error.message);
    const tutor = rows?.[0];
    if (!tutor) return null;

    return {
      id: tutor.id,
      tutorCode: tutor.tutor_code ?? data.tutorCode,
      displayName: tutor.display_name ?? tutor.tutor_code ?? data.tutorCode,
    };
  });
