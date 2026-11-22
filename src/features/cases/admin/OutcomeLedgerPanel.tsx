import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

import { ConsolePanel } from "@/components/ui/console-panel";
import {
  getCaseOutcomeLedger,
  outcomeEventLabel,
} from "@/features/cases/admin/outcome-ledger.functions";

/**
 * Issue #816 §2.7 — the case's outcome ledger, read back.
 *
 * `case_funnel_events` has been written since #428 Phase 1 and never read. This
 * is the reader: one case, newest first, with the only two fields that explain
 * anything — where a tutor ranked on the shortlist, and why the case stopped.
 * Read-only by design; the table is append-only at the grant level.
 */
export function OutcomeLedgerPanel({ caseId }: { caseId: string }) {
  const ledger = useQuery({
    queryKey: ["case-outcome-ledger", caseId],
    queryFn: () => getCaseOutcomeLedger({ data: { caseId } }),
  });

  const rows = ledger.data ?? [];
  if (ledger.isLoading || rows.length === 0) return null;

  return (
    <ConsolePanel>
      <h2 className="text-xs font-semibold text-muted-foreground">Outcome ledger</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        Append-only. Every row was written by the flow itself, never by hand.
      </p>
      <ul className="mt-3 divide-y divide-border">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-baseline gap-x-2 py-1.5 text-xs">
            <span className="tabular-nums text-muted-foreground">
              {format(new Date(row.createdAt), "d MMM HH:mm")}
            </span>
            <span className="font-medium text-[color:var(--ink)]">
              {outcomeEventLabel(row.eventType)}
            </span>
            {row.tutorCode ? (
              <span className="text-muted-foreground">
                {row.tutorName ?? row.tutorCode}
                {row.tutorName ? ` (${row.tutorCode})` : ""}
              </span>
            ) : null}
            {row.rankPosition !== null ? (
              <span className="text-muted-foreground">rank #{row.rankPosition}</span>
            ) : null}
            {row.requestSource ? (
              <span className="text-muted-foreground">
                {row.requestSource === "staff_shortlist" ? "staff shortlist" : "parent picked"}
              </span>
            ) : null}
            {row.sessionFocus ? (
              <span className="text-muted-foreground">{row.sessionFocus}</span>
            ) : null}
            {row.stopReason ? (
              <span className="text-muted-foreground">
                stopped: {row.stopReason.replace(/_/g, " ")}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </ConsolePanel>
  );
}
