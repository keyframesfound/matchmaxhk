import { useEffect, useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartHandshake } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConsolePanel } from "@/components/ui/console-panel";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  grantCaseSeat,
  listCaseSeatGrants,
  revokeCaseSeat,
  searchStudentsForGrant,
  setImpactAccount,
  type StudentHit,
} from "@/features/impact/impact-grants.functions";
import { seatsRemaining, seatsUsed } from "@/features/impact/seat-grant";
import { cn } from "@/lib/utils";

/** Same 300 ms window as the tutor editor's account search and the typeahead. */
const SEARCH_DEBOUNCE_MS = 300;
/** The server rejects a shorter query, so the input must too. */
const MIN_QUERY_LENGTH = 2;
const MAX_NOTE_LENGTH = 500;

/**
 * #794 AC-400-4 — the desk side of the Impact programme: give one unsold seat
 * in a small group class to a referred child, and mark the receiving account so
 * the $0 shop grant keys on it.
 *
 * The UI hides the grant control once the class is full, but that is only
 * signposting: `case_seat_grants` enforces the six-seat cap with `CAP_REACHED`,
 * so two staff clicking at the same moment still cannot oversell the class.
 * English-only staff copy, like the rest of the desk panels.
 */
export function ImpactDeskPanel({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const searchId = useId();
  const noteId = useId();
  const impactSwitchId = useId();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [picked, setPicked] = useState<StudentHit | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  const seatState = useQuery({
    queryKey: ["case-seat-grants", caseId],
    queryFn: () => listCaseSeatGrants({ data: { caseId } }),
  });

  const hits = useQuery({
    queryKey: ["impact-student-search", debounced],
    queryFn: () => searchStudentsForGrant({ data: { query: debounced } }),
    enabled: debounced.length >= MIN_QUERY_LENGTH,
  });

  const revoke = useMutation({
    mutationFn: (grantId: string) => revokeCaseSeat({ data: { caseId, grantId } }),
    onSuccess: () => {
      toast.success("Seat revoked");
      void queryClient.invalidateQueries({ queryKey: ["case-seat-grants", caseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grant = useMutation({
    mutationFn: (input: { studentId: string; note?: string }) =>
      grantCaseSeat({ data: { caseId, studentId: input.studentId, note: input.note } }),
    onSuccess: () => {
      toast.success("Seat granted");
      setPicked(null);
      setNote("");
      setSearch("");
      setDebounced("");
      void queryClient.invalidateQueries({ queryKey: ["case-seat-grants", caseId] });
      void queryClient.invalidateQueries({ queryKey: ["impact-student-search"] });
    },
    onError: (e: Error) => {
      if (e.message === "CAP_REACHED") toast.error("This class is full.");
      else if (e.message === "ALREADY_SEATED")
        toast.error("That student already holds a seat on this case.");
      else toast.error(e.message);
    },
  });

  const impact = useMutation({
    mutationFn: (input: { userId: string; impact: boolean }) => setImpactAccount({ data: input }),
    onSuccess: (_result, input) => {
      // The switch is the confirmation; keep the picked row in step, then let
      // the next search read the flag back from the server.
      setPicked((current) =>
        current && current.ownerUserId === input.userId
          ? { ...current, ownerImpact: input.impact }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: ["impact-student-search"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const state = seatState.data;
  if (seatState.isLoading || !state) return null;

  const usage = { studentCount: state.studentCount, grantedSeats: state.grants.length };
  const used = seatsUsed(usage);
  const remaining = seatsRemaining(usage);
  const full = remaining === 0;
  const results = debounced.length >= MIN_QUERY_LENGTH ? (hits.data ?? []) : [];
  const ownerUserId = picked?.ownerUserId ?? null;

  return (
    <ConsolePanel>
      <h2 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <HeartHandshake className="h-3.5 w-3.5" aria-hidden="true" />
        Impact: empty-seat grant
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        {used} of {state.cap} seats used.
        {full ? " A full class cannot donate a seat." : null}
      </p>

      <ul className="mt-3 space-y-2">
        {state.grants.length === 0 ? (
          <li className="text-[11px] text-muted-foreground">No seats granted yet.</li>
        ) : (
          state.grants.map((seat) => (
            <li key={seat.id} className="rounded-lg border border-[color:var(--ink)]/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-xs font-semibold text-[color:var(--ink)]">
                  {seat.studentName}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px]"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(seat.id)}
                >
                  {revoke.isPending && revoke.variables === seat.id ? "Revoking" : "Revoke"}
                </Button>
              </div>
              {seat.note ? (
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {seat.note}
                </p>
              ) : null}
            </li>
          ))
        )}
      </ul>

      {full ? null : (
        <div className="mt-4 border-t border-[color:var(--ink)]/10 pt-4">
          <label htmlFor={searchId} className="text-[11px] font-medium text-muted-foreground">
            Find the child
          </label>
          <Input
            id={searchId}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
            autoComplete="off"
            className="mt-1 h-9 text-sm"
          />
          {search.trim().length === 1 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">Type at least 2 characters.</p>
          ) : null}

          {results.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {results.map((hit) => {
                const selected = picked?.id === hit.id;
                return (
                  <li key={hit.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setPicked(hit)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors motion-reduce:transition-none",
                        selected
                          ? "border-[color:var(--ink)]/30 bg-[color:var(--foreground)]/[0.04]"
                          : "border-[color:var(--ink)]/10 hover:bg-[color:var(--foreground)]/[0.03]",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-[color:var(--ink)]">
                        {hit.displayName}
                      </span>
                      {hit.ownerImpact ? (
                        <span className="rounded-full border border-[color:var(--ink)]/15 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          Impact account
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : debounced.length >= MIN_QUERY_LENGTH && hits.isSuccess ? (
            <p className="mt-2 text-[11px] text-muted-foreground">No child matches that name.</p>
          ) : null}

          {picked ? (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-[color:var(--ink)]/15 bg-[color:var(--foreground)]/[0.04] px-3 py-2">
              <p className="min-w-0 flex-1 truncate text-xs font-medium text-[color:var(--ink)]">
                Granting to {picked.displayName}
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px]"
                onClick={() => setPicked(null)}
              >
                Clear
              </Button>
            </div>
          ) : null}

          {ownerUserId ? (
            <div className="mt-2 rounded-lg border border-[color:var(--ink)]/10 px-3 py-2">
              <div className="flex items-center gap-2">
                <label
                  htmlFor={impactSwitchId}
                  className="text-xs font-medium text-[color:var(--ink)]"
                >
                  Impact account
                </label>
                <Switch
                  id={impactSwitchId}
                  className="ml-auto"
                  checked={picked?.ownerImpact ?? false}
                  disabled={impact.isPending}
                  onCheckedChange={(checked) =>
                    impact.mutate({ userId: ownerUserId, impact: checked })
                  }
                />
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                The $0 shop grant keys on this flag.
              </p>
            </div>
          ) : null}

          <div className="mt-3">
            <label htmlFor={noteId} className="text-[11px] font-medium text-muted-foreground">
              Note (optional)
            </label>
            <Input
              id={noteId}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={MAX_NOTE_LENGTH}
              placeholder="Why this child holds the seat"
              className="mt-1 h-9 text-sm"
            />
          </div>

          <Button
            size="sm"
            className="mt-3 h-9 w-full font-semibold"
            disabled={!picked || grant.isPending}
            onClick={() => {
              if (!picked) return;
              grant.mutate({
                studentId: picked.id,
                note: note.trim() ? note.trim() : undefined,
              });
            }}
          >
            {grant.isPending ? "Granting" : "Grant seat"}
          </Button>
        </div>
      )}
    </ConsolePanel>
  );
}
