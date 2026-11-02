/**
 * Issue #259 (O1) — Fee desk, server half.
 *
 *   * uploadCaseFeeScreenshot — the payer (matched tutor) attaches ONE FPS
 *     proof (JPEG/PNG ≤5 MB) to an invoiced fee on their own case.
 *   * getCaseFeeScreenshotUrl — staff only, signed 10-minute URL.
 *   * assertReferenceFree / sendFeeReceipt — used by feeMarkPaid: a bank
 *     reference that already closed another case is rejected, and a paid fee
 *     sends one receipt email (case id, amount, paid time; no file, no phone).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { insertAudit, requireAdmin, selectRows, type Db, type Row } from "@/features/cases/desk-db";
import {
  FEE_SCREENSHOT_TYPES,
  expectedMarkingDateHkt,
  isAllowedScreenshot,
  isReferenceUsedElsewhere,
} from "@/features/cases/fee-desk";

const SCREENSHOTS_BUCKET = "orders-screenshots";
const SIGNED_URL_SECONDS = 600;
// base64 of 5 MB is ~6.7M chars; leave headroom for padding.
const MAX_BASE64_CHARS = 7_200_000;

type FeeRow = {
  id: string;
  case_id: string;
  status: string;
  amount_hkd: number;
  paid_at: string | null;
  receipt_sent_at: string | null;
  payment_screenshot_path: string | null;
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
        "id, case_id, status, amount_hkd, paid_at, receipt_sent_at, payment_screenshot_path",
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
    if (fee.payment_screenshot_path) throw new Error("SCREENSHOT_ALREADY_ATTACHED");

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
      .update({ payment_screenshot_path: path, payment_screenshot_at: now.toISOString() })
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
