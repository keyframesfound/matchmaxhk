import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, Building2, Handshake, ShieldCheck, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ContentsRow, GuideHeading, GuidePage } from "@/features/guide/guide-shell";
import { useSupportWhatsAppHref } from "@/features/help/components";

import { canonicalUrl } from "@/features/i18n/seo";
export const Route = createFileRoute("/guide/partners")({
  head: () => ({
    meta: [
      // Issue #541: the Centres & Educators guide (B2B partners are no
      // longer orphaned on the learning/tutor tabs).
      { title: "Centres & Educators | MatchMax" },
      {
        name: "description",
        content:
          "Partnering with MatchMax: how tuition centres and educational consultancies join as Organisation Partners — verification, the centre workspace, qualified enquiries, and the performance-based introduction fee.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Centres & Educators | MatchMax" },
      {
        property: "og:description",
        content:
          "Partnering with MatchMax: how tuition centres and educational consultancies join as Organisation Partners — verification, the centre workspace, qualified enquiries, and the performance-based introduction fee.",
      },
      { property: "og:url", content: canonicalUrl("/guide/partners") },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/guide/partners") }],
  }),
  component: GuidePartnersPage,
});

/**
 * Issue #412 G, the B2B tab beside Parents & Tutors (#258); content
 * rewritten to the Issue #541 Centres & Educators guide (§§1–4).
 *
 * Engage/match language only: MatchMax facilitates Contracts for Services
 * between partner organisations and self-employed independent educators.
 * It is not an employment agency and never recruits staff (Cap. 57).
 */
function GuidePartnersPage() {
  const { t } = useTranslation();
  const supportHref = useSupportWhatsAppHref();

  const steps = (["s1", "s2", "s3", "s4"] as const).map((key) => [
    t(`guide.partners.${key}_title`),
    t(`guide.partners.${key}_body`),
  ]);
  const who = (["who_1", "who_2", "who_3"] as const).map((key) => t(`guide.partners.${key}`));
  const rules = (["r1", "r2", "r3", "r4"] as const).map((key) => t(`guide.partners.${key}`));

  return (
    <GuidePage current="/guide/partners">
      <ContentsRow
        items={[
          { id: "who", label: t("guide.partners.who_title") },
          { id: "steps", label: t("guide.partners.steps_title") },
          { id: "vs", label: t("guide.partners.vs_title") },
          { id: "fee", label: t("guide.partners.fee_title") },
        ]}
      />
      <section className="mx-auto max-w-[1600px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            {t("guide.partners.title")}
          </h1>
          <p className="mt-4 text-lg leading-8 text-[color:var(--ink)]/65">
            {t("guide.partners.intro")}
          </p>
        </div>

        {/* §1 Who can join */}
        <div id="who" className="mt-12 max-w-4xl scroll-mt-40">
          <GuideHeading>{t("guide.partners.who_title")}</GuideHeading>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {who.map((text) => (
              <li
                key={text}
                className="rounded-2xl border border-[color:var(--ink)]/12 p-5 text-sm leading-7 text-[color:var(--ink)]/75"
              >
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/* §2 How the Centre Portal works */}
        <div id="steps" className="mt-14 max-w-4xl scroll-mt-40">
          <GuideHeading>{t("guide.partners.steps_title")}</GuideHeading>
          <ol className="mt-6 border-t border-[color:var(--ink)]/15">
            {steps.map(([title, body], index) => (
              <li
                key={title}
                className="grid grid-cols-[3rem_minmax(0,1fr)] gap-5 border-b border-[color:var(--ink)]/15 py-6 sm:gap-8 sm:py-7"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--foreground)]/[0.06] text-sm font-bold">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-lg font-bold tracking-tight sm:text-xl">{title}</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-[color:var(--ink)]/70">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* §3 Centre vs independent tutor accounts */}
        <div id="vs" className="mt-14 max-w-4xl scroll-mt-40">
          <GuideHeading>{t("guide.partners.vs_title")}</GuideHeading>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--ink)]/12 p-5 sm:p-6">
              <h3 className="flex items-center gap-2.5 text-base font-bold tracking-tight">
                <Building2
                  className="h-5 w-5 shrink-0 text-[color:var(--brand-link)]"
                  aria-hidden="true"
                />
                {t("guide.tab_partners")}
              </h3>
              <p className="mt-2 text-sm leading-7 text-[color:var(--ink)]/70">
                {t("guide.partners.vs_body")}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--ink)]/12 p-5 sm:p-6">
              <h3 className="flex items-center gap-2.5 text-base font-bold tracking-tight">
                <Users
                  className="h-5 w-5 shrink-0 text-[color:var(--brand-link)]"
                  aria-hidden="true"
                />
                {t("guide.tab_tutors")}
              </h3>
              <p className="mt-2 text-sm leading-7 text-[color:var(--ink)]/70">
                {t("guide.tutors.cap57")}
              </p>
            </div>
          </div>
        </div>

        {/* #412 G legal safeguards, kept from the original partners tab. */}
        <div id="rules" className="mt-14 max-w-4xl scroll-mt-40">
          <GuideHeading>{t("guide.partners.rules_title")}</GuideHeading>
          <div className="mt-6 rounded-2xl border-2 border-purple-500/30 bg-purple-500/[0.04] p-5 sm:p-6">
            <ul className="space-y-3">
              {rules.map((text) => (
                <li key={text} className="flex gap-3 text-sm leading-7 text-[color:var(--ink)]/80">
                  <ShieldCheck
                    className="mt-1 h-4 w-4 shrink-0 text-purple-600"
                    aria-hidden="true"
                  />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* §4 Partner fee structure */}
        <div id="fee" className="mt-14 max-w-4xl scroll-mt-40">
          <GuideHeading>{t("guide.partners.fee_title")}</GuideHeading>
          <p className="mt-6 max-w-2xl text-sm leading-7 text-[color:var(--ink)]/70">
            {t("guide.partners.fee_body")}
          </p>
        </div>

        <div className="mt-14 flex flex-wrap gap-3">
          <Button asChild size="lg" variant="solid" color="accent">
            <Link to="/business/join">
              {t("guide.partners.cta")} <ArrowRight />
            </Link>
          </Button>
          {supportHref ? (
            <Button asChild size="lg" variant="outline">
              <a href={supportHref} target="_blank" rel="noreferrer">
                <Handshake className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {t("guide.partners.cta_contact")}
              </a>
            </Button>
          ) : null}
        </div>
      </section>
    </GuidePage>
  );
}
