import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Download, Heart, Link2, Scale, Share2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StarRating } from "@/components/ui/StarRating";
import { cn } from "@/lib/utils";
import { shareOrCopy } from "@/lib/share";
import { useAuth } from "@/features/auth/useAuth";
import {
  getMyNoteReviewState,
  getMySavedNoteIds,
  getNoteReviews,
  getSimilarNotes,
  setNoteSaved,
  submitNoteReview,
  type SimilarNote,
} from "@/features/materials/note-engagement.functions";
import {
  getNoteDeliverables,
  getNoteExtrasSummary,
} from "@/features/materials/note-uploads.functions";
import { REVIEW_COMMENT_MAX } from "@/features/materials/note-reviews";
import { formatBytes } from "@/features/materials/note-file-tools";
import { formatMaterialTypeLabel } from "@/features/materials/queries";
import type { PublicNote } from "@/features/materials/notes.functions";

/**
 * Notes upload v2: the note page's engagement blocks (Taobao / Carousell
 * style): save + share, what's included, buyer downloads for extra files,
 * verified-buyer reviews, similar notes with a side-by-side compare, and a
 * "sell your own notes" entry point.
 */

export const SAVED_NOTES_QUERY_KEY = ["notes", "saved-ids"] as const;

/** Save (heart) toggle. Signed-out clicks call onRequireAuth. */
export function SaveNoteButton({
  materialId,
  onRequireAuth,
  className,
  compact = false,
}: {
  materialId: string;
  onRequireAuth: () => void;
  className?: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const savedQuery = useQuery({
    queryKey: [...SAVED_NOTES_QUERY_KEY, user?.id],
    queryFn: () => getMySavedNoteIds(),
    enabled: Boolean(user),
    staleTime: 60_000,
  });
  const saved = (savedQuery.data ?? []).includes(materialId);
  const mutation = useMutation({
    mutationFn: (next: boolean) => setNoteSaved({ data: { materialId, saved: next } }),
    onSuccess: (_d, next) => {
      queryClient.setQueryData<string[]>([...SAVED_NOTES_QUERY_KEY, user?.id], (prev = []) =>
        next
          ? [materialId, ...prev.filter((id) => id !== materialId)]
          : prev.filter((id) => id !== materialId),
      );
      toast.success(next ? t("notes.engage.saved") : t("notes.engage.unsaved"));
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("notes.engage.save_failed")),
  });
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={saved}
      className={className}
      disabled={mutation.isPending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!user) {
          onRequireAuth();
          return;
        }
        mutation.mutate(!saved);
      }}
    >
      <Heart
        className={cn("h-4 w-4", !compact && "mr-1.5", saved && "fill-current text-destructive")}
        aria-hidden
      />
      {compact ? <span className="sr-only">{t("notes.engage.save")}</span> : null}
      {compact ? null : saved ? t("notes.engage.saved_label") : t("notes.engage.save")}
    </Button>
  );
}

export function ShareNoteButton({ note }: { note: PublicNote }) {
  const { t } = useTranslation();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() =>
        void shareOrCopy(
          {
            title: note.title,
            text: note.summary ?? note.title,
            url: `${window.location.origin}/notes/${note.slug ?? note.id}`,
          },
          t("notes.engage.link_copied"),
          t("notes.engage.share_failed"),
        )
      }
    >
      <Share2 className="mr-1.5 h-4 w-4" aria-hidden />
      {t("notes.engage.share")}
    </Button>
  );
}

/** Public "what's included" list (names / sizes only). */
export function NoteIncludedFiles({ materialId }: { materialId: string }) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["notes", "extras-summary", materialId],
    queryFn: () => getNoteExtrasSummary({ data: { materialId } }),
  });
  const items = query.data ?? [];
  if (items.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold">{t("notes.engage.included_title")}</h2>
      <ul className="space-y-1.5 rounded-xl border border-border bg-card p-4 text-sm">
        <li className="flex items-center gap-2">
          <span className="rounded border border-border px-1.5 text-[11px] font-semibold">PDF</span>
          <span>{t("notes.engage.included_main")}</span>
        </li>
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            <span className="rounded border border-border px-1.5 text-[11px] font-semibold">
              {t(`notes.format.${item.format ?? "file"}`)}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {item.kind === "link"
                ? t("notes.engage.included_link")
                : (item.label ?? t(`notes.format.${item.format ?? "file"}`))}
            </span>
            {item.sizeBytes ? (
              <span className="text-xs text-muted-foreground">{formatBytes(item.sizeBytes)}</span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t("notes.engage.included_after_purchase")}</p>
    </section>
  );
}

/** Buyer / owner downloads for the extra files + links. */
export function NoteDeliverablesPanel({ materialId }: { materialId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["notes", "deliverables", materialId, user?.id],
    queryFn: () => getNoteDeliverables({ data: { materialId } }),
    enabled: Boolean(user),
    staleTime: 30 * 60_000,
  });
  const data = query.data;
  if (!data?.hasAccess || data.extras.length === 0) return null;
  return (
    <div className="space-y-2 rounded-2xl border border-success/40 bg-success/5 p-4">
      <p className="text-sm font-bold">{t("notes.engage.your_files")}</p>
      <ul className="space-y-1.5">
        {data.extras.map((item) => (
          <li key={item.id}>
            <a
              href={item.url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--brand-link)] hover:underline"
            >
              {item.kind === "link" ? (
                <Link2 className="h-4 w-4" aria-hidden />
              ) : (
                <Download className="h-4 w-4" aria-hidden />
              )}
              {item.label || item.fileName || item.url}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t("notes.engage.your_files_hint")}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export function NoteReviewsSection({
  materialId,
  isOwner,
}: {
  materialId: string;
  isOwner: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const reviewsQuery = useQuery({
    queryKey: ["notes", "reviews", materialId],
    queryFn: () => getNoteReviews({ data: { materialId } }),
  });
  const stateQuery = useQuery({
    queryKey: ["notes", "review-state", materialId, user?.id],
    queryFn: () => getMyNoteReviewState({ data: { materialId } }),
    enabled: Boolean(user) && !isOwner,
  });
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      submitNoteReview({ data: { materialId, rating, comment: comment.trim() || null } }),
    onSuccess: () => {
      toast.success(t("notes.reviews.posted"));
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["notes", "reviews", materialId] });
      void queryClient.invalidateQueries({ queryKey: ["notes", "review-state", materialId] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("notes.reviews.failed")),
  });

  const summary = reviewsQuery.data?.summary;
  const reviews = reviewsQuery.data?.reviews ?? [];
  const state = stateQuery.data;
  const mine = state?.myReview ?? null;
  const showForm = Boolean(state?.canReview) && (!mine || editing);
  const dateFmt = new Intl.DateTimeFormat(i18n.language === "zh-HK" ? "zh-HK" : "en-GB", {
    dateStyle: "medium",
  });

  return (
    <section className="space-y-4" id="reviews">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{t("notes.reviews.title")}</h2>
        {summary && summary.count > 0 ? (
          <div className="flex items-center gap-2 text-sm">
            <StarRating value={summary.average ?? 0} readOnly size={16} />
            <span className="font-semibold">{summary.average?.toFixed(1)}</span>
            <span className="text-muted-foreground">
              {t("notes.reviews.count", { count: summary.count })}
            </span>
          </div>
        ) : null}
      </div>

      {showForm ? (
        <form
          className="space-y-3 rounded-xl border border-border bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (rating >= 1) mutation.mutate();
          }}
        >
          <p className="text-sm font-semibold">{t("notes.reviews.form_title")}</p>
          <StarRating
            value={rating}
            onChange={setRating}
            label={t("notes.reviews.rating_label")}
            size={24}
          />
          <textarea
            value={comment}
            maxLength={REVIEW_COMMENT_MAX}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder={t("notes.reviews.comment_placeholder")}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:border-[color:var(--ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              variant="solid"
              color="neutral"
              disabled={rating < 1 || mutation.isPending}
            >
              {t("notes.reviews.submit")}
            </Button>
            {editing ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
                {t("notes.reviews.cancel")}
              </Button>
            ) : null}
          </div>
        </form>
      ) : mine ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-4 text-sm">
          <span>{t("notes.reviews.you_rated", { rating: mine.rating })}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setRating(mine.rating);
              setComment(mine.comment ?? "");
              setEditing(true);
            }}
          >
            {t("notes.reviews.edit")}
          </Button>
        </div>
      ) : !isOwner ? (
        <p className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          {t("notes.reviews.buyers_only")}
        </p>
      ) : null}

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("notes.reviews.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {reviews.slice(0, 20).map((review) => (
            <li key={review.id} className="space-y-1 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <StarRating value={review.rating} readOnly size={14} />
                <span className="font-semibold text-success">{t("notes.reviews.verified")}</span>
                <span>· {dateFmt.format(new Date(review.createdAt))}</span>
              </div>
              {review.comment ? (
                <p className="whitespace-pre-line text-sm leading-relaxed">{review.comment}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Similar notes + compare
// ---------------------------------------------------------------------------

export function SimilarNotesSection({ note }: { note: PublicNote }) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["notes", "similar", note.id],
    queryFn: () => getSimilarNotes({ data: { materialId: note.id } }),
  });
  const similar = query.data ?? [];
  if (similar.length === 0) return null;

  const toggle = (id: string) =>
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 3 ? prev : [...prev, id],
    );
  const compared: (PublicNote & { rating?: SimilarNote["rating"] })[] = [
    note,
    ...similar.filter((s) => picked.includes(s.id)),
  ];

  return (
    <section className="mt-14 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{t("notes.engage.similar_title")}</h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={picked.length === 0}
          onClick={() => setOpen(true)}
        >
          <Scale className="mr-1.5 h-4 w-4" aria-hidden />
          {t("notes.engage.compare_button", { count: picked.length })}
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {similar.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5"
          >
            <Link to="/notes/$slug" params={{ slug: item.slug ?? item.id }} className="group">
              <p className="font-semibold group-hover:underline">{item.title}</p>
              {item.summary ? (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.summary}</p>
              ) : null}
            </Link>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {item.priceHkd === 0
                  ? t("notes.card.free")
                  : t("notes.price", { amount: item.priceHkd })}
              </span>
              {item.rating.count > 0 ? (
                <span>
                  ★ {item.rating.average?.toFixed(1)} ({item.rating.count})
                </span>
              ) : null}
              {item.pageCount != null ? (
                <span>{t("notes.page_count", { count: item.pageCount })}</span>
              ) : null}
            </div>
            <label className="mt-auto flex cursor-pointer items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={picked.includes(item.id)}
                onChange={() => toggle(item.id)}
                disabled={!picked.includes(item.id) && picked.length >= 3}
              />
              {t("notes.engage.add_to_compare")}
            </label>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("notes.engage.compare_title")}</DialogTitle>
            <DialogDescription>{t("notes.engage.compare_description")}</DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <tbody>
                {(
                  [
                    ["title_row", (n: (typeof compared)[number]) => n.title],
                    [
                      "price",
                      (n: (typeof compared)[number]) =>
                        n.priceHkd === 0 ? t("notes.card.free") : `HK$${n.priceHkd}`,
                    ],
                    [
                      "type",
                      (n: (typeof compared)[number]) => formatMaterialTypeLabel(n.materialType, t),
                    ],
                    ["curriculum", (n: (typeof compared)[number]) => n.curriculumTag || "-"],
                    ["subject", (n: (typeof compared)[number]) => n.subjectTag ?? "-"],
                    [
                      "category",
                      (n: (typeof compared)[number]) =>
                        n.subcategory ? t(`notes.subcategory.${n.subcategory}`) : "-",
                    ],
                    [
                      "pages",
                      (n: (typeof compared)[number]) =>
                        n.pageCount != null ? String(n.pageCount) : "-",
                    ],
                    [
                      "language",
                      (n: (typeof compared)[number]) =>
                        n.contentLanguage ? t(`notes.language.${n.contentLanguage}`) : "-",
                    ],
                    [
                      "rating",
                      (n: (typeof compared)[number]) =>
                        n.rating && n.rating.count > 0
                          ? `★ ${n.rating.average?.toFixed(1)} (${n.rating.count})`
                          : "-",
                    ],
                    ["sold", (n: (typeof compared)[number]) => String(n.soldCount)],
                    ["tutor", (n: (typeof compared)[number]) => n.tutorName],
                  ] as const
                ).map(([key, value]) => (
                  <tr key={key} className="border-b border-border last:border-0">
                    <th className="w-28 py-2 pr-3 align-top text-xs font-semibold text-muted-foreground">
                      {t(`notes.engage.compare_${key}`)}
                    </th>
                    {compared.map((n, index) => (
                      <td
                        key={n.id}
                        className={cn("py-2 pr-3 align-top", index === 0 && "font-semibold")}
                      >
                        {key === "title_row" ? (
                          <Link
                            to="/notes/$slug"
                            params={{ slug: n.slug ?? n.id }}
                            className="text-[color:var(--brand-link)] hover:underline"
                          >
                            {value(n)}
                          </Link>
                        ) : (
                          value(n)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** "Sell your notes" entry point shown on notes pages. */
export function SellNotesCta({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-base font-bold">{t("notes.cta.sell_title")}</p>
        <p className="text-sm text-muted-foreground">{t("notes.cta.sell_body")}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button asChild variant="solid" color="neutral" className="font-semibold">
          <Link to="/account/notes/new">
            <Upload className="mr-2 h-4 w-4" aria-hidden />
            {t("notes.cta.sell_button")}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/guide/notes">{t("notes.cta.guide_button")}</Link>
        </Button>
      </div>
    </div>
  );
}
