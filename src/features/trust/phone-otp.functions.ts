/**
 * Issue #529 — +852 SMS OTP, server half. The SMS itself is sent and
 * verified by Supabase phone auth (Twilio); this module only reads the
 * confirmed phone off auth.users and enforces the gate when
 * app_settings.trust_phone_otp_required is on.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PHONE_OTP_SETTING_KEY, checkPhoneGate, isOtpRequired } from "@/features/trust/phone-otp";

type AuthAdmin = {
  auth: {
    admin: {
      getUserById: (id: string) => Promise<{
        data: { user: { phone?: string | null; phone_confirmed_at?: string | null } | null };
        error: { message: string } | null;
      }>;
    };
  };
};

export type PhoneOtpState = { required: boolean; verifiedPhone: string | null };

async function loadState(userId: string): Promise<PhoneOtpState> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { asAdminDb } = await import("@/features/materials/storage-helpers");
  const { readSetting } = await import("@/features/cases/desk-db");
  const required = isOtpRequired(
    await readSetting(asAdminDb(supabaseAdmin), PHONE_OTP_SETTING_KEY),
  );
  if (!required) return { required, verifiedPhone: null };
  const { data, error } = await (supabaseAdmin as unknown as AuthAdmin).auth.admin.getUserById(
    userId,
  );
  if (error) throw new Error(error.message);
  const user = data.user;
  const verifiedPhone = user?.phone && user.phone_confirmed_at ? user.phone : null;
  return { required, verifiedPhone };
}

/** Throws PHONE_NOT_VERIFIED / PHONE_NOT_HK / PHONE_MISMATCH when the gate is on and fails. */
export async function assertPhoneGate(userId: string, contactPhone?: string | null): Promise<void> {
  const state = await loadState(userId);
  const result = checkPhoneGate({ ...state, contactPhone });
  if (!result.ok) throw new Error(result.reason);
}

export const getPhoneOtpStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PhoneOtpState> => loadState(context.userId));
