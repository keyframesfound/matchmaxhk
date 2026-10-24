import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, Building2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ContentsRow, GuideHeading, GuidePage } from "@/features/guide/guide-shell";

export const Route = createFileRoute("/guide/partners")({
  head: () => ({
    meta: [
      { title: "Education Partners (B2B) | MatchMax" },
      {
        name: "description",
        content:
          "How tutorial centres, schools, and NGOs engage independent educators on MatchMax, Contracts for Services only, never staff recruitment.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Education Partners (B2B) | MatchMax" },
      {
        property: "og:description",
        content:
          "How tutorial centres, schools, and NGOs engage independent educators on MatchMax, Contracts for Services only, never staff recruitment.",
      },
      { property: "og:url", content: "https://matchmax.hk/guide/partners" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/guide/partners" }],
  }),
  component: GuidePartnersPage,
});

/**
 * Issue #412 G, the B2B tab beside Parents & Tutors (#258). Engage/match
 * language only: MatchMax facilitates Contracts for Services between partner
 * organisations and self-employed independent educators. It is not an
 * employment agency and never recruits staff.
 */
function GuidePartnersPage() {
  const { t } = useTranslation();

  const steps = (["s1", "s2", "s3"] as const).map((key) => [
    t(`guide.partners.${key}_title`),
    t(`guide.partners.${key}_body`),
  ]);
  const rules = (["r1", "r2", "r3", "r4"] as const).map((key) => t(`guide.partners.${key}`));

  return (
    <GuidePage current="/guide/partners">
      <ContentsRow
        items={[
          { id: "steps", label: t("guide.partners.steps_title") },
          { id: "rules", label: t("guide.partners.rules_title") },
          { id: "fee", label: t("guide.partners.fee_title") },
        ]}
      />
      <section className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
            {t("guide.partners.title")}
          </h1>
          <p className="mt-4 text-lg leading-8 text-[color:var(--ink)]/65">
            {t("guide.partners.intro")}
          </p>
        </div>

        <div id="steps" className="mt-12 max-w-4xl scroll-mt-40">
          <GuideHeading>{t("guide.partners.steps_title")}</GuideHeading>
          <ol className="mt-6 border-t border-[color:var(--ink)]/15">
            {steps.map(([title, body], index) => (
              <li
                key={title}
                className="grid grid-cols-[3rem_minmax(0,1fr)] gap-5 border-b border-[color:var(--ink)]/15 py-6 sm:gap-8 sm:py-7"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--foreground)]/[0.06] text-sm font-medium">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-lg font-medium tracking-tight sm:text-xl">{title}</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-[color:var(--ink)]/70">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

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
        </div>
      </section>
    </GuidePage>
  );
}
