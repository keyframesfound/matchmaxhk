/**
 * Issue #508 — Ownership dispatch filter for the desk tutor picker.
 *
 * "Do not work for free": once a tutor's 6-month intro window with a
 * counterparty (centre or parent) has closed, MatchMax does not facilitate
 * that match again — the fee would be $0. The desk shortlist therefore
 * excludes such tutors from the primary hits (surfacing them in a separate
 * warning section) and assigning one requires the operator to acknowledge
 * the #508 hard warning, which is audited.
 *
 * The window itself is defined by ownership-window.ts / the #536 engine:
 * it opens on the tutor's FIRST COMPLETED PAID Lesson 1 with that
 * counterparty and closes 180 days later.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { insertAudit, requireAdmin, selectRows, type Db } from "@/features/cases/desk-db";
import {
  INTRO_WINDOW_DAYS,
  isPastOwnershipWindow,
  outOfWindowWarning,
  type CounterpartyKind,
} from "@/features/cases/ownership-window";

type DbError = { message: string } | null;

/** One tutor hit in the case-context picker, with its ownership-window flag. */
export type CaseTutorHit = {
  id: string;
  displayName: string;
  tutorCode: string | null;
  hourlyRate: number;
  minHourlyRateHkd: number | null;
  photoUrl: string | null;
  referrerName: string | null;
  /** True when the 6-month window with this case's counterparty has closed. */
  outOfWindow: boolean;
  /** ISO close of the window (start + 180 d); null while open / not started. */
  windowEndsAt: string | null;
  /** The exact #508 hard-warning copy; null while open / not started. */
  warning: string | null;
};

type CaseParty = {
  id: string;
  case_code: string;
  status: string | null;
  matched_tutor_id: string | null;
  organisation_id: string | null;
  parent_id: string | null;
};

function counterpartyOf(c: CaseParty): { kind: CounterpartyKind; col: string; id: string } | null {
  if (c.organisation_id) return { kind: "centre", col: "organisation_id", id: c.organisation_id };
  if (c.parent_id) return { kind: "parent", col: "parent_id", id: c.parent_id };
  return null;
}

/**
 * Earliest completed paid Lesson 1 between each tutor and the counterparty,
 * as an ISO string keyed by tutor id. Tutors with no shared history are
 * absent from the map (window not started).
 */
async function earliestPaidL1WithCounterparty(
  db: Db,
  tutorIds: readonly string[],
  party: { kind: CounterpartyKind; col: string; id: string },
): Promise<Map<string, string>> {
  const byTutor = new Map<string, string>();
  if (tutorIds.length === 0) return byTutor;

  // Prior cases between these tutors and THIS counterparty (same column the
  // #536 fee engine's loadPriorCases reads, so both paths agree on history).
  const priorCases = await selectRows<{ id: string; matched_tutor_id: string }>(
    db,
    "tutoring_cases",
    "id, matched_tutor_id",
    [
      { col: "matched_tutor_id", op: "in", value: [...tutorIds] },
      { col: party.col, op: "eq", value: party.id },
    ],
  );
  if (priorCases.length === 0) return byTutor;

  const lessons = await selectRows<{ case_id: string; done_at: string | null }>(
    db,
    "case_lessons",
    "case_id, done_at",
    [
      { col: "case_id", op: "in", value: priorCases.map((c) => c.id) },
      { col: "sequence", op: "eq", value: 1 },
      { col: "status", op: "eq", value: "done" },
    ],
  );
  const l1ByCase = new Map(lessons.map((l) => [l.case_id, l.done_at]));
  for (const c of priorCases) {
    const doneAt = l1ByCase.get(c.id);
    if (!doneAt || !c.matched_tutor_id) continue;
    const prev = byTutor.get(c.matched_tutor_id);
    if (!prev || Date.parse(doneAt) < Date.parse(prev)) {
      byTutor.set(c.matched_tutor_id, doneAt);
    }
  }
  return byTutor;
}

function windowFlagFor(
  firstPaidL1At: string | undefined,
  now: Date,
): Pick<CaseTutorHit, "outOfWindow" | "windowEndsAt" | "warning"> {
  if (!firstPaidL1At || !isPastOwnershipWindow(firstPaidL1At, now)) {
    return { outOfWindow: false, windowEndsAt: null, warning: null };
  }
  const endsAt = new Date(Date.parse(firstPaidL1At) + INTRO_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return {
    outOfWindow: true,
    windowEndsAt: endsAt.toISOString(),
    warning: outOfWindowWarning(endsAt.toISOString()),
  };
}

export const searchCaseTutorsForMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        query: z.string().trim().min(2).max(60),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ hits: CaseTutorHit[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const cases = await selectRows<CaseParty>(
      db,
      "tutoring_cases",
      "id, case_code, status, matched_tutor_id, organisation_id, parent_id",
      [{ col: "id", op: "eq", value: data.caseId }],
    );
    const c = cases[0];
    if (!c) throw new Error("CASE_NOT_FOUND");

    // The structural Rows builder has no ilike; cast just this chain
    // (desk-search.functions.ts precedent).
    const tutorsAny = db.from<Record<string, unknown>>("tutors") as unknown as {
      select: (cols: string) => {
        or: (condition: string) => {
          limit: (n: number) => PromiseLike<{
            data: Array<{
              id: string;
              display_name: string;
              tutor_code: string | null;
              hourly_rate: number;
              min_hourly_rate_hkd: number | null;
              photo_url: string | null;
              referrer: { display_name: string } | { display_name: string }[] | null;
            }> | null;
            error: DbError;
          }>;
        };
      };
    };
    const q = data.query.replace(/[,()%]/g, "");
    const { data: tutorRows, error } = await tutorsAny
      .select(
        "id, display_name, tutor_code, hourly_rate, min_hourly_rate_hkd, photo_url, referrer:tutors!tutors_referred_by_fkey(display_name)",
      )
      .or(`display_name.ilike.%${q}%,tutor_code.ilike.%${q}%`)
      .limit(8);
    if (error) throw new Error(error.message);
    const tutorHits = tutorRows ?? [];
    if (tutorHits.length === 0) return { hits: [] };

    const party = counterpartyOf(c);
    const firstL1ByTutor = party
      ? await earliestPaidL1WithCounterparty(
          db,
          tutorHits.map((t) => t.id),
          party,
        )
      : new Map<string, string>();
    const now = new Date();

    const hits: CaseTutorHit[] = tutorHits.map((t) => {
      // The fkey embed's runtime shape oscillates between object and array
      // depending on the generated client; normalize both.
      const referrer = Array.isArray(t.referrer) ? (t.referrer[0] ?? null) : t.referrer;
      return {
        id: t.id,
        displayName: t.display_name,
        tutorCode: t.tutor_code,
        hourlyRate: t.hourly_rate,
        minHourlyRateHkd: t.min_hourly_rate_hkd,
        photoUrl: t.photo_url,
        referrerName: referrer?.display_name ?? null,
        ...windowFlagFor(firstL1ByTutor.get(t.id), now),
      };
    });
    // Active hits first: the shortlist must read as if out-of-window tutors
    // were excluded, while still being findable for the "centre asks by name"
    // path (#508 dispatch filter).
    hits.sort((a, b) => Number(a.outOfWindow) - Number(b.outOfWindow));
    return { hits };
  });

export type MatchTutorResult = { outcome: "matched" } | { outcome: "needs_ack"; warning: string };

/**
 * Assign a tutor to a case from the desk (#508). Returns `needs_ack` with the
 * hard-warning copy when the tutor's intro window with this counterparty has
 * closed; the panel must surface that copy and re-call with
 * `acknowledgeOutOfWindow: true` to proceed — the override is audited.
 */
export const matchCaseTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        tutorId: z.string().uuid(),
        acknowledgeOutOfWindow: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<MatchTutorResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);

    const cases = await selectRows<CaseParty>(
      db,
      "tutoring_cases",
      "id, case_code, status, matched_tutor_id, organisation_id, parent_id",
      [{ col: "id", op: "eq", value: data.caseId }],
    );
    const c = cases[0];
    if (!c) throw new Error("CASE_NOT_FOUND");
    if (c.status === "compliance_hold") {
      // Issue #412: a compliance-held request cannot be matched until staff
      // re-screen and clear the hold.
      throw new Error("COMPLIANCE_HOLD");
    }

    const tutors = await selectRows<{ id: string; display_name: string }>(
      db,
      "tutors",
      "id, display_name",
      [{ col: "id", op: "eq", value: data.tutorId }],
    );
    const tutor = tutors[0];
    if (!tutor) throw new Error("TUTOR_NOT_FOUND");

    const party = counterpartyOf(c);
    let overrideNote: string | null = null;
    if (party) {
      const firstL1 = await earliestPaidL1WithCounterparty(db, [tutor.id], party);
      const flag = windowFlagFor(firstL1.get(tutor.id), new Date());
      if (flag.outOfWindow && flag.warning) {
        if (!data.acknowledgeOutOfWindow) return { outcome: "needs_ack", warning: flag.warning };
        overrideNote = flag.warning;
      }
    }

    const { error } = await db
      .from("tutoring_cases")
      .update({
        status: "matched",
        matched_tutor_id: tutor.id,
        matched_at: new Date().toISOString(),
      })
      .eq("id", c.id);
    if (error) throw new Error(error.message);

    await insertAudit(
      db,
      c.id,
      context.userId,
      "matched",
      overrideNote ? `[#508 override] ${overrideNote}` : `matched to ${tutor.display_name}`,
    );

    // Issue #412 F: the engagement summary is ensured at match time. Fail-open
    // (transitionCase precedent) — it re-ensures idempotently later.
    try {
      const { ensureEngagementSummaryRow } = await import("@/features/cases/engagement.functions");
      await ensureEngagementSummaryRow(c.id);
    } catch (summaryError) {
      console.error("[engagement] failed to ensure summary on match:", summaryError);
    }
    return { outcome: "matched" };
  });
