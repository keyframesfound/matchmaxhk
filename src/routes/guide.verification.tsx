import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, BadgeCheck, Briefcase, CircleCheck, CircleX, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  GuideCtaRow,
  GuideHeading,
  GuideHeroImage,
  GuidePage,
  GuideSteps,
} from "@/features/guide/guide-shell";

import { canonicalUrl } from "@/features/i18n/seo";
export const Route = createFileRoute("/guide/verification")({
  head: () => ({
    meta: [
      { title: "Verification | MatchMax" },
      {
        name: "description",
        content:
          "What MatchMax checks before a tutor card goes live: transcripts, component scores, university enrolment, and what verification does not mean.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Verification | MatchMax" },
      {
        property: "og:description",
        content:
          "What MatchMax checks before a tutor card goes live: transcripts, component scores, university enrolment, and what verification does not mean.",
      },
      { property: "og:url", content: canonicalUrl("/guide/verification") },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/guide/verification") }],
  }),
  component: GuideVerificationPage,
});

/**
 * Issue #208: the verification detail page behind the hub's summary block.
 * Issue #492: tier card order locked Verified → Professionals → Stated,
 * connected 3-step process, and one merged disclaimer card (replaces the
 * duplicated "does not mean" + "badge covers" blocks).
 * Issue #498: the verified tier is the #411 azure Blue Tick (BadgeCheck,
 * #1d9bf0 fill like the tutor card) — the amber-gold trophy chrome is gone;
 * Professionals and Stated stay secondary/neutral.
 */
function GuideVerificationPage() {
  const { t } = useTranslation();

  const tiers: {
    key: "tier2" | "professionals" | "tier1";
    icon: typeof BadgeCheck;
    className: string;
    iconClass: string;
  }[] = [
    {
      key: "tier2",
      icon: BadgeCheck,
      className: "border-[#1d9bf0] bg-[#E3ECF6]/60 dark:border-[#1d9bf0]/50 dark:bg-[#1d9bf0]/10",
      iconClass: "fill-[#1d9bf0] text-white dark:text-[#0b2230]",
    },
    {
      key: "professionals",
      icon: Briefcase,
      className: "border-[#8ecdf8] bg-[#E3ECF6]/50 dark:border-[#8ecdf8]/40 dark:bg-[#1d9bf0]/10",
      iconClass: "text-[color:var(--brand-link)]",
    },
    {
      key: "tier1",
      icon: FileText,
      className: "border-[color:var(--border)] bg-[color:var(--surface)]",
      iconClass: "text-muted-foreground",
    },
  ];

  const process: [string, string, string][] = (["p1", "p2", "p3"] as const).map((key, index) => [
    String(index + 1),
    t(`guide.verification.${key}_title`),
    t(`guide.verification.${key}_body`),
  ]);

  return (
    <GuidePage current="/guide/verification">
      {/* Issue #498: narrow rails centred (mx-auto) + hero illustration slot. */}
      <section className="mx-auto max-w-[1600px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            {t("hiw.verification_title")}
          </h1>
          <p className="mt-4 text-lg leading-8 text-[color:var(--ink)]/65">
            {t("guide.verification.intro")}
          </p>
        </div>

        <div className="mt-10">
          <GuideHeroImage slot="verification" />
        </div>

        <div className="mx-auto mt-12 max-w-4xl">
          <GuideHeading>{t("guide.verification.tiers_title")}</GuideHeading>
          <div className="mt-6 space-y-4">
            {tiers.map(({ key, icon: Icon, className, iconClass }) => (
              <div key={key} className={`rounded-2xl border p-6 md:p-8 ${className}`}>
                <h3 className="flex items-center gap-2.5 text-lg font-bold tracking-tight sm:text-xl">
                  <Icon className={`h-5 w-5 shrink-0 ${iconClass}`} aria-hidden="true" />
                  {t(`guide.verification.${key}_title`)}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink)]/70">
                  {t(`guide.verification.${key}_body`)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-14 max-w-4xl">
          <GuideHeading>{t("guide.verification.process_title")}</GuideHeading>
          <div className="mt-6">
            <GuideSteps steps={process} />
          </div>
        </div>

        <div className="mx-auto mt-14 max-w-4xl">
          <GuideHeading>{t("guide.verification.not_mean_title")}</GuideHeading>
          <div className="mt-6 space-y-3">
            <div className="flex items-start gap-3 rounded-2xl border border-[color:var(--ink)]/12 p-5 sm:p-6">
              <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-[#dc2626]" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-[color:var(--ink)]/80">
                {t("guide.verification.disclaimer_grade")}
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-[color:var(--ink)]/12 p-5 sm:p-6">
              <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-[#dc2626]" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-[color:var(--ink)]/80">
                {t("guide.verification.disclaimer_endorsement")}
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-[color:var(--ink)]/12 p-5 sm:p-6">
              <CircleCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-link)]"
                aria-hidden="true"
              />
              <p className="text-sm leading-relaxed text-[color:var(--ink)]/80">
                {t("guide.verification.disclaimer_slip")}
              </p>
            </div>
          </div>
        </div>

        <GuideCtaRow>
          <Button
            asChild
            size="lg"
            variant="solid"
            color="neutral"
            className="h-auto w-full rounded-xl px-6 py-3.5 sm:col-span-2"
          >
            <Link to="/tutors">
              {t("hiw.hero_cta_browse")} <ArrowRight />
            </Link>
          </Button>
        </GuideCtaRow>
      </section>
    </GuidePage>
  );
}
