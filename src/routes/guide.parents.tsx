import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, Search, UserRoundCheck } from "lucide-react";

import { ContentsRow, GuideHeading, GuidePage, GuideSteps } from "@/features/guide/guide-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/guide/parents")({
  head: () => ({
    meta: [
      { title: "Parent Guide | MatchMax" },
      {
        name: "description",
        content:
          "How parents use MatchMax: browse tutor profiles or send a request, the concierge introduction, the 1.5-lesson admin fee, and what MatchMax does not do.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Parent Guide | MatchMax" },
      {
        property: "og:description",
        content:
          "How parents use MatchMax: browse tutor profiles or send a request, the concierge introduction, the 1.5-lesson admin fee, and what MatchMax does not do.",
      },
      { property: "og:url", content: "https://matchmax.hk/guide/parents" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/guide/parents" }],
  }),
  component: GuideParentsPage,
});

/** Issue #210: the parent guide, steps, money, and what MatchMax does not do. */
function GuideParentsPage() {
  const { t } = useTranslation();

  const steps: [string, string, string][] = (["s1", "s2", "s3", "s4"] as const).map(
    (key, index) => [
      String(index + 1),
      t(`guide.parents.${key}_title`),
      t(`guide.parents.${key}_body`),
    ],
  );

  const facts: [string, string][] = (
    ["rates", "names", "fit", "sickness", "account", "group"] as const
  ).map((key) => [t(`guide.parents.fact_${key}_label`), t(`guide.parents.fact_${key}_body`)]);

  const notDo: [string, string][] = (["lessons", "cut", "schedule"] as const).map((key) => [
    t(`guide.parents.not_${key}_label`),
    t(`guide.parents.not_${key}_body`),
  ]);

  return (
    <GuidePage current="/guide/parents">
      <ContentsRow
        items={[
          { id: "steps", label: t("guide.nav_steps") },
          { id: "money", label: t("guide.nav_money") },
          { id: "not-do", label: t("guide.nav_not_do") },
        ]}
      />
      <section className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
            {t("guide.tab_parents")}
          </h1>
          <p className="mt-4 text-lg leading-8 text-[color:var(--ink)]/65">
            {t("guide.parents.intro")}
          </p>
        </div>

        <div id="steps" className="mt-12 max-w-4xl scroll-mt-40">
          <GuideHeading>{t("guide.parents.steps_title")}</GuideHeading>
          <div className="mt-6">
            <GuideSteps steps={steps} />
          </div>
        </div>

        <div id="money" className="mt-14 max-w-4xl scroll-mt-40">
          <GuideHeading>{t("guide.money_title")}</GuideHeading>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {facts.map(([label, body]) => (
              <div
                key={label}
                className="rounded-2xl border border-[color:var(--ink)]/12 p-5 sm:p-6"
              >
                <h3 className="flex items-start gap-2 text-base font-medium tracking-tight">
                  <UserRoundCheck
                    className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-link)]"
                    aria-hidden="true"
                  />
                  {label}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[color:var(--ink)]/70">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div id="not-do" className="mt-14 max-w-4xl scroll-mt-40">
          <GuideHeading>{t("guide.not_do_title")}</GuideHeading>
          <div className="mt-6 space-y-3">
            {notDo.map(([label, body]) => (
              <div
                key={label}
                className="rounded-2xl border border-[color:var(--ink)]/12 bg-[color:var(--surface-subtle)] p-5 sm:p-6"
              >
                <h3 className="text-base font-medium tracking-tight">{label}</h3>
                <p className="mt-2 text-sm leading-6 text-[color:var(--ink)]/70">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-wrap gap-3">
          <Button asChild size="lg" variant="solid" color="accent">
            <Link to="/tutors">
              {t("guide.parents.cta_browse")} <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/tutor-requests" search={{ post: true }}>
              {t("guide.parents.cta_request")}
            </Link>
          </Button>
        </div>
      </section>
    </GuidePage>
  );
}
