import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ExternalLink, FileText, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/useAuth";
import {
  fetchGradeQueue,
  getGradeSlipUrl,
  reviewTutorGrade,
  type GradeQueueRow,
} from "@/features/tutors/admin/grade-review.functions";
import { GRADE_REJECTION_REASONS, type GradeRejectionReason } from "@/features/tutors/grades";

export const Route = createFileRoute("/_authenticated/admin/grades")({
  head: () => ({
    meta: [
      { title: "Grade review queue — MatchMax Admin" },
      {
        name: "description",
        content:
          "Review tutor grade slips: approve or reject each grade. Approved grades power the public Verified badge.",
      },
      { property: "og:url", content: "https://matchmax.hk/admin/grades" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/admin/grades" }],
  }),
  component: AdminGrades,
});

const REASON_LABELS: Record<GradeRejectionReason, string> = {
  name_does_not_match: "Name does not match",
  unreadable: "Unreadable",
  not_a_result_slip: "Not a result slip",
  looks_altered: "Looks altered",
  wrong_document: "Wrong document",
};

function formatSubmittedAt(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString("en-HK", { dateStyle: "medium", timeStyle: "short" });
}

function AdminGrades() {
  const { hasAnyRole, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const queueFn = useServerFn(fetchGradeQueue);
  const slipUrlFn = useServerFn(getGradeSlipUrl);
  const reviewFn = useServerFn(reviewTutorGrade);

  const [rejections, setRejections] = useState<
    Record<string, { reason: GradeRejectionReason | ""; note: string }>
  >({});

  useEffect(() => {
    if (!loading && !hasAnyRole(["admin", "super_admin"])) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, hasAnyRole, navigate]);

  const queueQuery = useQuery({
    queryKey: ["admin", "grade-queue"],
    queryFn: () => queueFn(),
    refetchInterval: 60_000,
  });

  const review = useMutation({
    mutationFn: async (input: {
      gradeId: string;
      decision: "approve" | "reject";
      reason?: GradeRejectionReason;
      note?: string;
    }) => {
      await reviewFn({ data: input });
    },
    onSuccess: async (_result, variables) => {
      toast.success(
        variables.decision === "approve"
          ? "Grade approved — the Verified badge updates on the tutor's card."
          : "Grade rejected — the tutor has been notified in app.",
      );
      setRejections((previous) => {
        const next = { ...previous };
        delete next[variables.gradeId];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "grade-queue"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openSlip = async (row: GradeQueueRow) => {
    try {
      const { url } = (await slipUrlFn({ data: { gradeId: row.id } })) as { url: string };
      window.open(url, "_blank", "noopener");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the slip.");
    }
  };

  if (loading) return null;
  if (!hasAnyRole(["admin", "super_admin"])) {
    navigate({ to: "/dashboard", replace: true });
    return null;
  }

  const rows = queueQuery.data ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-[color:var(--ink)]">
            <ShieldCheck className="h-5 w-5 text-[color:var(--brand-link)]" aria-hidden="true" />
            Grade review queue
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Approve or reject tutor grade slips. Approving a grade puts its label on the public card
            with the Verified badge. Slip files are staff-only (short-lived signed links).
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => queueQuery.refetch()}
          disabled={queueQuery.isRefetching}
        >
          <RefreshCw
            className={queueQuery.isRefetching ? "mr-1.5 h-4 w-4 animate-spin" : "mr-1.5 h-4 w-4"}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </div>

      {queueQuery.isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-[color:var(--ink)]/5" aria-hidden />
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-[color:var(--surface-subtle)] px-4 py-8 text-center text-sm text-muted-foreground">
          No pending grades. New slips submitted by tutors appear here, oldest first.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--surface-subtle)] text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Tutor code</th>
                <th className="px-3 py-2.5">Grade text</th>
                <th className="px-3 py-2.5">File</th>
                <th className="px-3 py-2.5">Submitted</th>
                <th className="px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rejection = rejections[row.id] ?? { reason: "" as const, note: "" };
                return (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="px-3 py-3 font-semibold text-[color:var(--ink)]">
                      {row.tutor_code ? (
                        <a
                          href={`/tutors/${row.tutor_code}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[color:var(--brand-link)] hover:underline"
                        >
                          {row.tutor_code}
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="max-w-xs px-3 py-3 text-[color:var(--ink)]">
                      {row.grade_label}
                    </td>
                    <td className="px-3 py-3">
                      {row.has_file ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void openSlip(row)}
                        >
                          <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          View slip
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No slip uploaded</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                      {formatSubmittedAt(row.submitted_at)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={review.isPending}
                            onClick={() => review.mutate({ gradeId: row.id, decision: "approve" })}
                          >
                            Approve
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={review.isPending || !rejection.reason}
                            onClick={() =>
                              review.mutate({
                                gradeId: row.id,
                                decision: "reject",
                                reason: rejection.reason || undefined,
                                note: rejection.note.trim() || undefined,
                              })
                            }
                          >
                            Reject
                          </Button>
                        </div>
                        <div className="min-w-[14rem] space-y-1.5">
                          <Select
                            value={rejection.reason}
                            onValueChange={(value) =>
                              setRejections((previous) => ({
                                ...previous,
                                [row.id]: {
                                  reason: value as GradeRejectionReason,
                                  note: rejection.note,
                                },
                              }))
                            }
                          >
                            <SelectTrigger aria-label="Rejection reason" className="h-8 text-xs">
                              <SelectValue placeholder="Rejection reason (required)" />
                            </SelectTrigger>
                            <SelectContent>
                              {GRADE_REJECTION_REASONS.map((reason) => (
                                <SelectItem key={reason} value={reason}>
                                  {REASON_LABELS[reason]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={rejection.note}
                            placeholder="Optional note"
                            className="h-8 text-xs"
                            maxLength={500}
                            onChange={(event) =>
                              setRejections((previous) => ({
                                ...previous,
                                [row.id]: { reason: rejection.reason, note: event.target.value },
                              }))
                            }
                          />
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

      <p className="text-[11px] leading-5 text-muted-foreground">
        Queue sorts by submitted time, oldest first. Reject requires a reason from the fixed list;
        the tutor gets one in-app notice either way — no WhatsApp, no email. Approving or rejecting
        one grade never changes any other approved grade.
      </p>
    </div>
  );
}
