import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Check,
  Gift,
  Search,
  UserRoundCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  GuideCtaRow,
  GuideFaq,
  GuideHeading,
  GuidePage,
  type GuideTab,
} from "@/features/guide/guide-shell";

import { canonicalUrl, currentSeoLocale, hreflangLinks, localizedMeta } from "@/features/i18n/seo";
import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";

export const Route = createFileRoute("/guide/")({
  head: () => {
    const locale = currentSeoLocale();
    return {
      meta: [
        ...localizedMeta(locale, {
          title: {
            en: "Guide | MatchMax",
            "zh-HK": "指南 | MatchMax",
          },
          description: {
            en: "Why MatchMax, how matching works, and what we verify, plus guides for parents, tutors, notes buyers, and referrers.",
            "zh-HK":
              "點解揀 MatchMax、配對點運作、我哋核實啲乜——仲有家長、導師、筆記買家同推薦人嘅指南。",
          },
        }),
        { name: "robots", content: "index, follow" },
        { property: "og:url", content: canonicalUrl("/guide") },
      ],
      links: [{ rel: "canonical", href: canonicalUrl("/guide") }, ...hreflangLinks("/guide")],
    };
  },
  component: GuideIndexPage,
});

type ComparisonRow = { aspect: string; oldWay: string; max: string };

type FaqItem = { title: string; content: string };

type GuideCard = {
  to: GuideTab;
  icon: typeof Search;
  title: string;
  body: string;
};

function useGuideContent() {
  const { t } = useTranslation();

  // Issue #492: fee density moved to the fee-bar visual, so the comparison
  // table carries the three non-money rows only, MatchMax column highlighted.
  const guideComparison: ComparisonRow[] = (["verification", "fit", "privacy"] as const).map(
    (key) => ({
      aspect: t(`hiw.edu.${key}.aspect`),
      oldWay: t(`hiw.edu.${key}.old`),
      max: t(`hiw.edu.${key}.max`),
    }),
  );

  const faqItems = (
    group: "tutor_faq" | "parent_faq" | "billing_faq",
    keys: readonly string[],
  ): FaqItem[] =>
    keys.map((key) => ({
      title: t(`hiw.${group}.${key}.q`),
      content: t(`hiw.${group}.${key}.a`),
    }));

  const tutorFaqItems = faqItems("tutor_faq", [
    "paid",
    "anonymity",
    "speed",
    "rates",
    "experience",
    "modes",
    "after_trial",
  ]);
  const parentFaqItems = faqItems("parent_faq", [
    "negotiate",
    "trial",
    "matching",
    "anonymity",
    "involvement",
    "verification",
    "payments",
  ]);
  const billingFaqItems = faqItems("billing_faq", [
    "pay",
    "notes",
    "rematch",
    "reschedule",
    "account",
  ]);

  return {
    t,
    guideComparison,
    tutorFaqItems,
    parentFaqItems,
    billingFaqItems,
  };
}

/** Issue #492 wireframe D: fee bars — old agencies' full slate bar vs the
 * short azure MatchMax bar (~25% width). Labels ride the token azure
 * (--btn-accent), never raw #1d9bf0, so the AA floor holds. */
function FeeBars() {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-[color:var(--ink)]/12 bg-[color:var(--card)] p-5 text-left sm:p-6">
      <h3 className="text-lg font-bold tracking-tight">{t("hiw.fee_title")}</h3>
      <div className="mt-5 space-y-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="w-40 shrink-0 text-sm text-muted-foreground max-sm:w-full">
            {t("hiw.fee_old_label")}
          </span>
          <div className="h-7 min-w-[120px] flex-1 rounded-md bg-[color:var(--ink)]/20" />
          <span className="shrink-0 text-sm text-muted-foreground">{t("hiw.fee_old_value")}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="w-40 shrink-0 text-sm font-semibold max-sm:w-full">
            {t("hiw.fee_max_label")}
          </span>
          <div className="h-7 w-1/4 min-w-[120px] rounded-md bg-[color:var(--btn-accent)]" />
          <span className="shrink-0 text-sm font-semibold text-[color:var(--ink)]">
            {t("hiw.fee_max_value")}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Comparison rows with the MatchMax column highlighted (azure wash). */
function ComparisonTable({ title, rows }: { title: string; rows: ComparisonRow[] }) {
  const { t } = useTranslation();
  return (
    <div className="mt-14 text-left">
      <GuideHeading>{title}</GuideHeading>
      <div className="mt-6 rounded-2xl border border-[color:var(--ink)]/12 bg-[color:var(--card)] p-5 sm:p-6 md:p-8">
        <div className="hidden gap-x-8 border-b border-[color:var(--ink)]/20 pb-4 md:grid md:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
          <p className="text-sm font-bold text-[color:var(--ink)]/55">{t("hiw.table_aspect")}</p>
          <p className="text-sm font-bold text-[color:var(--ink)]/55">{t("hiw.table_old")}</p>
          <p className="text-sm font-bold text-[color:var(--brand-link)]">{t("hiw.table_max")}</p>
        </div>
        <ul>
          {rows.map((row, index) => {
            const isLast = index === rows.length - 1;
            return (
              <li
                key={row.aspect}
                className={`py-5 md:grid md:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,1.4fr)] md:gap-x-8 md:py-5 ${
                  isLast ? "" : "border-b border-[color:var(--ink)]/10"
                }`}
              >
                <h3 className="text-base font-bold tracking-tight">{row.aspect}</h3>
                <div className="max-md:mt-3">
                  <p className="mb-1 text-xs font-medium text-[color:var(--ink)]/45 md:hidden">
                    {t("hiw.table_old_mobile")}
                  </p>
                  <p className="text-sm leading-6 text-[color:var(--ink)]/60">{row.oldWay}</p>
                </div>
                <div className="max-md:mt-3 md:rounded-xl md:bg-[color:var(--accent)] md:px-4 md:py-3">
                  <p className="mb-1 text-xs font-medium text-[color:var(--brand-link)] md:hidden">
                    {t("hiw.table_max")}
                  </p>
                  <p className="text-sm font-semibold leading-6 text-[color:var(--ink)]">
                    {row.max}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function GuideIndexPage() {
  const { t } = useTranslation();
  const { guideComparison, tutorFaqItems, parentFaqItems, billingFaqItems } = useGuideContent();

  const guideCards: GuideCard[] = [
    {
      to: "/guide/parents",
      icon: Users,
      title: t("guide.tab_parents"),
      body: t("guide.index_parents_body"),
    },
    {
      to: "/guide/tutors",
      icon: UserRoundCheck,
      title: t("guide.tab_tutors"),
      body: t("guide.index_tutors_body"),
    },
    {
      to: "/guide/notes",
      icon: BookOpen,
      title: t("guide.tab_notes"),
      body: t("guide.index_notes_body"),
    },
    {
      to: "/guide/refer",
      icon: Gift,
      title: t("guide.tab_refer"),
      body: t("guide.index_refer_body"),
    },
    {
      to: "/guide/verification",
      icon: Search,
      title: t("guide.tab_verification"),
      body: t("guide.index_verification_body"),
    },
    // Issue #412 G: hidden with the tab while the centre market is off.
    ...(CENTRE_MARKET_ENABLED
      ? [
          {
            to: "/guide/partners" as const,
            icon: Building2,
            title: t("guide.tab_partners"),
            body: t("guide.index_partners_body"),
          },
        ]
      : []),
  ];

  return (
    <GuidePage current="/guide">
      {/* Why us */}
      <section
        id="why-us"
        className="mx-auto max-w-[1600px] scroll-mt-32 px-5 pb-16 pt-12 text-center sm:px-8 sm:pb-24 sm:pt-16 lg:px-12"
      >
        <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--accent)] px-4 py-1.5 text-sm font-semibold text-[color:var(--ink)]">
          {t("guide.index_badge")}
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          {t("hiw.hero_title")}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[color:var(--ink)]/65">
          {t("hiw.hero_body")}
        </p>
        <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-2">
          {(["hiw.value_pill_1", "hiw.value_pill_2"] as const).map((key) => (
            <span
              key={key}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink)]/12 px-4 py-2 text-sm font-medium"
            >
              <Check className="h-4 w-4 text-[color:var(--brand-link)]" aria-hidden="true" />
              {t(key)}
            </span>
          ))}
        </div>
        <div className="mx-auto mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
          <Button
            asChild
            size="lg"
            variant="solid"
            color="neutral"
            className="h-auto w-full rounded-xl px-6 py-3.5"
          >
            <Link to="/tutors">
              {t("hiw.hero_cta_browse")} <ArrowRight />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-auto w-full rounded-xl px-6 py-3.5"
          >
            <Link to="/join">{t("hiw.hero_cta_apply")}</Link>
          </Button>
        </div>
        <div className="mx-auto mt-12 max-w-4xl">
          <FeeBars />
        </div>
        <ComparisonTable title={t("hiw.compare_table_title")} rows={guideComparison} />
      </section>

      {/* Concierge matching, for parents and tutors (fee framing locked:
          tutor-pays, Cap.57 independent operators — issue #492). */}
      <section
        id="matching"
        className="scroll-mt-32 bg-[#0f1419] py-16 text-[#0f1419] dark:bg-[color:var(--surface-subtle)] dark:text-white sm:py-24"
      >
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8 lg:px-12">
          <h2 className="text-3xl font-bold leading-[1.05] tracking-tight text-white sm:text-4xl">
            {t("hiw.flow_title")}
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {(
              [
                { icon: Search, key: "parents" },
                { icon: UserRoundCheck, key: "tutors" },
              ] as const
            ).map(({ icon: Icon, key }) => (
              <div
                key={key}
                className="rounded-2xl border border-white/15 bg-white/[0.04] p-6 sm:p-8"
              >
                <h3 className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-white">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {t(`guide.match_${key}_title`)}
                </h3>
                <ul className="mt-4 space-y-3">
                  {([1, 2, 3] as const).map((n) => (
                    <li key={n} className="flex gap-3 text-sm leading-relaxed text-white/80">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#8ecdf8]"
                        aria-hidden="true"
                      />
                      <span>{t(`guide.match_${key}_p${n}`)}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={key === "parents" ? "/guide/parents" : "/guide/tutors"}
                  className="mt-5 inline-flex items-center text-sm font-bold text-white"
                >
                  {t(`guide.match_${key}_link`)} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Explore the guides */}
      <section className="mx-auto max-w-[1600px] px-5 py-16 sm:px-8 sm:py-24 lg:px-12">
        <GuideHeading>{t("guide.index_explore_title")}</GuideHeading>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guideCards.map(({ to, icon: Icon, title, body }) => (
            <Link
              key={to}
              to={to}
              className="group rounded-2xl border border-[color:var(--ink)]/12 p-6 transition-colors hover:border-[color:var(--brand-link)]/40"
            >
              <h3 className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
                <Icon
                  className="h-5 w-5 shrink-0 text-[color:var(--brand-link)]"
                  aria-hidden="true"
                />
                {title}
                <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </h3>
              <p className="mt-2 text-sm leading-6 text-[color:var(--ink)]/65">{body}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* FAQ, all three groups live here (subpages stay lean) */}
      <section
        id="faq"
        className="mx-auto max-w-[1600px] scroll-mt-32 px-5 pb-24 pt-0 sm:px-8 sm:pb-24 lg:px-12"
      >
        <div className="mx-auto max-w-4xl">
          <GuideHeading>{t("hiw.faq_title")}</GuideHeading>

          <div className="mt-10">
            <h3 className="text-xl font-bold tracking-tight">{t("hiw.faq_tutors")}</h3>
            <div className="mt-3">
              <GuideFaq items={tutorFaqItems} />
            </div>
          </div>

          <div className="mt-12">
            <h3 className="text-xl font-bold tracking-tight">{t("hiw.faq_parents")}</h3>
            <div className="mt-3">
              <GuideFaq items={parentFaqItems} />
            </div>
          </div>

          <div className="mt-12">
            <h3 className="text-xl font-bold tracking-tight">{t("hiw.faq_billing")}</h3>
            <div className="mt-3">
              <GuideFaq items={billingFaqItems} />
            </div>
          </div>
        </div>
      </section>
    </GuidePage>
  );
}
