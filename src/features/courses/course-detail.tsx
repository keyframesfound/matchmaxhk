import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import {
  Download,
  Eye,
  FileText,
  GraduationCap,
  ListVideo,
  Lock,
  PlayCircle,
  ShoppingCart,
} from "lucide-react";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";
import { AuthGateDialog } from "@/features/auth/AuthGateDialog";
import { formatMoney } from "@/lib/money";
import { shopKindLabel } from "@/features/materials/material-card";
import { getPublicListing } from "@/features/materials/listings.functions";
import { getCourseAccess, COURSE_LOCKED_ERROR } from "@/features/materials/orders.functions";
import { startCheckout } from "@/features/materials/checkout.functions";
import { TermsGateCheckbox } from "@/features/legal/TermsGateCheckbox";
import type { PublicNote } from "@/features/materials/notes.functions";
import { ReportMenuButton } from "@/features/reports/report-button";

/**
 * #392: the Video / General Course detail page (/notes/<slug> rails,
 * course branch). Unowned: locked lesson rows (title + provider chip +
 * lock) with the Buy CTA, the normal startCheckout works as-is and the
 * order page links back here. Owner of a DELIVERED order: inline 16:9
 * embeds (lazy) + per-lesson PDF download buttons via getCourseAccess.
 * Embed-only: unlisted YouTube (youtube-nocookie) / Vimeo links; no video
 * file was ever uploaded.
 */

export function CourseDetailPage({ note }: { note: PublicNote }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [gateOpen, setGateOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsGateInvalid, setTermsGateInvalid] = useState(false);

  const isOwner = Boolean(user && note.tutorUserId && user.id === note.tutorUserId);

  // Public lesson meta (titles + provider chips + hasPdf only, never the
  // embed URLs) drives the locked list; the buyer gate drives the embeds.
  const slug = note.slug ?? note.id;
  const listingQuery = useQuery({
    queryKey: ["shop-listing", slug],
    queryFn: () => getPublicListing({ data: { slug } }),
  });
  const publicLessons = listingQuery.data?.lessons ?? [];

  // Access is a buyer gate: signed-in non-owners ask the server whether a
  // DELIVERED order unlocks the lessons. The typed COURSE_LOCKED_ERROR is
  // the "locked" state, not a crash.
  const accessQuery = useQuery({
    queryKey: ["course-access", note.id, user?.id],
    queryFn: () => getCourseAccess({ data: { materialId: note.id } }),
    enabled: Boolean(user) && !isOwner,
    retry: false,
  });
  const access = accessQuery.error?.message === COURSE_LOCKED_ERROR ? null : accessQuery.data;
  const unlocked = Boolean(access);

  const checkoutMutation = useMutation({
    mutationFn: () => startCheckout({ data: { materialId: note.id, legalAgreed: true } }),
    onSuccess: ({ orderId }) => {
      void navigate({ to: `/orders/${orderId}` });
    },
    onError: () => setGateOpen(true),
  });

  const guard = () => {
    if (!user) {
      setGateOpen(true);
      return;
    }
    if (!termsAccepted) {
      setTermsGateInvalid(true);
      return;
    }
    checkoutMutation.mutate();
  };

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:gap-10">
          <section className="min-w-0 space-y-6">
            <header className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                  {shopKindLabel(note.materialType, t)}
                </span>
                {note.curriculumTag ? (
                  <span className="rounded-md border border-border px-2.5 py-0.5 text-xs font-semibold text-foreground/80">
                    {note.curriculumTag}
                  </span>
                ) : null}
                {note.subjectTag ? (
                  <span className="rounded-md border border-border px-2.5 py-0.5 text-xs font-semibold text-foreground/80">
                    {note.subjectTag}
                  </span>
                ) : null}
              </div>
              <h1 className="text-2xl font-bold leading-tight tracking-normal sm:text-3xl">
                {note.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <a
                  href={`/tutors/${note.tutorCode}`}
                  className="inline-flex items-center gap-1.5 font-medium text-[color:var(--brand-link)] hover:underline"
                >
                  <GraduationCap className="h-4 w-4" aria-hidden />
                  {note.tutorName}
                </a>
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="h-4 w-4" aria-hidden />
                  {t("notes.views", { count: note.viewCount })}
                </span>
                {note.soldCount > 0 ? (
                  <span>{t("shop.card.sold_count", { count: note.soldCount })}</span>
                ) : null}
              </div>
            </header>

            {note.description ? (
              <section className="space-y-2">
                <h2 className="text-lg font-bold">{t("notes.contents_title")}</h2>
                <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-foreground/90">
                  {note.description}
                </p>
              </section>
            ) : null}

            {/* Lessons */}
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <ListVideo className="h-5 w-5" aria-hidden />
                {t("shop.course.lessons_title")}
              </h2>
              {isOwner ? (
                <p className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
                  {t("shop.course.owner_note")}
                </p>
              ) : null}
              {accessQuery.isError && accessQuery.error.message !== COURSE_LOCKED_ERROR ? (
                <p className="rounded-md border border-[#B42318]/30 bg-[#B42318]/5 p-4 text-sm text-destructive">
                  {accessQuery.error.message}
                </p>
              ) : null}
              {listingQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
              ) : publicLessons.length === 0 ? (
                <p className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
                  {t("shop.course.locked_empty")}
                </p>
              ) : (
                <ol className="space-y-3">
                  {publicLessons.map((lesson) => {
                    const accessLesson = access?.lessons.find(
                      (entry) => entry.id === lesson.id || entry.position === lesson.position,
                    );
                    return (
                      <li
                        key={lesson.id}
                        className="space-y-2 rounded-lg border border-border bg-card p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-bold text-[color:var(--ink)]">
                            {lesson.position}. {lesson.title}
                          </p>
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            {lesson.videoProvider ? (
                              <>
                                <PlayCircle className="h-3.5 w-3.5" aria-hidden />
                                {lesson.videoProvider === "youtube"
                                  ? t("shop.form.provider_youtube")
                                  : t("shop.form.provider_vimeo")}
                              </>
                            ) : lesson.hasPdf ? (
                              <>
                                <FileText className="h-3.5 w-3.5" aria-hidden />
                                {t("shop.form.provider_pdf")}
                              </>
                            ) : null}
                          </span>
                        </div>
                        {accessLesson?.embedUrl ? (
                          <div className="aspect-video w-full overflow-hidden rounded-md border border-border bg-muted/20">
                            <iframe
                              src={accessLesson.embedUrl}
                              title={lesson.title}
                              loading="lazy"
                              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              className="h-full w-full"
                            />
                          </div>
                        ) : null}
                        {accessLesson?.pdfSignedUrl ? (
                          <Button asChild variant="outline" size="sm">
                            <a
                              href={accessLesson.pdfSignedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Download className="mr-2 h-4 w-4" aria-hidden />
                              {t("shop.course.pdf_download")}
                            </a>
                          </Button>
                        ) : null}
                        {!accessLesson ? (
                          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <Lock className="h-3.5 w-3.5" aria-hidden />
                            {t("shop.course.locked_lesson")}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </section>

          {/* Buy rail */}
          <aside className="lg:sticky lg:top-24 lg:self-start" id="buy">
            <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
              <p className="text-3xl font-bold tracking-normal">
                {note.priceHkd === 0 ? t("notes.card.free") : formatMoney(note.priceHkd)}
              </p>
              <a
                href={`/tutors/${note.tutorCode}`}
                className="flex items-center gap-1.5 text-sm font-medium text-[color:var(--brand-link)] hover:underline"
              >
                <GraduationCap className="h-4 w-4" aria-hidden />
                {note.tutorName}
              </a>
              {unlocked ? (
                <p className="flex items-center gap-1.5 rounded-md border border-emerald-600/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <PlayCircle className="h-4 w-4" aria-hidden />
                  {t("shop.course.unlocked_note")}
                </p>
              ) : (
                <>
                  {!isOwner ? (
                    <TermsGateCheckbox
                      section="notes"
                      checked={termsAccepted}
                      invalid={termsGateInvalid}
                      onCheckedChange={(checked) => {
                        setTermsAccepted(checked);
                        if (checked) setTermsGateInvalid(false);
                      }}
                    />
                  ) : null}
                  <Button
                    variant="solid"
                    color="accent"
                    className="w-full font-bold"
                    disabled={checkoutMutation.isPending || isOwner}
                    onClick={guard}
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" aria-hidden />
                    {isOwner ? t("notes.own_note") : t("notes.add_to_cart")}
                  </Button>
                </>
              )}
              <ul className="space-y-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
                <li>· {t("shop.course.perk_embeds")}</li>
                <li>· {t("notes.perk_manual_review")}</li>
                <li>· {t("notes.perk_licence")}</li>
              </ul>
            </div>
            {user && !isOwner ? (
              <div className="mt-3 flex justify-end">
                <ReportMenuButton
                  targets={[
                    { targetType: "material", targetId: note.id, label: t("notes.report_target") },
                  ]}
                  menuLabel={t("report.menu_label_profile")}
                />
              </div>
            ) : null}
          </aside>
        </div>
      </main>
      <SiteFooter />
      <AuthGateDialog
        open={gateOpen}
        onOpenChange={setGateOpen}
        title={t("notes.gate_title")}
        description={t("notes.gate_description")}
      />
    </div>
  );
}
