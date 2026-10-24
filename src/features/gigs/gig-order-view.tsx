import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MAX_GIG_FILE_BYTES } from "@/features/gigs/gig";
import { uploadGigSourceFile, requestGigRefund } from "@/features/gigs/gig-buyer.functions";
import type { MyOrder } from "@/features/materials/checkout.functions";

/**
 * Issues #328/#329: the buyer-side panels a GIG order renders on
 * /orders/$orderId, on top of the shared reference card + FPS pay block.
 * in_fulfillment → "tutor is preparing" line with the fail-safe due date
 * (plus the ONE source-file upload for file_back services); past_due →
 * highlighted block with the parent's self-serve Request Refund; delivered →
 * the tutor's completion note. Download stays in the summary rail (notes
 * behaviour), gated on an actual delivered file so session gigs don't show a
 * dead button.
 */

function formatDue(datetime: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(datetime));
}

function GigSourceUpload({ order }: { order: MyOrder }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("Could not read the file."));
        reader.readAsDataURL(file);
      });
      return uploadGigSourceFile({
        data: {
          orderId: order.id,
          base64Data: base64,
          contentType:
            file.type === "application/pdf"
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      });
    },
    onSuccess: () => {
      toast.success(t("gigs.upload_success"));
      void queryClient.invalidateQueries({ queryKey: ["order", order.id] });
    },
    onSettled: () => setUploading(false),
  });

  return (
    <div className="space-y-1.5">
      <label htmlFor="gig-source" className="text-sm font-medium">
        {t("gigs.upload_label")}
      </label>
      <Input
        id="gig-source"
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="h-11 cursor-pointer"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const isPdfOrDocx =
            file.type === "application/pdf" ||
            file.type ===
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            /\.docx$/i.test(file.name);
          if (!isPdfOrDocx) {
            toast.error(t("gigs.upload_label"));
            return;
          }
          if (file.size > MAX_GIG_FILE_BYTES) {
            toast.error(t("gigs.upload_too_large"));
            return;
          }
          setUploading(true);
          uploadMutation.mutate(file);
        }}
      />
      <p className="text-xs text-muted-foreground">{t("gigs.upload_hint")}</p>
      {uploading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          {t("orders.screenshot_uploading")}
        </p>
      )}
      {order.hasSourceFile && !uploading && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-success">
          <Check className="h-3.5 w-3.5" aria-hidden />
          {t("gigs.upload_success")}
        </p>
      )}
    </div>
  );
}

export function GigOrderPanels({ order }: { order: MyOrder }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [refundOpen, setRefundOpen] = useState(false);

  const refundMutation = useMutation({
    mutationFn: () => requestGigRefund({ data: { orderId: order.id } }),
    onSuccess: () => {
      setRefundOpen(false);
      toast.success(t("gigs.refund_requested_toast"));
      void queryClient.invalidateQueries({ queryKey: ["order", order.id] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("gigs.refund_confirm_title")),
  });

  if (order.status === "in_fulfillment") {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-base font-medium">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
          {t("gigs.step_in_fulfillment")}
        </h2>
        {order.fulfillmentDueAt && (
          <p className="text-sm text-muted-foreground">
            {t("gigs.due_by", { datetime: formatDue(order.fulfillmentDueAt) })}
          </p>
        )}
        {order.gigDeliveryType === "file_back" ? <GigSourceUpload order={order} /> : null}
      </div>
    );
  }

  if (order.status === "past_due") {
    return (
      <div className="space-y-4 rounded-2xl border border-[#F4212E]/30 bg-[#F4212E]/5 p-6">
        <h2 className="flex items-center gap-2 text-base font-medium text-destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {t("gigs.past_due_title")}
        </h2>
        <p className="text-sm">{t("gigs.past_due_body")}</p>
        <Button variant="outline" onClick={() => setRefundOpen(true)} className="font-medium">
          {t("gigs.request_refund")}
        </Button>
        <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("gigs.refund_confirm_title")}</DialogTitle>
              <DialogDescription>{t("gigs.refund_confirm_body")}</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setRefundOpen(false)}>
                {t("gigs.cancel")}
              </Button>
              <Button
                variant="solid"
                color="accent"
                disabled={refundMutation.isPending}
                onClick={() => refundMutation.mutate()}
              >
                {refundMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                {t("gigs.request_refund")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (order.status === "delivered" && order.completionNote) {
    return (
      <div className="space-y-2 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-base font-medium">{t("gigs.completion_note_title")}</h2>
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
          {order.completionNote}
        </p>
      </div>
    );
  }

  return null;
}
