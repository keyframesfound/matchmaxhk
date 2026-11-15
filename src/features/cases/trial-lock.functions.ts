/**
 * Issue #772 Part 1 — 1-active-trial lock server fns.
 *
 * Surfaces (all authed):
 *   • getCaseTrialLock        — mutex state for the Case Manager / parent
 *                               workspace card (banner, active trial status,
 *                               locked backup buttons, 3rd-rematch notice).
 *   • startCaseTrialIntro     — desk unlock of one shortlisted tutor; refuses
 *                               with LOCKED_BY_ACTIVE_TRIAL or
 *                               REQUIRES_OPS_APPROVAL (never auto-unlocks the
 *                               3rd introduction).
 *   • closeCaseTrialIntro     — pre-L1 cancel / stop-after-L1 / replaced, which
 *                               spends the attempt and unlocks the next tutor.
 *   • clearTrialOpsApproval   — staff release after the concierge review.
 *   • confirmCaseTrialLesson  — the confirmed-trial write #768 turns into
 *                               auto-Busy (in-app and WhatsApp-desk confirms).
 *   • hasActiveTrialOrCaseInSubject — the shared #759 post-auth signal.
 *
 * The SoR machine itself is untouched: the lock rides on
 * tutoring_cases.sor_status (introduced → lesson_1_scheduled → lesson_1_done)
 * and only records which tutor holds the slot.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { insertAudit, requireAdmin } from "@/features/cases/desk-db";
import { isLegalTransition, type SorStatus } from "@/features/cases/sor";
import {
  activeTrialOrCaseSignal,
  attachLessonToActiveIntro,
  claimTrialIntro,
  clearTrialOpsApproval as clearTrialOpsApprovalRpc,
  closeTrialIntro,
  derivedCloseKind,
  emitConfirmedTrialBusy,
  loadLockCase,
  loadTrialLock,
  requireParentOrStaff,
  trialLockDb,
  type CloseIntroResult,
} from "@/features/cases/trial-lock.server";
import type {
  ActiveTrialOrCaseSignal,
  CaseTrialLockState,
  TrialCloseKind,
} from "@/features/cases/trial-lock";

const caseIdSchema = z.object({ caseId: z.string().uuid() });

export const getCaseTrialLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => caseIdSchema.parse(input))
  .handler(
    async ({
      context,
      data,
    }): Promise<{ lock: CaseTrialLockState; caseCode: string; sorStatus: string | null }> => {
      const db = await trialLockDb();
      const row = await loadLockCase(db, data.caseId);
      await requireParentOrStaff(db, row, context.userId);
      const lock = await loadTrialLock(db, data.caseId);
      return { lock, caseCode: row.case_code, sorStatus: row.sor_status };
    },
  );

export type StartTrialIntroResult =
  | { ok: true; introId: string; sequence: number; alreadyActive: boolean }
  | { ok: false; reason: "LOCKED_BY_ACTIVE_TRIAL"; activeTutorId: string | null }
  | { ok: false; reason: "REQUIRES_OPS_APPROVAL"; trialAttemptCount: number };

export const startCaseTrialIntro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    caseIdSchema
      .extend({
        tutorId: z.string().uuid(),
        source: z.enum(["in_app", "whatsapp_desk", "concierge"]).default("in_app"),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<StartTrialIntroResult> => {
    const db = await trialLockDb();
    await requireAdmin(db, context.userId);
    await loadLockCase(db, data.caseId);

    const claim = await claimTrialIntro(db, {
      caseId: data.caseId,
      tutorId: data.tutorId,
      source: data.source,
    });
    if (!claim.ok) {
      if (claim.reason === "LOCKED_BY_ACTIVE_TRIAL") {
        return { ok: false, reason: claim.reason, activeTutorId: claim.active?.tutorId ?? null };
      }
      return {
        ok: false,
        reason: claim.reason,
        trialAttemptCount: claim.trialAttemptCount,
      };
    }
    await insertAudit(
      db,
      data.caseId,
      context.userId,
      "trial_intro_opened",
      `#772 introduction #${claim.sequence} (tutor ${data.tutorId}, ${data.source})${
        claim.alreadyActive ? " — re-asserted" : ""
      }`,
    );
    return {
      ok: true,
      introId: claim.introId,
      sequence: claim.sequence,
      alreadyActive: claim.alreadyActive,
    };
  });

export const closeCaseTrialIntro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    caseIdSchema
      .extend({ closeKind: z.enum(["pre_l1", "after_l1", "replaced"]).optional() })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<CloseIntroResult> => {
    const db = await trialLockDb();
    await requireAdmin(db, context.userId);
    const row = await loadLockCase(db, data.caseId);
    const closeKind: TrialCloseKind =
      data.closeKind ?? (await derivedCloseKind(db, data.caseId, row.sor_status));
    const result = await closeTrialIntro(db, {
      caseId: data.caseId,
      closeKind,
      actorId: context.userId,
    });
    if (result.ok) {
      await insertAudit(
        db,
        data.caseId,
        context.userId,
        "trial_intro_closed",
        `#772 introduction closed (${closeKind}); attempts now ${result.trialAttemptCount ?? 0}`,
      );
    }
    return result;
  });

export const clearTrialOpsApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    caseIdSchema.extend({ note: z.string().max(300).optional() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean; wasRaised: boolean }> => {
    const db = await trialLockDb();
    await requireAdmin(db, context.userId);
    const result = await clearTrialOpsApprovalRpc(db, data.caseId);
    if (result.ok) {
      await insertAudit(
        db,
        data.caseId,
        context.userId,
        "trial_ops_approval_cleared",
        `#772 3rd-rematch ops approval cleared${data.note ? `: ${data.note}` : ""}`,
      );
    }
    return result;
  });

export type ConfirmTrialLessonResult = {
  lessonId: string;
  startsAt: string;
  busySource: "case_lessons";
  introId: string | null;
  sorStatus: string | null;
};

/**
 * Confirm the trial lesson time (in-app or WhatsApp desk). This is the #772
 * emission #768 consumes: the confirmed case_lessons row is what makes the
 * matching public grid cells Occupied (derived at read time by
 * availability-occupancy.functions.ts — no second availability store).
 */
export const confirmCaseTrialLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    caseIdSchema
      .extend({
        startsAtIso: z.string().datetime(),
        durationMin: z.number().int().min(15).max(240),
        locationOrLink: z.string().trim().max(300).optional(),
        source: z.enum(["in_app", "whatsapp_desk", "concierge"]).default("in_app"),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<ConfirmTrialLessonResult> => {
    const db = await trialLockDb();
    const row = await loadLockCase(db, data.caseId);
    await requireParentOrStaff(db, row, context.userId);
    const tutorId = row.matched_tutor_id;
    if (!tutorId) throw new Error("NO_MATCHED_TUTOR");

    // The mutex covers the confirm too: a lesson can only be confirmed for the
    // tutor holding the slot (the claim is idempotent for that tutor and
    // refuses with a reason code for anyone else).
    const claim = await claimTrialIntro(db, {
      caseId: data.caseId,
      tutorId,
      source: data.source,
    });
    if (!claim.ok) {
      throw new Error(
        claim.reason === "REQUIRES_OPS_APPROVAL"
          ? "REQUIRES_OPS_APPROVAL"
          : "LOCKED_BY_ACTIVE_TRIAL",
      );
    }

    const slot = await emitConfirmedTrialBusy(db, {
      caseId: data.caseId,
      tutorId,
      startsAtIso: data.startsAtIso,
      durationMin: data.durationMin,
      locationOrLink: data.locationOrLink ?? null,
      source: data.source,
      actorId: context.userId,
    });
    await attachLessonToActiveIntro(db, data.caseId, slot.lessonId);

    // SoR stays the source of truth: the trial moves to lesson_1_scheduled.
    let sorStatus = row.sor_status;
    const current = (row.sor_status ?? "introduced") as SorStatus;
    if (current === "introduced" && isLegalTransition(current, "lesson_1_scheduled")) {
      const { error } = await db
        .from<Record<string, unknown>>("tutoring_cases")
        .update({ sor_status: "lesson_1_scheduled", sor_status_at: new Date().toISOString() })
        .eq("id", data.caseId);
      if (error) throw new Error(error.message);
      await insertAudit(
        db,
        data.caseId,
        context.userId,
        "lesson_1_scheduled",
        `#772 trial confirmed (${data.source}) — ${slot.startsAt}`,
      );
      sorStatus = "lesson_1_scheduled";
    }

    return {
      lessonId: slot.lessonId,
      startsAt: slot.startsAt,
      busySource: slot.busySource,
      introId: claim.introId || null,
      sorStatus,
    };
  });

/**
 * The shared #759 signal: "already has an active trial or case in this
 * subject (and child if set)". #759 owns the toast/redirect; the submit guard
 * in src/lib/cases.functions.ts uses the same helper to refuse the INSERT.
 */
export const hasActiveTrialOrCaseInSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subject: z.string().trim().min(1).max(120),
        childId: z.string().uuid().nullish(),
        excludeCaseId: z.string().uuid().nullish(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<ActiveTrialOrCaseSignal> => {
    const db = await trialLockDb();
    return activeTrialOrCaseSignal(db, {
      userId: context.userId,
      subject: data.subject,
      childId: data.childId ?? null,
      excludeCaseId: data.excludeCaseId ?? null,
    });
  });
