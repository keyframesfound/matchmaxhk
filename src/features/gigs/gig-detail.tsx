import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BadgeCheck, Clock, GraduationCap, ShoppingCart } from "lucide-react";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";
import { AuthGateDialog } from "@/features/auth/AuthGateDialog";
import { TermsGateCheckbox } from "@/features/legal/TermsGateCheckbox";
import { gigCategoryLabelKey, gigDeliveryLabelKey } from "@/features/gigs/gig";
import { getGigBoughtCount } from "@/features/gigs/gig-buyer.functions";
import { publicCoverUrl } from "@/features/gigs/gigs.queries";
import { startCheckout } from "@/features/materials/checkout.functions";
import type { PublicNote } from "@/features/materials/notes.functions";
import { formatMaterialTypeLabel } from "@/features/materials/queries";
import { ReportMenuButton } from "@/features/reports/report-button";

/**
 * Issues #326/#329: the public GIG page, rendered by /notes/$slug whenever
 * the listing's material_type is 'gig'. A service has NO watermarked
 * preview, NO page count and NO view counter, the left column is the cover
 * image plus the plain-language description; the right column is the same
 * sticky buy card as notes (price, ONE azure Buy Now, terms gate, report).
 * Turnaround shows the tutor's note, falling back to the machine clock
 * ("within 48 hours"). The #316 honesty lines are mandatory copy: document
 * review is feedback-not-authorship, speaking mocks never carry join
 * details on the listing.
 */

export function GigDetailPage({ note }: { note: PublicNote }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const navigate = router.navigate.bind(router);
  const [gateOpen, setGateOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsGateInvalid, setTermsGateInvalid] = useState(false);
  // Owner check uses the tutor's AUTH id (tutors.user_id), same as notes.
  const isOwner = Boolean(user && note.tutorUserId && user.id === note.tutorUserId);

  const checkoutMutation = useMutation({
    mutationFn: () => startCheckout({ data: { materialId: note.id, legalAgreed: true } }),
    onSuccess: ({ orderId }) => {
      void navigate({ to: `/orders/${orderId}` });
    },
    onError: () => setGateOpen(true),
  });

  // #329: delivered-orders-only bought figure, computed in the database
  // (material_orders is not public). Best-effort, hides on failure.
  const boughtQuery = useQuery({
    queryKey: ["gig-bought", note.id],
    queryFn: () => getGigBoughtCount({ data: { materialId: note.id } }),
  });

  const isDocumentReview = note.gigCategory === "document_review";
  const isSpeakingMock = note.gigCategory === "speaking_mock";
  const isFileBack = note.gigDeliveryType === "file_back";
  const cover = publicCoverUrl(note.coverImagePath);
  const turnaroundText =
    note.turnaroundNote?.trim() ||
    t("gigs.turnaround_within", { hours: note.turnaroundHours ?? 48 });

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:gap-10">
          {/* Service column */}
          <section className="min-w-0 space-y-6">
            <header className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                  {formatMaterialTypeLabel(note.materialType, t)}
                </span>
                {note.gigCategory && (
                  <span className="rounded-md border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {t(gigCategoryLabelKey(note.gigCategory))}
                  </span>
                )}
                {note.gigDeliveryType && (
                  <span className="rounded-md border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {t(gigDeliveryLabelKey(note.gigDeliveryType))}
                  </span>
                )}
                {note.curriculumTag && (
                  <span className="rounded-md border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {note.curriculumTag}
                  </span>
                )}
                {note.subjectTag && (
                  <span className="rounded-md border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {note.subjectTag}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-medium leading-tight tracking-normal sm:text-3xl">
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
                  <span className="font-medium text-muted-foreground">{note.tutorCode}</span>
                  {note.tutorVerificationTier === "tier_2_verified" && (
                    <span className="inline-flex items-center gap-1 font-medium text-[color:var(--brand-link)]">
                      <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                      {t("gigs.verified")}
                    </span>
                  )}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" aria-hidden />
                  {turnaroundText}
                </span>
                {boughtQuery.data && boughtQuery.data.count > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    {t("gigs.bought_count_suffix", { count: boughtQuery.data.count })}
                  </span>
                )}
              </div>
            </header>

            {cover ? (
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <img
                  src={cover}
                  alt={note.title}
                  className="max-h-[420px] w-full object-cover"
                  onError={(event) => {
                    // A missing cover file degrades to the flat page, never a broken image.
                    event.currentTarget.parentElement?.remove();
                  }}
                />
              </div>
            ) : null}

            {note.description && (
              <section className="space-y-2">
                <h2 className="text-lg font-medium">{t("gigs.about_title")}</h2>
                <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-muted-foreground">
                  {note.description}
                </p>
              </section>
            )}

            <section className="space-y-3">
              <h2 className="text-lg font-medium">{t("gigs.details_title")}</h2>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-2 rounded-xl border border-border bg-card p-5 text-sm sm:grid-cols-2">
                {note.gigCategory && (
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-muted-foreground">{t("gigs.field_category")}</dt>
                    <dd className="font-medium">{t(gigCategoryLabelKey(note.gigCategory))}</dd>
                  </div>
                )}
                {note.gigDeliveryType && (
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-muted-foreground">{t("gigs.field_delivery")}</dt>
                    <dd className="font-medium">{t(gigDeliveryLabelKey(note.gigDeliveryType))}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-muted-foreground">{t("gigs.field_turnaround")}</dt>
                  <dd className="font-medium">{turnaroundText}</dd>
                </div>
                {isFileBack && (
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-muted-foreground">{t("gigs.field_source_format")}</dt>
                    <dd className="font-medium">{t("gigs.source_format_value")}</dd>
                  </div>
                )}
              </dl>
              {/* #316 honesty lines, mandatory copy, never marketing. */}
              {isDocumentReview && (
                <p className="text-xs text-muted-foreground">{t("gigs.integrity_line")}</p>
              )}
              {isSpeakingMock && (
                <p className="text-xs text-muted-foreground">{t("gigs.meeting_privacy_line")}</p>
              )}
            </section>
          </section>

          {/* Buy rail */}
          <aside className="lg:sticky lg:top-24 lg:self-start" id="buy">
            <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
              <p className="text-3xl font-medium tracking-normal">
                {t("notes.price", { amount: note.priceHkd })}
              </p>
              <a
                href={`/tutors/${note.tutorCode}`}
                className="flex items-center gap-1.5 text-sm font-medium text-[color:var(--brand-link)] hover:underline"
              >
                <GraduationCap className="h-4 w-4" aria-hidden />
                {note.tutorName}
              </a>
              {!isOwner && (
                <TermsGateCheckbox
                  section="notes"
                  checked={termsAccepted}
                  invalid={termsGateInvalid}
                  onCheckedChange={(checked) => {
                    setTermsAccepted(checked);
                    if (checked) setTermsGateInvalid(false);
                  }}
                />
              )}
              <Button
                variant="solid"
                color="accent"
                className="w-full font-medium"
                disabled={checkoutMutation.isPending || isOwner}
                onClick={() => {
                  if (!user) {
                    setGateOpen(true);
                    return;
                  }
                  // Issue #214 gate, same as notes: the buy click doubles as
                  // the terms-acceptance click (server re-validates).
                  if (!termsAccepted) {
                    setTermsGateInvalid(true);
                    return;
                  }
                  checkoutMutation.mutate();
                }}
              >
                <ShoppingCart className="mr-2 h-4 w-4" aria-hidden />
                {isOwner ? t("gigs.own_service") : t("gigs.buy_now")}
              </Button>
              <ul className="space-y-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
                <li>· {t("gigs.perk_turnaround", { turnaround: turnaroundText })}</li>
                <li>· {t("gigs.perk_manual_review")}</li>
                {isFileBack ? <li>· {t("gigs.perk_file_back")}</li> : null}
              </ul>
            </div>
            {user && !isOwner && (
              <div className="mt-3 flex justify-end">
                <ReportMenuButton
                  targets={[
                    { targetType: "material", targetId: note.id, label: t("gigs.report_target") },
                  ]}
                  menuLabel={t("report.menu_label_profile")}
                />
              </div>
            )}
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
