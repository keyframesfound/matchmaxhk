import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";

/**
 * Issues #83 + #105 (+ reviews half of #116): admin-only review curation in
 * the Tutor Editor. Reviews are collected off-platform (Google Form via the
 * concierge) and entered/published here — the client-facing site renders the
 * published ones read-only. RLS lets only admins write; tutors see nothing.
 */

export type AdminTutorReview = {
  id: string;
  rating: number;
  public_review: string | null;
  reviewer_display_name: string;
  student_grade_school: string | null;
  is_published: boolean;
  created_at: string;
};

const EMPTY_FORM = {
  reviewer_display_name: "",
  student_grade_school: "",
  public_review: "",
  rating: 5,
  is_published: true,
};

export function TutorReviewsAdmin({ tutorId }: { tutorId: string }) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [nameError, setNameError] = React.useState<string | null>(null);

  const reviewsQuery = useQuery({
    queryKey: ["admin", "tutor-reviews", tutorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_reviews")
        .select(
          "id, rating, public_review, reviewer_display_name, student_grade_school, is_published, created_at",
        )
        .eq("tutor_id", tutorId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AdminTutorReview[];
    },
  });

  const insertReview = useMutation({
    mutationFn: async () => {
      if (!form.reviewer_display_name.trim()) {
        throw new Error("Reviewer display name is required.");
      }
      const { error } = await supabase.from("tutor_reviews").insert({
        tutor_id: tutorId,
        rating: form.rating,
        public_review: form.public_review.trim() || null,
        reviewer_display_name: form.reviewer_display_name.trim(),
        student_grade_school: form.student_grade_school.trim() || null,
        is_verified: true,
        is_published: form.is_published,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(form.is_published ? "Review published" : "Review saved as hidden");
      setForm(EMPTY_FORM);
      setNameError(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "tutor-reviews", tutorId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setPublished = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      const { error } = await supabase
        .from("tutor_reviews")
        .update({ is_published: isPublished } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review visibility updated");
      void queryClient.invalidateQueries({ queryKey: ["admin", "tutor-reviews", tutorId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteReview = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tutor_reviews").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review deleted");
      void queryClient.invalidateQueries({ queryKey: ["admin", "tutor-reviews", tutorId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviews = reviewsQuery.data ?? [];

  return (
    <div className="space-y-5">
      {/* Existing reviews */}
      {reviews.length > 0 ? (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="rounded-xl border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[color:var(--ink)]">
                    {review.reviewer_display_name}
                    {review.student_grade_school ? (
                      <span className="ml-2 text-xs font-medium text-muted-foreground">
                        {review.student_grade_school}
                      </span>
                    ) : null}
                  </p>
                  <span className="mt-0.5 inline-flex items-center gap-0.5" aria-hidden>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={
                          star <= review.rating
                            ? "h-3.5 w-3.5 fill-[color:var(--brand-link)] text-[color:var(--brand-link)]"
                            : "h-3.5 w-3.5 text-border"
                        }
                        strokeWidth={1.5}
                      />
                    ))}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Checkbox
                      checked={review.is_published}
                      disabled={setPublished.isPending}
                      onCheckedChange={(checked) =>
                        setPublished.mutate({ id: review.id, isPublished: checked === true })
                      }
                      aria-label={`Publish review by ${review.reviewer_display_name}`}
                    />
                    Published
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-muted-foreground hover:text-red-600"
                    disabled={deleteReview.isPending}
                    onClick={() => deleteReview.mutate(review.id)}
                    aria-label={`Delete review by ${review.reviewer_display_name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {review.public_review ? (
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[color:var(--ink)]">
                  {review.public_review}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No reviews yet. Add verified parent/student feedback below.
        </p>
      )}

      {/* Add-review form */}
      <div className="space-y-3 rounded-xl border border-[color:var(--ink)]/10 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Add a review
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="review-name">Reviewer display name *</Label>
            <Input
              id="review-name"
              value={form.reviewer_display_name}
              onChange={(e) => {
                setForm({ ...form, reviewer_display_name: e.target.value });
                if (e.target.value.trim()) setNameError(null);
              }}
              placeholder="Mrs. Wong (Parent)"
              aria-invalid={Boolean(nameError)}
            />
            {nameError ? <p className="text-xs text-red-600">{nameError}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="review-grade">Student grade &amp; school</Label>
            <Input
              id="review-grade"
              value={form.student_grade_school}
              onChange={(e) => setForm({ ...form, student_grade_school: e.target.value })}
              placeholder="Year 12, South Island School"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Rating</Label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setForm({ ...form, rating: star })}
                aria-label={`${star} star${star > 1 ? "s" : ""}`}
                aria-pressed={form.rating === star}
                className="p-0.5"
              >
                <Star
                  className={
                    star <= form.rating
                      ? "h-5 w-5 fill-[color:var(--brand-link)] text-[color:var(--brand-link)]"
                      : "h-5 w-5 text-border"
                  }
                  strokeWidth={1.5}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="review-text">Testimonial</Label>
          <Textarea
            id="review-text"
            value={form.public_review}
            onChange={(e) => setForm({ ...form, public_review: e.target.value })}
            placeholder="The public quote shown on the tutor's profile…"
            rows={3}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[color:var(--ink)]">
            <Checkbox
              checked={form.is_published}
              onCheckedChange={(checked) => setForm({ ...form, is_published: checked === true })}
            />
            Publish immediately
          </label>
          <Button
            type="button"
            size="sm"
            disabled={insertReview.isPending}
            onClick={() => {
              if (!form.reviewer_display_name.trim()) {
                setNameError("Reviewer display name is required.");
                return;
              }
              insertReview.mutate();
            }}
          >
            Add review
          </Button>
        </div>
      </div>
    </div>
  );
}
