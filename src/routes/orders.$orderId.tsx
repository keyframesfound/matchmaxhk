import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useRef, useState } from "react";
import {
  Check,
  CircleDashed,
  Download,
  Loader2,
  MessageCircle,
  PlayCircle,
  Receipt,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/useAuth";
import {
  getMyOrder,
  uploadPaymentScreenshot,
  getOrderWhatsAppUrl,
  type MyOrder,
} from "@/features/materials/checkout.functions";
import { getOwnedMaterialUrl } from "@/features/materials/orders.functions";
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
          done: ["stamping", "delivered"].includes(order.status),
          current: order.status === "paid",
        },
        {
          key: "orders.step_stamping",
          done: order.status === "delivered",
          current: order.status === "stamping",
        },
        { key: "orders.step_delivered", done: order.status === "delivered", current: false },
      ];

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-medium tracking-normal">
          {order.status === "delivered"
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
                  <p className="font-mono text-xl font-medium tracking-wide">{order.reference}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("orders.amount_label")}
                  </p>
                  <p className="text-xl font-medium">
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
                <h2 className="flex items-center gap-2 text-base font-medium">
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
                    <p className="flex items-center gap-1.5 text-xs font-medium text-[#00875A]">
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
                  className="flex h-10 w-full items-center justify-center rounded-md bg-[#25D366] text-sm font-medium text-white transition-colors hover:bg-[#1EBE57]"
                >
                  <MessageCircle className="mr-2 h-4 w-4" aria-hidden />
                  {t("orders.pay_whatsapp_button")}
                </a>
                <p className="text-xs text-muted-foreground">{t("orders.sla_note")}</p>
              </div>
            )}

            {order.status === "rejected" && (
              <div className="flex items-start gap-3 rounded-2xl border border-[#F4212E]/30 bg-[#F4212E]/5 p-5 text-sm">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-[#F4212E]" aria-hidden />
                <p>{t("orders.rejected_note")}</p>
              </div>
            )}

            {/* Timeline */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-base font-medium">{t("orders.timeline_title")}</h2>
              <ol className="mt-4 space-y-3">
                {steps.map((step) => (
                  <li key={step.key} className="flex items-center gap-3 text-sm">
                    {step.done ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#17BF63]/15">
                        <Check className="h-3.5 w-3.5 text-[#00875A]" aria-hidden />
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
                        step.done || step.current ? "font-medium" : "text-muted-foreground"
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
                  className="mt-1 block font-medium text-[color:var(--brand-link)] hover:underline"
                >
                  {order.materialTitle}
                </Link>
              ) : (
                <p className="mt-1 font-medium">{order.materialTitle}</p>
              )}
              <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
                {t("orders.licence_note")}
              </p>
            </div>
            {order.action === "download" && isShopProduct && order.materialSlug ? (
              <Button asChild variant="solid" color="accent" className="w-full font-medium">
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
                  className="w-full font-medium"
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
              <p className="rounded-md bg-[#F4212E]/10 px-3 py-2 text-center text-xs font-medium text-[#F4212E]">
                {t("gigs.past_due_badge")}
              </p>
            )}
            {order.action === "refunded" && (
              <p className="rounded-md bg-amber-500/10 px-3 py-2 text-center text-xs font-medium text-amber-700">
                {t("orders.refunded_badge")}
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
              <p className="rounded-md bg-accent px-3 py-2 text-center text-xs font-medium text-accent-foreground">
                {t("orders.preparing_badge")}
              </p>
            )}
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
