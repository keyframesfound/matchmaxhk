import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getProgressProofUrl,
  listProgressProofQueue,
  reviewProgressProof,
  type ProgressProofQueueItem,
} from "@/features/cases/progress-proofs.functions";

const QUEUE_KEY = ["admin", "progress-proof-queue"] as const;

/** Staff-facing wording for the checkpoint kinds. */
const ASSESSMENT_LABELS: Record<string, string> = {
  school_quiz: "School quiz",
  term_exam: "Term exam",
  mock: "Mock",
  predicted: "Predicted grade",
  public_exam: "Public exam",
};

const AUTHOR_LABELS: Record<ProgressProofQueueItem["authorSide"], string> = {
  parent: "Family",
  tutor: "Tutor",
};

/** Server codes become plain staff sentences; anything else stays as thrown. */
function reviewErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("FORBIDDEN")) return "Admins only.";
  if (raw.includes("NOT_PENDING")) return "Another reviewer already decided this one.";
  if (raw.includes("NOT_FOUND")) return "This checkpoint is no longer in the queue.";
  return raw;
}

/**
 * #794 §2.6 — the desk half of Report Card Checked. A case party uploads one
 * report card or result slip against a progress checkpoint; staff approve or
 * reject it here and the document is destroyed either way. The queue never
 * carries the stored object key — each document opens through a 10-minute
 * signed link — and an upload never publishes a checkpoint on its own.
 */
export function ProgressEvidenceQueue() {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const queueFn = useServerFn(listProgressProofQueue);
  const proofUrlFn = useServerFn(getProgressProofUrl);
  const reviewFn = useServerFn(reviewProgressProof);

  const queueQuery = useQuery({
    queryKey: QUEUE_KEY,
    queryFn: () => queueFn(),
    refetchInterval: 60_000,
  });

  const review = useMutation({
    mutationFn: (input: { checkpointId: string; decision: "approve" | "reject"; note?: string }) =>
      reviewFn({ data: input }),
    onSuccess: async (_result, variables) => {
      toast.success(
        variables.decision === "approve"
          ? "Evidence approved. The checkpoint is desk-checked and the document is deleted."
          : "Evidence rejected. The checkpoint stays unconfirmed and the document is deleted.",
      );
      queryClient.setQueryData<ProgressProofQueueItem[]>(QUEUE_KEY, (current) =>
        (current ?? []).filter((row) => row.checkpointId !== variables.checkpointId),
      );
      setNotes((previous) => {
        const next = { ...previous };
        delete next[variables.checkpointId];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
    },
    onError: (error: unknown) => toast.error(reviewErrorMessage(error)),
  });

  const openProof = async (row: ProgressProofQueueItem) => {
    try {
      const { url } = await proofUrlFn({ data: { checkpointId: row.checkpointId } });
      window.open(url, "_blank", "noopener");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the document.");
    }
  };

  const rows = queueQuery.data ?? [];

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold text-[color:var(--ink)]">Progress evidence</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Families and tutors attach a report card or result slip to a progress checkpoint. Each
          document opens through a link that expires in 10 minutes.
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Approving desk-checks the checkpoint; the document is deleted on either decision, and any
          document still unreviewed after 14 days is deleted automatically.
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
                <th className="px-3 py-2.5">Case</th>
                <th className="px-3 py-2.5">Checkpoint</th>
                <th className="px-3 py-2.5">Author</th>
                <th className="px-3 py-2.5">Age</th>
                <th className="px-3 py-2.5">Document</th>
                <th className="px-3 py-2.5">Decision</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const assessment = ASSESSMENT_LABELS[row.assessmentType] ?? row.assessmentType;
                const author = AUTHOR_LABELS[row.authorSide];
                const ref = row.checkpointId.slice(0, 8);
                const note = notes[row.checkpointId] ?? "";
                return (
                  <tr key={row.checkpointId} className="border-t border-border align-top">
                    <td className="px-3 py-3 font-semibold text-[color:var(--ink)]">
                      {row.caseCode ? (
                        <a
                          href={`/admin/cases?q=${encodeURIComponent(row.caseCode)}`}
                          className="text-[color:var(--brand-link)] hover:underline"
                        >
                          {row.caseCode}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="max-w-[14rem] px-3 py-3 text-[color:var(--ink)]">
                      <p className="font-medium">{assessment}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {row.scoreValue} · {row.scaleType}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{author}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                      {row.ageDays === 0 ? "Today" : `${row.ageDays} d`}
                    </td>
                    <td className="px-3 py-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Open evidence for checkpoint ${ref}`}
                        onClick={() => void openProof(row)}
                      >
                        <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                        View
                      </Button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-[16rem] flex-col gap-2">
                        <Input
                          value={note}
                          placeholder="Rejection note (optional)"
                          aria-label={`Reviewer note for checkpoint ${ref}`}
                          className="h-8 text-xs"
                          maxLength={500}
                          onChange={(event) =>
                            setNotes((previous) => ({
                              ...previous,
                              [row.checkpointId]: event.target.value,
                            }))
                          }
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={review.isPending}
                            aria-label={`Approve evidence for checkpoint ${ref}`}
                            onClick={() =>
                              review.mutate({ checkpointId: row.checkpointId, decision: "approve" })
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={review.isPending}
                            aria-label={`Reject evidence for checkpoint ${ref}`}
                            onClick={() =>
                              review.mutate({
                                checkpointId: row.checkpointId,
                                decision: "reject",
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
