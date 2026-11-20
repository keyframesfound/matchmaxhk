/**
 * #783 §2.4 (was #737): BYOS one-time invite server fns. All reads and writes
 * go through the service role; byos_invites has RLS on with no policies, and
 * the waiver columns on tutoring_cases are service-role only (DB trigger).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { insertAudit, selectRows, type Db, type Row } from "@/features/cases/desk-db";
import { normalizePhone } from "@/features/cases/import-plan";
import {
  BYOS_CASE_SOURCE,
  byosClaimRefusal,
  byosInvitePath,
  hashInviteToken,
  isWellFormedInviteToken,
  newInviteToken,
  validateByosInvite,
  type ByosClaimRefusal,
  type PriorContact,
} from "@/features/cases/byos";

async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

/** The caller's tutor card, or null when they do not teach on MatchMax. */
async function myTutor(
  db: Db,
  userId: string,
): Promise<{ id: string; display_name: string } | null> {
  const rows = await selectRows<{ id: string; display_name: string }>(
    db,
    "tutors",
    "id, display_name",
    [{ col: "user_id", op: "eq", value: userId }],
    { col: "created_at", asc: true, limit: 1 },
  );
  return rows[0] ?? null;
}

export type ByosInviteRow = {
  id: string;
  invitee_label: string;
  subject: string;
  level: string | null;
  hourly_rate_hkd: number;
  status: "active" | "claimed" | "revoked";
  created_at: string;
  claimed_at: string | null;
};

const INVITE_COLS =
  "id, invitee_label, subject, level, hourly_rate_hkd, status, created_at, claimed_at";

export const listMyByosInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isTutor: boolean; invites: ByosInviteRow[] }> => {
    const db = await adminDb();
    const tutor = await myTutor(db, context.userId);
    if (!tutor) return { isTutor: false, invites: [] };
    const invites = await selectRows<ByosInviteRow>(
      db,
      "byos_invites",
      INVITE_COLS,
      [{ col: "tutor_id", op: "eq", value: tutor.id }],
      { col: "created_at", asc: false, limit: 50 },
    );
    return { isTutor: true, invites };
  });

/**
 * Create a one-time invite. Returns the raw token ONCE (only its hash is
 * stored), so the tutor copies / shares the link right away.
 */
export const createByosInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        inviteeLabel: z.string(),
        subject: z.string(),
        level: z.string().default(""),
        hourlyRateHkd: z.number(),
        lessonMode: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const problem = validateByosInvite(data);
    if (problem) throw new Error(`INVALID_${problem.toUpperCase()}`);
    const db = await adminDb();
    const tutor = await myTutor(db, context.userId);
    if (!tutor) throw new Error("NOT_A_TUTOR");
    // #782: Safety Attestation + strike pause before any new case.
    const { assertTutorCanBeIntroduced } =
      await import("@/features/trust/match-eligibility.server");
    await assertTutorCanBeIntroduced(db, tutor.id);

    const token = newInviteToken();
    const { error } = await db
      .from<Row>("byos_invites")
      .insert({
        token_hash: await hashInviteToken(token),
        tutor_id: tutor.id,
        invitee_label: data.inviteeLabel.trim(),
        subject: data.subject.trim(),
        level: data.level.trim() || null,
        hourly_rate_hkd: Math.round(data.hourlyRateHkd * 100) / 100,
        lesson_mode: data.lessonMode,
      })
      .select("id")
      .single();
    if (error) {
      if (/duplicate|unique/i.test(error.message)) throw new Error("ACTIVE_INVITE_EXISTS");
      throw new Error(error.message);
    }
    return { path: byosInvitePath(token) };
  });

export const revokeByosInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ inviteId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await adminDb();
    const tutor = await myTutor(db, context.userId);
    if (!tutor) throw new Error("NOT_A_TUTOR");
    const { error } = await db
      .from<Row>("byos_invites")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", data.inviteId)
      .eq("tutor_id", tutor.id)
      .eq("status", "active");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

type InviteRecord = {
  id: string;
  tutor_id: string;
  subject: string;
  level: string | null;
  hourly_rate_hkd: number;
  lesson_mode: string;
  status: string;
  tutors: { display_name: string; user_id: string | null } | null;
};

async function loadInvite(db: Db, token: string): Promise<InviteRecord | null> {
  if (!isWellFormedInviteToken(token)) return null;
  const rows = await selectRows<InviteRecord>(
    db,
    "byos_invites",
    "id, tutor_id, subject, level, hourly_rate_hkd, lesson_mode, status, tutors(display_name, user_id)",
    [{ col: "token_hash", op: "eq", value: await hashInviteToken(token) }],
  );
  return rows[0] ?? null;
}

export type ByosInvitePreview =
  | { found: false }
  | {
      found: true;
      active: boolean;
      tutorName: string;
      subject: string;
      level: string | null;
      hourlyRateHkd: number;
    };

/** Public preview for the landing page: no ids, no tutor contact details. */
export const getByosInvitePreview = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ token: z.string().max(64) }).parse(data))
  .handler(async ({ data }): Promise<ByosInvitePreview> => {
    const db = await adminDb();
    const invite = await loadInvite(db, data.token);
    if (!invite) return { found: false };
    return {
      found: true,
      active: invite.status === "active",
      tutorName: invite.tutors?.display_name ?? "",
      subject: invite.subject,
      level: invite.level,
      hourlyRateHkd: Number(invite.hourly_rate_hkd),
    };
  });

/** Live records tying the claimant (account or phone) to this tutor. */
async function priorContactWith(
  db: Db,
  tutorId: string,
  claimantId: string,
  claimantPhone: string | null,
): Promise<PriorContact> {
  const [ownCases, trials] = await Promise.all([
    selectRows<{ id: string; matched_tutor_id: string | null }>(
      db,
      "tutoring_cases",
      "id, matched_tutor_id",
      [{ col: "parent_id", op: "eq", value: claimantId }],
    ),
    selectRows<{ id: string }>(db, "case_trial_intros", "id", [
      { col: "tutor_id", op: "eq", value: tutorId },
      { col: "parent_id", op: "eq", value: claimantId },
    ]),
  ]);

  let matchedCase = ownCases.some((c) => c.matched_tutor_id === tutorId);
  if (!matchedCase && claimantPhone) {
    // A request filed under another account with the same phone still counts.
    const phone = normalizePhone(claimantPhone);
    if (phone.length >= 8) {
      const tutorCases = await selectRows<{ contact_phone: string | null }>(
        db,
        "tutoring_cases",
        "contact_phone",
        [{ col: "matched_tutor_id", op: "eq", value: tutorId }],
      );
      matchedCase = tutorCases.some(
        (c) => c.contact_phone != null && normalizePhone(c.contact_phone) === phone,
      );
    }
  }

  let tutorApplied = false;
  if (ownCases.length > 0) {
    const applications = await selectRows<{ id: string }>(db, "case_applications", "id", [
      { col: "tutor_id", op: "eq", value: tutorId },
      { col: "case_id", op: "in", value: ownCases.map((c) => c.id) },
    ]);
    tutorApplied = applications.length > 0;
  }

  return { matchedCase, trialIntro: trials.length > 0, tutorApplied };
}

export type ByosClaimResult =
  | { outcome: "claimed"; caseId: string }
  | { outcome: "refused"; reason: ByosClaimRefusal | "not_found" };

/**
 * Claim: the signed-in parent / student opens a BYOS_DIRECT case with the
 * admin fee waived. Refused (no case, no waiver) on any prior on-platform
 * contact with this tutor — the normal request + fee path stays open.
 */
export const claimByosInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ token: z.string().max(64) }).parse(data))
  .handler(async ({ data, context }): Promise<ByosClaimResult> => {
    const db = await adminDb();
    const invite = await loadInvite(db, data.token);
    if (!invite) return { outcome: "refused", reason: "not_found" };

    const profiles = await selectRows<{ display_name: string | null; phone: string | null }>(
      db,
      "profiles",
      "display_name, phone",
      [{ col: "id", op: "eq", value: context.userId }],
    );
    const profile = profiles[0];
    const refusal = byosClaimRefusal({
      inviteStatus: invite.status,
      claimantIsTutor: invite.tutors?.user_id === context.userId,
      prior: await priorContactWith(db, invite.tutor_id, context.userId, profile?.phone ?? null),
    });
    if (refusal) return { outcome: "refused", reason: refusal };
    {
      const { assertTutorCanBeIntroduced, assertParentCanBeMatched } =
        await import("@/features/trust/match-eligibility.server");
      await assertTutorCanBeIntroduced(db, invite.tutor_id);
      await assertParentCanBeMatched(db, context.userId);
    }

    // Spend the one-time token first; a concurrent claim loses here.
    const now = new Date().toISOString();
    const { count, error: spendError } = await db
      .from<Row>("byos_invites")
      .update(
        { status: "claimed", claimed_by: context.userId, claimed_at: now },
        { count: "exact" },
      )
      .eq("id", invite.id)
      .eq("status", "active");
    if (spendError) throw new Error(spendError.message);
    if ((count ?? 0) === 0) return { outcome: "refused", reason: "not_active" };

    const contactName = profile?.display_name?.trim() || "BYOS student";
    const { data: caseId, error: createError } = await db.rpc("admin_create_sor_case", {
      _payload: {
        assigned_tutor_id: invite.tutor_id,
        parent_account_id: context.userId,
        student_display_name: contactName,
        subject: invite.subject,
        level: invite.level,
        hourly_rate_hkd: invite.hourly_rate_hkd,
        lesson_mode: invite.lesson_mode,
        contact_name: contactName,
        contact_phone: profile?.phone ?? "",
        source: "byos_direct",
      },
    });
    if (createError || typeof caseId !== "string") {
      throw new Error(createError?.message ?? "CASE_CREATE_FAILED");
    }

    // Waiver flags + matched, then draft → introduced (a legal SOR edge).
    const { error: flagError } = await db
      .from<Row>("tutoring_cases")
      .update({
        case_source: BYOS_CASE_SOURCE,
        admin_fee_waived: true,
        status: "matched",
      })
      .eq("id", caseId);
    if (flagError) throw new Error(flagError.message);
    const { error: sorError } = await db
      .from<Row>("tutoring_cases")
      .update({ sor_status: "introduced", sor_status_at: now })
      .eq("id", caseId)
      .eq("sor_status", "draft");
    if (sorError) throw new Error(sorError.message);

    await db.from<Row>("byos_invites").update({ claimed_case_id: caseId }).eq("id", invite.id);
    await insertAudit(
      db,
      caseId,
      context.userId,
      "byos_claimed",
      "#783 BYOS_DIRECT invite claimed: admin fee waived (HK$0); tuition stays parent → tutor",
    );
    return { outcome: "claimed", caseId };
  });
