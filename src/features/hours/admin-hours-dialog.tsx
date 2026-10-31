// Issue #459 slice 8: the staff hours-reconcile dialog on /admin/tutors
// (§8.5). Read-only: displayed vs ledger SUM with a ✓/✗ parity line, plus
// the pending/disputed buckets that are excluded from public hours. No edit
// button by design — wrong rows are fixed via the lesson, not the counter.

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, Loader2, X } from "lucide-react";

import { adminReconcileTutorHours } from "@/features/hours/admin-hours.functions";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

function Row({
  label,
  hours,
  count,
  muted,
}: {
  label: string;
  hours: number;
  count: number;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className={muted ? "text-sm text-muted-foreground" : "text-sm font-medium"}>
        {label}
      </span>
      <span className="text-sm font-bold tabular-nums">
        {hours.toFixed(2)} h
        <span className="ml-2 text-xs font-normal text-muted-foreground">({count})</span>
      </span>
    </div>
  );
}

function ReconcileBody({ tutorId }: { tutorId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "hours-reconcile", tutorId],
    queryFn: () => adminReconcileTutorHours({ data: { tutorId } }),
  });

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading ledger…
      </p>
    );
  }
  if (isError || !data) {
    return <p className="py-6 text-sm text-destructive">Could not load the hours ledger.</p>;
  }

  const parity = data.publicHours === data.verifiedHours;
  return (
    <div className="mt-3 divide-y divide-border">
      <p className="pt-2 text-sm text-muted-foreground">
        {data.displayName ?? "Tutor"}
        {data.tutorCode ? ` · ${data.tutorCode}` : ""}
      </p>
      <div className="py-2">
        <Row
          label="Verified (counted publicly)"
          hours={data.verifiedHours}
          count={data.verifiedCount}
        />
        <Row
          label="Pending confirmation (not public)"
          hours={data.pendingHours}
          count={data.pendingCount}
          muted
        />
        <Row
          label="Disputed (not public)"
          hours={data.disputedHours}
          count={data.disputedCount}
          muted
        />
      </div>
      <div className="flex items-center gap-2 py-3">
        {parity ? (
          <>
            <Check className="h-4 w-4 text-emerald-600" aria-hidden />
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              In sync — displayed hours equal the ledger sum.
            </span>
          </>
        ) : (
          <>
            <X className="h-4 w-4 text-destructive" aria-hidden />
            <span className="text-sm font-semibold text-destructive">
              Drift — displayed {data.publicHours.toFixed(2)} h vs ledger{" "}
              {data.verifiedHours.toFixed(2)} h.
            </span>
          </>
        )}
      </div>
      <p className="py-2 text-xs text-muted-foreground">
        Read-only. A wrong row is fixed by fixing its lesson (void/refund path), never by editing
        hours.
        {data.lastVerifiedAt
          ? ` Last verify: ${format(new Date(data.lastVerifiedAt), "d MMM yyyy HH:mm")}.`
          : ""}
      </p>
    </div>
  );
}

export function HoursReconcileDialog({
  tutorId,
  onClose,
}: {
  tutorId: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(tutorId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="text-lg font-bold text-[color:var(--ink)]">
          Reconcile hours
        </DialogTitle>
        {tutorId ? <ReconcileBody tutorId={tutorId} /> : null}
      </DialogContent>
    </Dialog>
  );
}
