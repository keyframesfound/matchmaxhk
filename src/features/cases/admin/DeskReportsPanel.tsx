import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConsolePanel } from "@/components/ui/console-panel";
import {
  listCaseDeskReports,
  setDeskReportStatus,
  type CaseDeskReportRow,
} from "@/features/cases/rating.functions";

/**
 * #794 §2.1 — the desk side of the ratings loop. A case that stops before any
 * eligible completed lesson can only produce one of these: a private report
 * (no-show / rude or unsafe / never confirmed / other). Nothing here is ever
 * public; staff triage it here, then rematch, flag or ban with the existing
 * desk tools.
 */
export function DeskReportsPanel({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const reports = useQuery({
    queryKey: ["case-desk-reports", caseId],
    queryFn: () => listCaseDeskReports({ data: { caseId } }),
  });

  const setStatus = useMutation({
    mutationFn: (input: { reportId: string; status: CaseDeskReportRow["status"] }) =>
      setDeskReportStatus({ data: input }),
    onSuccess: () => {
      toast.success("Report updated");
      void queryClient.invalidateQueries({ queryKey: ["case-desk-reports", caseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = reports.data ?? [];
  if (reports.isLoading || rows.length === 0) return null;

  return (
    <ConsolePanel>
      <h2 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        Private participant reports
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        Desk-only. Sent from the case page when no lesson has been completed yet. Never published.
      </p>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-lg border border-[color:var(--ink)]/10 px-3 py-2.5">
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[color:var(--ink)]">
              {r.reason.replace(/_/g, " ")}
              <span className="rounded-full bg-[color:var(--foreground)]/[0.06] px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {r.author_side} · {r.status}
              </span>
            </p>
            {r.detail ? (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--ink)]">
                {r.detail}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={setStatus.isPending || r.status === "actioned"}
                onClick={() => setStatus.mutate({ reportId: r.id, status: "actioned" })}
              >
                Mark actioned
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={setStatus.isPending || r.status === "dismissed"}
                onClick={() => setStatus.mutate({ reportId: r.id, status: "dismissed" })}
              >
                Dismiss
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </ConsolePanel>
  );
}
