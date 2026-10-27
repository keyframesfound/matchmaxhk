import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CircleDashed,
  Download,
  Loader2,
  MessageCircle,
  PlayCircle,
  Receipt,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/useAuth";
import {
  getMyOrder,
  uploadPaymentScreenshot,
  getOrderWhatsAppUrl,
  type MyOrder,
} from "@/features/materials/checkout.functions";
import { getOwnedMaterialUrl } from "@/features/materials/orders.functions";
import { confirmOrderReceived, openOrderDispute } from "@/features/materials/escrow.functions";
import {
  DISPUTE_REASONS,
  canOpenDispute,
  disputeReasonLabelKey,
} from "@/features/materials/lifecycle";
import { gigTimelineSteps } from "@/features/gigs/gig";
import { GigOrderPanels } from "@/features/gigs/gig-order-view";
import { ReportMenuButton } from "@/features/reports/report-button";

/**
 * #203 checkout + order status page. Manual cashier: the parent sees the
 * order reference and MatchMax FPS instructions, attaches an optional
 * screenshot, and taps the purchase button, which opens WhatsApp with a
 * prefilled message stating what they are buying (Ryan, 2026-10-11). Staff
 * mark the payment; the status timeline flips to delivered and Download
 * appears (10-minute signed link, delivered orders only).
 */

export const Route = createFileRoute("/orders/$orderId")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Your order | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: OrderPage,
});

const WHATSAPP_FALLBACK = ""; // no number configured → the WhatsApp button hides

function OrderPage() {
  const { orderId } = Route.useParams() as { orderId: string };
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const orderQuery = useQuery({
    queryKey: ["order", orderId, user?.id],
    queryFn: () => getMyOrder({ data: { orderId } }),
    enabled: Boolean(user),
  });

  const orderData = orderQuery.data;
  const whatsappQuery = useQuery({
    queryKey: [
      "order-whatsapp",
      orderData?.reference,
      orderData?.materialTitle,
      orderData?.grossHkd,
    ],
    queryFn: () =>
      getOrderWhatsAppUrl({
        data: {
          reference: orderData!.reference,
          title: orderData!.materialTitle,
          grossHkd: orderData!.grossHkd,
        },
      }),
    enabled: Boolean(orderData),
  });

  const screenshotMutation = useMutation({
    mutationFn: async (file: File) => {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("Could not read the file."));
        reader.readAsDataURL(file);
      });
      const contentType =
        file.type === "image/png"
          ? "image/png"
          : file.type === "image/webp"
            ? "image/webp"
            : "image/jpeg";
      return uploadPaymentScreenshot({ data: { orderId, base64Data: base64, contentType } });
    },
    onSuccess: () => {
      toast.success(t("orders.screenshot_uploaded"));
      void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("orders.screenshot_failed")),
    onSettled: () => setUploading(false),
  });

  const downloadMutation = useMutation({
    mutationFn: () => getOwnedMaterialUrl({ data: { materialId: order!.materialId } }),
    onSuccess: (result) => window.open(result.signedUrl, "_blank", "noopener"),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Download failed."),
  });

  // #429: buyer taps "Received / No issue" — the held funds release early.
  const receivedMutation = useMutation({
    mutationFn: () => confirmOrderReceived({ data: { orderId } }),
    onSuccess: () => {
      toast.success(t("orders.received_done"));
      void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("orders.update_failed")),
  });

  // #429: dispute form state + open mutation (evidence rides the same call,
  // same private bucket as the FPS proof).
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState<string>("");
  const [disputeDetail, setDisputeDetail] = useState("");
  const [disputeEvidence, setDisputeEvidence] = useState<File | null>(null);
  const [disputeUploading, setDisputeUploading] = useState(false);
  const disputeFileRef = useRef<HTMLInputElement>(null);

  const disputeMutation = useMutation({
    mutationFn: async (input: { reason: string; detail: string; file: File | null }) => {
      let base64Data: string | undefined;
      let contentType: "image/jpeg" | "image/png" | "image/webp" | undefined;
      if (input.file) {
        base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
          reader.onerror = () => reject(new Error("Could not read the file."));
          reader.readAsDataURL(input.file as File);
        });
        contentType =
          input.file.type === "image/png"
            ? "image/png"
            : input.file.type === "image/webp"
              ? "image/webp"
              : "image/jpeg";
      }
      return openOrderDispute({
        data: {
          orderId,
          reason: input.reason as (typeof DISPUTE_REASONS)[number],
          detail: input.detail,
          base64Data,
          contentType,
        },
      });
    },
    onSuccess: () => {
      toast.success(t("orders.dispute_submitted"));
      setDisputeDialogOpen(false);
      setDisputeReason("");
      setDisputeDetail("");
      setDisputeEvidence(null);
      void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("orders.dispute_failed")),
    onSettled: () => setDisputeUploading(false),
  });

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">{t("orders.sign_in_required")}</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (orderQuery.isLoading || !orderData) {
    return (
      <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
        </main>
        <SiteFooter />
      </div>
    );
  }

  const order: MyOrder = orderData;
  const buyUrl = whatsappQuery.data?.url ?? WHATSAPP_FALLBACK;
  // #328: gig orders run the service timeline (awaiting_payment ->
  // in_fulfillment -> delivered) instead of the notes stamping pipeline; the
  // shared reference card + FPS pay block below stay identical.
  const isGig = order.materialType === "gig";
  // #392: course and folder purchases open on the product page (lesson
  // embeds / child unlocks), there is no per-order file to download.
  const isShopProduct =
    order.materialType === "video_course" ||
    order.materialType === "general_course" ||
    order.materialType === "topic_folder";

  const steps: { key: string; done: boolean; current: boolean }[] = isGig
    ? gigTimelineSteps(order.status)
    : [
        {
          key: "orders.step_awaiting_payment",
          done: !["awaiting_payment", "rejected"].includes(order.status),
          current: order.status === "awaiting_payment",
        },
        {
          key: "orders.step_paid",
          done: ["stamping", "delivered", "held", "released", "refunded_from_hold"].includes(
            order.status,
          ),
          current: order.status === "paid",
        },
        {
          key: "orders.step_stamping",
          done: ["delivered", "held", "released", "refunded_from_hold"].includes(order.status),
          current: order.status === "stamping",
        },
        {
          key: "orders.step_delivered",
          done: ["delivered", "held", "released", "refunded_from_hold"].includes(order.status),
          current: false,
        },
        {
          key: "orders.step_held",
          done: ["released", "refunded_from_hold"].includes(order.status),
          current: order.status === "held",
        },
        { key: "orders.step_released", done: order.status === "released", current: false },
      ];

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-medium tracking-normal">
          {order.status === "delivered" || order.status === "held" || order.status === "released"
            ? isGig
              ? t("gigs.delivered_title")
              : t("orders.delivered_title")
            : t("orders.checkout_title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <Link to="/account" className="text-[color:var(--brand-link)] hover:underline">
            {t("orders.back_to_account")}
          </Link>
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
          <section className="space-y-6">
            {/* Reference card */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("orders.reference_label")}
                  </p>
                  <p className="font-mono text-xl font-bold tracking-wide">{order.reference}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("orders.amount_label")}
                  </p>
                  <p className="text-xl font-bold">
                    {t("notes.price", { amount: order.grossHkd })}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{t("orders.reference_hint")}</p>
            </div>

            {/* #328 gig fulfillment panels (in_fulfillment upload + due date,
                past_due refund, delivered completion note). */}
            {isGig && <GigOrderPanels order={order} />}

            {/* FPS instructions */}
            {order.action === "pay" && (
              <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <Receipt className="h-4 w-4" aria-hidden />
                  {t("orders.fps_title")}
                </h2>
                <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground/90">
                  <li>{t("orders.fps_step_1")}</li>
                  <li>{t("orders.fps_step_2", { reference: order.reference })}</li>
                  <li>{t("orders.fps_step_3")}</li>
                </ol>
                <div className="space-y-1.5">
                  <Label htmlFor="screenshot" className="text-sm font-medium">
                    {t("orders.screenshot_label")}
                  </Label>
                  <Input
                    id="screenshot"
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="h-11 cursor-pointer"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error(t("orders.screenshot_too_large"));
                        return;
                      }
                      setUploading(true);
                      screenshotMutation.mutate(file);
                    }}
                  />
                  {uploading && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      {t("orders.screenshot_uploading")}
                    </p>
                  )}
                  {order.hasScreenshot && !uploading && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-success">
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      {t("orders.screenshot_attached")}
                    </p>
                  )}
                </div>
                {/* The purchase handoff (Ryan): WhatsApp opens with the order stated. */}
                <a
                  href={buyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-full items-center justify-center rounded-md bg-[#25D366] text-sm font-bold text-white transition-colors hover:bg-[#1EBE57]"
                >
                  <MessageCircle className="mr-2 h-4 w-4" aria-hidden />
                  {t("orders.pay_whatsapp_button")}
                </a>
                <p className="text-xs text-muted-foreground">{t("orders.sla_note")}</p>
              </div>
            )}

            {order.status === "rejected" && (
              <div className="flex items-start gap-3 rounded-2xl border border-[#F4212E]/30 bg-[#F4212E]/5 p-5 text-sm">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                <p>{t("orders.rejected_note")}</p>
              </div>
            )}

            {/* #429 escrow: while held, the payment is protected and can be
                refunded in full from the held funds; the buyer can end the
                hold early with Received / No issue. */}
            {!isGig && order.status === "held" && (
              <div className="space-y-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  {t("orders.escrow_banner_title")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("orders.escrow_banner_held", {
                    date: order.holdUntil
                      ? new Date(order.holdUntil).toLocaleString("en-HK", {
                          timeZone: "Asia/Hong_Kong",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                      : "—",
                  })}
                </p>
                <div>
                  {/* An open dispute freezes the hold — staff decide it, the
                      buyer cannot self-release the funds mid-dispute. */}
                  {order.disputeStatus !== "open" && (
                    <Button
                      variant="outline"
                      disabled={receivedMutation.isPending}
                      onClick={() => receivedMutation.mutate()}
                    >
                      {receivedMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Check className="mr-2 h-4 w-4" aria-hidden />
                      )}
                      {t("orders.received_button")}
                    </Button>
                  )}
                </div>
              </div>
            )}
            {!isGig && order.status === "released" && (
              <div className="flex items-start gap-3 rounded-2xl border border-[#17BF63]/30 bg-[#17BF63]/5 p-5 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                <p>{t("orders.escrow_banner_released")}</p>
              </div>
            )}

            {/* #429 dispute (notes orders only — gigs keep their #330 report
                hook): open while delivered/held; window = the hold period. */}
            {!isGig && canOpenDispute(order.status) && !order.disputeStatus && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  {t("orders.dispute_title")}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t(
                    order.status === "delivered"
                      ? "orders.dispute_note_delivered"
                      : "orders.dispute_note",
                  )}
                </p>
                <div className="mt-3">
                  <Button variant="outline" onClick={() => setDisputeDialogOpen(true)}>
                    {t("orders.dispute_open_button")}
                  </Button>
                </div>
              </div>
            )}
            {!isGig && order.disputeStatus === "open" && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                <div>
                  <p className="font-semibold">{t("orders.dispute_open_badge")}</p>
                  <p className="mt-1 text-muted-foreground">
                    {t("orders.dispute_open_note", {
                      date: order.disputeOpenedAt
                        ? new Date(order.disputeOpenedAt).toLocaleDateString("en-HK")
                        : "—",
                    })}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {t(disputeReasonLabelKey(order.disputeReason ?? ""))}
                  </p>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-lg font-bold">{t("orders.timeline_title")}</h2>
              <ol className="mt-4 space-y-3">
                {steps.map((step) => (
                  <li key={step.key} className="flex items-center gap-3 text-sm">
                    {step.done ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#17BF63]/15">
                        <Check className="h-3.5 w-3.5 text-success" aria-hidden />
                      </span>
                    ) : step.current ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent">
                        <CircleDashed className="h-3.5 w-3.5 text-accent-foreground" aria-hidden />
                      </span>
                    ) : (
                      <span className="h-6 w-6 rounded-full border border-border" />
                    )}
                    <span
                      className={
                        step.done || step.current ? "font-semibold" : "text-muted-foreground"
                      }
                    >
                      {t(step.key)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* Summary rail */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs font-medium text-muted-foreground">{t("orders.item_label")}</p>
              {order.materialSlug ? (
                <Link
                  to="/notes/$slug"
                  params={{ slug: order.materialSlug }}
                  className="mt-1 block font-semibold text-[color:var(--brand-link)] hover:underline"
                >
                  {order.materialTitle}
                </Link>
              ) : (
                <p className="mt-1 font-semibold">{order.materialTitle}</p>
              )}
              <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
                {t("orders.licence_note")}
              </p>
            </div>
            {order.action === "download" && isShopProduct && order.materialSlug ? (
              <Button asChild variant="solid" color="accent" className="w-full font-bold">
                <a href={`/notes/${order.materialSlug}`}>
                  <PlayCircle className="mr-2 h-4 w-4" aria-hidden />
                  {t("orders.open_course_button")}
                </a>
              </Button>
            ) : null}
            {order.action === "download" &&
              !isShopProduct &&
              (!isGig || order.hasDeliveredFile) && (
                <Button
                  variant="solid"
                  color="accent"
                  className="w-full font-bold"
                  disabled={downloadMutation.isPending}
                  onClick={() => downloadMutation.mutate()}
                >
                  {downloadMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Download className="mr-2 h-4 w-4" aria-hidden />
                  )}
                  {t("orders.download_button")}
                </Button>
              )}
            {order.action === "request_refund" && (
              <p className="rounded-md bg-[#F4212E]/10 px-3 py-2 text-center text-xs font-bold text-destructive">
                {t("gigs.past_due_badge")}
              </p>
            )}
            {order.action === "refunded" && (
              <p className="rounded-md bg-amber-500/10 px-3 py-2 text-center text-xs font-bold text-amber-700">
                {t("orders.refunded_badge")}
              </p>
            )}
            {order.status === "refunded_from_hold" && order.refundAmountHkd != null && (
              <p className="rounded-md bg-amber-500/10 px-3 py-2 text-center text-xs font-bold text-amber-700">
                {t("orders.refund_amount_line", {
                  amount: Number(order.refundAmountHkd).toFixed(0),
                })}
              </p>
            )}
            {/* #330: post-delivery quality disputes go through the #216 report
                hook, operator-reviewed, refunds stay self-serve for past_due
                non-delivery only, never auto-clawed back after delivery. */}
            {isGig && order.action === "download" && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("gigs.dispute_title")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{t("gigs.dispute_note")}</p>
                <div className="mt-3 flex justify-end">
                  <ReportMenuButton
                    targets={[
                      {
                        targetType: "material",
                        targetId: order.materialId,
                        label: order.materialTitle,
                      },
                    ]}
                    menuLabel={t("gigs.dispute_report_label")}
                  />
                </div>
              </div>
            )}
            {order.action === "preparing" && (
              <p className="rounded-md bg-accent px-3 py-2 text-center text-xs font-bold text-accent-foreground">
                {t("orders.preparing_badge")}
              </p>
            )}
          </aside>
        </div>
      </main>

      {/* #429: the buyer's dispute form (reason + detail + optional evidence
          image into the private orders-screenshots bucket). */}
      <Dialog open={disputeDialogOpen} onOpenChange={setDisputeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("orders.dispute_dialog_title")}</DialogTitle>
            <DialogDescription>{t("orders.dispute_note")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("orders.dispute_reason_label")}</Label>
              <div className="space-y-2">
                {DISPUTE_REASONS.map((reason) => (
                  <label key={reason} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="dispute-reason"
                      value={reason}
                      checked={disputeReason === reason}
                      onChange={() => setDisputeReason(reason)}
                      className="h-4 w-4 accent-[color:var(--brand-link)]"
                    />
                    {t(disputeReasonLabelKey(reason))}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dispute-detail">{t("orders.dispute_detail_label")}</Label>
              <Textarea
                id="dispute-detail"
                value={disputeDetail}
                onChange={(event) => setDisputeDetail(event.target.value)}
                maxLength={1000}
                rows={4}
                placeholder={t("orders.dispute_detail_placeholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dispute-evidence">{t("orders.dispute_evidence_label")}</Label>
              <Input
                id="dispute-evidence"
                ref={disputeFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="h-11 cursor-pointer"
                onChange={(event) => setDisputeEvidence(event.target.files?.[0] ?? null)}
              />
              {disputeEvidence && disputeEvidence.size > 5 * 1024 * 1024 && (
                <p className="text-xs font-medium text-destructive">
                  {t("orders.screenshot_too_large")}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeDialogOpen(false)}>
              {t("gigs.admin_desk_cancel")}
            </Button>
            <Button
              className="font-bold"
              disabled={
                disputeUploading ||
                disputeReason === "" ||
                disputeDetail.trim().length < 10 ||
                Boolean(disputeEvidence && disputeEvidence.size > 5 * 1024 * 1024)
              }
              onClick={() => {
                setDisputeUploading(true);
                disputeMutation.mutate({
                  reason: disputeReason,
                  detail: disputeDetail.trim(),
                  file: disputeEvidence,
                });
              }}
            >
              {disputeUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              {t("orders.dispute_submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SiteFooter />
    </div>
  );
}
