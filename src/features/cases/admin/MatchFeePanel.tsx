import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, UserRoundCheck, Wallet, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConsolePanel } from "@/components/ui/console-panel";
import type { CaseRow } from "./shared";

type TutorHit = {
  id: string;
  display_name: string;
  tutor_code: string;
  hourly_rate: number;
  photo_url: string | null;
  referrer: { display_name: string } | null;
};

const TUTOR_SELECT =
  "id, display_name, tutor_code, hourly_rate, photo_url, referrer:tutors!tutors_referred_by_fkey(display_name)";

function formatHkd(cents: number | null): string {
  if (cents === null) return "—";
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency: "HKD",
    minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

function TutorAvatar({ hit }: { hit: TutorHit }) {
  if (hit.photo_url) {
    return (
      <img
        src={hit.photo_url}
        alt=""
        className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-[color:var(--ink)]/10"
      />
    );
  }
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:var(--ink)]/[0.06] text-[10px] font-bold text-[color:var(--ink)]/60">
      {(hit.tutor_code || "MM").slice(0, 2)}
    </div>
  );
}

/**
 * Match & fee capture — the two real-world events the referral bounty hangs
 * off: which tutor won the case, and when the Administrative Matching Fee
 * arrived. Recording the fee on a referred tutor's case auto-logs their
 * referrer's 15% bounty via the trg_cases_fee_referral_bounty trigger.
 */
export function MatchFeePanel({ caseRow, onPatched }: { caseRow: CaseRow; onPatched: () => void }) {
  const [query, setQuery] = useState("");
  const [feeInput, setFeeInput] = useState("");

  const { data: hits = [], isFetching: searching } = useQuery({
    queryKey: ["admin", "tutor-picker", query.trim()],
    enabled: !caseRow.matched_tutor_id && query.trim().length >= 2,
    queryFn: async () => {
      const q = query.trim().replace(/[,()%]/g, "");
      const { data, error } = await supabase
        .from("tutors")
        .select(TUTOR_SELECT)
        .or(`display_name.ilike.%${q}%,tutor_code.ilike.%${q}%`)
        .limit(6);
      if (error) throw error;
      return data as unknown as TutorHit[];
    },
  });

  const { data: matchedTutor } = useQuery({
    queryKey: ["admin", "matched-tutor", caseRow.matched_tutor_id],
    enabled: Boolean(caseRow.matched_tutor_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutors")
        .select(TUTOR_SELECT)
        .eq("id", caseRow.matched_tutor_id as string)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as TutorHit | null;
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

  const markMatched = (tutor: TutorHit) => {
    patchMutation.mutate(
      {
        status: "matched",
        matched_tutor_id: tutor.id,
        matched_at: new Date().toISOString(),
      },
      {
        onSuccess: () => {
          setQuery("");
          toast.success(`Case ${caseRow.case_code} matched to ${tutor.display_name}`);
        },
      },
    );
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
          toast.success("Fee recorded — a referred tutor's bounty auto-logs at 15%");
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

  const pending = patchMutation.isPending;
  const referrerName = matchedTutor?.referrer?.display_name ?? null;

  return (
    <ConsolePanel>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-muted-foreground">Match &amp; fee</h2>
        <UserRoundCheck className="h-4 w-4 text-muted-foreground/60" aria-hidden="true" />
      </div>

      {/* Matched tutor */}
      {caseRow.matched_tutor_id ? (
        <div className="mt-3 rounded-xl border border-[color:var(--ink)]/[0.07] bg-[color:var(--surface-subtle)]/40 px-3.5 py-3">
          {matchedTutor ? (
            <div className="flex items-center gap-3">
              <TutorAvatar hit={matchedTutor} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-[color:var(--ink)]">
                  {matchedTutor.display_name}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  HK${matchedTutor.hourly_rate}/hr
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
                hits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    disabled={pending}
                    onClick={() => markMatched(hit)}
                    className="flex w-full items-center gap-3 rounded-xl border border-[color:var(--ink)]/[0.07] px-3 py-2 text-left transition-colors hover:bg-[color:var(--surface-subtle)]/70 disabled:opacity-50"
                  >
                    <TutorAvatar hit={hit} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-[color:var(--ink)]">
                        {hit.display_name}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {hit.tutor_code} · HK${hit.hourly_rate}/hr
                        {hit.referrer ? ` · referred by ${hit.referrer.display_name}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] font-bold text-[color:var(--brand-link)]">
                      Match
                    </span>
                  </button>
                ))
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
              Standard fee = 1.5 × hourly rate · short-term case = 20% of the package. Recording it
              logs a referred tutor's 15% bounty automatically.
            </p>
          </div>
        )}
      </div>
    </ConsolePanel>
  );
}
