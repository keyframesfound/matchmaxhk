import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { currentSeoLocale, localizedMeta } from "@/features/i18n/seo";

import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";
import {
  ArrowRight,
  Building2,
  BookOpen,
  Clock3,
  CreditCard,
  FileText,
  Gift,
  Search,
  ShieldCheck,
  UserRoundCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ContentsRow, GuideHeading, GuidePage, type GuideTab } from "@/features/guide/guide-shell";

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
        { property: "og:url", content: "https://matchmax.hk/guide" },
      ],
      links: [{ rel: "canonical", href: "https://matchmax.hk/guide" }],
    };
  },
  component: GuideIndexPage,
});

type ComparisonRow = {
  aspect: string;
  oldWay: string;
  advantage: string;
  detail: string;
};

type FaqItem = { id: string; title: string; content: string };

type GuideCard = {
  to: GuideTab;
  icon: typeof Search;
  title: string;
  body: string;
};

function useGuideContent() {
  const { t } = useTranslation();

  const comparisonRow = (key: string): ComparisonRow => ({
    aspect: t(`hiw.edu.${key}.aspect`),
    oldWay: t(`hiw.edu.${key}.old`),
    advantage: t(`hiw.edu.${key}.adv`),
    detail: t(`hiw.edu.${key}.detail`),
  });

  const guideComparison = (["commission", "screening", "fit", "privacy"] as const).map(
    comparisonRow,
  );

  const faqItems = (
    group: "tutor_faq" | "parent_faq" | "billing_faq",
    keys: readonly string[],
  ): FaqItem[] =>
    keys.map((key, index) => ({
      id: String(index + 1),
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

function ComparisonTable({ title, rows }: { title: string; rows: ComparisonRow[] }) {
  const { t } = useTranslation();
  return (
    <div>
      <GuideHeading>{title}</GuideHeading>
      <div className="mt-5 rounded-2xl border border-[color:var(--ink)]/12 bg-[color:var(--card)] p-5 md:p-8">
        <div className="hidden gap-x-10 border-b border-[color:var(--ink)]/20 pb-4 md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
          <p className="text-sm font-medium text-[color:var(--ink)]/55">{t("hiw.table_aspect")}</p>
          <p className="text-sm font-medium text-[color:var(--ink)]/55">{t("hiw.table_old")}</p>
          <p className="text-sm font-medium text-[color:var(--brand-link)]">{t("hiw.table_max")}</p>
        </div>
        <ul>
          {rows.map((row, index) => {
            const isLast = index === rows.length - 1;
            return (
              <li
                key={row.aspect}
                className={`max-md:py-5 md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.2fr)] md:gap-x-10 md:py-9 transition-colors hover:bg-[color:var(--foreground)]/[0.02] ${
                  isLast ? "" : "border-b border-[color:var(--ink)]/12"
                }`}
              >
                <h3 className="text-lg font-medium tracking-tight">{row.aspect}</h3>
                <div className="max-md:mt-4">
                  <p className="mb-1 text-xs font-medium text-[color:var(--ink)]/45 md:hidden">
                    {t("hiw.table_old_mobile")}
                  </p>
                  <p className="text-sm leading-6 text-[color:var(--ink)]/60">{row.oldWay}</p>
                </div>
                <div aria-hidden="true" className="flex items-center gap-3 md:hidden max-md:mt-4">
                  <span className="h-px flex-1 bg-[color:var(--border)]" />
                  <span className="text-[11px] font-medium text-[color:var(--ink)]">
                    {t("hiw.table_vs")}
                  </span>
                  <span className="h-px flex-1 bg-[color:var(--border)]" />
                </div>
                <div className="max-md:mt-4">
                  <p className="mb-1 text-xs font-medium text-[color:var(--brand-link)] md:hidden">
                    {t("hiw.table_max")}
                  </p>
                  <p className="text-sm leading-6 text-[color:var(--ink)]">
                    <strong className="font-medium text-[color:var(--brand-link)]">
                      {row.advantage}:
                    </strong>{" "}
                    {row.detail}
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

/** FAQ accordion, flat, borders only. */
function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <Accordion type="single" collapsible>
      {items.map((item, index) => (
        <AccordionItem key={index} value={`item-${index}`}>
          <AccordionTrigger className="font-medium hover:no-underline">
            {item.title}
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground">{item.content}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
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
      icon: ShieldCheck,
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
      <ContentsRow
        items={[
          { id: "why-us", label: t("guide.nav_why_us") },
          { id: "matching", label: t("guide.nav_matching") },
          { id: "verification", label: t("guide.nav_verification") },
          { id: "faq", label: t("guide.nav_faq") },
        ]}
      />
      {/* Why us */}
      <section
        id="why-us"
        className="mx-auto max-w-[1600px] scroll-mt-32 px-5 py-16 text-center sm:px-8 sm:py-24 lg:px-12"
      >
        <h1 className="mx-auto max-w-4xl text-5xl font-medium leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
          {t("hiw.hero_title")}
        </h1>
        <p className="mx-auto mt-6 max-w-4xl text-lg leading-8 text-[color:var(--ink)]/65">
          {t("hiw.hero_body")}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" variant="solid" color="accent">
            <Link to="/tutors">
              {t("hiw.hero_cta_browse")} <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/join">{t("hiw.hero_cta_apply")}</Link>
          </Button>
        </div>
        <div className="mt-14 text-left">
          <ComparisonTable title={t("hiw.compare_table_title")} rows={guideComparison} />
        </div>
      </section>

      {/* Matching flow */}
      <section
        id="matching"
        className="scroll-mt-32 bg-[#0f1419] py-16 text-[#0f1419] dark:bg-[color:var(--surface-subtle)] dark:text-white sm:py-24"
      >
        <div className="mx-auto max-w-[1600px] px-5 text-white sm:px-8 lg:px-12">
          <div className="grid gap-6 md:grid-cols-[0.7fr_1.3fr] md:items-end">
            <div>
              <div className="mt-5 flex items-center gap-3 text-sm font-medium">
                <Clock3 className="h-5 w-5" /> {t("hiw.flow_speed")}
              </div>
            </div>
            <div>
              <h2 className="max-w-3xl text-4xl font-medium leading-[1.02] tracking-tight text-white sm:text-5xl">
                {t("hiw.flow_title")}
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/70">
                {t("hiw.flow_body")}
              </p>
              <p className="mt-3 max-w-xl text-base font-medium leading-7 text-white">
                {t("hiw.flow_oneliner")}
              </p>
            </div>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {(
              [
                { icon: Search, key: "parents" },
                { icon: UserRoundCheck, key: "tutors" },
              ] as const
            ).map(({ icon: Icon, key }) => (
              <div
                key={key}
                className="rounded-2xl border border-white/15 bg-white/[0.04] p-6 transition-colors hover:border-white/30 sm:p-8"
              >
                <Icon className="h-6 w-6" aria-hidden="true" />
                <h3 className="mt-4 text-xl font-medium tracking-tight text-white">
                  {t(`guide.match_${key}_title`)}
                </h3>
                <p className="mt-3 text-sm leading-7 text-white/75">
                  {t(`guide.match_${key}_body`)}
                </p>
                <Link
                  to={key === "parents" ? "/guide/parents" : "/guide/tutors"}
                  className="mt-4 inline-flex items-center text-sm font-medium transition-transform hover:translate-x-1"
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
              <Icon className="h-6 w-6 text-[color:var(--brand-link)]" aria-hidden="true" />
              <h3 className="mt-4 flex items-center gap-2 text-lg font-medium tracking-tight">
                {title}
                <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
              </h3>
              <p className="mt-2 text-sm leading-6 text-[color:var(--ink)]/65">{body}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Verification summary */}
      <section
        id="verification"
        className="scroll-mt-32 border-t border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] py-16 sm:py-24"
      >
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-4xl">
            <GuideHeading>{t("hiw.verification_title")}</GuideHeading>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-[color:var(--ink)]/12 bg-[color:var(--card)] p-6 transition-colors hover:border-[color:var(--ink)]/25 md:p-8">
                <h3 className="flex items-center gap-2 text-lg font-medium tracking-tight sm:text-xl">
                  <ShieldCheck
                    className="h-5 w-5 text-[color:var(--brand-link)]"
                    aria-hidden="true"
                  />
                  {t("hiw.verification_tier2_title")}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[color:var(--ink)]/65">
                  {t("hiw.verification_tier2_body")}
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--ink)]/12 bg-[color:var(--card)] p-6 transition-colors hover:border-[color:var(--ink)]/25 md:p-8">
                <h3 className="flex items-center gap-2 text-lg font-medium tracking-tight sm:text-xl">
                  <FileText
                    className="h-5 w-5 text-[color:var(--muted-foreground)]"
                    aria-hidden="true"
                  />
                  {t("hiw.verification_tier1_title")}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[color:var(--ink)]/65">
                  {t("hiw.verification_tier1_body")}
                </p>
              </div>
            </div>
            <p className="mt-6 text-sm leading-6 text-[color:var(--ink)]/55">
              {t("hiw.verification_disclaimer")}
            </p>
            <Link
              to="/guide/verification"
              className="mt-4 inline-flex items-center text-sm font-medium transition-transform hover:translate-x-1"
            >
              {t("guide.index_verification_link")} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ, all three groups live here (Ryan: subpages stay lean) */}
      <section
        id="faq"
        className="mx-auto max-w-[1600px] scroll-mt-32 px-5 py-16 sm:px-8 sm:py-24 lg:px-12"
      >
        <div className="mx-auto max-w-4xl">
          <GuideHeading>{t("hiw.faq_title")}</GuideHeading>

          <div className="mt-12">
            <h3 className="flex items-center gap-2 text-2xl font-medium tracking-tight">
              <UserRoundCheck
                className="h-6 w-6 text-[color:var(--muted-foreground)]"
                aria-hidden="true"
              />
              {t("hiw.faq_tutors")}
            </h3>
            <div className="mt-5">
              <FaqAccordion items={tutorFaqItems} />
            </div>
          </div>

          <div className="mt-12">
            <h3 className="flex items-center gap-2 text-2xl font-medium tracking-tight">
              <Search className="h-6 w-6 text-[color:var(--muted-foreground)]" aria-hidden="true" />
              {t("hiw.faq_parents")}
            </h3>
            <div className="mt-5">
              <FaqAccordion items={parentFaqItems} />
            </div>
          </div>

          <div className="mt-12">
            <h3 className="flex items-center gap-2 text-2xl font-medium tracking-tight">
              <CreditCard
                className="h-6 w-6 text-[color:var(--muted-foreground)]"
                aria-hidden="true"
              />
              {t("hiw.faq_billing")}
            </h3>
            <div className="mt-5">
              <FaqAccordion items={billingFaqItems} />
            </div>
          </div>
        </div>
      </section>
    </GuidePage>
  );
}
