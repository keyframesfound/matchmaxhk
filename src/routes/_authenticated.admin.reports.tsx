import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  ConsoleTable,
  ConsoleTableBody,
  ConsoleTableEmpty,
  ConsoleTableHead,
  ConsoleTableSkeletonRows,
  ConsoleTd,
  ConsoleTh,
} from "@/components/ui/console-table";
import { useAuth } from "@/features/auth/useAuth";
import {
  listReportsAdmin,
  resolveReport,
  type AdminReportRow,
} from "@/features/reports/reports.functions";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({
    meta: [
      { title: "Reports — MatchMax Admin" },
      {
        name: "description",
        content: "Staff queue for user reports on cards, photos, introductions and notes.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminReports,
});

const REASON_LABELS: Record<string, string> = {
  contact_details: "Contact details",
  inappropriate_image: "Inappropriate image",
  copyright: "Copyright",
  fake_credentials: "Fake credentials",
  not_as_described: "Not as described / fraud",
  harassment: "Harassment or hate",
  spam: "Spam",
  impersonation: "Impersonation",
  other: "Other",
};

const TARGET_LABELS: Record<string, string> = {
  tutor_card: "Tutor card",
  tutor_photo: "Photo",
  tutor_introduction: "Introduction",
  material: "Note",
};

/**
 * Issue #216: staff reports queue. Open reports first (oldest at the top so
 * nothing sinks), then resolved history. Uphold hides the reported item and
 * the second uphold on one tutor pauses the card (resolveReport handles both
 * server-side and flags the threshold in its result); reject closes the
 * report without touching the item. Reporter identity + email are shown here
 * — anonymity is tutor-facing only; staff need it to catch serial false
 * reporters.
 */
function AdminReports() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const reportsQuery = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: () => listReportsAdmin(),
    enabled: Boolean(user),
  });

  const resolveMutation = useMutation({
    mutationFn: (input: { reportId: string; action: "uphold" | "reject" }) =>
      resolveReport({ data: input }),
    onSuccess: (_data, variables) => {
      toast.success(
        variables.action === "uphold" ? "Report upheld — the item is hidden." : "Report rejected.",
      );
      void queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
      setResolvingId(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to resolve report.");
      setResolvingId(null);
    },
  });

  const rows = reportsQuery.data ?? [];
  const open = rows.filter((row) => row.status === "open");
  const resolved = rows.filter((row) => row.status !== "open");

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Reports</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            User reports on tutor cards, photos, introductions and notes. Upholding hides the item;
            a second uphold on one tutor pauses the card.
          </p>
        </div>
      </div>

      <section className="mt-6">
        <h3 className="pb-3 text-sm font-semibold tracking-tight">Open ({open.length})</h3>
        <ConsoleTable minTableWidth="900px">
          <ConsoleTableHead>
            <tr>
              <ConsoleTh>Reported</ConsoleTh>
              <ConsoleTh>Target</ConsoleTh>
              <ConsoleTh>Reason</ConsoleTh>
              <ConsoleTh>Details</ConsoleTh>
              <ConsoleTh>Reporter</ConsoleTh>
              <ConsoleTh align="right">Actions</ConsoleTh>
            </tr>
          </ConsoleTableHead>
          <ConsoleTableBody>
            {reportsQuery.isLoading ? (
              <ConsoleTableSkeletonRows columns={6} />
            ) : open.length === 0 ? (
              <ConsoleTableEmpty
                colSpan={6}
                icon={Flag}
                title="No open reports"
                description="New reports from the report buttons land here."
              />
            ) : (
              open.map((row) => (
                <ReportRowView
                  key={row.id}
                  row={row}
                  busy={resolvingId === row.id}
                  onAct={(action) => {
                    setResolvingId(row.id);
                    resolveMutation.mutate({ reportId: row.id, action });
                  }}
                />
              ))
            )}
          </ConsoleTableBody>
        </ConsoleTable>
      </section>

      {resolved.length > 0 ? (
        <section className="mt-8">
          <h3 className="pb-3 text-sm font-semibold tracking-tight">
            Resolved ({resolved.length})
          </h3>
          <ConsoleTable minTableWidth="900px">
            <ConsoleTableHead>
              <tr>
                <ConsoleTh>Reported</ConsoleTh>
                <ConsoleTh>Target</ConsoleTh>
                <ConsoleTh>Reason</ConsoleTh>
                <ConsoleTh>Reporter</ConsoleTh>
                <ConsoleTh>Status</ConsoleTh>
              </tr>
            </ConsoleTableHead>
            <ConsoleTableBody>
              {resolved.map((row) => (
                <tr key={row.id}>
                  <ConsoleTd className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </ConsoleTd>
                  <ConsoleTd className="text-xs">
                    {TARGET_LABELS[row.target_type] ?? row.target_type}
                    {row.target_label ? ` — ${row.target_label}` : ""}
                  </ConsoleTd>
                  <ConsoleTd className="text-xs">
                    {REASON_LABELS[row.reason] ?? row.reason}
                  </ConsoleTd>
                  <ConsoleTd className="max-w-[220px] truncate text-xs text-muted-foreground">
                    {row.reporter_email ?? row.reporter_id}
                  </ConsoleTd>
                  <ConsoleTd>
                    <StatusPill status={row.status} />
                  </ConsoleTd>
                </tr>
              ))}
            </ConsoleTableBody>
          </ConsoleTable>
        </section>
      ) : null}
    </div>
  );
}

function ReportRowView({
  row,
  busy,
  onAct,
}: {
  row: AdminReportRow;
  busy: boolean;
  onAct: (action: "uphold" | "reject") => void;
}) {
  return (
    <tr>
      <ConsoleTd className="whitespace-nowrap text-xs text-muted-foreground">
        {new Date(row.created_at).toLocaleString()}
      </ConsoleTd>
      <ConsoleTd className="text-xs">
        <span className="font-semibold">{TARGET_LABELS[row.target_type] ?? row.target_type}</span>
        {row.target_label ? (
          <span className="block max-w-[200px] truncate text-muted-foreground">
            {row.target_label}
          </span>
        ) : null}
      </ConsoleTd>
      <ConsoleTd className="text-xs">{REASON_LABELS[row.reason] ?? row.reason}</ConsoleTd>
      <ConsoleTd className="max-w-[240px] text-xs text-muted-foreground">
        {row.note ? <span className="line-clamp-3">{row.note}</span> : "—"}
      </ConsoleTd>
      <ConsoleTd className="max-w-[220px] truncate text-xs text-muted-foreground">
        {row.reporter_email ?? row.reporter_id}
      </ConsoleTd>
      <ConsoleTd align="right">
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-8 px-3 text-xs font-bold"
            disabled={busy}
            onClick={() => onAct("reject")}
          >
            Reject
          </Button>
          <Button
            type="button"
            variant="solid"
            color="blue"
            className="h-8 px-3 text-xs font-bold"
            disabled={busy}
            onClick={() => onAct("uphold")}
          >
            {busy ? "Working…" : "Uphold"}
          </Button>
        </div>
      </ConsoleTd>
    </tr>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles =
    status === "upheld"
      ? "border-[color:var(--ink)]/20 bg-muted text-[color:var(--ink)]"
      : "border-border bg-[color:var(--surface)] text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${styles}`}
    >
      {status === "upheld" ? "Upheld" : "Rejected"}
    </span>
  );
}
