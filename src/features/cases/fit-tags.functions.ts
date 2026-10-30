/**
 * #528 fit data desk server fns. Admin-gated, service role: the case pref_*
 * columns and case_fit_signals have no authenticated grant.
 *
 *  - getCaseFit     — case prefs, matched tutor's tags, the soft hint, and the
 *                     backend-only signals (match -> L1 booked, L1 reschedules).
 *  - saveCaseFitTags — desk records the parent's optional soft tags.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import {
  insertAudit,
  requireAdmin,
  selectRows,
  selectRowsOrEmpty,
  type Row,
} from "@/features/cases/desk-db";
import {
  EMPTY_FIT_TAGS,
  FIT_TAG_COLUMNS,
  FIT_TAG_KEYS,
  HOMEWORK_EXPECTATIONS,
  MATERIALS_POLICIES,
  TEACHING_STYLES,
  VIBE_PREFERENCES,
  fitHint,
  fitTagsFromRow,
  fitTagsToRow,
  type FitHint,
  type FitTags,
} from "@/features/cases/fit-tags";

export type CaseFitState = {
  parent: FitTags;
  tutor: FitTags | null;
  hint: FitHint | null;
  signals: { matchToL1BookedMinutes: number | null; l1RescheduleCount: number } | null;
};

const caseCols = (["id", "matched_tutor_id"] as string[])
  .concat(FIT_TAG_KEYS.map((k) => FIT_TAG_COLUMNS[k].case))
  .join(", ");
const tutorCols = FIT_TAG_KEYS.map((k) => FIT_TAG_COLUMNS[k].tutor).join(", ");

export const getCaseFit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<CaseFitState> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const rows = await selectRows<Row>(db, "tutoring_cases", caseCols, [
      { col: "id", op: "eq", value: data.caseId },
    ]);
    const c = rows[0];
    if (!c) throw new Error("CASE_NOT_FOUND");
    const parent = fitTagsFromRow(c, "case");
    const tutorId = typeof c.matched_tutor_id === "string" ? c.matched_tutor_id : null;

    const [tutorRows, signalRows] = await Promise.all([
      tutorId
        ? selectRows<Row>(db, "tutors", tutorCols, [{ col: "id", op: "eq", value: tutorId }])
        : Promise.resolve([]),
      selectRowsOrEmpty<{ match_to_l1_booked_minutes: number | null; l1_reschedule_count: number }>(
        db,
        "case_fit_signals",
        "match_to_l1_booked_minutes, l1_reschedule_count",
        [{ col: "case_id", op: "eq", value: data.caseId }],
      ),
    ]);
    const tutor = tutorRows[0] ? fitTagsFromRow(tutorRows[0], "tutor") : null;
    const signal = signalRows[0];
    return {
      parent,
      tutor,
      hint: tutor ? fitHint(tutor, parent) : null,
      signals: signal
        ? {
            matchToL1BookedMinutes: signal.match_to_l1_booked_minutes,
            l1RescheduleCount: Number(signal.l1_reschedule_count) || 0,
          }
        : null,
    };
  });

const tagsInput = z.object({
  teachingStyle: z.enum(TEACHING_STYLES).nullable(),
  materialsPolicy: z.enum(MATERIALS_POLICIES).nullable(),
  vibe: z.enum(VIBE_PREFERENCES).nullable(),
  homework: z.enum(HOMEWORK_EXPECTATIONS).nullable(),
});

export const saveCaseFitTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ caseId: z.string().uuid(), tags: tagsInput }).parse(input),
  )
  .handler(async ({ context, data }): Promise<FitTags> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const tags: FitTags = { ...EMPTY_FIT_TAGS, ...data.tags };
    const { error } = await db
      .from<Row>("tutoring_cases")
      .update(fitTagsToRow(tags, "case"))
      .eq("id", data.caseId);
    if (error) throw new Error(error.message);
    await insertAudit(db, data.caseId, context.userId, "fit_tags", "[#528] parent soft fit tags");
    return tags;
  });
