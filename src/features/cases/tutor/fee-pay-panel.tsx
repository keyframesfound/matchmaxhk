import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Receipt } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { uploadCaseFeeScreenshot } from "@/features/cases/fee-desk.functions";
import {
  FEE_SCREENSHOT_MAX_BYTES,
  MATCHMAX_FPS,
  fpsMemoForCase,
  isAllowedScreenshot,
} from "@/features/cases/fee-desk";
import { bytesToBase64 } from "@/features/materials/storage-helpers";

type Props = {
  feeId: string;
  caseCode: string;
  amountHkd: number;
  dueAt: string | null;
  hasScreenshot: boolean;
};

/**
 * #259 fee desk: the payer (matched tutor, tutor-pays) sees the invoice and
 * the company FPS details on the case, and may attach one payment screenshot.
 * No parent phone appears here; contact unlocks after staff mark paid.
 */
export function FeePayPanel({ feeId, caseCode, amountHkd, dueAt, hasScreenshot }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const memo = fpsMemoForCase(caseCode);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      return uploadCaseFeeScreenshot({
        data: {
          feeId,
          base64Data: bytesToBase64(bytes),
          contentType: file.type as "image/jpeg" | "image/png",
        },
      });
    },
    onSuccess: (res) => {
      toast.success(t("fee_desk.uploaded", { date: res.expectedMarkingDate }));
      void queryClient.invalidateQueries({ queryKey: ["sor", "tutor-cases"] });
    },
    onError: () => toast.error(t("fee_desk.upload_failed")),
    onSettled: () => {
      if (fileRef.current) fileRef.current.value = "";
    },
  });

  return (
    <div className="mt-3 space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold text-[color:var(--ink)]">
        <Receipt className="h-4 w-4" aria-hidden />
        {t("fee_desk.title")}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
        <dt>{t("fee_desk.amount")}</dt>
        <dd className="font-semibold text-foreground">HK${Number(amountHkd).toFixed(0)}</dd>
        {dueAt && (
          <>
            <dt>{t("fee_desk.due")}</dt>
            <dd className="text-foreground">{format(new Date(dueAt), "yyyy-MM-dd")}</dd>
          </>
        )}
        <dt>{t("fee_desk.payee")}</dt>
        <dd className="text-foreground">
          {MATCHMAX_FPS.payeeName} · FPS {MATCHMAX_FPS.fpsNumber}
        </dd>
        <dt>{t("fee_desk.bank")}</dt>
        <dd className="text-foreground">{MATCHMAX_FPS.bankAccount}</dd>
        <dt>{t("fee_desk.reference")}</dt>
        <dd className="font-mono text-foreground">{memo}</dd>
      </dl>
      <p className="text-xs text-muted-foreground">{t("fee_desk.hours_note")}</p>
      {hasScreenshot ? (
        <p className="text-xs font-medium text-emerald-700">{t("fee_desk.screenshot_received")}</p>
      ) : (
        <label className="block space-y-1">
          <span className="text-xs font-medium">{t("fee_desk.screenshot_label")}</span>
          <div className="flex items-center gap-2">
            <Input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png"
              className="h-10 cursor-pointer"
              disabled={upload.isPending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (!isAllowedScreenshot(file.type, file.size)) {
                  toast.error(
                    t("fee_desk.screenshot_invalid", {
                      mb: FEE_SCREENSHOT_MAX_BYTES / (1024 * 1024),
                    }),
                  );
                  event.target.value = "";
                  return;
                }
                upload.mutate(file);
              }}
            />
            {upload.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          </div>
        </label>
      )}
    </div>
  );
}
