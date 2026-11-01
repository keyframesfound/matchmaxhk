import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { canonicalUrl } from "@/features/i18n/seo";

/**
 * #573 Part 4.3: copyright notice-and-takedown procedure (Cap. 528). Valid
 * notices are P1: hidden and reviewed within 24 hours; sellers may send a
 * counter-notice within 7 days (docs/notes-shop-dispute-report-sop.md §4.4).
 */
export const Route = createFileRoute("/copyright")({
  head: () => ({
    meta: [
      { title: "Copyright and Takedown | MatchMax" },
      {
        name: "description",
        content:
          "How copyright owners ask MatchMax to remove infringing study materials, and how quickly we act.",
      },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/copyright") }],
  }),
  component: CopyrightPage,
});

function CopyrightPage() {
  const { t } = useTranslation();
  const items = (["item1", "item2", "item3", "item4"] as const).map((key) =>
    t(`legal.copyright.${key}`),
  );
  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--surface)] text-[color:var(--ink)]">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl space-y-8 px-5 py-10 sm:px-8 sm:py-14">
          <header className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight">{t("legal.copyright.title")}</h1>
            <p className="text-base leading-7 text-[color:var(--ink)]/75">
              {t("legal.copyright.intro")}
            </p>
          </header>
          <section className="space-y-3 border-t border-[color:var(--ink)]/10 pt-6">
            <h2 className="text-xl font-bold">{t("legal.copyright.how_title")}</h2>
            <p className="text-sm leading-7 text-[color:var(--ink)]/75">
              {t("legal.copyright.how_body")}
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-sm leading-7 text-[color:var(--ink)]/75">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </section>
          <section className="space-y-3 border-t border-[color:var(--ink)]/10 pt-6">
            <h2 className="text-xl font-bold">{t("legal.copyright.sla_title")}</h2>
            <p className="text-sm leading-7 text-[color:var(--ink)]/75">
              {t("legal.copyright.sla_body")}
            </p>
          </section>
          <section className="space-y-3 border-t border-[color:var(--ink)]/10 pt-6">
            <h2 className="text-xl font-bold">{t("legal.copyright.sellers_title")}</h2>
            <p className="text-sm leading-7 text-[color:var(--ink)]/75">
              {t("legal.copyright.sellers_body")}
            </p>
            <p className="text-sm font-semibold">
              <a href="mailto:legal@matchmax.hk" className="underline underline-offset-4">
                {t("legal.copyright.contact")}
              </a>
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
