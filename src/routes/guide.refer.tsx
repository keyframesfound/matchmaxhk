import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, Copy, Gift } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ContentsRow,
  GuideHeading,
  GuidePage,
  GuideRules,
  GuideSteps,
} from "@/features/guide/guide-shell";

export const Route = createFileRoute("/guide/refer")({
  head: () => ({
    meta: [
      { title: "Refer a Tutor | MatchMax" },
      {
        name: "description",
        content:
          "Share your link, your friend applies as a tutor, and after their first case completes two lessons and the fee you earn 15% of the MatchMax admin fee.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Refer a Tutor | MatchMax" },
      {
        property: "og:description",
        content:
          "Share your link, your friend applies as a tutor, and after their first case completes two lessons and the fee you earn 15% of the MatchMax admin fee.",
      },
      { property: "og:url", content: "https://matchmax.hk/guide/refer" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/guide/refer" }],
  }),
  component: GuideReferPage,
});

/** Issue #213: the refer page — five steps, the rule, the exclusions. */
function GuideReferPage() {
  const { t } = useTranslation();

  const steps: [string, string, string][] = (["s1", "s2", "s3", "s4", "s5"] as const).map(
    (key, index) => [
      String(index + 1),
      t(`guide.refer.${key}_title`),
      t(`guide.refer.${key}_body`),
    ],
  );

  const exclusions: [string, string][] = (["self", "already", "second", "whatsapp"] as const).map(
    (key) => ["—", t(`guide.refer.exclusion_${key}`)],
  );

  return (
    <GuidePage current="/guide/refer">
      <ContentsRow
        items={[
          { id: "steps", label: t("guide.nav_steps") },
          { id: "rule", label: t("guide.refer.rule_title") },
          { id: "exclusions", label: t("guide.refer.exclusions_title") },
        ]}
      />
      <section className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
        <div className="max-w-3xl">
          <p className="text-sm font-bold text-[color:var(--muted-foreground)]">
            {t("guide.refer.eyebrow")}
          </p>
          <h1 className="mt-3 flex flex-wrap items-center gap-3 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            <Gift className="h-9 w-9 text-[color:var(--brand-link)]" aria-hidden="true" />
            {t("guide.tab_refer")}
          </h1>
          <p className="mt-4 text-lg leading-8 text-[color:var(--ink)]/65">
            {t("guide.refer.intro")}
          </p>
        </div>

        <div id="steps" className="mt-12 max-w-4xl scroll-mt-40">
          <GuideHeading>{t("guide.refer.steps_title")}</GuideHeading>
          <div className="mt-6">
            <GuideSteps steps={steps} />
          </div>
        </div>

        <div id="rule" className="mt-14 max-w-4xl scroll-mt-40">
          <GuideHeading>{t("guide.refer.rule_title")}</GuideHeading>
          <div className="mt-6 rounded-2xl border border-[color:var(--ink)]/12 p-5 sm:p-6">
            <ul className="space-y-4 text-sm leading-7 text-[color:var(--ink)]/80">
              {(["bounty", "what_counts", "when", "how_paid"] as const).map((key) => (
                <li key={key} className="flex gap-3">
                  <Copy
                    className="mt-1.5 h-4 w-4 shrink-0 text-[color:var(--brand-link)]"
                    aria-hidden="true"
                  />
                  <span>{t(`guide.refer.rule_${key}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div id="exclusions" className="mt-14 max-w-4xl scroll-mt-40">
          <GuideHeading>{t("guide.refer.exclusions_title")}</GuideHeading>
          <div className="mt-6 rounded-2xl border-2 border-amber-500/30 bg-amber-500/[0.04] p-5 sm:p-6">
            <GuideRules items={exclusions} />
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-center gap-3">
          <Button asChild size="lg" variant="solid" color="accent">
            <Link to="/join">
              {t("guide.refer.cta_apply")} <ArrowRight />
            </Link>
          </Button>
          <p className="text-sm text-[color:var(--ink)]/60">{t("guide.refer.dashboard_note")}</p>
        </div>
      </section>
    </GuidePage>
  );
}
