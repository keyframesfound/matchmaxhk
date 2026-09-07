import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
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

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

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

  return {
    t,
    valueProps,
    educatorComparison,
    parentComparison,
    parentSteps,
    tutorSteps,
    tutorFaqItems,
    parentFaqItems,
  };
}

function AudienceSection({
  eyebrow,
  audience,
  title,
  icon: Icon,
  steps,
  links,
  className,
  numberClassName,
  accentClassName,
  bodyTextClassName = "text-current/70",
}: {
  eyebrow: string;
  audience: string;
  title: string;
  icon: typeof Search;
  steps: [string, string, string][];
  links: { to: "/tutors" | "/join" | "/tutor-requests"; label: string; search?: { post?: true } }[];
  className: string;
  numberClassName: string;
  accentClassName: string;
  bodyTextClassName?: string;
}) {
  return (
    <section className={className}>
      <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <article className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,4fr)] lg:gap-20">
          <div className="h-fit lg:sticky lg:top-24">
            <Icon className={`h-7 w-7 ${accentClassName}`} />
            <p className={`mt-6 text-sm font-bold ${accentClassName}`}>{eyebrow}</p>
            <h3 className="mt-3 text-5xl font-extrabold leading-[1.02] tracking-tight text-inherit sm:text-6xl lg:text-7xl">
              {audience}
            </h3>
            <p className="mt-4 max-w-md text-xl font-bold leading-snug tracking-tight sm:text-2xl">
              {title}
            </p>
            <div className="mt-8 space-y-3">
              {links.map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  search={link.search}
                  className="inline-flex items-center text-sm font-bold transition-transform hover:translate-x-1"
                >
                  {link.label} <ArrowRight className={`ml-2 h-4 w-4 ${accentClassName}`} />
                </Link>
              ))}
            </div>
          </div>
          <ol className="border-t border-current/20">
            {steps.map(([number, stepTitle, text]) => (
              <li
                key={number}
                className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-5 border-b border-current/20 py-7 sm:gap-8 sm:py-9"
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center text-sm font-bold ${numberClassName}`}
                >
                  {number}
                </span>
                <div>
                  <h4 className="text-xl font-bold tracking-tight text-inherit sm:text-2xl">
                    {stepTitle}
                  </h4>
                  <p className={`mt-3 max-w-2xl text-sm leading-7 ${bodyTextClassName}`}>{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </article>
      </div>
    </section>
  );
}

function ComparisonTable({ title, rows }: { title: string; rows: ComparisonRow[] }) {
  const { t } = useTranslation();
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      <div className="mt-8 hidden gap-x-10 border-b border-[color:var(--ink)]/20 pb-4 md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
        <p className="text-sm font-bold text-[color:var(--ink)]/55">{t("hiw.table_aspect")}</p>
        <p className="text-sm font-bold text-[color:var(--ink)]/55">{t("hiw.table_old")}</p>
        <p className="text-sm font-bold text-[color:var(--brand-link)]">{t("hiw.table_max")}</p>
      </div>
      <ul>
        {rows.map((row) => (
          <li
            key={row.aspect}
            className="grid gap-x-10 gap-y-4 border-b border-[color:var(--ink)]/12 py-7 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.2fr)] md:gap-y-0 md:py-9"
          >
            <h3 className="text-lg font-bold tracking-tight">{row.aspect}</h3>
            <div>
              <p className="mb-1 text-xs font-medium text-[color:var(--ink)]/45 md:hidden">
                {t("hiw.table_old_mobile")}
              </p>
              <p className="text-sm leading-6 text-[color:var(--ink)]/60">{row.oldWay}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-[color:var(--muted-foreground)] md:hidden">
                {t("hiw.table_max")}
              </p>
              <p className="text-sm leading-6 text-[color:var(--ink)]">
                <strong className="font-bold text-[color:var(--brand-link)]">
                  {row.advantage}:
                </strong>{" "}
                {row.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FaqAccordion({ items, className }: { items: FaqItem[]; className?: string }) {
  return (
    <Accordion type="single" collapsible className={className}>
      {items.map((item, index) => (
        <AccordionItem key={index} value={`item-${index}`}>
          <AccordionTrigger className="font-semibold hover:no-underline">
            {item.title}
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground">{item.content}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function HowItWorksPage() {
  const { t } = useTranslation();
  const {
    valueProps,
    educatorComparison,
    parentComparison,
    parentSteps,
    tutorSteps,
    tutorFaqItems,
    parentFaqItems,
  } = useHowItWorksContent();

  return (
    <div className="how-it-works-paper flex min-h-screen flex-col text-[color:var(--ink)]">
      <SiteHeader className="!border-b-0 !bg-white/95 dark:!bg-[color:var(--surface)]" />
      <main className="flex-1">
        <section className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
          <p className="text-sm font-bold text-[color:var(--muted-foreground)]">
            {t("hiw.hero_eyebrow")}
          </p>
          <div className="relative mt-5 w-fit">
            <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
              {t("hiw.hero_title")}
            </h1>
            <Asterisk className="absolute -right-6 -top-4 h-5 w-5 text-[color:var(--muted-foreground)] sm:-right-9 sm:-top-5 sm:h-7 sm:w-7" />
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
        </section>

        <section className="mx-auto max-w-[1440px] px-5 pb-20 sm:px-8 sm:pb-28 lg:px-12">
          <p className="text-sm font-bold text-[color:var(--muted-foreground)]">
            {t("hiw.props_eyebrow")}
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 sm:gap-8">
            {valueProps.map(({ icon: Icon, title, detail }) => (
              <article
                key={title}
                className="rounded-[var(--radius-panel)] border border-[color:var(--ink)]/12 bg-[color:var(--surface)] p-6 shadow-[var(--shadow-brand)] sm:p-8"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-panel)] bg-[color:var(--foreground)]/[0.04]">
                  <Icon
                    className="h-6 w-6 text-[color:var(--muted-foreground)]"
                    aria-hidden="true"
                  />
                </span>
                <h3 className="mt-5 text-xl font-bold tracking-tight sm:text-2xl">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-[color:var(--ink)]/65">{detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 pb-20 sm:px-8 sm:pb-28 lg:px-12">
          <p className="text-sm font-bold text-[color:var(--muted-foreground)]">
            {t("hiw.compare_eyebrow")}
          </p>
          <div className="mt-10 space-y-16 sm:mt-12 sm:space-y-20">
            <ComparisonTable title={t("hiw.compare_edu_title")} rows={educatorComparison} />
            <ComparisonTable title={t("hiw.compare_parent_title")} rows={parentComparison} />
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

        <AudienceSection
          eyebrow={t("hiw.parents_eyebrow")}
          audience={t("hiw.parents_audience")}
          title={t("hiw.parents_title")}
          icon={Search}
          steps={parentSteps}
          links={[
            { to: "/tutors", label: t("hiw.parents_link_find") },
            {
              to: "/tutor-requests",
              search: { post: true },
              label: t("hiw.parents_link_request"),
            },
          ]}
          className="bg-[#E3ECF6] text-[#0f1419] dark:bg-[#061622] dark:text-white"
          numberClassName="bg-[color:var(--foreground)]/[0.06] text-[color:var(--foreground)]"
          accentClassName="text-[color:var(--muted-foreground)]"
        />

        <AudienceSection
          eyebrow={t("hiw.tutors_eyebrow")}
          audience={t("hiw.tutors_audience")}
          title={t("hiw.tutors_title")}
          icon={UserRoundCheck}
          steps={tutorSteps}
          links={[
            { to: "/tutor-requests", label: t("hiw.tutors_link_cases") },
            { to: "/join", label: t("hiw.tutors_link_apply") },
          ]}
          className="bg-[#0f1419] !text-white dark:bg-[#0f1419] dark:!text-white"
          numberClassName="bg-[color:var(--foreground)]/[0.06] text-[color:var(--foreground)]"
          accentClassName="text-[color:var(--muted-foreground)]"
          bodyTextClassName="text-white"
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

            <div className="mt-14">
              <h3 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                <UserRoundCheck
                  className="h-6 w-6 text-[color:var(--muted-foreground)]"
                  aria-hidden="true"
                />
                {t("hiw.faq_tutors")}
              </h3>
              <FaqAccordion className="mt-5" items={tutorFaqItems} />
            </div>

            <div className="mt-14">
              <h3 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                <Search
                  className="h-6 w-6 text-[color:var(--muted-foreground)]"
                  aria-hidden="true"
                />
                {t("hiw.faq_parents")}
              </h3>
              <FaqAccordion className="mt-5" items={parentFaqItems} />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
          <div className="grid gap-10 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <MessageCircle className="h-7 w-7 text-[color:var(--muted-foreground)]" />
              <h2 className="mt-7 max-w-4xl text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
                {t("hiw.cta_title")}
              </h2>
              <p className="mt-6 max-w-xl text-base leading-7 text-[color:var(--ink)]/68">
                {t("hiw.cta_body")}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-[color:var(--ink)]/70">
              <Check className="h-4 w-4 text-[color:var(--muted-foreground)]" />{" "}
              {t("hiw.cta_check")}
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
