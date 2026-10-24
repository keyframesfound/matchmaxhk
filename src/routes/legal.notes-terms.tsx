import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PageBackButton } from "@/components/layout/page-back-button";

export const Route = createFileRoute("/legal/notes-terms")({
  head: () => ({
    meta: [
      { title: "Notes Terms | MatchMax" },
      {
        name: "description",
        content:
          "The terms that govern study materials sold through MatchMax: licences, delivery, refunds, takedowns, and the warranty the tutor gives on every upload.",
      },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/legal/notes-terms" }],
  }),
  component: NotesTermsPage,
});

/**
 * Issue #212: a short terms page for notes. The tutor upload links here and
 * accepting them is required before submitting. Buyer checkout is still the
 * concierge WhatsApp flow, no in-app purchase UI links here yet; that
 * surface arrives with the manual cashier (issue #250 family).
 */

function Clause({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[color:var(--ink)]/10 py-7">
      <h2 className="text-xl font-medium tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-[color:var(--ink)]/75">{children}</div>
    </section>
  );
}

function NotesTermsPage() {
  const { t } = useTranslation();

  const bannedSummary: string[] = (
    ["school_papers", "publisher", "hkeaa", "ib", "classmate", "contact"] as const
  ).map((key) => t(`guide.notes.banned_${key}`));

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--surface)] text-[color:var(--ink)]">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
          <div className="lg:hidden">
            <PageBackButton />
          </div>
          <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">
            {t("legal.notes_terms.title")}
          </h1>
          <p className="mt-3 text-sm text-[color:var(--ink)]/55">
            {t("legal.notes_terms.updated")}
          </p>

          <div className="mt-6">
            <Clause title={t("legal.notes_terms.role_title")}>
              <p>{t("legal.notes_terms.role_body")}</p>
            </Clause>
            <Clause title={t("legal.notes_terms.warranty_title")}>
              <p>{t("legal.notes_terms.warranty_body")}</p>
              <ul className="list-inside list-disc space-y-1.5">
                {bannedSummary.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Clause>
            <Clause title={t("legal.notes_terms.licence_title")}>
              <p>{t("legal.notes_terms.licence_body")}</p>
            </Clause>
            <Clause title={t("legal.notes_terms.delivery_title")}>
              <p>{t("legal.notes_terms.delivery_body")}</p>
            </Clause>
            <Clause title={t("legal.notes_terms.refund_title")}>
              <p>{t("legal.notes_terms.refund_body")}</p>
            </Clause>
            <Clause title={t("legal.notes_terms.takedown_title")}>
              <p>{t("legal.notes_terms.takedown_body")}</p>
            </Clause>
            <Clause title={t("legal.notes_terms.affiliation_title")}>
              <p>{t("legal.notes_terms.affiliation_body")}</p>
            </Clause>
            <Clause title={t("legal.notes_terms.law_title")}>
              <p>{t("legal.notes_terms.law_body")}</p>
            </Clause>
          </div>

          <p className="mt-10 border-t border-[color:var(--ink)]/10 pt-6 text-sm">
            <Link to="/guide/notes" className="font-medium underline underline-offset-4">
              {t("legal.notes_terms.back_to_guide")}
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
