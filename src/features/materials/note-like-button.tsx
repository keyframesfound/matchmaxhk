import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";
import { cn } from "@/lib/utils";
import { getNoteLikeState, setNoteLiked } from "@/features/materials/note-likes.functions";
import {
  NOTE_LIKE_COUNTS_QUERY_KEY,
  NOTE_LIKE_STATE_QUERY_KEY,
} from "@/features/materials/note-like-queries";

/**
 * #726: the like affordance for marketplace note cards and the note page.
 * Data, notification and the toggle server fn live in note-likes.functions.ts;
 * this file is presentation only:
 *
 * - grids load the counts for every visible card in ONE batch call
 *   (useNoteLikeCounts, capped at NOTE_LIKE_BATCH_MAX), never per card;
 * - the tap resolves the viewer's own state lazily (cards only know the
 *   count) and then toggles, so the first tap can never double-like;
 * - signed-out taps hand off to the page's existing auth prompt;
 * - an own note never shows the button (the server refuses it anyway).
 */

/**
 * #726 copy keys, now present in en / zh-HK / zh-CN. The English defaultValue
 * stays as a belt-and-braces fallback so a missing key can never paint raw key
 * text on a marketplace card.
 */
const LIKE_COPY = {
  like: "notes.engage.like",
  liked: "notes.engage.liked",
  failed: "notes.engage.like_failed",
} as const;

export function NoteLikeButton({
  materialId,
  initialCount = 0,
  initialLiked,
  isOwner = false,
  onRequireAuth,
  variant = "card",
  className,
}: {
  materialId: string;
  /** Batch count from the grid, or the note page's own read. */
  initialCount?: number;
  /** Known viewer state (note page). Omitted on cards, resolved on first tap. */
  initialLiked?: boolean;
  isOwner?: boolean;
  onRequireAuth: () => void;
  variant?: "card" | "detail";
  className?: string;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [optimistic, setOptimistic] = useState<{ liked: boolean; count: number } | null>(null);
  // The server refuses a self-like; the card has no owner signal, so the
  // refusal retires the button instead of shouting at the owner.
  const [refused, setRefused] = useState(false);

  const liked = optimistic?.liked ?? initialLiked ?? false;
  const count = optimistic?.count ?? initialCount;

  const mutation = useMutation({
    mutationFn: async () => {
      let current = liked;
      // Cards ship counts only. Resolve the caller's state once, on the tap,
      // never on render (that would be one request per card).
      if (initialLiked === undefined) {
        const known = await queryClient.ensureQueryData({
          queryKey: [...NOTE_LIKE_STATE_QUERY_KEY, materialId],
          queryFn: () => getNoteLikeState({ data: { materialId } }),
          staleTime: 30_000,
        });
        current = known.liked;
      }
      return setNoteLiked({ data: { materialId, liked: !current } });
    },
    onSuccess: (next) => {
      setOptimistic(next);
      void queryClient.invalidateQueries({
        queryKey: [...NOTE_LIKE_STATE_QUERY_KEY, materialId],
      });
      void queryClient.invalidateQueries({ queryKey: NOTE_LIKE_COUNTS_QUERY_KEY });
    },
    onError: (error) => {
      if (error instanceof Error && error.message.includes("SELF_LIKE_FORBIDDEN")) {
        setRefused(true);
        return;
      }
      toast.error(
        error instanceof Error
          ? error.message
          : t(LIKE_COPY.failed, { defaultValue: "Could not update your like." }),
      );
    },
  });

  if (isOwner || refused) return null;

  const label = liked
    ? t(LIKE_COPY.liked, { defaultValue: "Liked" })
    : t(LIKE_COPY.like, { defaultValue: "Like" });
  const ariaLabel = `${label} · ${count}`;

  const onClick = () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (mutation.isPending) return;
    mutation.mutate();
  };

  const heart = (
    <Heart
      className={cn("h-4 w-4 shrink-0", liked ? "fill-current text-rose-500" : "text-current")}
      aria-hidden
    />
  );

  if (variant === "detail") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-pressed={liked}
        aria-label={ariaLabel}
        disabled={mutation.isPending}
        onClick={onClick}
        className={cn("gap-1.5", className)}
      >
        {heart}
        <span className="font-semibold tabular-nums">{count}</span>
      </Button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-label={ariaLabel}
      disabled={mutation.isPending}
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1 rounded-full bg-card/90 px-2 text-[color:var(--ink)] transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
        className,
      )}
    >
      {heart}
      <span className="text-xs font-semibold tabular-nums">{count}</span>
    </button>
  );
}
