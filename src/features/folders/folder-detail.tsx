import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { Eye, Folder, GraduationCap, Layers, ShoppingCart } from "lucide-react";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";
import { AuthGateDialog } from "@/features/auth/AuthGateDialog";
import { formatMoney } from "@/lib/money";
import { materialCoverUrl, shopKindLabel } from "@/features/materials/material-card";
import { getFolderPriceQuote, getPublicListing } from "@/features/materials/listings.functions";
import { startCheckout } from "@/features/materials/checkout.functions";
import { TermsGateCheckbox } from "@/features/legal/TermsGateCheckbox";
import { formatMaterialTypeLabel } from "@/features/materials/queries";
import type { PublicNote } from "@/features/materials/notes.functions";
import { ReportMenuButton } from "@/features/reports/report-button";

/**
 * #392: the Topic Folder detail page (/notes/<slug> rails, folder branch).
 * Left: what's inside, every published child with cover thumb, price and
 * its own "Buy single" (a normal startCheckout on the child). Right: the
 * buy rail with "Buy full folder" showing the SIGNED-IN buyer's prorated
 * price (delivered child orders are subtracted, floored at 0) plus a
 * proration explainer; guests see the bulk price + savings badge.
 */

export function FolderDetailPage({ note }: { note: PublicNote }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [gateOpen, setGateOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsGateInvalid, setTermsGateInvalid] = useState(false);

  const isOwner = Boolean(user && note.tutorUserId && user.id === note.tutorUserId);
  const slug = note.slug ?? note.id;

  const listingQuery = useQuery({
    queryKey: ["shop-listing", slug],
    queryFn: () => getPublicListing({ data: { slug } }),
  });
  const children = listingQuery.data?.children ?? [];

  const quoteQuery = useQuery({
    queryKey: ["folder-quote", note.id, user?.id],
    queryFn: () => getFolderPriceQuote({ data: { folderId: note.id } }),
    enabled: Boolean(user) && !isOwner,
  });
  const quote = quoteQuery.data ?? null;
  const displayPrice = quote ? quote.adjusted : note.priceHkd;

  const buyFolderMutation = useMutation({
    mutationFn: () => startCheckout({ data: { materialId: note.id, legalAgreed: true } }),
    onSuccess: ({ orderId }) => {
      void navigate({ to: `/orders/${orderId}` });
    },
    onError: () => setGateOpen(true),
  });

  const buyChildMutation = useMutation({
    mutationFn: (childId: string) =>
      startCheckout({ data: { materialId: childId, legalAgreed: true } }),
    onSuccess: ({ orderId }) => {
      void navigate({ to: `/orders/${orderId}` });
    },
    onError: () => setGateOpen(true),
  });

  const guard = (run: () => void) => {
    if (!user) {
      setGateOpen(true);
      return;
    }
    if (!termsAccepted) {
      setTermsGateInvalid(true);
      return;
    }
    run();
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
                {note.yearTag ? (
                  <span className="rounded-md border border-border px-2.5 py-0.5 text-xs font-semibold text-foreground/80">
                    {note.yearTag}
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

            {/* What's inside */}
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Layers className="h-5 w-5" aria-hidden />
                {t("shop.folder.whats_inside", { count: children.length })}
              </h2>
              {listingQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
              ) : children.length === 0 ? (
                <p className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
                  {t("shop.folder.empty")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {children.map((child, index) => {
                    const cover = materialCoverUrl(child.coverImagePath);
                    return (
                      <li
                        key={child.id}
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3"
                      >
                        <span className="w-5 shrink-0 text-center text-xs font-bold text-muted-foreground">
                          {index + 1}
                        </span>
                        {cover ? (
                          <img
                            src={cover}
                            alt=""
                            loading="lazy"
                            className="h-12 w-16 shrink-0 rounded-md border border-border object-cover"
                          />
                        ) : (
                          <span
                            className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground"
                            aria-hidden
                          >
                            <Folder className="h-4 w-4" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <a
                            href={`/notes/${child.slug ?? child.id}`}
                            className="block truncate text-sm font-bold text-[color:var(--ink)] hover:text-[color:var(--brand-link)] hover:underline"
                          >
                            {child.title}
                          </a>
                          <p className="text-xs text-muted-foreground">
                            {formatMaterialTypeLabel(child.materialType, t)}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-bold text-[color:var(--ink)]">
                          {child.priceHkd === 0
                            ? t("notes.card.free")
                            : formatMoney(child.priceHkd)}
                        </span>
                        {child.priceHkd > 0 ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            disabled={buyChildMutation.isPending || isOwner}
                            onClick={() => guard(() => buyChildMutation.mutate(child.id))}
                          >
                            {t("shop.card.buy_single")}
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </section>

          {/* Buy rail */}
          <aside className="lg:sticky lg:top-24 lg:self-start" id="buy">
            <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
              <p className="text-3xl font-bold tracking-normal">
                {displayPrice === 0 ? t("shop.folder.included_label") : formatMoney(displayPrice)}
              </p>
              {quote && quote.ownedSum > 0 ? (
                <p className="rounded-md border border-emerald-600/30 bg-emerald-500/10 px-3 py-2 text-xs leading-relaxed font-semibold text-emerald-700 dark:text-emerald-400">
                  {t("shop.folder.proration_explainer", {
                    credit: formatMoney(quote.ownedSum),
                    bulk: formatMoney(quote.bulk),
                  })}
                </p>
              ) : null}
              <a
                href={`/tutors/${note.tutorCode}`}
                className="flex items-center gap-1.5 text-sm font-medium text-[color:var(--brand-link)] hover:underline"
              >
                <GraduationCap className="h-4 w-4" aria-hidden />
                {note.tutorName}
              </a>
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
                disabled={buyFolderMutation.isPending || isOwner}
                onClick={() => guard(() => buyFolderMutation.mutate())}
              >
                <ShoppingCart className="mr-2 h-4 w-4" aria-hidden />
                {isOwner
                  ? t("notes.own_note")
                  : quote && quote.adjusted === 0
                    ? t("shop.folder.claim_button")
                    : t("shop.folder.buy_button")}
              </Button>
              <ul className="space-y-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
                <li>· {t("shop.folder.perk_unlock")}</li>
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
