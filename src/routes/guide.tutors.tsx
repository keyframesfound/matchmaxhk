import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, ClipboardList } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ContentsRow, GuideHeading, GuidePage, GuideSteps } from "@/features/guide/guide-shell";

export const Route = createFileRoute("/guide/tutors")({
  head: () => ({
    meta: [
      { title: "Tutor Guide | MatchMax" },
      {
        name: "description",
        content:
          "How tutors use MatchMax: submit credentials, get listed anonymously, claim cases that fit your commute, and keep the hourly fee after the 1.5-lesson admin fee.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Tutor Guide | MatchMax" },
      {
        property: "og:description",
        content:
          "How tutors use MatchMax: submit credentials, get listed anonymously, claim cases that fit your commute, and keep the hourly fee after the 1.5-lesson admin fee.",
      },
      { property: "og:url", content: "https://matchmax.hk/guide/tutors" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/guide/tutors" }],
  }),
  component: GuideTutorsPage,
});

/** Issue #210: the tutor guide — steps, money, and what MatchMax does not do. */
function GuideTutorsPage() {
  const { t } = useTranslation();

  const steps: [string, string, string][] = (["s1", "s2", "s3", "s4"] as const).map(
    (key, index) => [
      String(index + 1),
      t(`guide.tutors.${key}_title`),
      t(`guide.tutors.${key}_body`),
    ],
  );

  const facts: [string, string][] = (["commission", "privacy", "modes", "experience"] as const).map(
    (key) => [t(`guide.tutors.fact_${key}_label`), t(`guide.tutors.fact_${key}_body`)],
  );

  const notDo: [string, string][] = (["cut", "schedule", "clients"] as const).map((key) => [
    t(`guide.tutors.not_${key}_label`),
    t(`guide.tutors.not_${key}_body`),
  ]);

  return (
    <GuidePage current="/guide/tutors">
      <ContentsRow
        items={[
          { id: "steps", label: t("guide.nav_steps") },
          { id: "money", label: t("guide.nav_money") },
          { id: "not-do", label: t("guide.nav_not_do") },
        ]}
      />
      <section className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
        <div className="max-w-3xl">
          <p className="text-sm font-bold text-[color:var(--muted-foreground)]">
            {t("guide.tutors.eyebrow")}
          </p>
          <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            {t("guide.tab_tutors")}
          </h1>
          <p className="mt-4 text-lg leading-8 text-[color:var(--ink)]/65">
            {t("guide.tutors.intro")}
          </p>
          <p className="mt-4 text-base leading-7 text-[color:var(--ink)]/65">
            {t("guide.tutors.support_para")}
          </p>
          <p className="mt-3 text-base leading-7 text-[color:var(--ink)]/65">
            <Link
              to="/tutor-playbook"
              className="font-bold underline underline-offset-4 hover:opacity-80"
            >
              {t("guide.tutors.support_link_label")}
            </Link>
            {t("guide.tutors.support_link_suffix")}
          </p>
        </div>

        <div id="steps" className="mt-12 max-w-4xl scroll-mt-40">
          <GuideHeading>{t("guide.tutors.steps_title")}</GuideHeading>
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
                <h3 className="text-base font-bold tracking-tight">{label}</h3>
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
                <h3 className="text-base font-bold tracking-tight">{label}</h3>
                <p className="mt-2 text-sm leading-6 text-[color:var(--ink)]/70">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-wrap gap-3">
          <Button asChild size="lg" variant="solid" color="accent">
            <Link to="/tutor-requests">
              {t("guide.tutors.cta_cases")} <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/join">{t("guide.tutors.cta_apply")}</Link>
          </Button>
        </div>

        <p className="mt-8 flex items-center gap-2 text-sm text-[color:var(--ink)]/60">
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          <Link to="/tutor-playbook" className="font-bold underline underline-offset-4">
            {t("guide.tutors.playbook_link")}
          </Link>
        </p>

        <p className="mt-10 border-t border-[color:var(--ink)]/12 pt-6 text-sm text-muted-foreground">
          {t("guide.tutors.founder_line")}
        </p>
      </section>
    </GuidePage>
  );
}
