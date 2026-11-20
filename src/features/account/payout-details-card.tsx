import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getMyPayoutDetails,
  saveMyPayoutDetails,
  type SellerPayoutDetails,
} from "@/features/materials/checkout-v2.functions";
import { maskPayoutValue } from "@/features/account/payout-mask";

type Method = SellerPayoutDetails["payoutMethod"];
const QUERY_KEY = ["studio", "payout-details"] as const;

const METHOD_KEYS: Record<Method, string> = {
  fps_phone: "studio.payout_method_fps_phone",
  fps_id: "studio.payout_method_fps_id",
  bank_account: "studio.payout_method_bank",
};

/**
 * #784 §2.2 (AC-585-1 / AC-585-3): the seller's private HK payout details,
 * needed before a PAID listing can be submitted. Service-role storage; only
 * a masked summary is shown back, and nothing here is ever public.
 */
export function PayoutDetailsCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const current = useQuery({ queryKey: QUERY_KEY, queryFn: () => getMyPayoutDetails() });
  const [editing, setEditing] = useState(false);
  const [method, setMethod] = useState<Method>("fps_phone");
  const [value, setValue] = useState("");
  const [payee, setPayee] = useState("");

  const save = useMutation({
    mutationFn: () =>
      saveMyPayoutDetails({
        data: {
          payoutMethod: method,
          fpsPhone: method === "fps_phone" ? value.trim() : null,
          fpsId: method === "fps_id" ? value.trim() : null,
          bankAccount: method === "bank_account" ? value.trim() : null,
          payeeName: payee.trim(),
        },
      }),
    onSuccess: () => {
      toast.success(t("studio.payout_saved"));
      setEditing(false);
      setValue("");
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: () => toast.error(t("studio.payout_invalid")),
  });

  const saved = current.data ?? null;
  const savedValue =
    saved?.payoutMethod === "fps_phone"
      ? saved.fpsPhone
      : saved?.payoutMethod === "fps_id"
        ? saved.fpsId
        : (saved?.bankAccount ?? null);

  return (
    <section
      id="payout-details"
      className="space-y-3 rounded-[var(--radius-panel)] border border-border bg-card p-5"
    >
      <h2 className="flex items-center gap-2 text-base font-bold">
        <Landmark className="h-4 w-4 text-[color:var(--brand-link)]" aria-hidden />
        {t("studio.payout_details_title")}
      </h2>
      <p className="text-xs text-muted-foreground">{t("studio.payout_details_hint")}</p>

      {current.isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}

      {!editing && saved ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            {t(METHOD_KEYS[saved.payoutMethod])} · {maskPayoutValue(savedValue)} · {saved.payeeName}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setMethod(saved.payoutMethod);
              setPayee(saved.payeeName);
              setEditing(true);
            }}
          >
            {t("studio.payout_edit")}
          </Button>
        </div>
      ) : null}

      {!current.isLoading && (editing || !saved) ? (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <fieldset className="space-y-1.5 sm:col-span-2">
            <legend className="text-sm font-medium">{t("studio.payout_method")}</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(METHOD_KEYS) as Method[]).map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="sm"
                  variant={method === m ? "default" : "outline"}
                  aria-pressed={method === m}
                  onClick={() => setMethod(m)}
                >
                  {t(METHOD_KEYS[m])}
                </Button>
              ))}
            </div>
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="payout-value">{t(METHOD_KEYS[method])}</Label>
            <Input
              id="payout-value"
              autoComplete="off"
              inputMode={method === "fps_phone" || method === "bank_account" ? "numeric" : "text"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payout-payee">{t("studio.payout_payee")}</Label>
            <Input
              id="payout-payee"
              autoComplete="name"
              maxLength={80}
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button
              type="submit"
              className="font-bold"
              disabled={!value.trim() || !payee.trim() || save.isPending}
            >
              {save.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              {t("studio.payout_save")}
            </Button>
            {editing ? (
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                {t("studio.payout_cancel")}
              </Button>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground sm:col-span-2">
            {t("studio.payout_private")}
          </p>
        </form>
      ) : null}
    </section>
  );
}
