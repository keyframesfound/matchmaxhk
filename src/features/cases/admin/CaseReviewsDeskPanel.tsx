import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Lock, Star } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConsolePanel } from "@/components/ui/console-panel";
import {
  listCaseReviewsForDesk,
  setCaseReviewHidden,
  type DeskCaseReviewRow,
} from "@/features/cases/rating.functions";

const DIRECTION_LABEL: Record<DeskCaseReviewRow["direction"], string> = {
  parent_to_tutor: "Parent → tutor",
  tutor_to_parent: "Tutor → parent",
};

const STATUS_CHIP: Record<
  DeskCaseReviewRow["status"],
  { label: string; variant: "success" | "warning" | "outline" }
> = {
  visible: { label: "Published", variant: "success" },
  held: { label: "Held", variant: "warning" },
  hidden: { label: "Hidden", variant: "outline" },
};

function stars(rating: number) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return `${"★".repeat(filled)}${"☆".repeat(5 - filled)}`;
}

/**
 * #794 AC-649-2 — the two artefacts the ratings loop writes for the desk and
 * nothing else reads: the author's private note, and a review the contact
 * filter or a moderator put on hold. Tutor→parent ratings are never public, so
 * this panel is their only audience; hiding here removes a row from the public
 * aggregate exactly as a moderator action would.
 */
export function CaseReviewsDeskPanel({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const reviews = useQuery({
    queryKey: ["case-desk-reviews", caseId],
    queryFn: () => listCaseReviewsForDesk({ data: { caseId } }),
  });

  const setHidden = useMutation({
    mutationFn: (input: { reviewId: string; hidden: boolean }) =>
      setCaseReviewHidden({ data: input }),
    onSuccess: (_result, input) => {
      toast.success(input.hidden ? "Review hidden" : "Review restored");
      void queryClient.invalidateQueries({ queryKey: ["case-desk-reviews", caseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = reviews.data ?? [];
  if (reviews.isLoading || rows.length === 0) return null;

  return (
    <ConsolePanel>
      <h2 className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Star className="h-3.5 w-3.5" aria-hidden="true" />
        Ratings & private notes
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        Tutor ratings of parents are never public. Hiding a review keeps the record and the note.
      </p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => {
          const chip = STATUS_CHIP[row.status];
          const hidden = row.status === "hidden";
          const pending = setHidden.isPending && setHidden.variables?.reviewId === row.id;

          return (
            <li key={row.id} className="rounded-lg border border-[color:var(--ink)]/10 px-3 py-2.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="text-xs font-semibold text-[color:var(--ink)]">
                  {row.author_display_line}
                </p>
                <span
                  className="text-xs text-[color:var(--ink)]"
                  aria-label={`Rated ${row.rating} out of 5`}
                >
                  <span aria-hidden="true">{stars(row.rating)}</span>
                  <span className="ml-1 font-medium">{row.rating}</span>
                </span>
                <Badge variant={chip.variant}>{chip.label}</Badge>
                {row.status === "held" && row.held_reason ? (
                  <span className="text-[11px] text-muted-foreground">
                    {row.held_reason.replace(/_/g, " ")}
                  </span>
                ) : null}
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {DIRECTION_LABEL[row.direction]}
                </span>
              </div>

              {row.comment ? (
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--ink)]">
                  {row.comment}
                </p>
              ) : null}

              {row.desk_note ? (
                <div className="mt-2 rounded-lg border border-[color:var(--ink)]/15 bg-[color:var(--foreground)]/[0.04] px-3 py-2">
                  <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-[color:var(--ink)]">
                    <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                    Private note to the desk
                    {row.desk_note_at ? (
                      <span
                        className="ml-auto font-normal text-muted-foreground"
                        // Relative for triage, exact on hover: a private note is
                        // an audit artefact, so the underlying timestamp must be
                        // readable without asking anyone.
                        title={new Date(row.desk_note_at).toISOString()}
                      >
                        Added {formatDistanceToNow(new Date(row.desk_note_at), { addSuffix: true })}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[color:var(--ink)]">
                    {row.desk_note}
                  </p>
                </div>
              ) : null}

              <div className="mt-2">
                <Button
                  size="sm"
                  variant={hidden ? "ghost" : "outline"}
                  disabled={setHidden.isPending}
                  onClick={() => setHidden.mutate({ reviewId: row.id, hidden: !hidden })}
                >
                  {pending ? "Saving" : hidden ? "Restore" : "Hide review"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </ConsolePanel>
  );
}
