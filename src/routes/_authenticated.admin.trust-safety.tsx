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
import {
  listContrabandHits,
  listTrustQueue,
  type TrustQueueRow,
} from "@/features/trust/trust-queue.functions";
import { resolveCaseRiskFlag } from "@/features/trust/trust.functions";
import {
  emergencySuspendAccount,
  listSafetyQuarantines,
  releaseSafetyQuarantine,
} from "@/features/trust/quarantine.functions";
import { listStrikeLadderReviews } from "@/features/trust/behaviour-reports.functions";
import { FreezeAccountDialog } from "@/features/trust/freeze-account-dialog";

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
      <StrikeLadderSection />
      <QuarantineSection />
      <ContrabandHitsSection />
    </div>
  );
}

/** #782 §2.3: blocked saves (category + matched term only, never the content). */
function ContrabandHitsSection() {
  const { user } = useAuth();
  const hits = useQuery({
    queryKey: ["admin", "contraband-hits"],
    queryFn: () => listContrabandHits(),
    enabled: Boolean(user),
  });
  const rows = hits.data ?? [];
  return (
    <section className="mt-10">
      <h3 className="pb-1 text-sm font-semibold tracking-tight">Blocked saves ({rows.length})</h3>
      <p className="pb-3 text-xs text-muted-foreground">
        Listings, bios and Case Workspace text the contraband filter rejected. Review false
        positives with the user; the filter never bans on its own.
      </p>
      <ConsoleTable minTableWidth="760px">
        <ConsoleTableHead>
          <tr>
            <ConsoleTh>When</ConsoleTh>
            <ConsoleTh>Category</ConsoleTh>
            <ConsoleTh>Matched</ConsoleTh>
            <ConsoleTh>Where</ConsoleTh>
            <ConsoleTh>User</ConsoleTh>
          </tr>
        </ConsoleTableHead>
        <ConsoleTableBody>
          {hits.isLoading ? (
            <ConsoleTableSkeletonRows columns={5} />
          ) : rows.length === 0 ? (
            <ConsoleTableEmpty
              colSpan={5}
              icon={ShieldAlert}
              title="No blocked saves"
              description="Banned terms and dangerous file types are logged here."
            />
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <ConsoleTd>{new Date(row.created_at).toLocaleString("en-HK")}</ConsoleTd>
                <ConsoleTd>{row.category}</ConsoleTd>
                <ConsoleTd>{row.matched_term ?? "—"}</ConsoleTd>
                <ConsoleTd>{row.surface}</ConsoleTd>
                <ConsoleTd>
                  <span className="font-mono text-xs">{row.user_id?.slice(0, 8) ?? "—"}</span>
                </ConsoleTd>
              </tr>
            ))
          )}
        </ConsoleTableBody>
      </ConsoleTable>
    </section>
  );
}

const TRIGGER_LABELS: Record<string, string> = {
  verified_report: "Auto: matched reporter",
  unmatched_threshold: "Auto: 3 unmatched reporters",
  emergency_suspend: "Emergency Suspend",
};

/** #782 §2.4: quarantined profiles / listings and Emergency Suspends; staff release. */
function QuarantineSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["admin", "safety-quarantines"],
    queryFn: () => listSafetyQuarantines(),
    enabled: Boolean(user),
  });
  const release = useMutation({
    mutationFn: (quarantineId: string) => releaseSafetyQuarantine({ data: { quarantineId } }),
    onSuccess: () => {
      toast.success("Released. The profile / listing is visible again.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "safety-quarantines"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Release failed."),
  });
  const rows = list.data ?? [];
  const open = rows.filter((r) => !r.released_at).length;
  return (
    <section className="mt-10">
      <h3 className="pb-1 text-sm font-semibold tracking-tight">
        Quarantine &amp; Emergency Suspend ({open} active)
      </h3>
      <p className="pb-3 text-xs text-muted-foreground">
        Urgent Safety reports auto-quarantine on 1 matched reporter or 3 unmatched reporters.
        Review, then release or keep. Reporter identity is never shown to the tutor.
      </p>
      <ConsoleTable minTableWidth="760px">
        <ConsoleTableHead>
          <tr>
            <ConsoleTh>When</ConsoleTh>
            <ConsoleTh>Trigger</ConsoleTh>
            <ConsoleTh>Tutor</ConsoleTh>
            <ConsoleTh>Note</ConsoleTh>
            <ConsoleTh align="right">Actions</ConsoleTh>
          </tr>
        </ConsoleTableHead>
        <ConsoleTableBody>
          {list.isLoading ? (
            <ConsoleTableSkeletonRows columns={5} />
          ) : rows.length === 0 ? (
            <ConsoleTableEmpty
              colSpan={5}
              icon={ShieldAlert}
              title="Nothing quarantined"
              description="Auto-quarantines and Emergency Suspends appear here."
            />
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <ConsoleTd>{new Date(row.created_at).toLocaleString("en-HK")}</ConsoleTd>
                <ConsoleTd>
                  {TRIGGER_LABELS[row.trigger_kind] ?? row.trigger_kind}
                  {row.material_id ? " · listing" : ""}
                </ConsoleTd>
                <ConsoleTd>
                  {row.tutors?.tutor_code ? (
                    <Link
                      to="/tutors/$tutorCode"
                      params={{ tutorCode: row.tutors.tutor_code }}
                      className="underline"
                    >
                      {row.tutors.tutor_code}
                    </Link>
                  ) : (
                    "—"
                  )}
                </ConsoleTd>
                <ConsoleTd className="max-w-[240px] truncate">{row.note ?? "—"}</ConsoleTd>
                <ConsoleTd align="right">
                  {row.released_at ? (
                    <span className="text-xs text-muted-foreground">Released</span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 px-3 text-xs font-bold"
                      disabled={release.isPending}
                      onClick={() => release.mutate(row.id)}
                    >
                      Release
                    </Button>
                  )}
                </ConsoleTd>
              </tr>
            ))
          )}
        </ConsoleTableBody>
      </ConsoleTable>
    </section>
  );
}

/** #782 AC-703-3 level 3: staff decide Freeze & Suspend (never automatic). */
function StrikeLadderSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: ["admin", "strike-ladder"],
    queryFn: () => listStrikeLadderReviews(),
    enabled: Boolean(user),
  });
  const freeze = useMutation({
    mutationFn: (input: { accountId: string; note: string }) =>
      emergencySuspendAccount({ data: input }),
    onSuccess: () => {
      toast.success("Account frozen and suspended.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "strike-ladder"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "safety-quarantines"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Freeze failed."),
  });
  const rows = list.data ?? [];
  return (
    <section className="mt-10">
      <h3 className="pb-1 text-sm font-semibold tracking-tight">
        Strike ladder: Freeze decisions ({rows.filter((r) => !r.suspended).length})
      </h3>
      <p className="pb-3 text-xs text-muted-foreground">
        3+ concierge strikes (no-reply, no-show, bad behaviour). New matches are already paused;
        decide whether to Freeze &amp; Suspend. The system never does this on its own.
      </p>
      <ConsoleTable minTableWidth="640px">
        <ConsoleTableHead>
          <tr>
            <ConsoleTh>Account</ConsoleTh>
            <ConsoleTh>Strikes</ConsoleTh>
            <ConsoleTh>Last strike</ConsoleTh>
            <ConsoleTh align="right">Decision</ConsoleTh>
          </tr>
        </ConsoleTableHead>
        <ConsoleTableBody>
          {list.isLoading ? (
            <ConsoleTableSkeletonRows columns={4} />
          ) : rows.length === 0 ? (
            <ConsoleTableEmpty
              colSpan={4}
              icon={ShieldAlert}
              title="No account at 3 strikes"
              description="Accounts reaching the third concierge strike appear here."
            />
          ) : (
            rows.map((row) => (
              <tr key={row.accountId}>
                <ConsoleTd>
                  {row.displayName ?? "—"}{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    {row.accountId.slice(0, 8)}
                  </span>
                </ConsoleTd>
                <ConsoleTd>{row.strikes}</ConsoleTd>
                <ConsoleTd>{new Date(row.lastStrikeAt).toLocaleString("en-HK")}</ConsoleTd>
                <ConsoleTd align="right">
                  {row.suspended ? (
                    <span className="text-xs text-muted-foreground">Suspended</span>
                  ) : (
                    <FreezeAccountDialog
                      pending={freeze.isPending}
                      onConfirm={(note) => freeze.mutate({ accountId: row.accountId, note })}
                    />
                  )}
                </ConsoleTd>
              </tr>
            ))
          )}
        </ConsoleTableBody>
      </ConsoleTable>
    </section>
  );
}
