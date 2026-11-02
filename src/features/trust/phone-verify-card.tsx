import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Smartphone } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { OTP_CODE_LENGTH, toHkE164 } from "@/features/trust/phone-otp";
import { getPhoneOtpStatus } from "@/features/trust/phone-otp.functions";

const PHONE_OTP_QUERY_KEY = ["trust", "phone-otp"];

/**
 * #529 +852 SMS OTP. Renders nothing while the gate is off
 * (app_settings.trust_phone_otp_required) or once the account has a
 * verified HK mobile. Sends and checks the code through Supabase phone auth
 * (phone_change), so the confirmed number lands on auth.users.
 */
export function PhoneVerifyCard({ defaultPhone = "" }: { defaultPhone?: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: PHONE_OTP_QUERY_KEY,
    queryFn: () => getPhoneOtpStatus(),
  });
  const [phone, setPhone] = useState(defaultPhone);
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: async () => {
      const e164 = toHkE164(phone);
      if (!e164) throw new Error(t("phone_otp.invalid_phone"));
      const { error } = await supabase.auth.updateUser({ phone: e164 });
      if (error) throw new Error(error.message);
      return e164;
    },
    onSuccess: (e164) => {
      setSentTo(e164);
      toast.success(t("phone_otp.sent"));
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const verify = useMutation({
    mutationFn: async () => {
      if (!sentTo) throw new Error(t("phone_otp.invalid_phone"));
      const { error } = await supabase.auth.verifyOtp({
        phone: sentTo,
        token: code.trim(),
        type: "phone_change",
      });
      if (error) throw new Error(t("phone_otp.invalid_code"));
    },
    onSuccess: () => {
      toast.success(t("phone_otp.verified"));
      void queryClient.invalidateQueries({ queryKey: PHONE_OTP_QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data?.required) return null;
  if (data.verifiedPhone) {
    return (
      <p className="flex items-center gap-2 text-sm text-emerald-700">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        {t("phone_otp.verified_as", { phone: `+${data.verifiedPhone}` })}
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold">
        <Smartphone className="h-4 w-4" aria-hidden />
        {t("phone_otp.title")}
      </p>
      <p className="text-muted-foreground">{t("phone_otp.body")}</p>
      <div className="flex flex-wrap gap-2">
        <Input
          className="h-10 w-48"
          inputMode="tel"
          aria-label={t("phone_otp.phone_label")}
          placeholder="9123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={send.isPending}
          onClick={() => send.mutate()}
        >
          {send.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />}
          {sentTo ? t("phone_otp.resend") : t("phone_otp.send")}
        </Button>
      </div>
      {sentTo && (
        <div className="flex flex-wrap gap-2">
          <Input
            className="h-10 w-32 tracking-widest"
            inputMode="numeric"
            maxLength={OTP_CODE_LENGTH}
            aria-label={t("phone_otp.code_label")}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <Button
            type="button"
            disabled={code.length !== OTP_CODE_LENGTH || verify.isPending}
            onClick={() => verify.mutate()}
          >
            {t("phone_otp.verify")}
          </Button>
        </div>
      )}
    </div>
  );
}
