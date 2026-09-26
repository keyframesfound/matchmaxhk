import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, HandCoins, Info, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  ConsoleTable,
  ConsoleTableBody,
  ConsoleTableEmpty,
  ConsoleTableHead,
  ConsoleTableSkeletonRows,
  ConsoleTd,
  ConsoleTh,
} from "@/components/ui/console-table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/useAuth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/referrals")({
  head: () => ({
    meta: [
      { title: "Referrals — MatchMax Admin" },
      { name: "description", content: "Track tutor referral bounties." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminReferrals,
});

type BountyStatus = "pending" | "ready_for_payout" | "paid";

type ReferredTutorRow = {
  id: string;
  tutor_code: string;
  display_name: string;
  created_at: string;
  referred_by: string;
  referrer: { id: string; tutor_code: string; display_name: string } | null;
  bounty: {
    id: string;
    amount_cents: number;
    status: BountyStatus;
    ready_at: string | null;
    paid_at: string | null;
  } | null;
};

type ReferredApplicationRow = {
  id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  referred_by: string;
  data: { name?: string; email?: string };
  referrer: { id: string; tutor_code: string; display_name: string } | null;
};

const BOUNTY_STATUS_PILL: Record<BountyStatus, { label: string; className: string }> = {
  pending: {
    label: "Pending — match in progress",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  ready_for_payout: {
    label: "Ready for payout",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  },
  paid: {
    label: "Paid",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
};

const APPLICATION_STATUS_PILL: Record<ReferredApplicationRow["status"], string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  accepted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  rejected: "bg-red-500/15 text-red-700 dark:text-red-400",
};

function formatHkd(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency: "HKD",
    minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-HK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function parseAmountToCents(raw: string): number | null {
  const value = Number.parseFloat(raw.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(value) || value <= 0 || value > 100000) return null;
  return Math.round(value * 100);
}

function AdminReferrals() {
  const { hasAnyRole, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [amountDialog, setAmountDialog] = useState<{ tutorId: string; bountyId?: string } | null>(
    null,
  );
  const [amountInput, setAmountInput] = useState("");

  const {
    data: referredTutors = [],
    isLoading: tutorsLoading,
    isError: tutorsError,
  } = useQuery({
    queryKey: ["admin", "referrals", "tutors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutors")
        .select(
          `id, tutor_code, display_name, created_at, referred_by,
           referrer:tutors!tutors_referred_by_fkey(id, tutor_code, display_name),
           bounty:referral_bounties(id, amount_cents, status, ready_at, paid_at)`,
        )
        .not("referred_by", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ReferredTutorRow[];
    },
  });

  const {
    data: referredApplications = [],
    isLoading: applicationsLoading,
    isError: applicationsError,
  } = useQuery({
    queryKey: ["admin", "referrals", "applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_applications")
        .select(
          `id, status, created_at, referred_by, data,
           referrer:tutors!tutor_applications_referred_by_fkey(id, tutor_code, display_name)`,
        )
        .not("referred_by", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as unknown as ReferredApplicationRow[];
    },
  });

  const invalidateReferrals = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "referrals"] });
  };

  const createBounty = useMutation({
    mutationFn: async ({ tutorId, cents }: { tutorId: string; cents: number }) => {
      const tutor = referredTutors.find((row) => row.id === tutorId);
      if (!tutor?.referred_by) throw new Error("This tutor has no referrer on file.");
      const { error } = await supabase.from("referral_bounties").insert({
        referred_tutor_id: tutorId,
        referring_tutor_id: tutor.referred_by,
        amount_cents: cents,
        status: "pending",
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bounty recorded — the referrer now sees it as pending");
      setAmountDialog(null);
      invalidateReferrals();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateBounty = useMutation({
    mutationFn: async (variables: {
      bountyId: string;
      status?: BountyStatus;
      amountCents?: number;
    }) => {
      const patch: Record<string, unknown> = {};
      if (variables.status === "ready_for_payout") {
        patch.status = variables.status;
        patch.ready_at = new Date().toISOString();
      } else if (variables.status === "paid") {
        patch.status = variables.status;
        patch.paid_at = new Date().toISOString();
      }
      if (variables.amountCents !== undefined) patch.amount_cents = variables.amountCents;
      const { error } = await supabase
        .from("referral_bounties")
        .update(patch as never)
        .eq("id", variables.bountyId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      toast.success(
        variables.amountCents !== undefined
          ? "Bounty amount updated"
          : variables.status === "paid"
            ? "Marked as paid via FPS"
            : "Bounty cleared for payout",
      );
      invalidateReferrals();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = useMemo(() => {
    let pendingCents = 0;
    let readyCents = 0;
    let paidCents = 0;
    for (const row of referredTutors) {
      if (!row.bounty) continue;
      if (row.bounty.status === "pending") pendingCents += row.bounty.amount_cents;
      else if (row.bounty.status === "ready_for_payout") readyCents += row.bounty.amount_cents;
      else if (row.bounty.status === "paid") paidCents += row.bounty.amount_cents;
    }
    return { pendingCents, readyCents, paidCents };
  }, [referredTutors]);

  function openAmountDialog(tutor: ReferredTutorRow) {
    setAmountInput(tutor.bounty ? (tutor.bounty.amount_cents / 100).toFixed(2) : "");
    setAmountDialog({ tutorId: tutor.id, bountyId: tutor.bounty?.id });
  }

  function submitAmount() {
    if (!amountDialog) return;
    const cents = parseAmountToCents(amountInput);
    if (cents === null) {
      toast.error("Enter a bounty amount in HKD, e.g. 112.50");
      return;
    }
    if (amountDialog.bountyId) {
      updateBounty.mutate({ bountyId: amountDialog.bountyId, amountCents: cents });
    } else {
      createBounty.mutate({ tutorId: amountDialog.tutorId, cents });
    }
  }

  if (!loading && !hasAnyRole(["admin", "super_admin"])) {
    void navigate({ to: "/dashboard", replace: true });
    return null;
  }

  const amountPending = createBounty.isPending || updateBounty.isPending;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--ink)]">
          Referrals &amp; bounties
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track the 15% referral program. Record a bounty when a referred tutor lands their first
          case, clear it once the matching fee is collected, and mark it paid after the FPS
          transfer. Payouts stay manual — nothing is automated.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "Pending bounties",
            hint: "Matches in progress",
            value: formatHkd(totals.pendingCents),
          },
          {
            label: "Ready for payout",
            hint: "Fee collected, awaiting FPS",
            value: formatHkd(totals.readyCents),
          },
          {
            label: "Paid lifetime",
            hint: "Transferred via FPS",
            value: formatHkd(totals.paidCents),
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-4"
          >
            <p className="text-xs font-medium text-[color:var(--ink)]/60">{card.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-[color:var(--ink)]">
              {card.value}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{card.hint}</p>
          </div>
        ))}
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[color:var(--ink)]">Referred tutors</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Each tutor card created from a referred application appears here once it is saved.
          </p>
        </div>
        <ConsoleTable tableClassName="text-left" minTableWidth="52rem">
          <ConsoleTableHead>
            <tr>
              <ConsoleTh>Referred tutor</ConsoleTh>
              <ConsoleTh>Referred by</ConsoleTh>
              <ConsoleTh>Card created</ConsoleTh>
              <ConsoleTh>Bounty</ConsoleTh>
              <ConsoleTh align="right">Actions</ConsoleTh>
            </tr>
          </ConsoleTableHead>
          <ConsoleTableBody>
            {tutorsLoading && <ConsoleTableSkeletonRows columns={5} />}
            {tutorsError && (
              <ConsoleTableEmpty
                colSpan={5}
                icon={X}
                title="Could not load referrals"
                description="Please try again."
              />
            )}
            {!tutorsLoading && !tutorsError && referredTutors.length === 0 && (
              <ConsoleTableEmpty
                colSpan={5}
                icon={Gift}
                title="No referred tutors yet"
                description="Tutor cards created from referred applications will show up here."
              />
            )}
            {referredTutors.map((row) => (
              <tr
                key={row.id}
                className="transition-colors hover:bg-[color:var(--surface-subtle)]/40"
              >
                <ConsoleTd>
                  <div className="font-bold text-[color:var(--ink)]">{row.display_name}</div>
                  <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {row.tutor_code}
                  </div>
                </ConsoleTd>
                <ConsoleTd>
                  <div className="text-sm font-semibold text-[color:var(--ink)]">
                    {row.referrer?.display_name ?? "—"}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {row.referrer?.tutor_code ?? ""}
                  </div>
                </ConsoleTd>
                <ConsoleTd className="text-xs text-muted-foreground">
                  {formatDate(row.created_at)}
                </ConsoleTd>
                <ConsoleTd>
                  {row.bounty ? (
                    <div className="space-y-1">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2.5 py-0.5 text-xs font-bold",
                          BOUNTY_STATUS_PILL[row.bounty.status].className,
                        )}
                      >
                        {BOUNTY_STATUS_PILL[row.bounty.status].label}
                      </span>
                      <div className="text-sm font-bold text-[color:var(--ink)]">
                        {formatHkd(row.bounty.amount_cents)}
                      </div>
                      {row.bounty.paid_at ? (
                        <div className="text-xs text-muted-foreground">
                          Paid {formatDate(row.bounty.paid_at)}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not recorded</span>
                  )}
                </ConsoleTd>
                <ConsoleTd align="right">
                  <div className="flex items-center justify-end gap-2">
                    {!row.bounty ? (
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 text-xs font-bold"
                        onClick={() => openAmountDialog(row)}
                      >
                        <HandCoins className="h-3.5 w-3.5" />
                        Record 1st case
                      </Button>
                    ) : row.bounty.status === "pending" ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          aria-label="Edit bounty amount"
                          onClick={() => openAmountDialog(row)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs font-bold"
                          disabled={amountPending}
                          onClick={() =>
                            updateBounty.mutate({
                              bountyId: row.bounty!.id,
                              status: "ready_for_payout",
                            })
                          }
                        >
                          Mark ready for payout
                        </Button>
                      </>
                    ) : row.bounty.status === "ready_for_payout" ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          aria-label="Edit bounty amount"
                          onClick={() => openAmountDialog(row)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs font-bold"
                          disabled={amountPending}
                          onClick={() =>
                            updateBounty.mutate({ bountyId: row.bounty!.id, status: "paid" })
                          }
                        >
                          Mark paid
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </ConsoleTd>
              </tr>
            ))}
          </ConsoleTableBody>
        </ConsoleTable>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[color:var(--ink)]">Referred applications</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Applications submitted through a referral link. They count toward the referrer's
            &ldquo;Friends joined&rdquo; stat as soon as they arrive; create their tutor card from
            Join Requests to make the bounty trackable.
          </p>
        </div>
        <ConsoleTable tableClassName="text-left" minTableWidth="44rem">
          <ConsoleTableHead>
            <tr>
              <ConsoleTh>Applicant</ConsoleTh>
              <ConsoleTh>Referred by</ConsoleTh>
              <ConsoleTh>Status</ConsoleTh>
              <ConsoleTh>Submitted</ConsoleTh>
            </tr>
          </ConsoleTableHead>
          <ConsoleTableBody>
            {applicationsLoading && <ConsoleTableSkeletonRows columns={4} />}
            {applicationsError && (
              <ConsoleTableEmpty
                colSpan={4}
                icon={X}
                title="Could not load referred applications"
                description="Please try again."
              />
            )}
            {!applicationsLoading && !applicationsError && referredApplications.length === 0 && (
              <ConsoleTableEmpty
                colSpan={4}
                icon={Gift}
                title="No referred applications yet"
                description="Applications that arrive via /join?ref=… links will appear here."
              />
            )}
            {referredApplications.map((row) => (
              <tr
                key={row.id}
                className="transition-colors hover:bg-[color:var(--surface-subtle)]/40"
              >
                <ConsoleTd>
                  <div className="font-bold text-[color:var(--ink)]">{row.data.name || "—"}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{row.data.email}</div>
                </ConsoleTd>
                <ConsoleTd className="text-sm text-[color:var(--ink)]">
                  {row.referrer?.display_name ?? "—"}
                </ConsoleTd>
                <ConsoleTd>
                  <span
                    className={cn(
                      "inline-block rounded-full px-2.5 py-0.5 text-xs font-bold capitalize",
                      APPLICATION_STATUS_PILL[row.status],
                    )}
                  >
                    {row.status}
                  </span>
                </ConsoleTd>
                <ConsoleTd className="text-xs text-muted-foreground">
                  {formatDate(row.created_at)}
                </ConsoleTd>
              </tr>
            ))}
          </ConsoleTableBody>
        </ConsoleTable>
      </section>

      <p className="flex items-start gap-2.5 rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] px-4 py-3 text-xs leading-5 text-[color:var(--ink)]/65">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          The bounty is the referrer's 15% cut of the collected matching fee (1.5 &times; the agreed
          hourly rate; 20% of the package for short-term cases). Example: HK$500/hr tutor → HK$750
          fee → HK$112.50 bounty. Mark a bounty paid only after the FPS transfer is sent.
        </span>
      </p>

      <Dialog
        open={Boolean(amountDialog)}
        onOpenChange={(open) => {
          if (!open) setAmountDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {amountDialog?.bountyId ? "Edit bounty amount" : "Record first case bounty"}
            </DialogTitle>
            <DialogDescription>
              Enter the referring tutor's 15% cut of the collected matching fee in HKD.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label htmlFor="bounty-amount" className="text-sm font-bold text-[color:var(--ink)]">
              Bounty amount (HKD)
            </label>
            <Input
              id="bounty-amount"
              inputMode="decimal"
              placeholder="112.50"
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitAmount();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAmountDialog(null)}>
              Cancel
            </Button>
            <Button className="font-bold" disabled={amountPending} onClick={submitAmount}>
              {amountDialog?.bountyId ? "Save amount" : "Record bounty"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
