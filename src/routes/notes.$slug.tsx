import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { BookOpen, FileText, GraduationCap, Eye, ShoppingCart, MessageCircle } from "lucide-react";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";
import { AuthGateDialog } from "@/features/auth/AuthGateDialog";
import {
  getPublicNote,
  getPublicNotesByTutor,
  getNoteWhatsAppActions,
  type PublicNote,
} from "@/features/materials/notes.functions";
import { startCheckout } from "@/features/materials/checkout.functions";
import { TermsGateCheckbox } from "@/features/legal/TermsGateCheckbox";
import { NotePreviewViewer } from "@/features/materials/note-preview-viewer";
import { formatMaterialTypeLabel } from "@/features/materials/queries";
import { GigDetailPage } from "@/features/gigs/gig-detail";
import { ReportMenuButton } from "@/features/reports/report-button";

/**
 * #203 + P8/P14: the public note page — the marketplace's Clastify-style
 * listing. Left: watermarked preview, first 3 pages crisp, the rest blurred
 * under a lock panel. Right: sticky buy card (price, tutor badge, Add to
 * cart, request-this-tutor WhatsApp, owner stats, report). Below: contents
 * and details. Azure is spent on the one money CTA only (Scarcity Rule).
 */

export const Route = createFileRoute("/notes/$slug")({
  head: ({ params, loaderData }) => ({
    meta: [
      {
        // #326: gigs ride the /notes/$slug rails but are services, not notes.
        title:
          (loaderData as { note?: { materialType?: string } | null } | undefined)?.note
            ?.materialType === "gig"
            ? "Service | MatchMax"
            : "Notes | MatchMax",
      },
      { property: "og:type", content: "product" },
      { property: "og:url", content: `https://matchmax.hk/notes/${params.slug}` },
      { name: "description", content: "Preview and buy study notes on MatchMax." },
    ],
    links: [{ rel: "canonical", href: `https://matchmax.hk/notes/${params.slug}` }],
  }),
  loader: async ({ params }) => {
    const note = await getPublicNote({ data: { slug: params.slug } });
    // Render the 404 page (matches tutors.$tutorCode / tutor-requests.$caseCode)
    // — a bare Error would surface as HTTP 500 on prod for any bogus slug.
    if (!note) throw notFound();
    return { note };
  },
  component: GigOrNotePage,
});

/**
 * #326: one route, two products. Gigs ride the same slug/loader/404 rails as
 * notes but render the service page (no watermark viewer, no preview, no
 * view counter). Branching lives in sibling components so each keeps its own
 * stable hook order.
 */
function GigOrNotePage() {
  const { note } = Route.useLoaderData() as { note: PublicNote };
  if (note.materialType === "gig") return <GigDetailPage note={note} />;
  return <NotePage />;
}

function NotePage() {
  const { note } = Route.useLoaderData() as { note: PublicNote };
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const navigate = router.navigate.bind(router);
  const [gateOpen, setGateOpen] = useState(false);
  // Issue #214: the checkout terms gate — the buy click doubles as the
  // notes-terms acceptance click. Client gate here (button refuses to place
  // the order unchecked); startCheckout re-validates server-side and records
  // the terms_acceptances row (surface checkout, subject_id = order id).
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsGateInvalid, setTermsGateInvalid] = useState(false);
  // Owner check uses the tutor's AUTH id (tutors.user_id), not the tutors
  // row id — review fix: note.tutorId is the FK, user.id is an auth uid.
  const isOwner = Boolean(user && note.tutorUserId && user.id === note.tutorUserId);

  // #203: signed-in, non-owner views count once per account per day.
  useEffect(() => {
    if (!user || isOwner) return;
    import("@/features/materials/notes.functions").then(({ recordMaterialView }) =>
      recordMaterialView({ data: { materialId: note.id } }).catch(() => undefined),
    );
  }, [user, isOwner, note.id]);

  const whatsappQuery = useQuery({
    queryKey: ["note-whatsapp", note.title, note.priceHkd, note.tutorName],
    queryFn: () =>
      getNoteWhatsAppActions({
        data: {
          title: note.title,
          priceHkd: note.priceHkd,
          tutorName: note.tutorName,
          tutorCode: note.tutorCode,
        },
      }),
  });

  const checkoutMutation = useMutation({
    mutationFn: () => startCheckout({ data: { materialId: note.id, legalAgreed: true } }),
    onSuccess: ({ orderId }) => {
      void navigate({ to: `/orders/${orderId}` });
    },
    onError: () => setGateOpen(true),
  });

  const othersQuery = useQuery({
    queryKey: ["note-others", note.tutorId, note.id],
    queryFn: () =>
      getPublicNotesByTutor({ data: { tutorId: note.tutorId, excludeMaterialId: note.id } }),
  });

  const iaLabel = ["ia", "ee", "tok_essay"].includes(note.documentType);
  const isExemplar = note.materialType === "exemplar" || iaLabel;
  // #314: an .apkg deck has no watermarked preview — the page shows a
  // download panel instead of the in-browser viewer (no Anki player).
  const isApkgDeck = note.materialType === "flashcards" && !note.previewUrl;

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--background)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:gap-10">
          {/* Preview column */}
          <section className="min-w-0 space-y-6">
            <header className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                  {formatMaterialTypeLabel(note.materialType, t)}
                </span>
                {isExemplar && note.gradeAchieved ? (
                  <span className="rounded-md border border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/5 px-2.5 py-0.5 text-xs font-bold text-[color:var(--brand-link)]">
                    {t("notes.field_grade")}: {note.gradeAchieved}
                  </span>
                ) : null}
                {note.curriculumTag && (
                  <span className="rounded-md border border-border px-2.5 py-0.5 text-xs font-semibold text-foreground/80">
                    {note.curriculumTag}
                  </span>
                )}
                {note.subjectTag && (
                  <span className="rounded-md border border-border px-2.5 py-0.5 text-xs font-semibold text-foreground/80">
                    {note.subjectTag}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold leading-tight tracking-normal sm:text-3xl">
                {note.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <Link
                  to="/tutors/$tutorCode"
                  params={{ tutorCode: note.tutorCode }}
                  className="inline-flex items-center gap-1.5 font-medium text-[color:var(--brand-link)] hover:underline"
                >
                  <GraduationCap className="h-4 w-4" aria-hidden />
                  {note.tutorName}
                </Link>
                {note.pageCount != null && (
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="h-4 w-4" aria-hidden />
                    {t("notes.page_count", { count: note.pageCount })}
                  </span>
                )}
                {note.wordCount != null && (
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="h-4 w-4" aria-hidden />
                    {t("notes.card.word_count", { count: note.wordCount })}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="h-4 w-4" aria-hidden />
                  {t("notes.views", { count: note.viewCount })}
                </span>
                {note.soldCount > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4" aria-hidden />
                    {t("notes.sold", { count: note.soldCount })}
                  </span>
                )}
              </div>
            </header>

            {isApkgDeck ? (
              <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-6">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent">
                  <FileText className="h-5 w-5 text-accent-foreground" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold">{t("notes.apkg_panel_title")}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {t("notes.apkg_panel_body")}
                  </p>
                </div>
              </div>
            ) : (
              <NotePreviewViewer
                previewUrl={note.previewUrl}
                previewPages={note.previewPages}
                pageCount={note.pageCount}
                ctaLabel={t("notes.unlock_cta")}
                lockedLabel={t("notes.locked_title")}
              />
            )}

            {note.description && (
              <section className="space-y-2">
                <h2 className="text-lg font-bold">{t("notes.contents_title")}</h2>
                <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-foreground/90">
                  {note.description}
                </p>
              </section>
            )}

            <section className="space-y-3">
              <h2 className="text-lg font-bold">{t("notes.details_title")}</h2>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-2 rounded-xl border border-border bg-card p-5 text-sm sm:grid-cols-2">
                {note.curriculumTag && (
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-muted-foreground">{t("notes.field_curriculum")}</dt>
                    <dd className="font-semibold">{note.curriculumTag}</dd>
                  </div>
                )}
                {note.subjectTag && (
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-muted-foreground">{t("notes.field_subject")}</dt>
                    <dd className="font-semibold">{note.subjectTag}</dd>
                  </div>
                )}
                {note.topic && (
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-muted-foreground">{t("notes.field_topic")}</dt>
                    <dd className="font-semibold">{note.topic}</dd>
                  </div>
                )}
                {note.yearTag && (
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-muted-foreground">{t("notes.field_year")}</dt>
                    <dd className="font-semibold">{note.yearTag}</dd>
                  </div>
                )}
                {note.pageCount != null && (
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-muted-foreground">{t("notes.field_pages")}</dt>
                    <dd className="font-semibold">
                      {t("notes.page_count", { count: note.pageCount })}
                    </dd>
                  </div>
                )}
                {note.wordCount != null && (
                  <div className="flex justify-between gap-4 sm:block">
                    <dt className="text-muted-foreground">{t("notes.field_word_count")}</dt>
                    <dd className="font-semibold">
                      {t("notes.card.word_count", { count: note.wordCount })}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-4 sm:block">
                  <dt className="text-muted-foreground">{t("notes.field_format")}</dt>
                  <dd className="font-semibold">{isApkgDeck ? t("notes.format_apkg") : "PDF"}</dd>
                </div>
              </dl>
              {isExemplar && (
                <p className="text-xs text-muted-foreground">{t("notes.exemplar_disclaimer")}</p>
              )}
            </section>
          </section>

          {/* Buy rail */}
          <aside className="lg:sticky lg:top-24 lg:self-start" id="buy">
            <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
              <p className="text-3xl font-bold tracking-normal">
                {note.priceHkd === 0
                  ? t("notes.card.free")
                  : t("notes.price", { amount: note.priceHkd })}
              </p>
              <Link
                to="/tutors/$tutorCode"
                params={{ tutorCode: note.tutorCode }}
                className="flex items-center gap-1.5 text-sm font-medium text-[color:var(--brand-link)] hover:underline"
              >
                <GraduationCap className="h-4 w-4" aria-hidden />
                {note.tutorName}
              </Link>
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
                className="w-full font-bold"
                disabled={checkoutMutation.isPending || isOwner}
                onClick={() => {
                  if (!user) {
                    setGateOpen(true);
                    return;
                  }
                  // Issue #214: refuse to place the order with the terms
                  // gate unchecked (client half; server re-validates).
                  if (!termsAccepted) {
                    setTermsGateInvalid(true);
                    return;
                  }
                  checkoutMutation.mutate();
                }}
              >
                <ShoppingCart className="mr-2 h-4 w-4" aria-hidden />
                {isOwner ? t("notes.own_note") : t("notes.add_to_cart")}
              </Button>
              {whatsappQuery.data?.requestUrl && (
                <a
                  href={whatsappQuery.data.requestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-full items-center justify-center rounded-md border border-[#25D366]/40 text-sm font-semibold text-[#1EA457] transition-colors hover:bg-[#25D366]/10"
                >
                  <MessageCircle className="mr-2 h-4 w-4" aria-hidden />
                  {t("notes.request_tutor")}
                </a>
              )}
              <ul className="space-y-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
                <li>· {t("notes.perk_manual_review")}</li>
                <li>· {t("notes.perk_licence")}</li>
                <li>· {t("notes.perk_download")}</li>
              </ul>
            </div>
            {user && !isOwner && (
              <div className="mt-3 flex justify-end">
                <ReportMenuButton
                  targets={[
                    { targetType: "material", targetId: note.id, label: t("notes.report_target") },
                  ]}
                  menuLabel={t("report.menu_label_profile")}
                />
              </div>
            )}
          </aside>
        </div>

        {othersQuery.data && othersQuery.data.length > 0 && (
          <section className="mt-14 space-y-4">
            <h2 className="text-lg font-bold">{t("notes.more_from_tutor")}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {othersQuery.data.map((other) => (
                <a
                  key={other.id}
                  href={`/notes/${other.slug ?? other.id}`}
                  className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/25"
                >
                  <p className="font-semibold group-hover:underline">{other.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {other.priceHkd === 0
                      ? t("notes.card.free")
                      : t("notes.price", { amount: other.priceHkd })}
                  </p>
                </a>
              ))}
            </div>
          </section>
        )}
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
