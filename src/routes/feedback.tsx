import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { cn } from "@/lib/utils";

type FeedbackRole = "parent_student" | "tutor";

type StarRatingProps = {
  value: number;
  onChange: (value: number) => void;
  label: string;
};

/** Accessible 5-star row: radio group semantics over star buttons. */
function StarRating({ value, onChange, label }: StarRatingProps) {
  const { t } = useTranslation();
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={t("feedback.star_label_other", { count: star })}
          onClick={() => onChange(star)}
          className={cn(
            "text-2xl leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/40",
            star <= value
              ? "text-amber-500"
              : "text-[color:var(--foreground)]/20 hover:text-amber-300",
          )}
        >
          ★
        </button>
      ))}
    </div>
  );
}

type RatingKey = "speed" | "smoothness" | "service";

/**
 * Issue #148: platform-level service quality feedback form.
 * Screen 1 = identity routing; Screen 2 = role-specific form. Submissions go
 * to the service_feedback table with the role tagged for admin routing.
 */
export default function Feedback() {
  const { t, i18n } = useTranslation();
  const [role, setRole] = useState<FeedbackRole | null>(null);
  const [ratings, setRatings] = useState<Record<RatingKey, number>>({
    speed: 0,
    smoothness: 0,
    service: 0,
  });
  const [topConcern, setTopConcern] = useState("");
  const [additional, setAdditional] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const prompts: Array<{ key: RatingKey; prompt: string }> =
    role === "tutor"
      ? [
          { key: "speed", prompt: t("feedback.tutor_speed_prompt") },
          { key: "smoothness", prompt: t("feedback.tutor_smoothness_prompt") },
          { key: "service", prompt: t("feedback.tutor_service_prompt") },
        ]
      : [
          { key: "speed", prompt: t("feedback.parent_speed_prompt") },
          { key: "smoothness", prompt: t("feedback.parent_smoothness_prompt") },
          { key: "service", prompt: t("feedback.parent_service_prompt") },
        ];

  const valid =
    ratings.speed > 0 &&
    ratings.smoothness > 0 &&
    ratings.service > 0 &&
    topConcern.trim().length > 0;

  async function submit() {
    if (!role || !valid) return;
    setSubmitting(true);
    const { error } = await supabase.from("service_feedback").insert({
      role,
      speed_rating: ratings.speed,
      smoothness_rating: ratings.smoothness,
      service_rating: ratings.service,
      top_concern: topConcern.trim().slice(0, 500),
      additional_comments: additional.trim() || null,
      locale: i18n.language,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSubmitted(true);
    window.scrollTo(0, 0);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
          {submitted ? (
            <div className="rounded-[var(--radius-panel)] border border-border bg-card p-8 text-center sm:p-12">
              <p className="text-4xl" aria-hidden>
                🙏
              </p>
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-[color:var(--ink)]">
                {t("feedback.thanks_title")}
              </h1>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                {t("feedback.thanks_desc")}
              </p>
              <Button asChild variant="outline" className="mt-6">
                <Link to="/">{t("feedback.back_home")}</Link>
              </Button>
            </div>
          ) : role === null ? (
            <section aria-labelledby="feedback-title" className="text-center">
              <h1
                id="feedback-title"
                className="text-3xl font-bold tracking-tight text-[color:var(--ink)] sm:text-4xl"
              >
                {t("feedback.routing_title")}
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t("feedback.routing_desc")}
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {(
                  [
                    { value: "parent_student", labelKey: "feedback.role_parent" },
                    { value: "tutor", labelKey: "feedback.role_tutor" },
                  ] as Array<{ value: FeedbackRole; labelKey: string }>
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRole(option.value)}
                    className="rounded-[var(--radius-panel)] border border-border bg-card px-6 py-8 text-base font-bold text-[color:var(--ink)] transition-colors hover:border-[color:var(--foreground)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/40"
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section aria-labelledby="feedback-form-title">
              <p className="text-xs font-medium text-[color:var(--ink)]/65">
                {t("feedback.form_eyebrow")}
              </p>
              <h1
                id="feedback-form-title"
                className="mt-2 text-3xl font-bold tracking-tight text-[color:var(--ink)] sm:text-4xl"
              >
                {t("feedback.form_title")}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {role === "tutor" ? t("feedback.tutor_subtext") : t("feedback.parent_subtext")}
              </p>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
                className="mt-8 space-y-7"
              >
                {prompts.map(({ key, prompt }) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-[color:var(--ink)]">{prompt}</Label>
                    <StarRating
                      value={ratings[key]}
                      onChange={(value) => setRatings((prev) => ({ ...prev, [key]: value }))}
                      label={prompt}
                    />
                  </div>
                ))}

                <div className="space-y-2">
                  <Label htmlFor="feedback-concern" className="text-[color:var(--ink)]">
                    {role === "tutor"
                      ? t("feedback.tutor_concern_label")
                      : t("feedback.parent_concern_label")}{" "}
                    <span className="text-destructive" aria-hidden>
                      *
                    </span>
                  </Label>
                  <Input
                    id="feedback-concern"
                    required
                    maxLength={500}
                    value={topConcern}
                    onChange={(event) => setTopConcern(event.target.value)}
                    placeholder={
                      role === "tutor"
                        ? t("feedback.tutor_concern_placeholder")
                        : t("feedback.parent_concern_placeholder")
                    }
                    className="h-11 rounded-xl bg-[color:var(--surface)]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feedback-additional" className="text-[color:var(--ink)]">
                    {role === "tutor"
                      ? t("feedback.tutor_additional_label")
                      : t("feedback.parent_additional_label")}
                  </Label>
                  <textarea
                    id="feedback-additional"
                    rows={5}
                    value={additional}
                    onChange={(event) => setAdditional(event.target.value)}
                    className="w-full rounded-xl border border-input bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--ink)] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/40"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={submitting || !valid} className="font-bold">
                    {submitting ? t("feedback.submitting") : t("feedback.submit")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setRole(null)}
                    className="text-[color:var(--ink)]/70"
                  >
                    {t("feedback.switch_role")}
                  </Button>
                </div>
              </form>
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
