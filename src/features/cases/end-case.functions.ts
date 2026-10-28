/**
 * Issue #503, bilateral End Case server fn.
 *
 * Parent or tutor taps End Case on their own surface. The first tap records
 * the side marker and softly prompts the other party (bell, through the
 * #205 bus); when BOTH markers are set the case completes to sor_status
 * 'closed' (the Ended state — legal from fee_paid/active per the transition
 * guard). Staff force-end already exists on the SoR desk (transitionCase).
 *
 * Ending does NOT waive an unpaid admin fee and does not touch phone/fee
 * locks; history stays on the case record (nothing is deleted).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import type { SorStatus } from "@/features/cases/sor-db";
import { assertTransition } from "@/features/cases/sor";
import { decideCaseEnd } from "@/features/cases/end-case";

type Row = Record<string, unknown>;
type Db = ReturnType<typeof asAdminDb>;

async function selectRows<T extends Row>(
  db: Db,
  table: string,
  cols: string,
  match: { col: string; op: "eq"; value: unknown }[],
): Promise<T[]> {
  let q = db.from<T>(table).select(cols);
  for (const m of match) q = q.eq(m.col, m.value);
  const { data } = await q;
  return (data ?? []) as T[];
}

async function resolveTutorId(db: Db, userId: string): Promise<string | null> {
  const rows = await selectRows<{ id: string }>(db, "tutors", "id", [
    { col: "user_id", op: "eq", value: userId },
  ]);
  return rows[0]?.id ?? null;
}

export const endCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(
    async ({
      context,
      data,
    }): Promise<{ ended: boolean; myMarked: boolean; sorStatus: SorStatus }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = asAdminDb(supabaseAdmin);

      const rows = await selectRows<{
        id: string;
        parent_id: string | null;
        matched_tutor_id: string | null;
        sor_status: SorStatus | null;
        ended_by_parent_at: string | null;
        ended_by_tutor_at: string | null;
      }>(
        db,
        "tutoring_cases",
        "id, parent_id, matched_tutor_id, sor_status, ended_by_parent_at, ended_by_tutor_at",
        [{ col: "id", op: "eq", value: data.caseId }],
      );
      const c = rows[0];
      if (!c) throw new Error("CASE_NOT_FOUND");

      // Role resolution: the case's parent, or its matched tutor. Both sides
      // may tap (not staff-only); staff keep the desk force-end.
      let actorRole: "parent" | "tutor" | null = null;
      if (c.parent_id === context.userId) actorRole = "parent";
      if (!actorRole) {
        const tutorId = await resolveTutorId(db, context.userId);
        if (tutorId && c.matched_tutor_id === tutorId) actorRole = "tutor";
      }
      if (!actorRole) throw new Error("CASE_NOT_FOUND");

      const decision = decideCaseEnd({
        sorStatus: c.sor_status,
        endedByParentAt: c.ended_by_parent_at,
        endedByTutorAt: c.ended_by_tutor_at,
        actorRole,
      });
      if (decision.action === "reject") throw new Error(decision.message);

      const nowIso = new Date().toISOString();
      const myMark =
        actorRole === "parent"
          ? { ended_by_parent_at: c.ended_by_parent_at ?? nowIso }
          : { ended_by_tutor_at: c.ended_by_tutor_at ?? nowIso };

      if (decision.action === "complete") {
        // Bilateral completion: both markers + the 'closed' transition. The
        // guard re-checks the edge; assertTransition fails fast with the
        // repo's IllegalTransitionError before any write.
        assertTransition(c.sor_status as SorStatus, "closed");
        const { error } = await db
          .from<Row>("tutoring_cases")
          .update({ ...myMark, sor_status: "closed", sor_status_at: nowIso })
          .eq("id", c.id);
        if (error) throw new Error(error.message);
        await db
          .from<Row>("case_audit")
          .insert({
            case_id: c.id,
            actor_id: context.userId,
            from_status: c.sor_status,
            to_status: "closed",
            reason: "End Case confirmed by both parties (#503)",
          })
          .select("id")
          .single();
        return { ended: true, myMarked: true, sorStatus: "closed" };
      }

      // First tap from this side. Idempotent: a re-tap rewrites the same
      // marker only if missing. Soft prompt for the other party through the
      // bus: one event per direction, each delivered in-app to the OTHER
      // side only (the actor already knows they tapped).
      if (
        (actorRole === "parent" && c.ended_by_parent_at == null) ||
        (actorRole === "tutor" && c.ended_by_tutor_at == null)
      ) {
        const { error } = await db.from<Row>("tutoring_cases").update(myMark).eq("id", c.id);
        if (error) throw new Error(error.message);

        // Simultaneous-tap heal: if both parties raced past the read above,
        // both markers are now set while the status never completed. The
        // second writer closes the case here (the guard re-checks the edge).
        const after = await selectRows<{
          ended_by_parent_at: string | null;
          ended_by_tutor_at: string | null;
          sor_status: SorStatus | null;
        }>(db, "tutoring_cases", "ended_by_parent_at, ended_by_tutor_at, sor_status", [
          { col: "id", op: "eq", value: c.id },
        ]);
        const now2 = after[0];
        if (
          now2 &&
          now2.sor_status != null &&
          now2.sor_status !== "closed" &&
          now2.ended_by_parent_at != null &&
          now2.ended_by_tutor_at != null
        ) {
          assertTransition(now2.sor_status as SorStatus, "closed");
          const { error: closeError } = await db
            .from<Row>("tutoring_cases")
            .update({ sor_status: "closed", sor_status_at: nowIso })
            .eq("id", c.id);
          if (closeError) throw new Error(closeError.message);
          await db
            .from<Row>("case_audit")
            .insert({
              case_id: c.id,
              actor_id: context.userId,
              from_status: now2.sor_status,
              to_status: "closed",
              reason: "End Case confirmed by both parties (#503)",
            })
            .select("id")
            .single();
          return { ended: true, myMarked: true, sorStatus: "closed" };
        }

        const eventType =
          actorRole === "parent" ? "case.end_requested_by_parent" : "case.end_requested_by_tutor";
        const { error: eventError } = await db
          .from<Row>("case_events")
          .insert({ event_type: eventType, payload: { case_id: c.id }, source_id: c.id })
          .select("id")
          .single();
        if (eventError && !/duplicate|unique/i.test(eventError.message ?? "")) {
          throw new Error(`insert event ${eventType}: ${eventError.message}`);
        }
      }
      return {
        ended: false,
        myMarked: true,
        sorStatus: c.sor_status as SorStatus,
      };
    },
  );
