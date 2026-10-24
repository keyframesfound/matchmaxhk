import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Download, Eye, Loader2, Undo2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ConsoleTable,
  ConsoleTableBody,
  ConsoleTableEmpty,
  ConsoleTableHead,
  ConsoleTableSkeletonRows,
  ConsoleTh,
  ConsoleTd,
} from "@/components/ui/console-table";
import {
  listMaterialOrdersAdmin,
  markOrderPaid,
  releaseOrder,
  rejectOrder,
  getOrderScreenshotUrl,
  type AdminOrderRow,
} from "@/features/materials/orders-desk.functions";
import {
  getGigOrderSourceUrl,
  listGigDeskOrders,
  listGhostStrikes,
  markGigOrderPaid,
  staffRefundGigOrder,
  type GigDeskOrder,
} from "@/features/gigs/gig-staff.functions";
import {
  DEFAULT_TURNAROUND_HOURS,
  gigCategoryLabelKey,
  gigDeliveryLabelKey,
} from "@/features/gigs/gig";

/**
 * #203 manual cashier queue on /admin/materials, split #328 into Notes and
 * Services. One row per order: reference, item, gross, status, screenshot
 * viewer, and the action ladder — notes keep mark-paid → release (or
 * reject); gig orders confirm FPS (→ in_fulfillment, the fail-safe clock
 * starts), show their fulfillment state (due date, past-due highlight,
 * parent refund request), and offer the staff refund (which ghost-strikes
 * past-due tutors server-side). The #328 sweep runs on every desk load via
 * listGigDeskOrders. No buyer contact is ever shown.
 */

type DeskTab = "all" | "notes" | "services";

const TAB_LABEL_KEYS: Record<DeskTab, string> = {
  all: "gigs.admin_desk_tab_all",
  notes: "gigs.admin_desk_tab_notes",
  services: "gigs.admin_desk_tab_services",
};

/** HKT timestamp for the fulfillment clock lines ("Due 19 Oct, 14:00"). */
function formatHkt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-HK", {
    timeZone: "Asia/Hong_Kong",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function gigStatusChipClass(status: string): string {
  if (status === "delivered") {
    return "rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-700";
  }
  if (status === "in_fulfillment") {
    return "rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-700";
  }
  if (status === "past_due") {
    return "rounded-md bg-rose-500/10 px-2 py-0.5 text-xs font-bold text-rose-700";
  }
  return "rounded-md bg-slate-500/10 px-2 py-0.5 text-xs font-bold text-slate-600";
}

export function MaterialsOrdersDesk() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<DeskTab>("all");
  const [fpsRefs, setFpsRefs] = useState<Record<string, string>>({});
  const [refundTarget, setRefundTarget] = useState<GigDeskOrder | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [strikeFilter, setStrikeFilter] = useState("");

  const ordersQuery = useQuery({
    queryKey: ["admin", "material-orders"],
    queryFn: listMaterialOrdersAdmin,
  });

  // Loads the gig queue AND runs the #328 sweep server-side (lazy clock —
  // no cron dependency).
  const gigsQuery = useQuery({
    queryKey: ["admin", "gig-orders"],
    queryFn: listGigDeskOrders,
  });

  const strikesQuery = useQuery({
    queryKey: ["admin", "ghost-strikes"],
    queryFn: () => listGhostStrikes({ data: {} }),
  });

  // Surface what the sweep flipped, once per changed count.
  const sweptRef = useRef(0);
  useEffect(() => {
    const swept = gigsQuery.data?.swept ?? 0;
    if (swept > sweptRef.current) {
      toast.info(t("gigs.admin_desk_swept", { count: swept }));
    }
    sweptRef.current = Math.max(sweptRef.current, swept);
  }, [gigsQuery.data?.swept, t]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "material-orders"] });
  const invalidateGigs = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "gig-orders"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "ghost-strikes"] });
  };

  const markPaidMutation = useMutation({
    mutationFn: (input: { orderId: string; fpsReference: string }) =>
      markOrderPaid({ data: input }),
    onSuccess: () => {
      toast.success("Marked paid.");
      void invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed."),
  });

  const releaseMutation = useMutation({
    mutationFn: (orderId: string) => releaseOrder({ data: { orderId } }),
    onSuccess: () => {
      toast.success("Released — the buyer can download now.");
      void invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Release failed."),
  });

  const rejectMutation = useMutation({
    mutationFn: (input: { orderId: string; reason: string }) => rejectOrder({ data: input }),
    onSuccess: () => {
      toast.success("Order rejected — the buyer can re-pay.");
      void invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed."),
  });

  const screenshotMutation = useMutation({
    mutationFn: (orderId: string) => getOrderScreenshotUrl({ data: { orderId } }),
    onSuccess: (result) => window.open(result.signedUrl, "_blank", "noopener"),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "No screenshot attached."),
  });

  // #328 file_back (grok re-review 2026-10-17): staff can open the buyer's
  // uploaded source document, not just see that one exists.
  const sourceMutation = useMutation({
    mutationFn: (orderId: string) => getGigOrderSourceUrl({ data: { orderId } }),
    onSuccess: (result) => window.open(result.signedUrl, "_blank", "noopener"),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "No source file attached."),
  });

  // #328: staff confirm FPS on a gig order — awaiting_payment jumps to
  // in_fulfillment and the tutor's turnaround clock starts.
  const markGigPaidMutation = useMutation({
    mutationFn: (input: { orderId: string; fpsReference: string }) =>
      markGigOrderPaid({ data: input }),
    onSuccess: (_data, variables) => {
      toast.success(t("gigs.admin_desk_marked_paid"));
      setFpsRefs((prev) => {
        const next = { ...prev };
        delete next[variables.orderId];
        return next;
      });
      void invalidateGigs();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed."),
  });

  // #328: staff refund at any pre-refunded gig stage; past-due refunds
  // ghost-strike the tutor server-side.
  const gigRefundMutation = useMutation({
    mutationFn: (input: { orderId: string; reason: string }) =>
      staffRefundGigOrder({ data: input }),
    onSuccess: () => {
      toast.success(t("gigs.admin_desk_refunded"));
      setRefundTarget(null);
      setRefundReason("");
      void invalidateGigs();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Refund failed."),
  });

  const orders = ordersQuery.data ?? [];
  const pending = orders.filter(
    (o) => o.status === "awaiting_payment" || o.status === "paid",
  ).length;
  const gigs = gigsQuery.data?.orders ?? [];
  const gigPending = gigs.filter((g) => g.status === "awaiting_payment").length;
  const counts: Record<DeskTab, number> = {
    all: orders.length + gigs.length,
    notes: orders.length,
    services: gigs.length,
  };
  const showNotes = tab === "all" || tab === "notes";
  const showServices = tab === "all" || tab === "services";
  const visibleCount = (showNotes ? orders.length : 0) + (showServices ? gigs.length : 0);

  const strikes = strikesQuery.data ?? [];
  const needle = strikeFilter.trim().toLowerCase();
  const filteredStrikes = needle
    ? strikes.filter((strike) =>
        `${strike.tutorName ?? ""} ${strike.tutorCode ?? ""} ${strike.orderReference ?? ""}`
          .toLowerCase()
          .includes(needle),
      )
    : strikes;

  const gigTurnaroundLabel = (order: GigDeskOrder): string => {
    if (order.turnaroundNote) return order.turnaroundNote;
    return t("gigs.admin_turnaround_hours", {
      hours: order.turnaroundHours ?? DEFAULT_TURNAROUND_HOURS,
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-bold">Orders</h3>
        <p className="text-sm text-[color:var(--ink)]/65">
          {pending + gigPending > 0
            ? t("gigs.admin_desk_awaiting", { count: pending + gigPending })
            : t("gigs.admin_desk_none_waiting")}
        </p>
      </div>

      {/* Notes / Services split (#328): same table, two fulfilment worlds. */}
      <div
        className="flex flex-wrap items-center gap-1"
        role="tablist"
        aria-label={t("gigs.admin_desk_tablist_label")}
      >
        {(Object.keys(TAB_LABEL_KEYS) as DeskTab[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={
              tab === key
                ? "rounded-md border border-border bg-muted px-3 py-1 text-xs font-bold"
                : "rounded-md border border-transparent px-3 py-1 text-xs font-bold text-[color:var(--ink)]/60 hover:bg-muted/60"
            }
          >
            {t(TAB_LABEL_KEYS[key])}
            {counts[key] > 0 ? ` (${counts[key]})` : ""}
          </button>
        ))}
      </div>

      <ConsoleTable>
        <ConsoleTableHead>
          <ConsoleTh className="w-[12%]">Reference</ConsoleTh>
          <ConsoleTh className="w-[26%]">Item</ConsoleTh>
          <ConsoleTh>Amount</ConsoleTh>
          <ConsoleTh>Status</ConsoleTh>
          <ConsoleTh className="w-[24%]">Actions</ConsoleTh>
        </ConsoleTableHead>
        <ConsoleTableBody>
          {ordersQuery.isLoading || gigsQuery.isLoading ? (
            <ConsoleTableSkeletonRows columns={5} />
          ) : visibleCount === 0 ? (
            <ConsoleTableEmpty colSpan={5} title="No orders yet" />
          ) : (
            <>
              {showNotes &&
                orders.map((order: AdminOrderRow) => (
                  <tr key={order.id} className="border-b border-border/60">
                    <ConsoleTd className="font-mono text-xs">{order.reference || "—"}</ConsoleTd>
                    <ConsoleTd className="max-w-[16rem] truncate">{order.material_title}</ConsoleTd>
                    <ConsoleTd>HK${Number(order.gross_hkd).toFixed(0)}</ConsoleTd>
                    <ConsoleTd>
                      <span
                        className={
                          order.status === "delivered"
                            ? "rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-700"
                            : order.status === "awaiting_payment"
                              ? "rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-700"
                              : "rounded-md bg-slate-500/10 px-2 py-0.5 text-xs font-bold text-slate-600"
                        }
                      >
                        {order.status.replace(/_/g, " ")}
                      </span>
                    </ConsoleTd>
                    <ConsoleTd>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t("gigs.admin_desk_view_screenshot")}
                          disabled={!order.has_screenshot}
                          onClick={() => screenshotMutation.mutate(order.id)}
                        >
                          <Eye className="h-4 w-4" aria-hidden />
                        </Button>
                        {order.status === "awaiting_payment" && (
                          <div className="flex items-center gap-1">
                            <Label htmlFor={`fps-${order.id}`} className="sr-only">
                              FPS reference
                            </Label>
                            <Input
                              id={`fps-${order.id}`}
                              value={fpsRefs[order.id] ?? ""}
                              onChange={(e) =>
                                setFpsRefs((prev) => ({ ...prev, [order.id]: e.target.value }))
                              }
                              placeholder="FPS reference"
                              className="h-8 w-36 text-xs"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={(fpsRefs[order.id] ?? "").trim().length < 3}
                              onClick={() =>
                                markPaidMutation.mutate({
                                  orderId: order.id,
                                  fpsReference: (fpsRefs[order.id] ?? "").trim(),
                                })
                              }
                            >
                              {markPaidMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              ) : (
                                <Check className="h-4 w-4" aria-hidden />
                              )}
                              Paid
                            </Button>
                          </div>
                        )}
                        {(order.status === "paid" || order.status === "stamp_failed") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => releaseMutation.mutate(order.id)}
                          >
                            {releaseMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <Check className="h-4 w-4" aria-hidden />
                            )}
                            Release
                          </Button>
                        )}
                        {order.status === "awaiting_payment" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={t("gigs.admin_desk_reject_order")}
                            onClick={() =>
                              rejectMutation.mutate({
                                orderId: order.id,
                                reason: "Payment could not be verified.",
                              })
                            }
                          >
                            <X className="h-4 w-4" aria-hidden />
                          </Button>
                        )}
                      </div>
                    </ConsoleTd>
                  </tr>
                ))}
              {showServices &&
                gigs.map((order) => (
                  <tr
                    key={order.id}
                    className={
                      order.status === "past_due"
                        ? "border-b border-border/60 bg-rose-500/5"
                        : "border-b border-border/60"
                    }
                  >
                    <ConsoleTd className="font-mono text-xs">{order.reference || "—"}</ConsoleTd>
                    <ConsoleTd className="max-w-[16rem]">
                      <span className="block truncate font-semibold text-[color:var(--ink)]">
                        {order.listingTitle}
                      </span>
                      <span className="block truncate text-xs text-[color:var(--ink)]/55">
                        {t(gigCategoryLabelKey(order.gigCategory ?? "other"))}
                        {" · "}
                        {t(gigDeliveryLabelKey(order.gigDeliveryType ?? "file_back"))}
                        {" · "}
                        {gigTurnaroundLabel(order)}
                      </span>
                    </ConsoleTd>
                    <ConsoleTd>HK${Number(order.grossHkd).toFixed(0)}</ConsoleTd>
                    <ConsoleTd>
                      <span className={gigStatusChipClass(order.status)}>
                        {order.status === "past_due"
                          ? t("gigs.admin_desk_past_due")
                          : order.status.replace(/_/g, " ")}
                      </span>
                      {order.status === "in_fulfillment" && order.fulfillmentDueAt && (
                        <span className="mt-1 block text-xs text-[color:var(--ink)]/65">
                          {t("gigs.admin_desk_due", { date: formatHkt(order.fulfillmentDueAt) })}
                        </span>
                      )}
                      {order.refundRequestedAt && (
                        <span className="mt-1 block text-xs font-bold text-rose-700">
                          {t("gigs.admin_desk_refund_requested", {
                            date: formatHkt(order.refundRequestedAt),
                          })}
                        </span>
                      )}
                      {order.status === "delivered" &&
                        order.gigDeliveryType === "file_back" &&
                        order.deliveredFilePath && (
                          <span className="mt-1 block truncate font-mono text-xs text-[color:var(--ink)]/55">
                            {t("gigs.admin_desk_return_file", { path: order.deliveredFilePath })}
                          </span>
                        )}
                      {order.completionNote && (
                        <span className="mt-1 block truncate text-xs text-[color:var(--ink)]/55">
                          {t("gigs.admin_desk_completion_note")}: {order.completionNote}
                        </span>
                      )}
                    </ConsoleTd>
                    <ConsoleTd>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t("gigs.admin_desk_view_screenshot")}
                          disabled={!order.hasScreenshot}
                          onClick={() => screenshotMutation.mutate(order.id)}
                        >
                          <Eye className="h-4 w-4" aria-hidden />
                        </Button>
                        {order.gigDeliveryType === "file_back" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={t("gigs.admin_desk_view_source")}
                            disabled={!order.buyerSourcePath || sourceMutation.isPending}
                            onClick={() => sourceMutation.mutate(order.id)}
                          >
                            <Download className="h-4 w-4" aria-hidden />
                          </Button>
                        )}
                        {order.status === "awaiting_payment" && (
                          <div className="flex items-center gap-1">
                            <Label htmlFor={`fps-${order.id}`} className="sr-only">
                              FPS reference
                            </Label>
                            <Input
                              id={`fps-${order.id}`}
                              value={fpsRefs[order.id] ?? ""}
                              onChange={(e) =>
                                setFpsRefs((prev) => ({ ...prev, [order.id]: e.target.value }))
                              }
                              placeholder="FPS reference"
                              className="h-8 w-36 text-xs"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={(fpsRefs[order.id] ?? "").trim().length < 3}
                              onClick={() =>
                                markGigPaidMutation.mutate({
                                  orderId: order.id,
                                  fpsReference: (fpsRefs[order.id] ?? "").trim(),
                                })
                              }
                            >
                              {markGigPaidMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              ) : (
                                <Check className="h-4 w-4" aria-hidden />
                              )}
                              Paid
                            </Button>
                          </div>
                        )}
                        {(order.status === "in_fulfillment" ||
                          order.status === "past_due" ||
                          order.status === "delivered") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={t("gigs.admin_desk_refund_button")}
                            onClick={() => {
                              setRefundReason("");
                              setRefundTarget(order);
                            }}
                          >
                            <Undo2 className="h-4 w-4" aria-hidden />
                          </Button>
                        )}
                      </div>
                    </ConsoleTd>
                  </tr>
                ))}
            </>
          )}
        </ConsoleTableBody>
      </ConsoleTable>

      {/* ---------------------------------------------------------------
          #328 ghost-strike ledger: staff/ops visibility only. Populated by
          staff refunds of past-due orders; never shown on the public card.
      ---------------------------------------------------------------- */}
      <div className="mt-6 space-y-2 rounded-md border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-bold">{t("gigs.admin_strikes_title")}</h4>
          <Label htmlFor="ghost-strike-filter" className="sr-only">
            {t("gigs.admin_strikes_filter_label")}
          </Label>
          <Input
            id="ghost-strike-filter"
            value={strikeFilter}
            onChange={(event) => setStrikeFilter(event.target.value)}
            placeholder={t("gigs.admin_strikes_filter_label")}
            className="h-8 w-52 text-xs"
          />
        </div>
        {filteredStrikes.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("gigs.admin_strikes_empty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {filteredStrikes.map((strike) => (
              <li
                key={strike.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-xs"
              >
                <span className="font-medium text-[color:var(--ink)]">
                  {strike.tutorName ?? strike.tutorId.slice(0, 8)}
                  {strike.tutorCode ? ` (${strike.tutorCode})` : ""}
                </span>
                <span className="font-mono text-[color:var(--ink)]/65">
                  {strike.orderReference ?? strike.orderId.slice(0, 8)}
                </span>
                <span className="max-w-[20rem] flex-1 truncate text-[color:var(--ink)]/65">
                  {strike.reason}
                </span>
                <span className="text-[color:var(--ink)]/45">{formatHkt(strike.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Staff refund dialog (#328): reason is required; a past-due refund
          ghost-strikes the tutor server-side. */}
      <Dialog
        open={Boolean(refundTarget)}
        onOpenChange={(open) => {
          if (!open) setRefundTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("gigs.admin_desk_refund_title")}</DialogTitle>
            <DialogDescription>
              {refundTarget?.reference || ""} · {refundTarget?.listingTitle || ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="gig-refund-reason">{t("gigs.admin_desk_refund_reason_label")}</Label>
            <Input
              id="gig-refund-reason"
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
              maxLength={400}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundTarget(null)}>
              {t("gigs.admin_desk_cancel")}
            </Button>
            <Button
              className="font-bold"
              disabled={refundReason.trim().length < 3 || gigRefundMutation.isPending}
              onClick={() =>
                refundTarget &&
                gigRefundMutation.mutate({
                  orderId: refundTarget.id,
                  reason: refundReason.trim(),
                })
              }
            >
              {gigRefundMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              {t("gigs.admin_desk_refund_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
