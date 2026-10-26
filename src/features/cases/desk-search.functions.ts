/**
 * Issue #55, staff search finds a case by tutor code.
 *
 * The desk list filters case columns only; staff often know the TUTOR code
 * (off a WhatsApp intro, the unpaid queue, a tutor's message). This fn
 * resolves tutors by tutor_code ilike %q% and returns their cases in the
 * SAME row shape the desk list uses (ADMIN_CASE_SELECT_COLUMNS), with the
 * matched tutor attached as a `matchedTutor` side field so the route can
 * union the hits into its displayed list without reshaping anything.
 *
 * Staff-gated (admin/super_admin/staff, the desk route's role set),
 * service-role reads only.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { ADMIN_CASE_SELECT_COLUMNS, type CaseRow } from "@/features/cases/admin/shared";

type Db = ReturnType<typeof asAdminDb>;
type DbError = { message: string } | null;

async function requireDeskAccess(db: Db, userId: string): Promise<void> {
  for (const role of ["admin", "super_admin", "staff"] as const) {
    const { data } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return;
  }
  throw new Error("FORBIDDEN");
}

/**
 * Wire type of one hit: the desk row shape with the matched tutor attached.
 * Concrete property types only, TanStack Start validates server-fn returns
 * for serializability, so the loose `Record<string, unknown>` fields of
 * CaseRow are narrowed here (compliance_triage answers are flat JSON
 * primitives in practice); the route casts back to its CaseRow view.
 */
export type TutorCodeCaseHit = Omit<CaseRow, "compliance_triage"> & {
  compliance_triage: Record<string, string | boolean | number | null> | null;
  matchedTutor: { tutor_code: string | null; display_name: string | null } | null;
};

export const findCasesByTutorCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().trim().min(1).max(60) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ items: TutorCodeCaseHit[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskAccess(db, context.userId);

    // The structural Rows builder has no ilike; cast just this chain
    // (deleteRow precedent in tutor.functions.ts).
    const tutorsAny = db.from<Record<string, unknown>>("tutors") as unknown as {
      select: (cols: string) => {
        ilike: (
          col: string,
          value: string,
        ) => {
          limit: (n: number) => PromiseLike<{
            data: { id: string; tutor_code: string | null; display_name: string | null }[] | null;
            error: DbError;
          }>;
        };
      };
    };
    const { data: tutors, error: tutorsError } = await tutorsAny
      .select("id, tutor_code, display_name")
      .ilike("tutor_code", `%${data.query}%`)
      .limit(10);
    if (tutorsError) throw new Error(tutorsError.message);
    if (!tutors || tutors.length === 0) return { items: [] };

    let q = db
      .from<Record<string, unknown>>("tutoring_cases")
      .select(`${ADMIN_CASE_SELECT_COLUMNS}, tutors(tutor_code, display_name)`);
    q = q.in(
      "matched_tutor_id",
      tutors.map((t) => t.id),
    );
    q = q.order("created_at", { ascending: false });
    q = q.limit(50);
    const { data: cases, error: casesError } = await q;
    if (casesError) throw new Error(casesError.message);

    const tutorById = new Map(tutors.map((t) => [t.id, t]));
    const items: TutorCodeCaseHit[] = ((cases ?? []) as Array<Record<string, unknown>>).map(
      (row) => {
        const tutor = tutorById.get(row.matched_tutor_id as string);
        const { tutors: _embed, ...rest } = row;
        return {
          ...rest,
          matchedTutor: tutor
            ? { tutor_code: tutor.tutor_code, display_name: tutor.display_name }
            : null,
        } as unknown as TutorCodeCaseHit;
      },
    );
    return { items };
  });
