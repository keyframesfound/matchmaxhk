import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ClipboardCopy, Clock3, Loader2, Receipt, ShieldAlert } from "lucide-react";
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
  /** #760 Part 3: none / submitted (verifying) / rejected (re-upload). */
  proofStatus: string | null;
  /** Ops one-liner sent with the re-upload request. */
  proofRejectNote: string | null;
};

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // Clipboard API can be unavailable — fall back to a transient textarea.
    try {
      const el = document.createElement("textarea");
      el.value = value;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * #259 fee desk, #760 Part 3 settlement card: the payer (matched tutor,
 * tutor-pays) sees the invoice, the company FPS details and the MM-case
 * reference on the case, attaches one payment screenshot, and sees the proof
 * state — payment_due → pending verification (amber) → settled (staff mark
 * paid), with a Replace Screenshot round-trip when ops rejects the receipt.
 * No parent phone appears here; contact unlocks after staff mark paid.
 */
export function FeePayPanel({
  feeId,
  caseCode,
  amountHkd,
  dueAt,
  hasScreenshot,
  proofStatus,
  proofRejectNote,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const memo = fpsMemoForCase(caseCode);
  const verifying = proofStatus === "submitted";
  const rejected = proofStatus === "rejected";

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold text-[color:var(--ink)]">
          <Receipt className="h-4 w-4" aria-hidden />
          {t("fee_desk.title")}
        </p>
        {verifying ? (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700">
            <Clock3 className="h-3.5 w-3.5" aria-hidden />
            {t("fee_desk.proof_verifying")}
          </span>
        ) : null}
      </div>
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
          <button
            type="button"
            className="ml-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-[color:var(--foreground)]/[0.05]"
            aria-label={t("fee_desk.copy_fps")}
            onClick={async () => {
              const ok = await copyText(MATCHMAX_FPS.fpsNumber);
              if (ok) toast.success(t("fee_desk.copied"));
            }}
          >
            <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
          </button>
        </dd>
        <dt>{t("fee_desk.bank")}</dt>
        <dd className="text-foreground">{MATCHMAX_FPS.bankAccount}</dd>
        <dt>{t("fee_desk.reference")}</dt>
        <dd className="font-mono text-foreground">
          {memo}
          <button
            type="button"
            className="ml-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-[color:var(--foreground)]/[0.05]"
            aria-label={t("fee_desk.copy_reference")}
            onClick={async () => {
              const ok = await copyText(memo);
              if (ok) toast.success(t("fee_desk.copied"));
            }}
          >
            <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
          </button>
        </dd>
      </dl>
      <p className="text-xs text-muted-foreground">{t("fee_desk.hours_note")}</p>
      {rejected ? (
        <p className="flex items-start gap-2 rounded-xl border border-[#F4212E]/30 bg-[#F4212E]/[0.06] px-3 py-2 text-xs font-semibold text-destructive">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {t("fee_desk.proof_rejected")}
            {proofRejectNote ? ` — ${proofRejectNote}` : ""}
          </span>
        </p>
      ) : null}
      {hasScreenshot && !rejected ? (
        <p className="text-xs font-medium text-emerald-700">{t("fee_desk.screenshot_received")}</p>
      ) : (
        <label className="block space-y-1">
          <span className="text-xs font-medium">
            {rejected ? t("fee_desk.screenshot_replace") : t("fee_desk.screenshot_label")}
          </span>
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
