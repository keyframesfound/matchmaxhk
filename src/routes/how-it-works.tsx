import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Asterisk,
  BadgeCheck,
  Building2,
  Check,
  Clock3,
  GraduationCap,
  HandCoins,
  MessageCircle,
  Search,
  UserRoundCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { BlurHighlightText } from "@/components/ui/blur-highlight-text";
import { Button } from "@/components/ui/button";
import { fetchLandingStats } from "@/features/tutors/queries";
import { MatchFlowTrack } from "@/components/ui/match-flow-track";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Reveal } from "@/components/ui/reveal";
import { ScrollProgressRail } from "@/components/ui/scroll-progress";
import { VerificationPipeline } from "@/components/ui/verification-pipeline";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works | MatchMax" },
      {
        name: "description",
        content:
          "Discover MatchMax's transparent, high-calibre tutoring matching for families, tutors, and education centres in Hong Kong — plus answers to the most frequently asked questions.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: HowItWorksPage,
});

type ComparisonRow = {
  aspect: string;
  oldWay: string;
  advantage: string;
  detail: string;
};

type ValueProp = {
  icon: typeof Search;
  title: string;
  detail: string;
};

type FaqItem = { id: string; title: string; content: string };

const PROP_ICONS = {
  screening: BadgeCheck,
  fees: HandCoins,
  b2b: Building2,
  founded: GraduationCap,
} as const;

function useHowItWorksContent() {
  const { t } = useTranslation();

  const valueProps: ValueProp[] = (["screening", "fees", "b2b", "founded"] as const).map((key) => ({
    icon: PROP_ICONS[key],
    title: t(`hiw.props.${key}.title`),
    detail: t(`hiw.props.${key}.detail`),
  }));

  const comparisonRow = (group: "edu" | "parent_cmp", key: string): ComparisonRow => ({
    aspect: t(`hiw.${group}.${key}.aspect`),
    oldWay: t(`hiw.${group}.${key}.old`),
    advantage: t(`hiw.${group}.${key}.adv`),
    detail: t(`hiw.${group}.${key}.detail`),
  });

  const educatorComparison = (
    ["commission", "travel", "credibility", "voice", "privacy"] as const
  ).map((key) => comparisonRow("edu", key));

  const parentComparison = (["browsing", "screening", "quality", "scores", "alumni"] as const).map(
    (key) => comparisonRow("parent_cmp", key),
  );

  const parentSteps: [string, string, string][] = (["s1", "s2", "s3"] as const).map(
    (key, index) => [
      String(index + 1).padStart(2, "0"),
      t(`hiw.parents_steps.${key}.title`),
      t(`hiw.parents_steps.${key}.detail`),
    ],
  );

  const tutorSteps: [string, string, string][] = (["s1", "s2", "s3"] as const).map((key, index) => [
    String(index + 1).padStart(2, "0"),
    t(`hiw.tutors_steps.${key}.title`),
    t(`hiw.tutors_steps.${key}.detail`),
  ]);

  const faqItems = (group: "tutor_faq" | "parent_faq", keys: readonly string[]): FaqItem[] =>
    keys.map((key, index) => ({
      id: String(index + 1),
      title: t(`hiw.${group}.${key}.q`),
      content: t(`hiw.${group}.${key}.a`),
    }));

  const tutorFaqItems = faqItems("tutor_faq", [
    "paid",
    "speed",
    "rates",
    "experience",
    "modes",
    "protection",
  ]);
  const parentFaqItems = faqItems("parent_faq", [
    "negotiate",
    "trial",
    "matching",
    "verification",
    "payments",
  ]);

  const machineSteps = (["s1", "s2", "s3", "s4"] as const).map((key) => ({
    title: t(`hiw.machine_steps.${key}.title`),
    detail: t(`hiw.machine_steps.${key}.detail`),
    ...(key === "s3" ? { badge: t("hiw.machine_verified") } : {}),
  }));

  return {
    t,
    valueProps,
    educatorComparison,
    parentComparison,
    parentSteps,
    tutorSteps,
    tutorFaqItems,
    parentFaqItems,
    machineSteps,
  };
}

function DeltaLedger({
  title,
  rows,
  t,
}: {
  title: string;
  rows: ComparisonRow[];
  t: (key: string) => string;
}) {
  return (
    <div>
      <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h3>
      <div className="mt-8 hidden gap-x-10 border-b border-white/15 pb-4 md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
        <p className="text-sm font-bold text-white/45">{t("hiw.table_aspect")}</p>
        <p className="text-sm font-bold text-white/45 line-through decoration-white/30">
          {t("hiw.table_old")}
        </p>
        <p className="text-sm font-bold text-[#1d9bf0]">{t("hiw.table_max")}</p>
      </div>
      <ul>
        {rows.map((row) => (
          <Reveal key={row.aspect} className="border-b border-white/10">
            <li className="grid gap-x-10 gap-y-4 py-7 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.2fr)] md:gap-y-0 md:py-9">
              <h4 className="text-lg font-bold tracking-tight">{row.aspect}</h4>
              <div>
                <p className="mb-1 text-xs font-medium text-white/40 md:hidden">
                  {t("hiw.table_old_mobile")}
                </p>
                <p className="text-sm leading-6 text-white/45 line-through decoration-white/30">
                  {row.oldWay}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-[#8ecdf8] md:hidden">
                  {t("hiw.table_max")}
                </p>
                <p className="text-sm leading-6 text-white/85">
                  <strong className="font-bold text-[#1d9bf0]">{row.advantage}: </strong>
                  {row.detail}
                </p>
              </div>
            </li>
          </Reveal>
        ))}
      </ul>
    </div>
  );
}

function HowItWorksPage() {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const {
    valueProps,
    educatorComparison,
    parentComparison,
    parentSteps,
    tutorSteps,
    tutorFaqItems,
    parentFaqItems,
    machineSteps,
  } = useHowItWorksContent();

  const { data: studentsMatched = "0" } = useQuery({
    queryKey: ["settings", "students_matched"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "students_matched")
        .maybeSingle();
      if (error) throw error;
      return typeof data?.value === "string" ? data.value : "0";
    },
  });

  const { data: landingStats } = useQuery({
    queryKey: ["landing", "stats"],
    queryFn: fetchLandingStats,
  });

  const stats = [
    {
      target: Number.parseInt(studentsMatched.replace(/[^0-9]/g, ""), 10) || 0,
      label: t("hiw.stats_matched_label"),
    },
    {
      target: landingStats?.activeTutors ?? 0,
      label: t("hiw.stats_edu_label"),
    },
    {
      target: landingStats?.subjectsCovered ?? 0,
      label: t("hiw.stats_subjects_label"),
    },
  ];

  const heroHighlights = t("hiw.hero_title_highlights", { returnObjects: true }) as string[];

  return (
    <div className="how-it-works-paper flex min-h-screen flex-col text-[color:var(--ink)]">
      <SiteHeader className="!border-b-0 !bg-white/95 dark:!bg-[color:var(--surface)]" />
      <ScrollProgressRail />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <AuroraBackground className="opacity-70" />
          <div className="relative mx-auto max-w-[1440px] px-5 pb-16 pt-20 sm:px-8 sm:pb-24 sm:pt-28 lg:px-12">
            <p className="text-sm font-bold text-[color:var(--muted-foreground)]">
              {t("hiw.hero_eyebrow")}
            </p>
            <div className="relative mt-5 w-fit">
              <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
                <BlurHighlightText as="span" highlights={heroHighlights}>
                  {t("hiw.hero_title")}
                </BlurHighlightText>
              </h1>
              <motion.span
                aria-hidden="true"
                className="absolute -right-7 -top-5 text-[color:var(--brand-link)] sm:-right-10 sm:-top-6"
                animate={reducedMotion ? undefined : { rotate: 360 }}
                transition={{ duration: 24, ease: "linear", repeat: Infinity }}
              >
                <Asterisk className="h-6 w-6 sm:h-8 sm:w-8" />
              </motion.span>
            </div>
            <p className="mt-6 max-w-xl text-base leading-7 text-[color:var(--ink)]/65">
              {t("hiw.hero_body")}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" variant="solid" color="accent">
                <Link to="/tutors">
                  {t("hiw.hero_cta_browse")} <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/join">{t("hiw.hero_cta_apply")}</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 pb-20 sm:px-8 sm:pb-28 lg:px-12">
          <p className="text-sm font-bold text-[color:var(--muted-foreground)]">
            {t("hiw.stats_eyebrow")}
          </p>
          <dl className="mt-8 grid gap-x-10 gap-y-8 border-y border-[color:var(--ink)]/12 py-10 sm:grid-cols-3">
            {stats.map((stat, index) => (
              <Reveal key={stat.label} delay={index * 0.08}>
                <div>
                  <dd className="text-5xl font-extrabold tracking-tight text-[color:var(--brand-link)] sm:text-6xl">
                    <NumberTicker target={stat.target} duration={2.2} delay={index * 0.15} />
                  </dd>
                  <dt className="mt-3 text-sm font-bold text-[color:var(--muted-foreground)]">
                    {stat.label}
                  </dt>
                </div>
              </Reveal>
            ))}
          </dl>

          <p className="mt-16 text-sm font-bold text-[color:var(--muted-foreground)]">
            {t("hiw.props_eyebrow")}
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 sm:gap-8">
            {valueProps.map(({ icon: Icon, title, detail }, index) => (
              <Reveal key={title} delay={index * 0.05}>
                <article className="h-full rounded-[var(--radius-panel)] border border-[color:var(--ink)]/12 bg-[color:var(--surface)] p-6 shadow-[var(--shadow-brand)] sm:p-8">
                  <span className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-panel)] bg-[color:var(--foreground)]/[0.04]">
                    <Icon
                      className="h-6 w-6 text-[color:var(--muted-foreground)]"
                      aria-hidden="true"
                    />
                  </span>
                  <h3 className="mt-5 text-xl font-bold tracking-tight sm:text-2xl">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[color:var(--ink)]/65">{detail}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="bg-[#0f1419] text-white dark:bg-[color:var(--surface)]">
          <VerificationPipeline
            eyebrow={t("hiw.machine_eyebrow")}
            title={t("hiw.machine_title")}
            lead={t("hiw.machine_lead")}
            steps={machineSteps}
            handoffLabel={t("hiw.machine_handoff_label")}
            handoffFrom={t("hiw.machine_handoff_from")}
            handoffTo={t("hiw.machine_handoff_to")}
            demoNote={t("hiw.machine_demo_note")}
          />
          <div className="mx-auto max-w-[1440px] px-5 pb-24 sm:px-8 lg:px-12">
            <Reveal>
              <p className="max-w-xl text-base leading-7 text-white/55">{t("hiw.ledger_intro")}</p>
            </Reveal>
            <div className="mt-12 space-y-16 sm:space-y-20">
              <DeltaLedger title={t("hiw.compare_edu_title")} rows={educatorComparison} t={t} />
              <DeltaLedger title={t("hiw.compare_parent_title")} rows={parentComparison} t={t} />
            </div>
          </div>
        </section>

        <section className="px-5 py-20 text-[#0f1419] dark:bg-[#16181c] dark:text-white sm:px-8 sm:py-28 lg:px-12">
          <div className="mx-auto max-w-[1440px]">
            <div className="grid gap-6 md:grid-cols-[0.7fr_1.3fr] md:items-end">
              <div>
                <p className="text-sm font-bold text-[color:var(--muted-foreground)]">
                  {t("hiw.flow_eyebrow")}
                </p>
                <div className="mt-5 flex items-center gap-3 text-sm font-bold">
                  <Clock3 className="h-5 w-5" /> {t("hiw.flow_speed")}
                </div>
              </div>
              <h2 className="max-w-3xl text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
                {t("hiw.flow_title")}
              </h2>
            </div>
          </div>
        </section>

        <MatchFlowTrack
          tone="light"
          icon={Search}
          eyebrow={t("hiw.parents_eyebrow")}
          audience={t("hiw.parents_audience")}
          title={t("hiw.parents_title")}
          steps={parentSteps}
          links={[
            { to: "/tutors", label: t("hiw.parents_link_find") },
            {
              to: "/tutor-requests",
              search: { post: true },
              label: t("hiw.parents_link_request"),
            },
          ]}
          mockTitle={t("hiw.mock_title_parents")}
          mockStates={[
            t("hiw.mock_state_searching"),
            t("hiw.mock_state_shortlist"),
            t("hiw.mock_state_matched"),
          ]}
          mockNote={t("hiw.mock_note")}
          mockRowA={t("hiw.mock_row_profiles")}
          mockRowB={t("hiw.mock_row_match")}
        />

        <MatchFlowTrack
          tone="dark"
          icon={UserRoundCheck}
          eyebrow={t("hiw.tutors_eyebrow")}
          audience={t("hiw.tutors_audience")}
          title={t("hiw.tutors_title")}
          steps={tutorSteps}
          links={[
            { to: "/tutor-requests", label: t("hiw.tutors_link_cases") },
            { to: "/join", label: t("hiw.tutors_link_apply") },
          ]}
          mockTitle={t("hiw.mock_title_tutors")}
          mockStates={[
            t("hiw.mock_state_searching"),
            t("hiw.mock_state_shortlist"),
            t("hiw.mock_state_matched"),
          ]}
          mockNote={t("hiw.mock_note")}
          mockRowA={t("hiw.mock_row_profiles")}
          mockRowB={t("hiw.mock_row_match")}
        />

        <section
          id="faq"
          className="mx-auto max-w-[1440px] scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28 lg:px-12"
        >
          <div className="mx-auto max-w-4xl">
            <p className="text-sm font-bold text-[color:var(--muted-foreground)]">
              {t("hiw.faq_eyebrow")}
            </p>
            <h2 className="mt-3 text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
              {t("hiw.faq_title")}
            </h2>

            <Reveal className="mt-14">
              <h3 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                <UserRoundCheck
                  className="h-6 w-6 text-[color:var(--muted-foreground)]"
                  aria-hidden="true"
                />
                {t("hiw.faq_tutors")}
              </h3>
              <div className="mt-5 rounded-[var(--radius-panel)] border border-[color:var(--ink)]/12 bg-[color:var(--surface)] px-5 py-2 shadow-[var(--shadow-brand)] sm:px-8">
                <Accordion type="single" collapsible className="w-full">
                  {tutorFaqItems.map((item) => (
                    <AccordionItem
                      key={item.id}
                      value={`tutor-faq-${item.id}`}
                      className="border-[color:var(--ink)]/10"
                    >
                      <AccordionTrigger className="py-5 text-left text-lg font-bold text-[color:var(--ink)] hover:no-underline sm:text-xl">
                        {item.title}
                      </AccordionTrigger>
                      <AccordionContent className="pb-5 text-base leading-relaxed text-[color:var(--ink)]/70">
                        {item.content}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </Reveal>

            <Reveal className="mt-14">
              <h3 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                <Search
                  className="h-6 w-6 text-[color:var(--muted-foreground)]"
                  aria-hidden="true"
                />
                {t("hiw.faq_parents")}
              </h3>
              <div className="mt-5 rounded-[var(--radius-panel)] border border-[color:var(--ink)]/12 bg-[color:var(--surface)] px-5 py-2 shadow-[var(--shadow-brand)] sm:px-8">
                <Accordion type="single" collapsible className="w-full">
                  {parentFaqItems.map((item) => (
                    <AccordionItem
                      key={item.id}
                      value={`parent-faq-${item.id}`}
                      className="border-[color:var(--ink)]/10"
                    >
                      <AccordionTrigger className="py-5 text-left text-lg font-bold text-[color:var(--ink)] hover:no-underline sm:text-xl">
                        {item.title}
                      </AccordionTrigger>
                      <AccordionContent className="pb-5 text-base leading-relaxed text-[color:var(--ink)]/70">
                        {item.content}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="relative overflow-hidden">
          <AuroraBackground className="opacity-60" />
          <div className="relative mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
            <div className="grid gap-10 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <MessageCircle className="h-7 w-7 text-[color:var(--muted-foreground)]" />
                <h2 className="mt-7 max-w-4xl text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
                  {t("hiw.cta_title")}
                </h2>
                <p className="mt-6 max-w-xl text-base leading-7 text-[color:var(--ink)]/68">
                  {t("hiw.cta_body")}
                </p>
                <div className="mt-8">
                  <Button asChild size="lg" variant="solid" color="accent">
                    <Link to="/tutor-requests" search={{ post: true }}>
                      {t("hiw.parents_link_request")} <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-[color:var(--ink)]/70">
                <Check className="h-4 w-4 text-[color:var(--muted-foreground)]" />{" "}
                {t("hiw.cta_check")}
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter
        hideDivider
        className="!border-t-0 !bg-transparent dark:!bg-[color:var(--surface)]"
      />
    </div>
  );
}
