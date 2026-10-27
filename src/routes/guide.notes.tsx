import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, CircleCheck, CircleX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { canonicalUrl } from "@/features/i18n/seo";
import { GuideCtaRow, GuideHeading, GuidePage, GuideSteps } from "@/features/guide/guide-shell";

export const Route = createFileRoute("/guide/notes")({
  head: () => ({
    meta: [
      { title: "Notes Guide | MatchMax" },
      {
        name: "description",
        content:
          "How the MatchMax notes marketplace works, what tutors may sell, and the ban list: no school papers, no HKEAA or IB past papers, no contact details in files.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Notes Guide | MatchMax" },
      {
        property: "og:description",
        content:
          "How the MatchMax notes marketplace works, what tutors may sell, and the ban list: no school papers, no HKEAA or IB past papers, no contact details in files.",
      },
      { property: "og:url", content: canonicalUrl("/guide/notes") },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/guide/notes") }],
  }),
  component: GuideNotesPage,
});

/**
 * Issue #211: the notes page sells the service AND states the ban list.
 * The dangerous "school-specific past-paper solutions" claim is removed from
 * every public surface; the ban list sits above any upload entry point.
 * Issue #492: connected 5-step flow (pay → staff release → monthly payout,
 * MatchMax keeps 20%), neutral ban-list card with subtle ✕ icons.
 */
function GuideNotesPage() {
  const { t } = useTranslation();

  const steps: [string, string, string][] = (["s1", "s2", "s3", "s4", "s5"] as const).map(
    (key, index) => [
      String(index + 1),
      t(`guide.notes.${key}_title`),
      t(`guide.notes.${key}_body`),
    ],
  );

  const banned: string[] = (
    ["school_papers", "publisher", "hkeaa", "ib", "classmate", "contact"] as const
  ).map((key) => t(`guide.notes.banned_${key}`));

  return (
    <GuidePage current="/guide/notes">
      <section className="mx-auto max-w-[1600px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            {t("guide.notes.h1")}
          </h1>
          <p className="mt-4 text-lg leading-8 text-[color:var(--ink)]/65">
            {t("guide.notes.intro")}
          </p>
        </div>

        <div className="mt-12 max-w-4xl">
          <GuideHeading>{t("guide.notes.how_title")}</GuideHeading>
          <div className="mt-6">
            <GuideSteps steps={steps} />
          </div>
        </div>

        <div className="mt-14 grid max-w-4xl gap-6 lg:grid-cols-2">
          <div>
            <GuideHeading>{t("guide.notes.banned_title")}</GuideHeading>
            <div className="mt-6 rounded-2xl border border-[color:var(--ink)]/12 p-5 sm:p-6">
              <ul className="space-y-3">
                {banned.map((text) => (
                  <li
                    key={text}
                    className="flex gap-3 text-sm leading-relaxed text-[color:var(--ink)]/80"
                  >
                    <CircleX className="mt-1 h-4 w-4 shrink-0 text-[#dc2626]" aria-hidden="true" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <GuideHeading>{t("guide.notes.enforcement_title")}</GuideHeading>
            <div className="mt-6 space-y-3">
              {(["reject", "repeat", "remove"] as const).map((key) => (
                <div
                  key={key}
                  className="flex items-start gap-3 rounded-2xl border border-[color:var(--ink)]/12 bg-[color:var(--surface-subtle)] p-5"
                >
                  <CircleCheck
                    className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--brand-link)]"
                    aria-hidden="true"
                  />
                  <p className="text-sm leading-relaxed text-[color:var(--ink)]/75">
                    {t(`guide.notes.enforcement_${key}`)}
                  </p>
                </div>
              ))}
            </div>
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
            <Link to="/tutors" search={{ view: "materials" }}>
              {t("guide.notes.cta_browse")} <ArrowRight />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-auto w-full rounded-xl px-6 py-3.5"
          >
            <Link to="/legal/notes-terms">{t("guide.notes.terms_link")}</Link>
          </Button>
          <p className="max-w-2xl text-xs leading-6 text-[color:var(--ink)]/55 sm:col-span-2">
            {t("guide.notes.upload_note")}
          </p>
        </GuideCtaRow>
      </section>
    </GuidePage>
  );
}
