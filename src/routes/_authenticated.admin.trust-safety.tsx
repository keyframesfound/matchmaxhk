import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
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
import { CASE_RISK_FLAG_LABELS, isCaseRiskFlagType } from "@/features/trust/trust";
import { listTrustQueue, type TrustQueueRow } from "@/features/trust/trust-queue.functions";
import { resolveCaseRiskFlag } from "@/features/trust/trust.functions";

export const Route = createFileRoute("/_authenticated/admin/trust-safety")({
  head: () => ({
    meta: [
      { title: "Trust & safety, MatchMax Admin" },
      {
        name: "description",
        content: "Staff queue for case risk flags, safety holds and unconfirmed first lessons.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminTrustSafety,
});

/** Scam / hostile types get the high-contrast treatment (#529 A7). */
const SEVERE = new Set([
  "SCAM_OVERPAYMENT",
  "SCAM_BAIT_AND_SWITCH",
  "HOSTILE_OR_ABUSIVE_CLIENT",
  "BLACKLISTED_CONTACT",
]);

function FlagLabel({ type }: { type: string }) {
  const label = isCaseRiskFlagType(type) ? CASE_RISK_FLAG_LABELS[type] : type;
  const tone = SEVERE.has(type)
    ? "bg-red-500/15 text-red-700 dark:text-red-400"
    : "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{label}</span>
  );
}

function QueueRow({
  row,
  busy,
  onResolve,
}: {
  row: TrustQueueRow;
  busy: boolean;
  onResolve: () => void;
}) {
  const isHeld = row.caseStatus === "compliance_hold";
  return (
    <tr>
      <ConsoleTd className="whitespace-nowrap text-xs text-muted-foreground">
        {new Date(row.createdAt).toLocaleString()}
      </ConsoleTd>
      <ConsoleTd>
        <FlagLabel type={row.flagType} />
      </ConsoleTd>
      <ConsoleTd className="text-xs">
        {row.caseCode ? (
          <Link
            to="/admin/cases"
            search={{ q: row.caseCode }}
            className="font-semibold underline-offset-2 hover:underline"
          >
            {row.caseCode}
          </Link>
        ) : (
          row.caseId
        )}
        {isHeld ? (
          <span className="ml-2 text-[11px] font-semibold text-[color:var(--warning)]">Held</span>
        ) : null}
      </ConsoleTd>
      <ConsoleTd className="max-w-[320px] text-xs text-muted-foreground">
        {row.note ?? "—"}
      </ConsoleTd>
      <ConsoleTd className="text-xs text-muted-foreground">{row.source}</ConsoleTd>
      <ConsoleTd align="right">
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={busy}
          onClick={onResolve}
        >
          Resolve
        </Button>
      </ConsoleTd>
    </tr>
  );
}

/**
 * Issue #529 §E — trust & safety queue. Open case risk flags (rules screen,
 * blacklist matches, ghost risk, manual and future AI flags), held cases on
 * top. Resolving clears the flag only: release a held case, grant hostile
 * protection or ban from the case's Drop-Protection panel and account tools,
 * so every permanent action stays a human decision.
 */
function AdminTrustSafety() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queueQuery = useQuery({
    queryKey: ["admin", "trust-safety"],
    queryFn: () => listTrustQueue(),
    enabled: Boolean(user),
  });
  const resolve = useMutation({
    mutationFn: (flagId: string) => resolveCaseRiskFlag({ data: { flagId } }),
    onSuccess: () => {
      toast.success("Flag resolved");
      void queryClient.invalidateQueries({ queryKey: ["admin", "trust-safety"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to resolve flag."),
  });

  const rows = queueQuery.data?.rows ?? [];
  const heldCount = new Set(
    rows.filter((r) => r.caseStatus === "compliance_hold").map((r) => r.caseId),
  ).size;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <h2 className="text-xl font-bold tracking-tight">Trust &amp; safety</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Open risk flags across cases. Held cases stay off the board until you re-screen them on the
        case page. Flags never ban or blacklist on their own.
      </p>

      <section className="mt-6">
        <h3 className="pb-3 text-sm font-semibold tracking-tight">
          Open ({rows.length}) · held cases {heldCount}
        </h3>
        <ConsoleTable minTableWidth="900px">
          <ConsoleTableHead>
            <tr>
              <ConsoleTh>Raised</ConsoleTh>
              <ConsoleTh>Flag</ConsoleTh>
              <ConsoleTh>Case</ConsoleTh>
              <ConsoleTh>Evidence</ConsoleTh>
              <ConsoleTh>Source</ConsoleTh>
              <ConsoleTh align="right">Actions</ConsoleTh>
            </tr>
          </ConsoleTableHead>
          <ConsoleTableBody>
            {queueQuery.isLoading ? (
              <ConsoleTableSkeletonRows columns={6} />
            ) : rows.length === 0 ? (
              <ConsoleTableEmpty
                colSpan={6}
                icon={ShieldAlert}
                title="No open risk flags"
                description="Safety holds, blacklist matches and unconfirmed first lessons land here."
              />
            ) : (
              rows.map((row) => (
                <QueueRow
                  key={row.flagId}
                  row={row}
                  busy={resolve.isPending && resolve.variables === row.flagId}
                  onResolve={() => resolve.mutate(row.flagId)}
                />
              ))
            )}
          </ConsoleTableBody>
        </ConsoleTable>
      </section>
    </div>
  );
}
