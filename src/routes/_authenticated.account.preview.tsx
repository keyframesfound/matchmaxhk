import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Rocket, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { PublicProfileView } from "@/features/account/preview/public-profile-view";
import {
  buildPreviewFetchPlan,
  isOwnTutorPreview,
  PREVIEW_OWNER_COLUMNS,
  resolvePreviewCardState,
  shouldShowGoLiveCta,
  type PreviewOwnerRow,
} from "@/features/account/preview/preview-state";
import { useAuth } from "@/features/auth/useAuth";
import { fetchTutorByCode } from "@/features/tutors/queries";
import { PublicTutorCard } from "@/features/tutors/public-tutor-card";
import { TutorSaveButton } from "@/features/tutors/saved-tutors";
import { getTutorInquiryAction } from "@/features/tutors/tutor-display";

/**
 * Issue #104: guided "Preview as parent" sandbox (+ the #294 remainder: the
 * owner sees the visitor's report affordances, guarded). Renders the signed-in
 * tutor's OWN public presence exactly as parents see it, the /tutors grid's
 * PublicTutorCard and the public profile sections, built ONLY from the same
 * public query fns the public surfaces use (fetchTutorByCode), so nothing a
 * parent cannot see can leak. noindex; guests never reach it (the
 * _authenticated layout redirects to /auth).
 */
export const Route = createFileRoute("/_authenticated/account/preview")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Preview as parent | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewPage,
});

function PreviewPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bannerVisible, setBannerVisible] = useState(true);

  // Owner read (RLS tutors_owner_select): the session user's tutors row —
  // publication fields only, never contact data.
  const ownerQuery = useQuery({
    queryKey: ["account", "preview-owner-row", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutors")
        .select(PREVIEW_OWNER_COLUMNS)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as PreviewOwnerRow) ?? null;
    },
    enabled: Boolean(user),
  });

  const ownerRow: PreviewOwnerRow = ownerQuery.data ?? null;
  const plan = buildPreviewFetchPlan(ownerRow);
  const cardState = resolvePreviewCardState(ownerRow);
  const showGoLiveCta = !ownerQuery.isLoading && shouldShowGoLiveCta(cardState);

  // The preview itself fetches through the SAME public fn the /tutors grid and
  // the public profile use, keyed on the owner row's tutor code, so the
  // render below can only ever show what parents see.
  const publicTutorQuery = useQuery({
    queryKey: ["tutor", "byCode", plan.stage === "public_data" ? plan.tutorCode : ""],
    queryFn: () => fetchTutorByCode(plan.stage === "public_data" ? plan.tutorCode : ""),
    enabled: plan.stage === "public_data",
  });

  // Shared with PublicProfileView's identical key, one fetch total.
  const { data: whatsappNumber } = useQuery({
    queryKey: ["settings", "whatsapp_number"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "whatsapp_number")
        .maybeSingle();
      if (error) throw error;
      return typeof data?.value === "string" ? data.value : "";
    },
  });

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">{t("orders.sign_in_required")}</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const liveTutor = plan.stage === "public_data" ? (publicTutorQuery.data ?? null) : null;
  const isLive = Boolean(liveTutor);
  const isLoading =
    ownerQuery.isLoading || (plan.stage === "public_data" && publicTutorQuery.isLoading);
  const isOwn = isOwnTutorPreview(user.id, liveTutor);
  const inquiry = liveTutor
    ? getTutorInquiryAction(liveTutor, whatsappNumber, i18n.language)
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      {/* Dismissible instructional banner (issue #104). */}
      {bannerVisible ? (
        <div className="border-b border-border bg-[color:var(--accent)]/10">
          <div className="mx-auto flex w-full max-w-7xl items-start justify-between gap-3 px-4 py-3 sm:px-6">
            <p className="text-sm leading-relaxed text-[color:var(--ink)]">{t("preview.banner")}</p>
            <button
              type="button"
              aria-label={t("preview.banner_dismiss")}
              onClick={() => setBannerVisible(false)}
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-[color:var(--foreground)]/[0.06] hover:text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      <main className="flex-1">
        {isLoading ? (
          <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-10 sm:px-6" aria-busy="true">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-80 w-full max-w-md rounded-[var(--radius-panel)]" />
            <Skeleton className="h-40 w-full rounded-[var(--radius-panel)]" />
          </div>
        ) : isLive && liveTutor ? (
          <>
            {/* The /tutors grid card, same component, same props shape. */}
            <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6">
              <div className="max-w-md">
                <PublicTutorCard
                  tutor={liveTutor}
                  priceSuffix={t("featured.per_hour")}
                  onOpen={(code) =>
                    void navigate({ to: "/tutors/$tutorCode", params: { tutorCode: code } })
                  }
                  footerAction={
                    <>
                      <TutorSaveButton tutorId={liveTutor.id} compact />
                      {inquiry && inquiry.kind !== "status" ? (
                        <Button
                          asChild
                          className="h-9 rounded-sm bg-[color:var(--surface-invert)] px-4 text-[13px] font-bold text-[color:var(--surface-invert-fg)] hover:bg-[color:var(--surface-invert-hover)]"
                        >
                          <a
                            href={inquiry.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {inquiry.label}
                          </a>
                        </Button>
                      ) : null}
                    </>
                  }
                />
              </div>
            </section>

            {/* The full public profile view, owner-guarded report affordances. */}
            <section className="mt-8">
              <div>
                <PublicProfileView tutor={liveTutor} isOwn={isOwn} />
              </div>
            </section>
          </>
        ) : (
          /* No live card yet (#356: it goes live when /join is submitted). */
          <section className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6">
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <p className="text-sm font-bold text-[color:var(--ink)]">
                {t("preview.empty_title")}
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                {t("preview.empty_body")}
              </p>
              <Button asChild variant="solid" color="blue" className="mt-4 font-bold">
                <Link to="/join">{t("preview.empty_cta")}</Link>
              </Button>
            </div>
          </section>
        )}

        {/* Bottom clearance for the fixed action toolbar plus the mobile
            bottom nav overlay (#145 convention). */}
        <div className="pb-[calc(11rem+env(safe-area-inset-bottom))] lg:pb-28" aria-hidden="true" />
      </main>

      {/* Sticky bottom action toolbar: border-top, no shadow. */}
      <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 border-t border-border bg-[color:var(--surface)] lg:bottom-0">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Button variant="outline" className="font-semibold" asChild>
            <Link to="/dashboard" hash="my-tutor">
              <Pencil className="mr-2 h-4 w-4" aria-hidden />
              {t("preview.edit_cta")}
            </Link>
          </Button>
          {/* #356: the submit/go-live CTA exists only while the card is not
              live, a live card shows no submit button. /join owns the
              existing confirmation flow (ack + verification + publish). */}
          {showGoLiveCta ? (
            <Button variant="solid" color="blue" className="font-bold" asChild>
              <Link to="/join">
                <Rocket className="mr-2 h-4 w-4" aria-hidden />
                {t("preview.submit_cta")}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
