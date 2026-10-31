import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  CircleX,
  EyeOff,
  LogIn,
  RefreshCcw,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  GuideCtaRow,
  GuideHeading,
  GuideHeroImage,
  GuidePage,
  GuideSteps,
} from "@/features/guide/guide-shell";

import { canonicalUrl } from "@/features/i18n/seo";
export const Route = createFileRoute("/guide/parents")({
  head: () => ({
    meta: [
      // Issue #541: inclusive of independent students, not parent-only.
      { title: "Students & Parents Guide | MatchMax" },
      {
        name: "description",
        content:
          "How students and parents use MatchMax: browse tutor profiles or send a request, book for yourself or add child profiles, the concierge introduction, the 1.5-lesson admin fee, and what MatchMax does not do.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Students & Parents Guide | MatchMax" },
      {
        property: "og:description",
        content:
          "How students and parents use MatchMax: browse tutor profiles or send a request, book for yourself or add child profiles, the concierge introduction, the 1.5-lesson admin fee, and what MatchMax does not do.",
      },
      { property: "og:url", content: canonicalUrl("/guide/parents") },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/guide/parents") }],
  }),
  component: GuideParentsPage,
});

/**
 * Issue #210: the parent guide, steps, money, and what MatchMax does not do.
 * Issue #492: connected stepper, inline-icon policy cards, subtle ✕ rows,
 * tutor-pays fee framing (Cap.57 independent operators) in step 3.
 */
function GuideParentsPage() {
  const { t } = useTranslation();

  const steps: [string, string, string][] = (["s1", "s2", "s3", "s4"] as const).map(
    (key, index) => [
      String(index + 1),
      t(`guide.parents.${key}_title`),
      t(`guide.parents.${key}_body`),
    ],
  );

  const facts: { key: string; icon: typeof CircleDollarSign }[] = [
    { key: "rates", icon: CircleDollarSign },
    { key: "names", icon: EyeOff },
    { key: "fit", icon: RefreshCcw },
    { key: "sickness", icon: CalendarClock },
    { key: "account", icon: LogIn },
    { key: "group", icon: Users },
  ];

  const notDo: [string, string][] = (["lessons", "cut", "schedule"] as const).map((key) => [
    t(`guide.parents.not_${key}_label`),
    t(`guide.parents.not_${key}_body`),
  ]);

  return (
    <GuidePage current="/guide/parents">
      {/* Issue #498: the narrow rails run mx-auto so the column centres like
          the Why Us tab instead of hugging left inside the 1600px wrapper. */}
      <section className="mx-auto max-w-[1600px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            {t("guide.parents.h1")}
          </h1>
          <p className="mt-4 text-lg leading-8 text-[color:var(--ink)]/65">
            {t("guide.parents.intro")}
          </p>
          {/* Issue #541: the unified-account callout — book for yourself or
              add child profiles under /account (#459 Learning vs Teaching). */}
          <div className="mt-6 rounded-2xl border border-[color:var(--ink)]/12 bg-[color:var(--accent)] p-5 text-left sm:p-6">
            <h2 className="text-base font-bold tracking-tight text-[color:var(--ink)]">
              {t("guide.parents.account_callout_title")}
            </h2>
            <p className="mt-2 text-sm leading-7 text-[color:var(--ink)]/70">
              {t("guide.parents.account_callout_body")}
            </p>
            <Link
              to="/account"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[color:var(--brand-link)] underline-offset-4 hover:underline"
            >
              {t("guide.parents.cta_account")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="mt-10">
          <GuideHeroImage slot="parents" />
        </div>

        <div className="mx-auto mt-12 max-w-4xl">
          <GuideHeading>{t("guide.parents.steps_title")}</GuideHeading>
          <div className="mt-6">
            <GuideSteps steps={steps} />
          </div>
        </div>

        <div className="mx-auto mt-14 max-w-4xl">
          <GuideHeading>{t("guide.money_title")}</GuideHeading>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {facts.map(({ key, icon: Icon }) => (
              <div key={key} className="rounded-2xl border border-[color:var(--ink)]/12 p-5 sm:p-6">
                <h3 className="flex items-center gap-2.5 text-base font-semibold tracking-tight">
                  <Icon
                    className="h-5 w-5 shrink-0 text-[color:var(--brand-link)]"
                    aria-hidden="true"
                  />
                  {t(`guide.parents.fact_${key}_label`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(`guide.parents.fact_${key}_body`)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-14 max-w-4xl">
          <GuideHeading>{t("guide.not_do_title")}</GuideHeading>
          <div className="mt-6 space-y-3">
            {notDo.map(([label, body]) => (
              <div
                key={label}
                className="flex items-start gap-3 rounded-2xl border border-[color:var(--ink)]/12 p-5 sm:p-6"
              >
                <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-[#dc2626]" aria-hidden="true" />
                <div>
                  <h3 className="text-base font-semibold tracking-tight">{label}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <GuideCtaRow>
          <Button
            asChild
            size="lg"
            variant="solid"
            color="neutral"
            className="h-auto w-full rounded-xl px-6 py-3.5"
          >
            <Link to="/tutors">
              {t("guide.parents.cta_browse")} <ArrowRight />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-auto w-full rounded-xl px-6 py-3.5"
          >
            <Link to="/tutor-requests" search={{ post: true }}>
              {t("guide.parents.cta_request")}
            </Link>
          </Button>
        </GuideCtaRow>
      </section>
    </GuidePage>
  );
}
