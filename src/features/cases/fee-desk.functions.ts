/**
 * Issue #259 (O1) — Fee desk, server half.
 *
 *   * uploadCaseFeeScreenshot — the payer (matched tutor) attaches ONE FPS
 *     proof (JPEG/PNG ≤5 MB) to an invoiced fee on their own case.
 *   * getCaseFeeScreenshotUrl — staff only, signed 10-minute URL.
 *   * assertReferenceFree / sendFeeReceipt — used by feeMarkPaid: a bank
 *     reference that already closed another case is rejected, and a paid fee
 *     sends one receipt email (case id, amount, paid time; no file, no phone).
 *   * resolveApplyFeeGate — the #760 72h soft gate, with the #756 [was #260]
 *     carve-out: an open dispute on the tutor's own cases lifts the block for
 *     that one application and the bypass is written to case_audit.
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
  type Db,
  type Row,
} from "@/features/cases/desk-db";
import {
  FEE_SCREENSHOT_TYPES,
  adminFeeOverdue,
  expectedMarkingDateHkt,
  isAllowedScreenshot,
  isReferenceUsedElsewhere,
  type SettlementFeeShape,
} from "@/features/cases/fee-desk";

const SCREENSHOTS_BUCKET = "orders-screenshots";
const SIGNED_URL_SECONDS = 600;
// base64 of 10 MB is ~13.4M chars; leave headroom for padding (#760: the
// settlement card accepts PNG/JPG receipts up to 10 MB).
const MAX_BASE64_CHARS = 14_400_000;

type FeeRow = {
  id: string;
  case_id: string;
  status: string;
  amount_hkd: number;
  paid_at: string | null;
  receipt_sent_at: string | null;
  payment_screenshot_path: string | null;
  proof_status: string | null;
  proof_rejected_at: string | null;
};

async function tutorIdForUser(db: Db, userId: string): Promise<string> {
  const tutors = await selectRows<{ id: string }>(db, "tutors", "id", [
    { col: "user_id", op: "eq", value: userId },
  ]);
  const tutorId = tutors[0]?.id;
  if (!tutorId) throw new Error("NO_TUTOR_CARD");
  return tutorId;
}

export const uploadCaseFeeScreenshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        feeId: z.string().uuid(),
        base64Data: z.string().trim().min(50).max(MAX_BASE64_CHARS),
        contentType: z.enum(FEE_SCREENSHOT_TYPES),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true; expectedMarkingDate: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutorId = await tutorIdForUser(db, context.userId);

    const fee = (
      await selectRows<FeeRow>(
        db,
        "case_fees",
        "id, case_id, status, amount_hkd, paid_at, receipt_sent_at, payment_screenshot_path, proof_status, proof_rejected_at",
        [{ col: "id", op: "eq", value: data.feeId }],
      )
    )[0];
    if (!fee) throw new Error("FEE_NOT_FOUND");
    const cases = await selectRows<{ matched_tutor_id: string | null }>(
      db,
      "tutoring_cases",
      "matched_tutor_id",
      [{ col: "id", op: "eq", value: fee.case_id }],
    );
    if (cases[0]?.matched_tutor_id !== tutorId) throw new Error("FEE_NOT_FOUND");
    if (fee.status !== "invoiced") throw new Error("FEE_NOT_INVOICED");
    // #760: one screenshot per proof round — a REPLACEMENT is allowed only
    // after ops rejected the previous one (Replace Screenshot flow).
    if (fee.payment_screenshot_path && fee.proof_status !== "rejected") {
      throw new Error("SCREENSHOT_ALREADY_ATTACHED");
    }

    const bytes = Buffer.from(data.base64Data, "base64");
    if (!isAllowedScreenshot(data.contentType, bytes.byteLength)) {
      throw new Error("SCREENSHOT_INVALID");
    }
    const ext = data.contentType === "image/png" ? "png" : "jpg";
    const path = `case-fees/${fee.id}-${Date.now().toString(36)}.${ext}`;
    const { error: uploadError } = await db.storage
      .from(SCREENSHOTS_BUCKET)
      .upload(path, bytes, { contentType: data.contentType });
    if (uploadError) throw new Error(uploadError.message);

    const now = new Date();
    const { error } = await db
      .from<Row>("case_fees")
      .update({
        payment_screenshot_path: path,
        payment_screenshot_at: now.toISOString(),
        // A replacement re-enters the verification queue; the constraint
        // pairs proof_status with the reject columns (cleared on submit).
        proof_status: "submitted",
        proof_rejected_at: null,
        proof_reject_note: null,
      } as Row)
      .eq("id", fee.id);
    if (error) throw new Error(error.message);
    await insertAudit(db, fee.case_id, context.userId, "fee_screenshot_attached", null);

    const { notifyOps } = await import("@/lib/ops-webhook.server");
    void notifyOps("case.fee_screenshot", { case_id: fee.case_id, fee_id: fee.id }).catch(() => {});
    return { ok: true, expectedMarkingDate: expectedMarkingDateHkt(now) };
  });

export const getCaseFeeScreenshotUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ feeId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ signedUrl: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);
    const fee = (
      await selectRows<{ payment_screenshot_path: string | null }>(
        db,
        "case_fees",
        "payment_screenshot_path",
        [{ col: "id", op: "eq", value: data.feeId }],
      )
    )[0];
    if (!fee?.payment_screenshot_path) throw new Error("No screenshot attached.");
    const { data: signed, error } = await db.storage
      .from(SCREENSHOTS_BUCKET)
      .createSignedUrl(fee.payment_screenshot_path, SIGNED_URL_SECONDS);
    if (error || !signed) throw new Error(error?.message || "Failed to sign URL");
    return { signedUrl: signed.signedUrl };
  });

/**
 * #760 Part 3 — ops Request Re-upload: the receipt is unreadable / wrong.
 * proof_status flips to 'rejected' (the tutor's card shows the note and a
 * Replace Screenshot affordance), and the >72h overdue soft-gate clock gains
 * +24 hours from this rejection (PROOF_REJECT_CLOCK_RESET_MS). The fee stays
 * 'invoiced' — nothing is waived.
 */
export const rejectFeeScreenshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        feeId: z.string().uuid(),
        note: z.string().trim().min(3).max(300),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);
    const fee = (
      await selectRows<FeeRow>(
        db,
        "case_fees",
        "id, case_id, status, amount_hkd, paid_at, receipt_sent_at, payment_screenshot_path, proof_status, proof_rejected_at",
        [{ col: "id", op: "eq", value: data.feeId }],
      )
    )[0];
    if (!fee) throw new Error("FEE_NOT_FOUND");
    if (fee.status !== "invoiced") throw new Error("FEE_NOT_INVOICED");
    if (!fee.payment_screenshot_path) throw new Error("NO_SCREENSHOT");

    const nowIso = new Date().toISOString();
    const { error } = await db
      .from<Row>("case_fees")
      .update({
        proof_status: "rejected",
        proof_rejected_at: nowIso,
        proof_reject_note: data.note,
      } as Row)
      .eq("id", fee.id);
    if (error) throw new Error(error.message);
    await insertAudit(db, fee.case_id, context.userId, "fee_proof_rejected", data.note);
    const { notifyOps } = await import("@/lib/ops-webhook.server");
    void notifyOps("case.fee_proof_rejected", { case_id: fee.case_id, fee_id: fee.id }).catch(
      () => {},
    );
    return { ok: true };
  });

/** Throws FPS_REFERENCE_USED when `reference` already closed a fee on another case. */
export async function assertReferenceFree(
  db: Db,
  caseId: string,
  reference: string | null | undefined,
): Promise<void> {
  if (!reference) return;
  const paid = await selectRows<{ case_id: string; fps_reference: string | null }>(
    db,
    "case_fees",
    "case_id, fps_reference",
    [{ col: "status", op: "eq", value: "paid" }],
  );
  const used = isReferenceUsedElsewhere(
    reference,
    caseId,
    paid.map((p) => ({ caseId: p.case_id, fpsReference: p.fps_reference })),
  );
  if (used) throw new Error("FPS_REFERENCE_USED");
}

/**
 * One receipt per paid fee to the payer (matched tutor). Best-effort: a mail
 * failure never undoes the paid mark; receipt_sent_at makes it once-only.
 */
export async function sendFeeReceipt(db: Db, feeId: string): Promise<void> {
  try {
    const fee = (
      await selectRows<FeeRow>(
        db,
        "case_fees",
        "id, case_id, status, amount_hkd, paid_at, receipt_sent_at, payment_screenshot_path",
        [{ col: "id", op: "eq", value: feeId }],
      )
    )[0];
    if (!fee || fee.status !== "paid" || fee.receipt_sent_at) return;
    const c = (
      await selectRows<{ case_code: string; matched_tutor_id: string | null }>(
        db,
        "tutoring_cases",
        "case_code, matched_tutor_id",
        [{ col: "id", op: "eq", value: fee.case_id }],
      )
    )[0];
    if (!c?.matched_tutor_id) return;
    const tutor = (
      await selectRows<{ user_id: string | null }>(db, "tutors", "user_id", [
        { col: "id", op: "eq", value: c.matched_tutor_id },
      ])
    )[0];
    if (!tutor?.user_id) return;
    const profile = (
      await selectRows<{ email: string | null }>(db, "profiles", "email", [
        { col: "id", op: "eq", value: tutor.user_id },
      ])
    )[0];
    if (!profile?.email) return;

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    await sendTemplateEmail("fee-receipt", profile.email, {
      idempotencyKey: `fee-receipt-${fee.id}`,
      templateData: {
        caseCode: c.case_code,
        amountHkd: `HK$${Number(fee.amount_hkd).toFixed(2)}`,
        paidAt: fee.paid_at
          ? new Date(fee.paid_at).toLocaleString("en-HK", { timeZone: "Asia/Hong_Kong" })
          : "",
      },
    });
    await db
      .from<Row>("case_fees")
      .update({ receipt_sent_at: new Date().toISOString() })
      .eq("id", fee.id);
  } catch (e) {
    console.error("[fee-desk] receipt failed:", e instanceof Error ? e.message : e);
  }
}

// ---------------------------------------------------------------------------
// #756 [was #260] — the 72h soft gate, with the open-dispute carve-out
// ---------------------------------------------------------------------------

/**
 * Where a parent/tutor dispute lives while it is unresolved. Both tables mark
 * the open row `status = 'disputed'`, and only staff move it off that state
 * (tutor_session_logs: the parent disputes a logged session until it is
 * verified or revoked; verified_hours_ledger: the parent disputes an hours
 * credit until it is resolved). There is no dedicated disputes table, and none
 * is invented here.
 */
export const OPEN_DISPUTE_SOURCES = ["tutor_session_logs", "verified_hours_ledger"] as const;
export type OpenDisputeSource = (typeof OPEN_DISPUTE_SOURCES)[number];
export type OpenDispute = { source: OpenDisputeSource; count: number };

/** What the Apply gate reads. `blocks` is false when the carve-out applies. */
export type ApplyFeeGate = {
  /** Raw observation: at least one invoiced fee is past the 72h window. */
  overdue: boolean;
  /** What the gate acts on: overdue AND no open-dispute carve-out. */
  blocks: boolean;
  /** Set only when `overdue` was lifted by an open dispute. */
  carveOut: "open_dispute" | null;
  disputes: OpenDispute[];
};

/**
 * #760 Part 3 gate + #756 carve-out. `fees` are the tutor's admin fees and
 * `disputes` their unresolved disputes; an open dispute lifts the block for
 * this one application only — every other Apply gate (board status, gender,
 * centre consent) still runs, and lesson logging is never touched. With no open
 * dispute the result is exactly the old `fees.some(adminFeeOverdue)`.
 */
export function applyFeeGate(args: {
  fees: readonly SettlementFeeShape[];
  disputes: readonly OpenDispute[];
  now: Date;
}): ApplyFeeGate {
  const overdue = args.fees.some((f) => adminFeeOverdue(f, args.now));
  const disputes = args.disputes.filter((d) => d.count > 0);
  const carveOut = overdue && disputes.length > 0 ? "open_dispute" : null;
  return { overdue, blocks: overdue && carveOut === null, carveOut, disputes };
}

/** One human-readable line for case_audit: why the gate was bypassed. */
export function disputeCarveOutReason(disputes: readonly OpenDispute[]): string {
  const open = disputes
    .filter((d) => d.count > 0)
    .map((d) => `${d.source}=${d.count}`)
    .join(", ");
  return `[#756/#260] 72h admin fee gate bypassed: open dispute (${open})`;
}

/**
 * The tutor's own unresolved disputes. Both reads are tolerant: a missing or
 * unreadable table means no carve-out, so the gate stays as strict as before.
 */
export async function openTutorDisputes(db: Db, tutorId: string): Promise<OpenDispute[]> {
  const [logs, ledger] = await Promise.all([
    selectRowsOrEmpty<{ id: string }>(db, "tutor_session_logs", "id", [
      { col: "tutor_id", op: "eq", value: tutorId },
      { col: "status", op: "eq", value: "disputed" },
    ]),
    selectRowsOrEmpty<{ id: string }>(db, "verified_hours_ledger", "id", [
      { col: "tutor_id", op: "eq", value: tutorId },
      { col: "status", op: "eq", value: "disputed" },
    ]),
  ]);
  return [
    { source: "tutor_session_logs", count: logs.length },
    { source: "verified_hours_ledger", count: ledger.length },
  ];
}

/**
 * The whole Apply gate read in one call: the tutor's fees, their open
 * disputes, and — when the carve-out fires — a case_audit row plus an ops ping
 * so the desk can see why the block was skipped. Logging is best-effort: a
 * failed audit write never re-blocks an application the carve-out allowed.
 */
export async function resolveApplyFeeGate(
  db: Db,
  args: { tutorId: string; userId: string; targetCaseId: string; now?: Date },
): Promise<ApplyFeeGate> {
  const caseIds = (
    await selectRows<{ id: string }>(db, "tutoring_cases", "id", [
      { col: "matched_tutor_id", op: "eq", value: args.tutorId },
    ])
  ).map((r) => r.id);
  const fees: SettlementFeeShape[] =
    caseIds.length === 0
      ? []
      : (
          await selectRows<{
            status: string;
            proof_status: string | null;
            proof_rejected_at: string | null;
            created_at: string | null;
          }>(db, "case_fees", "status, proof_status, proof_rejected_at, created_at", [
            { col: "case_id", op: "in", value: caseIds },
          ])
        ).map((f) => ({
          status: f.status,
          payment_screenshot_path: null,
          proof_status: f.proof_status,
          proof_rejected_at: f.proof_rejected_at,
          created_at: f.created_at,
        }));

  const disputes = await openTutorDisputes(db, args.tutorId);
  const gate = applyFeeGate({ fees, disputes, now: args.now ?? new Date() });
  if (gate.carveOut) {
    const reason = disputeCarveOutReason(gate.disputes);
    try {
      await insertAudit(db, args.targetCaseId, args.userId, "apply_fee_gate_bypassed", reason);
    } catch (e) {
      console.error("[fee-desk] carve-out audit failed:", e instanceof Error ? e.message : e);
    }
    const { notifyOps } = await import("@/lib/ops-webhook.server");
    void notifyOps("case.apply_fee_gate_bypassed", {
      case_id: args.targetCaseId,
      tutor_id: args.tutorId,
      reason,
    }).catch(() => {});
  }
  return gate;
}
