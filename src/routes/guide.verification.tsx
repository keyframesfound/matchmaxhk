import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, FileText, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ContentsRow, GuideHeading, GuidePage } from "@/features/guide/guide-shell";

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
      { property: "og:url", content: "https://matchmax.hk/guide/verification" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/guide/verification" }],
  }),
  component: GuideVerificationPage,
});

/** Issue #208: the verification detail page behind the hub's summary block. */
function GuideVerificationPage() {
  const { t } = useTranslation();

  const tiers: [string, string][] = (["tier2", "tier1", "professionals"] as const).map((key) => [
    t(`guide.verification.${key}_title`),
    t(`guide.verification.${key}_body`),
  ]);

  const notMean: [string, string][] = (["grade", "offer", "marking", "endorsement"] as const).map(
    (key) => ["✗", t(`guide.verification.not_${key}`)],
  );

  return (
    <GuidePage current="/guide/verification">
      <ContentsRow
        items={[
          { id: "tiers", label: t("guide.verification.tiers_title") },
          { id: "process", label: t("guide.verification.process_title") },
          { id: "not-mean", label: t("guide.verification.not_mean_title") },
          { id: "badge-scope", label: t("guide.verification.badge_title") },
        ]}
      />
      <section className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
            {t("hiw.verification_title")}
          </h1>
          <p className="mt-4 text-lg leading-8 text-[color:var(--ink)]/65">
            {t("guide.verification.intro")}
          </p>
        </div>

        <div id="tiers" className="mt-12 max-w-4xl scroll-mt-40">
          <GuideHeading>{t("guide.verification.tiers_title")}</GuideHeading>
          <div className="mt-6 space-y-4">
            {tiers.map(([title, body], index) => (
              <div
                key={title}
                className="rounded-2xl border border-[color:var(--ink)]/12 bg-[color:var(--card)] p-6 transition-colors hover:border-[color:var(--ink)]/25 md:p-8"
              >
                <h3 className="flex items-center gap-2 text-lg font-medium tracking-tight sm:text-xl">
                  {index === 0 ? (
                    <ShieldCheck
                      className="h-5 w-5 text-[color:var(--brand-link)]"
                      aria-hidden="true"
                    />
                  ) : (
                    <FileText
                      className="h-5 w-5 text-[color:var(--muted-foreground)]"
                      aria-hidden="true"
                    />
                  )}
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[color:var(--ink)]/65">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div id="process" className="mt-14 max-w-4xl scroll-mt-40">
          <GuideHeading>{t("guide.verification.process_title")}</GuideHeading>
          <ol className="mt-6 border-t border-[color:var(--ink)]/15">
            {(["p1", "p2", "p3"] as const).map((key, index) => (
              <li
                key={key}
                className="grid grid-cols-[3rem_minmax(0,1fr)] gap-5 border-b border-[color:var(--ink)]/15 py-6 sm:gap-8 sm:py-7"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--foreground)]/[0.06] text-sm font-medium">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-lg font-medium tracking-tight sm:text-xl">
                    {t(`guide.verification.${key}_title`)}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-[color:var(--ink)]/70">
                    {t(`guide.verification.${key}_body`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div id="not-mean" className="mt-14 max-w-4xl scroll-mt-40">
          <GuideHeading>{t("guide.verification.not_mean_title")}</GuideHeading>
          <div className="mt-6 rounded-2xl border-2 border-amber-500/30 bg-amber-500/[0.04] p-5 sm:p-6">
            <ul className="space-y-3">
              {notMean.map(([marker, text]) => (
                <li key={text} className="flex gap-3 text-sm leading-7 text-[color:var(--ink)]/80">
                  <span aria-hidden="true" className="font-medium text-amber-600">
                    {marker}
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 border-t border-amber-500/20 pt-4 text-sm leading-7 text-[color:var(--ink)]/75">
              {t("hiw.verification_disclaimer")}
            </p>
          </div>
        </div>

        {/* Issue #309: verification scope of the grade badge, the exact four
            consent lines tutors accept at /join, in both locales. */}
        <div id="badge-scope" className="mt-14 max-w-4xl scroll-mt-40">
          <GuideHeading>{t("guide.verification.badge_title")}</GuideHeading>
          <ul className="mt-6 list-disc space-y-3 border-t border-[color:var(--ink)]/15 pt-6 pl-5">
            {([1, 2, 3, 4] as const).map((line) => (
              <li key={line} className="text-sm leading-7 text-[color:var(--ink)]/80">
                {t(`guide.verification.badge_line_${line}`)}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-14 flex flex-wrap gap-3">
          <Button asChild size="lg" variant="solid" color="accent">
            <Link to="/tutors">
              {t("hiw.hero_cta_browse")} <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </GuidePage>
  );
}
