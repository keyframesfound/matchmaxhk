import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, CircleCheck, CircleX } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ContentsRow,
  GuideHeading,
  GuidePage,
  GuideRules,
  GuideSteps,
} from "@/features/guide/guide-shell";

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
      { property: "og:url", content: "https://matchmax.hk/guide/notes" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/guide/notes" }],
  }),
  component: GuideNotesPage,
});

/**
 * Issue #211: the notes page sells the service AND states the ban list.
 * The dangerous "school-specific past-paper solutions" claim is removed from
 * every public surface; the ban list sits above any upload entry point.
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

  const allowed: [string, string][] = (["own", "examples", "checklists", "exemplar"] as const).map(
    (key) => ["✓", t(`guide.notes.allowed_${key}`)],
  );

  const banned: [string, string][] = (
    ["school_papers", "publisher", "hkeaa", "ib", "classmate", "contact"] as const
  ).map((key) => ["✗", t(`guide.notes.banned_${key}`)]);

  return (
    <GuidePage current="/guide/notes">
      <ContentsRow
        items={[
          { id: "how", label: t("guide.nav_how_it_works") },
          { id: "allowed", label: t("guide.notes.allowed_title") },
          { id: "ban-list", label: t("guide.notes.banned_title") },
          { id: "enforcement", label: t("guide.notes.enforcement_title") },
        ]}
      />
      <section className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
        <div className="max-w-3xl">
          <p className="text-sm font-bold text-[color:var(--muted-foreground)]">
            {t("guide.notes.eyebrow")}
          </p>
          <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            {t("guide.tab_notes")}
          </h1>
          <p className="mt-4 text-lg leading-8 text-[color:var(--ink)]/65">
            {t("guide.notes.intro")}
          </p>
        </div>

        <div id="how" className="mt-12 max-w-4xl scroll-mt-40">
          <GuideHeading>{t("guide.notes.how_title")}</GuideHeading>
          <div className="mt-6">
            <GuideSteps steps={steps} />
          </div>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <div id="allowed" className="scroll-mt-40">
            <GuideHeading>{t("guide.notes.allowed_title")}</GuideHeading>
            <div className="mt-6 rounded-2xl border border-[color:var(--ink)]/12 p-5 sm:p-6">
              <GuideRules items={allowed} />
            </div>
          </div>

          <div id="ban-list" className="scroll-mt-40">
            <GuideHeading>{t("guide.notes.banned_title")}</GuideHeading>
            <div className="mt-6 rounded-2xl border-2 border-red-600/30 bg-red-500/[0.04] p-5 sm:p-6">
              <ul className="space-y-3">
                {banned.map(([marker, text]) => (
                  <li
                    key={text}
                    className="flex gap-3 text-sm leading-7 text-[color:var(--ink)]/80"
                  >
                    <CircleX className="mt-1.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                    <span>
                      <span className="sr-only">{marker} </span>
                      {text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div id="enforcement" className="mt-14 max-w-4xl scroll-mt-40">
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
                <p className="text-sm leading-7 text-[color:var(--ink)]/75">
                  {t(`guide.notes.enforcement_${key}`)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-center gap-3">
          <Button asChild size="lg" variant="solid" color="accent">
            <Link to="/tutors" search={{ view: "materials" }}>
              {t("guide.notes.cta_browse")} <ArrowRight />
            </Link>
          </Button>
          <Link to="/legal/notes-terms" className="text-sm font-bold underline underline-offset-4">
            {t("guide.notes.terms_link")}
          </Link>
        </div>
        <p className="mt-6 max-w-2xl text-xs leading-6 text-[color:var(--ink)]/55">
          {t("guide.notes.upload_note")}
        </p>
      </section>
    </GuidePage>
  );
}
