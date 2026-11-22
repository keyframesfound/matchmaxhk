import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  decideNeedVerification,
  listNeedVerificationQueue,
  type NeedVerificationQueueItem,
} from "@/features/impact/need-verification.functions";
import type { ProofKind } from "@/features/impact/need-verification";

const QUEUE_KEY = ["admin", "need-verification-queue"] as const;

/** Staff-facing wording for the nine accepted proof types (AC-560-3). */
const PROOF_LABELS: Record<ProofKind, string> = {
  cssa: "CSSA",
  wfsfaa_full: "WFSFAA Full Grant",
  wfsfaa_half: "WFSFAA Half Grant",
  working_family_allowance: "Working Family Allowance",
  public_housing: "Public housing",
  ngo_letter: "NGO referral letter",
  social_worker_letter: "Social worker letter",
  school_letter: "School letter",
  other: "Other proof",
};

function formatSubmittedAt(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString("en-HK", { dateStyle: "medium", timeStyle: "short" });
}

/** Server codes become plain staff sentences; anything else stays as thrown. */
function decideErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("ALREADY_REVIEWED")) return "Another reviewer already decided this one.";
  if (raw.includes("FORBIDDEN")) return "Staff only.";
  if (raw.includes("VERIFICATION_NOT_FOUND")) return "This request is no longer in the queue.";
  return raw;
}

/**
 * #794 §2.3 (AC-560-3) — the desk half of Verified Need. A family uploads one
 * proof document; staff approve or reject it here and the document is destroyed
 * on the decision. The queue only ever hands out a 10-minute signed URL, never
 * the stored object key, so there is no path to render as a link.
 */
export function NeedVerificationQueue() {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [cascades, setCascades] = useState<Record<string, boolean>>({});

  const queueQuery = useQuery({
    queryKey: QUEUE_KEY,
    queryFn: () => listNeedVerificationQueue(),
    refetchInterval: 60_000,
  });

  const decide = useMutation({
    mutationFn: (input: {
      id: string;
      decision: "approve" | "reject";
      cascade: boolean;
      note?: string;
    }) =>
      decideNeedVerification({
        data: {
          id: input.id,
          decision: input.decision,
          cascade: input.decision === "approve" ? input.cascade : false,
          note: input.note,
        },
      }),
    onSuccess: async (_result, variables) => {
      toast.success(
        variables.decision === "approve"
          ? "Proof approved. The family is verified for 12 months and the document is deleted."
          : "Proof rejected. The family keeps its self-declared request and the document is deleted.",
      );
      // Drop the row before the refetch lands so a fast second click has no target.
      queryClient.setQueryData<NeedVerificationQueueItem[]>(QUEUE_KEY, (current) =>
        (current ?? []).filter((row) => row.id !== variables.id),
      );
      setNotes((previous) => {
        const next = { ...previous };
        delete next[variables.id];
        return next;
      });
      setCascades((previous) => {
        const next = { ...previous };
        delete next[variables.id];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
    },
    onError: (error: unknown) => toast.error(decideErrorMessage(error)),
  });

  const rows = queueQuery.data ?? [];

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold text-[color:var(--ink)]">
          Access and pro-bono verifications
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Families submit one proof of need for a verified pro-bono rate. Each document opens
          through a link that expires in 10 minutes.
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          The document is deleted when the decision is saved.
        </p>
      </div>

      {queueQuery.isLoading ? (
        <div className="h-32 animate-pulse rounded-xl bg-[color:var(--ink)]/5" aria-hidden />
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-[color:var(--surface-subtle)] px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing waiting for review.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--surface-subtle)] text-left text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Proof</th>
                <th className="px-3 py-2.5">Document</th>
                <th className="px-3 py-2.5">Submitted</th>
                <th className="px-3 py-2.5">Decision</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const label = PROOF_LABELS[row.proofKind];
                const ref = row.id.slice(0, 8);
                const note = notes[row.id] ?? "";
                const cascade = cascades[row.id] ?? false;
                return (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="max-w-xs px-3 py-3">
                      <p className="font-semibold text-[color:var(--ink)]">{label}</p>
                      {row.contextNote ? (
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                          {row.contextNote}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      {row.fileUrl ? (
                        <a
                          href={row.fileUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--brand-link)] hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                          Open document
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">No document</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                      {formatSubmittedAt(row.createdAt)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-[16rem] flex-col gap-2">
                        <Input
                          value={note}
                          placeholder="Reviewer note (optional)"
                          aria-label={`Reviewer note for ${label} submission ${ref}`}
                          className="h-8 text-xs"
                          maxLength={500}
                          onChange={(event) =>
                            setNotes((previous) => ({
                              ...previous,
                              [row.id]: event.target.value,
                            }))
                          }
                        />
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={cascade}
                            onChange={(event) =>
                              setCascades((previous) => ({
                                ...previous,
                                [row.id]: event.target.checked,
                              }))
                            }
                            className="h-3.5 w-3.5 accent-[color:var(--brand-link)]"
                          />
                          Also cover the other children on this account
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={decide.isPending}
                            aria-label={`Approve ${label} submission ${ref}`}
                            onClick={() =>
                              decide.mutate({
                                id: row.id,
                                decision: "approve",
                                cascade,
                                note: note.trim() || undefined,
                              })
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={decide.isPending}
                            aria-label={`Reject ${label} submission ${ref}`}
                            onClick={() =>
                              decide.mutate({
                                id: row.id,
                                decision: "reject",
                                cascade: false,
                                note: note.trim() || undefined,
                              })
                            }
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
