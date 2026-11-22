import { createFileRoute, notFound } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicPage } from "@/components/layout/PublicPage";
import { IMPACT_PAGE_LIVE } from "@/lib/feature-flags";

/**
 * #794 AC-400-3 — the MatchMax Impact page, built and HELD.
 *
 * The AC is explicit: the page must exist in code, but `matchmax.hk/impact`
 * stays unavailable until the first NGO partner is confirmed. `IMPACT_PAGE_LIVE`
 * is the single switch; while it is false this route throws `notFound()`, so the
 * URL returns a real 404 and Explore keeps its interim `/guide#impact` link.
 *
 * Nothing here promises cash: no donation per match, no fee, and the only
 * numbers on the page are the ones the programme already runs on.
 *
 * The partner-logo section renders only when a partner exists. An empty logo
 * wall would be a claim we cannot back, so `IMPACT_PARTNERS` starts empty and
 * the section is omitted until it is not.
 */
const IMPACT_PARTNERS: { name: string; href: string }[] = [];

export const Route = createFileRoute("/impact")({
  beforeLoad: () => {
    if (!IMPACT_PAGE_LIVE) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "MatchMax Impact" },
      {
        name: "description",
        content:
          "How MatchMax supports students who could not otherwise afford tutoring, without cash donations per match.",
      },
      // Held: keep it out of the index even after release is a deliberate act.
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ImpactPage,
});

function Section({ title, body }: { title: string; body: string }) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold text-[color:var(--ink)]">{title}</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">{body}</p>
    </section>
  );
}

function ImpactPage() {
  const { t } = useTranslation();
  return (
    <PublicPage>
      <PageContainer className="max-w-3xl py-10">
        <PageIntro title={t("impact.title")} description={t("impact.intro")} width="narrow" dense />

        <Section title={t("impact.seats_title")} body={t("impact.seats_body")} />
        <Section title={t("impact.scholarship_title")} body={t("impact.scholarship_body")} />

        {IMPACT_PARTNERS.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-base font-semibold text-[color:var(--ink)]">
              {t("impact.partners_title")}
            </h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
              {t("impact.partners_body")}
            </p>
            <ul className="mt-3 flex flex-wrap gap-3">
              {IMPACT_PARTNERS.map((partner) => (
                <li key={partner.href} className="rounded-xl border border-border px-3 py-2">
                  <a
                    href={partner.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-sm font-semibold text-[color:var(--brand-link)] hover:underline"
                  >
                    {partner.name}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="mt-10 text-sm text-muted-foreground">{t("impact.contact")}</p>
      </PageContainer>
    </PublicPage>
  );
}
