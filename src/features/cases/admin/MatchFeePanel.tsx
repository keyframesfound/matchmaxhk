import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, ShieldAlert, UserRoundCheck, Wallet, X } from "lucide-react";
import { toast } from "sonner";

import {
  matchCaseTutor,
  searchCaseTutorsForMatch,
  type CaseTutorHit,
} from "@/features/cases/match-dispatch.functions";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConsolePanel } from "@/components/ui/console-panel";
import { InitialAvatar } from "@/components/ui/initial-avatar";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatMoneyFromCents } from "@/lib/money";
import type { CaseRow } from "./shared";

// Fee policy comparisons happen in HKD (issue #112), so a tutor quoting in
// another currency is judged on the HKD-normalized snapshot.
function tutorHkdRate(hit: Pick<CaseTutorHit, "hourlyRate" | "minHourlyRateHkd">): number {
  return hit.minHourlyRateHkd ?? hit.hourlyRate;
}

function formatHkd(cents: number | null): string {
  return cents === null ? "—" : formatMoneyFromCents(cents);
}

function TutorAvatar({
  hit,
}: {
  hit: Pick<CaseTutorHit, "id" | "displayName" | "tutorCode" | "photoUrl">;
}) {
  if (hit.photoUrl) {
    return (
      <img
        src={hit.photoUrl}
        alt=""
        className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-[color:var(--ink)]/10"
      />
    );
  }
  // Issue #437: branded deterministic initial avatar (no grey placeholders).
  return (
    <InitialAvatar
      stableId={hit.tutorCode ?? hit.id}
      name={hit.displayName}
      className="h-9 w-9 text-[11px]"
    />
  );
}

/**
 * Match & fee capture, the two real-world events the referral bounty hangs
 * off: which tutor won the case, and when the Administrative Matching Fee
 * arrived. Recording the fee on a referred tutor's case auto-logs their
 * referrer's 15% bounty via the trg_cases_fee_referral_bounty trigger.
 */
export function MatchFeePanel({ caseRow, onPatched }: { caseRow: CaseRow; onPatched: () => void }) {
  const [query, setQuery] = useState("");
  const [feeInput, setFeeInput] = useState("");
  // The assignment that hit the #508 hard warning and awaits acknowledgement.
  const [ack, setAck] = useState<{ tutorId: string; name: string; warning: string } | null>(null);

  const { data: hits = [], isFetching: searching } = useQuery({
    queryKey: ["admin", "tutor-picker", caseRow.id, query.trim()],
    enabled: !caseRow.matched_tutor_id && query.trim().length >= 2,
    queryFn: async () => {
      const res = await searchCaseTutorsForMatch({
        data: { caseId: caseRow.id, query: query.trim() },
      });
      return res.hits;
    },
  });

  const { data: matchedTutor } = useQuery({
    queryKey: ["admin", "matched-tutor", caseRow.matched_tutor_id],
    enabled: Boolean(caseRow.matched_tutor_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutors")
        .select(
          "id, display_name, tutor_code, hourly_rate, min_hourly_rate_hkd, photo_url, referrer:tutors!tutors_referred_by_fkey(display_name)",
        )
        .eq("id", caseRow.matched_tutor_id as string)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as {
        id: string;
        display_name: string;
        tutor_code: string | null;
        hourly_rate: number;
        min_hourly_rate_hkd: number | null;
        photo_url: string | null;
        referrer: { display_name: string } | { display_name: string }[] | null;
      };
      // The fkey embed's inferred shape oscillates between object and array
      // depending on the generated client; normalize both.
      const referrerRow = Array.isArray(row.referrer) ? (row.referrer[0] ?? null) : row.referrer;
      const view: CaseTutorHit = {
        id: row.id,
        displayName: row.display_name,
        tutorCode: row.tutor_code,
        hourlyRate: row.hourly_rate,
        minHourlyRateHkd: row.min_hourly_rate_hkd,
        photoUrl: row.photo_url,
        referrerName: referrerRow?.display_name ?? null,
        outOfWindow: false,
        windowEndsAt: null,
        warning: null,
        shadowbanUntil: null,
      };
      return view;
    },
  });

  const patchMutation = useMutation({
    mutationFn: async (patch: Partial<CaseRow>) => {
      const { error } = await supabase
        .from("tutoring_cases")
        .update(patch as never)
        .eq("id", caseRow.id);
      if (error) throw error;
    },
    onSuccess: () => onPatched(),
    onError: (e: Error) => toast.error(e.message),
  });

  /**
   * Assign a tutor. The server re-checks the #508 window and answers
   * `needs_ack` with the hard-warning copy when it has closed — the dialog
   * then re-calls with `acknowledgeOutOfWindow: true` (audited server-side).
   */
  const matchMutation = useMutation({
    mutationFn: async (input: { tutorId: string; name: string; acknowledge: boolean }) =>
      matchCaseTutor({
        data: {
          caseId: caseRow.id,
          tutorId: input.tutorId,
          acknowledgeOutOfWindow: input.acknowledge,
        },
      }),
    onSuccess: (res, input) => {
      if (res.outcome === "needs_ack") {
        setAck({ tutorId: input.tutorId, name: input.name, warning: res.warning });
        return;
      }
      setAck(null);
      setQuery("");
      toast.success(`Case ${caseRow.case_code} matched to ${input.name}`);
      onPatched();
    },
    onError: (e: Error) => {
      if (e.message === "COMPLIANCE_HOLD") {
        toast.error("Compliance hold: re-screen this request before matching a tutor.");
        return;
      }
      toast.error(e.message);
    },
  });

  const onHitClick = (tutor: CaseTutorHit) => {
    // Issue #412: client-side guard mirrors the server check for instant UX.
    if (caseRow.status === "compliance_hold") {
      toast.error("Compliance hold: re-screen this request before matching a tutor.");
      return;
    }
    matchMutation.mutate({
      tutorId: tutor.id,
      name: tutor.displayName,
      acknowledge: false,
    });
  };

  const confirmAck = () => {
    if (!ack) return;
    matchMutation.mutate({
      tutorId: ack.tutorId,
      name: ack.name,
      acknowledge: true,
    });
  };

  const clearMatch = () => {
    patchMutation.mutate(
      { matched_tutor_id: null, matched_at: null },
      {
        onSuccess: () => toast.success(`Matched tutor removed from ${caseRow.case_code}`),
      },
    );
  };

  const markFeeCollected = () => {
    const value = Number.parseFloat(feeInput);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter the collected fee in HK$");
      return;
    }
    patchMutation.mutate(
      {
        fee_collected_at: new Date().toISOString(),
        fee_amount_cents: Math.round(value * 100),
      },
      {
        onSuccess: () => {
          setFeeInput("");
          toast.success("Fee recorded, a referred tutor's bounty auto-logs at 15%");
        },
      },
    );
  };

  const undoFee = () => {
    patchMutation.mutate(
      { fee_collected_at: null, fee_amount_cents: null },
      { onSuccess: () => toast.success("Fee record removed") },
    );
  };

  const pending = patchMutation.isPending || matchMutation.isPending;
  const referrerName = matchedTutor?.referrerName ?? null;

  return (
    <ConsolePanel>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-muted-foreground">Match &amp; fee</h2>
        <UserRoundCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </div>

      {/* Matched tutor */}
      {caseRow.matched_tutor_id ? (
        <div className="mt-3 rounded-xl border border-[color:var(--ink)]/[0.07] bg-[color:var(--surface-subtle)]/40 px-3.5 py-3">
          {matchedTutor ? (
            <div className="flex items-center gap-3">
              <TutorAvatar hit={matchedTutor} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-[color:var(--ink)]">
                  {matchedTutor.displayName}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  HK${tutorHkdRate(matchedTutor)}/hr
                  {caseRow.matched_at
                    ? ` · matched ${format(new Date(caseRow.matched_at), "d MMM yyyy")}`
                    : ""}
                </p>
                {referrerName ? (
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-[color:var(--brand-link)]">
                    Referred by {referrerName}
                  </p>
                ) : null}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px] font-bold text-muted-foreground hover:text-[color:var(--ink)]"
                disabled={pending}
                onClick={clearMatch}
              >
                <X className="mr-1 h-3 w-3" /> Remove
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Loading matched tutor…</p>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tutors by name or code…"
            className="h-9 rounded-xl text-sm"
            aria-label="Search tutors to match"
          />
          {query.trim().length >= 2 ? (
            <div className="mt-2 space-y-1.5">
              {searching ? (
                <p className="flex items-center gap-2 px-1 py-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
                </p>
              ) : hits.length === 0 ? (
                <p className="px-1 py-1 text-xs text-muted-foreground">
                  No tutors match “{query.trim()}”.
                </p>
              ) : (
                hits.map((hit) =>
                  hit.outOfWindow ? (
                    // #508 dispatch filter: past-window tutors are excluded
                    // from the shortlist proper — shown flagged, assignment
                    // goes through the hard warning.
                    <div
                      key={hit.id}
                      className="rounded-xl border border-[color:var(--ink)]/[0.07] bg-[color:var(--surface-subtle)]/40 px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <TutorAvatar hit={hit} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold text-muted-foreground">
                            {hit.displayName}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {hit.tutorCode} · HK${tutorHkdRate(hit)}/hr
                            {hit.referrerName ? ` · referred by ${hit.referrerName}` : ""}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-muted-foreground">
                          <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                          Out of window
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        {hit.warning}
                      </p>
                    </div>
                  ) : (
                    <button
                      key={hit.id}
                      type="button"
                      disabled={pending}
                      onClick={() => onHitClick(hit)}
                      className="flex w-full items-center gap-3 rounded-xl border border-[color:var(--ink)]/[0.07] px-3 py-2 text-left transition-colors hover:bg-[color:var(--surface-subtle)]/70 disabled:opacity-50"
                    >
                      <TutorAvatar hit={hit} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-[color:var(--ink)]">
                          {hit.displayName}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {hit.tutorCode} · HK${tutorHkdRate(hit)}/hr
                          {hit.referrerName ? ` · referred by ${hit.referrerName}` : ""}
                        </span>
                      </span>
                      {hit.shadowbanUntil ? (
                        <span
                          className="shrink-0 text-[11px] font-bold text-muted-foreground"
                          title="Quit a Lesson 1 without emergency proof (#529). Matching is allowed; prefer active tutors."
                        >
                          Shadowbanned to {format(new Date(hit.shadowbanUntil), "d MMM")}
                        </span>
                      ) : null}
                      <span className="shrink-0 text-[11px] font-bold text-[color:var(--brand-link)]">
                        Match
                      </span>
                    </button>
                  ),
                )
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Matching fee */}
      <div className="mt-4 border-t border-[color:var(--ink)]/[0.07] pt-4">
        <div className="flex items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs font-semibold text-muted-foreground">Matching fee</p>
        </div>
        {caseRow.fee_collected_at ? (
          <div className="mt-2 rounded-xl border border-[color:var(--ink)]/[0.07] bg-[color:var(--surface-subtle)]/40 px-3.5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-[color:var(--ink)]">
                  {formatHkd(caseRow.fee_amount_cents)} collected
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {format(new Date(caseRow.fee_collected_at), "d MMM yyyy, h:mm a")}
                </p>
                {referrerName && caseRow.fee_amount_cents ? (
                  <p className="mt-0.5 text-[11px] font-semibold text-[color:var(--brand-link)]">
                    {referrerName}'s bounty:{" "}
                    {formatHkd(Math.round(caseRow.fee_amount_cents * 0.15))} (15%)
                  </p>
                ) : null}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 shrink-0 px-2 text-[11px] font-bold text-muted-foreground hover:text-[color:var(--ink)]"
                disabled={pending}
                onClick={undoFee}
              >
                Undo
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <div className="flex gap-2">
              <Input
                value={feeInput}
                onChange={(e) => setFeeInput(e.target.value)}
                inputMode="decimal"
                placeholder="Fee in HK$"
                className="h-9 rounded-xl text-sm"
                aria-label="Collected matching fee in HK dollars"
              />
              <Button
                size="sm"
                className="h-9 shrink-0 font-bold"
                disabled={pending}
                onClick={markFeeCollected}
              >
                {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Fee collected
              </Button>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              {caseRow.is_short_case
                ? // #443: while short, the fee is 20% of the package — captured
                  // in the Short case panel above, not the 1.5-lesson input.
                  "Short case active: the platform fee is 20% of the package (rate × hours × lessons), invoiced from the Short case panel above. "
                : "Standard fee = 1.5 × hourly rate · short-term case = 20% of the package. "}
              Recording it logs a referred tutor's 15% bounty automatically.
            </p>
          </div>
        )}
      </div>

      {/* #508 hard warning: assigning a tutor past the 6-month intro window
          with this counterparty earns $0 — the operator must acknowledge. */}
      <AlertDialog
        open={ack !== null}
        onOpenChange={(open) => {
          if (!open) setAck(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Out of window</AlertDialogTitle>
            <AlertDialogDescription>{ack?.warning}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Don't assign</AlertDialogCancel>
            <Button className="font-bold" disabled={matchMutation.isPending} onClick={confirmAck}>
              {matchMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Assign anyway
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConsolePanel>
  );
}
