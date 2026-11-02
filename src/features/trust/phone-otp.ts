/**
 * Issue #529 V1 item 3 — +852 SMS OTP, pure half.
 *
 * Verification runs on Supabase phone auth (Twilio provider configured in
 * the Supabase dashboard): the signed-in user adds a phone with
 * auth.updateUser({ phone }) and confirms the SMS code with
 * verifyOtp({ type: "phone_change" }), which sets auth.users.phone +
 * phone_confirmed_at. The gate is OFF until app_settings
 * `trust_phone_otp_required` is true, so bookings never break before the
 * SMS provider is live. When on:
 *   * parent booking (submitCaseRequest) needs a verified +852 phone that
 *     matches the request's contact phone;
 *   * tutor Apply (sensitive action) needs a verified +852 phone.
 */

import { normalizePhone } from "@/features/cases/import-plan";

export const PHONE_OTP_SETTING_KEY = "trust_phone_otp_required";
export const OTP_CODE_LENGTH = 6;

const HK_MOBILE = /^[4-9]\d{7}$/;

/** HK mobile numbers: 8 digits starting 4–9 (landlines start 2/3). */
export function isHkMobile(raw: string | null | undefined): boolean {
  return HK_MOBILE.test(normalizePhone(raw ?? ""));
}

/** "9123 4567" → "+85291234567"; null when not an HK mobile. */
export function toHkE164(raw: string | null | undefined): string | null {
  const d = normalizePhone(raw ?? "");
  return HK_MOBILE.test(d) ? `+852${d}` : null;
}

export function isOtpRequired(settingValue: unknown): boolean {
  return settingValue === true || settingValue === "true";
}

export type PhoneGateResult =
  { ok: true } | { ok: false; reason: "PHONE_NOT_VERIFIED" | "PHONE_NOT_HK" | "PHONE_MISMATCH" };

/**
 * The server gate. `verifiedPhone` is auth.users.phone when
 * phone_confirmed_at is set (Supabase stores it without the "+").
 */
export function checkPhoneGate(input: {
  required: boolean;
  verifiedPhone: string | null;
  contactPhone?: string | null;
}): PhoneGateResult {
  if (!input.required) return { ok: true };
  if (!input.verifiedPhone) return { ok: false, reason: "PHONE_NOT_VERIFIED" };
  if (!isHkMobile(input.verifiedPhone)) return { ok: false, reason: "PHONE_NOT_HK" };
  if (
    input.contactPhone != null &&
    normalizePhone(input.contactPhone) !== normalizePhone(input.verifiedPhone)
  ) {
    return { ok: false, reason: "PHONE_MISMATCH" };
  }
  return { ok: true };
}
