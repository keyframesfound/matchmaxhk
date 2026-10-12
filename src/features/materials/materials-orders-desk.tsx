import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Eye, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
/**
 * #203 manual cashier queue on /admin/materials. One row per order:
 * reference, pack, gross, status, screenshot viewer, and the mark-paid →
 * release (or reject) ladder. No buyer contact is ever shown.
 */
export function MaterialsOrdersDesk() {
  const queryClient = useQueryClient();
  const [fpsRefs, setFpsRefs] = useState<Record<string, string>>({});

  const ordersQuery = useQuery({
    queryKey: ["admin", "material-orders"],
    queryFn: listMaterialOrdersAdmin,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "material-orders"] });

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

  const orders = ordersQuery.data ?? [];
  const pending = orders.filter((o) => o.status === "awaiting_payment" || o.status === "paid");

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-bold">Orders</h3>
        <p className="text-sm text-[color:var(--ink)]/65">
          {pending.length > 0 ? `${pending.length} awaiting action` : "No orders waiting on you"}
        </p>
      </div>
      <ConsoleTable>
        <ConsoleTableHead>
          <ConsoleTh className="w-[12%]">Reference</ConsoleTh>
          <ConsoleTh className="w-[26%]">Note</ConsoleTh>
          <ConsoleTh>Amount</ConsoleTh>
          <ConsoleTh>Status</ConsoleTh>
          <ConsoleTh className="w-[24%]">Cashier actions</ConsoleTh>
        </ConsoleTableHead>
        <ConsoleTableBody>
          {ordersQuery.isLoading ? (
            <ConsoleTableSkeletonRows columns={5} />
          ) : orders.length === 0 ? (
            <ConsoleTableEmpty colSpan={5} title="No orders yet" />
          ) : (
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
                      aria-label="View payment screenshot"
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
                        aria-label="Reject order"
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
            ))
          )}
        </ConsoleTableBody>
      </ConsoleTable>
    </section>
  );
}
