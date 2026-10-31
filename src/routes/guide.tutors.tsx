import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, BadgeCheck, CircleX, ClipboardList } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  GuideCtaRow,
  GuideHeading,
  GuideHeroImage,
  GuidePage,
  GuideSteps,
} from "@/features/guide/guide-shell";

import { canonicalUrl } from "@/features/i18n/seo";
export const Route = createFileRoute("/guide/tutors")({
  head: () => ({
    meta: [
      { title: "Tutor Guide | MatchMax" },
      {
        name: "description",
        content:
          "How tutors use MatchMax: list as an independent tutor, claim cases that fit your commute, and keep 100% of the hourly fee after the 1.5-lesson admin fee.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Tutor Guide | MatchMax" },
      {
        property: "og:description",
        content:
          "How tutors use MatchMax: list as an independent tutor, claim cases that fit your commute, and keep 100% of the hourly fee after the 1.5-lesson admin fee.",
      },
      { property: "og:url", content: canonicalUrl("/guide/tutors") },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/guide/tutors") }],
  }),
  component: GuideTutorsPage,
});

/**
 * Issue #210: the tutor guide, steps, money, and what MatchMax does not do.
 * Issue #492: connected stepper, playbook pill, subtle ✕ rows, and the
 * locked Cap.57 independent-operator fee copy in step 4.
 */
function GuideTutorsPage() {
  const { t } = useTranslation();

  const steps: [string, string, string][] = (["s1", "s2", "s3", "s4"] as const).map(
    (key, index) => [
      String(index + 1),
      t(`guide.tutors.${key}_title`),
      t(`guide.tutors.${key}_body`),
    ],
  );

  const notDo: [string, string][] = (["cut", "schedule", "clients"] as const).map((key) => [
    t(`guide.tutors.not_${key}_label`),
    t(`guide.tutors.not_${key}_body`),
  ]);

  return (
    <GuidePage current="/guide/tutors">
      {/* Issue #498: narrow rails centred (mx-auto) + hero illustration slot. */}
      <section className="mx-auto max-w-[1600px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            {t("guide.tutors.h1")}
          </h1>
          <p className="mt-4 text-lg leading-8 text-[color:var(--ink)]/65">
            {t("guide.tutors.intro")}
          </p>
          {/* Issue #541: same-account Teaching Mode (no second email) — the
              #459 additive Become a Tutor flow. */}
          <div className="mt-6 rounded-2xl border border-[color:var(--ink)]/12 bg-[color:var(--accent)] p-5 text-left sm:p-6">
            <p className="text-sm leading-7 text-[color:var(--ink)]/75">
              {t("guide.tutors.same_account")}
            </p>
            <p className="mt-2 text-xs leading-6 text-[color:var(--ink)]/55">
              {t("guide.tutors.cap57")}
            </p>
          </div>
          <Link
            to="/help"
            search={{ audience: "tutors" }}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] transition-colors hover:bg-[color:var(--accent)]/70"
          >
            <ClipboardList className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t("guide.tutors.playbook_pill")}
          </Link>
        </div>

        <div className="mt-10">
          <GuideHeroImage slot="tutors" />
        </div>

        <div className="mx-auto mt-12 max-w-4xl">
          <GuideHeading>{t("guide.tutors.steps_title")}</GuideHeading>
          <div className="mt-6">
            <GuideSteps steps={steps} />
          </div>
          {/* Issue #541: case badges tell tutors who they are contacting
              (#459 slice 9 — Parent Account vs Independent Student). */}
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[color:var(--ink)]/12 p-5 sm:p-6">
            <BadgeCheck
              className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-link)]"
              aria-hidden="true"
            />
            <p className="text-sm leading-7 text-[color:var(--ink)]/75">
              {t("guide.tutors.case_badges")}
            </p>
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
            <Link to="/tutor-requests">
              {t("guide.tutors.cta_cases")} <ArrowRight />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-auto w-full rounded-xl px-6 py-3.5"
          >
            <Link to="/join">{t("guide.tutors.cta_apply")}</Link>
          </Button>
          <p className="text-sm text-[color:var(--ink)]/60 sm:col-span-2">
            <Link
              to="/help"
              search={{ audience: "tutors" }}
              className="font-bold text-[color:var(--brand-link)] underline underline-offset-4 hover:opacity-80"
            >
              {t("guide.tutors.playbook_link")}
            </Link>
          </p>
        </GuideCtaRow>
      </section>
    </GuidePage>
  );
}
