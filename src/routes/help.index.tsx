import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LifeBuoy, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";
import { z } from "zod";

import { WhatsAppIcon } from "@/components/layout/WhatsAppFloatButton";
import { PublicPage } from "@/components/layout/PublicPage";
import { useAuth } from "@/features/auth/useAuth";
import { HelpArticleLink, useSupportWhatsAppHref } from "@/features/help/components";
import {
  getHelpCategory,
  getHelpIcon,
  getHelpTopics,
  searchHelpArticles,
  type HelpArticle,
} from "@/features/help/content";
import { cn } from "@/lib/utils";

import { canonicalUrl } from "@/features/i18n/seo";
export const Route = createFileRoute("/help/")({
  // `q` prefills the search box when arriving from a sub-header search on a
  // topic/article page (issue #500: persistent Help search), so the index
  // immediately renders the results view.
  validateSearch: z.object({
    // TanStack JSON-decodes search params, so a hand-typed /help?audience=1
    // arrives as a number and a bare z.enum would 500 on the cold URL
    // (GLM review round 2, verified against /tutors?q=123). Invalid values
    // fall back to the defaults instead of rejecting the navigation.
    audience: z
      .preprocess(
        (v) => (v === "tutors" || v === "parents" ? v : undefined),
        z.enum(["tutors", "parents"]).optional(),
      )
      .optional(),
    // `q` prefills the search box when arriving from a sub-header search on a
    // topic/article page (issue #500: persistent Help search), so the index
    // immediately renders the results view. Numbers/booleans are stringified
    // so /help?q=123 renders search results instead of a 500.
    q: z
      .preprocess(
        (v) => (typeof v === "number" || typeof v === "boolean" ? String(v) : v),
        z.string().optional(),
      )
      .optional(),
  }),
  head: () => ({
    meta: [
      { title: "Help Centre | MatchMax" },
      {
        name: "description",
        content:
          "Guides and answers for MatchMax tutors and parents, parent communication, scheduling, pedagogy, payments, policies, and getting started with lessons.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Help Centre | MatchMax" },
      {
        property: "og:description",
        content:
          "Guides and answers for MatchMax tutors and parents, communication, scheduling, pedagogy, payments, and policies.",
      },
      { property: "og:url", content: canonicalUrl("/help") },
    ],
  }),
  component: HelpCentrePage,
});

type AudienceTab = "tutors" | "parents";

/** Quick-link chips that swap with the audience pill (issue #500, copy lock). */
const QUICK_CHIPS: Record<AudienceTab, { key: string; to: { category: string; slug: string } }[]> =
  {
    tutors: [
      {
        key: "help.chip_tutor_fee",
        to: { category: "payments-policies", slug: "admin-fee-structure" },
      },
      {
        key: "help.chip_tutor_intro",
        to: { category: "parent-communication", slug: "introduce-yourself-whatsapp" },
      },
      {
        key: "help.chip_tutor_dates",
        to: { category: "scheduling-logistics", slug: "coordinate-lesson-dates" },
      },
    ],
    parents: [
      {
        key: "help.chip_parent_match",
        to: { category: "parent-getting-started", slug: "request-a-tutor-and-get-matched" },
      },
      {
        key: "help.chip_parent_pay",
        to: {
          category: "parent-payments",
          slug: "understand-zero-parent-commission-and-tutor-admin-fees",
        },
      },
      {
        key: "help.chip_parent_first",
        to: { category: "parent-scheduling", slug: "prepare-for-your-first-lesson" },
      },
    ],
  };

function QuickChips({ activeTab }: { activeTab: AudienceTab }) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-2">
      <span className="mr-1 text-sm text-muted-foreground">{t("help.chips_label")}</span>
      {QUICK_CHIPS[activeTab].map((chip) => (
        <Link
          key={chip.key}
          to="/help/$category/$slug"
          params={{ category: chip.to.category, slug: chip.to.slug }}
          className="inline-flex h-9 items-center rounded-full border border-border bg-[color:var(--surface)] px-4 text-sm font-medium text-foreground transition-colors hover:bg-[color:var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:outline-none"
        >
          {t(chip.key)}
        </Link>
      ))}
    </div>
  );
}

function TopicCategoryCard({
  categorySlug,
  articles,
}: {
  categorySlug: string;
  articles: HelpArticle[];
}) {
  const category = getHelpCategory(categorySlug);
  if (!category) return null;
  const Icon = getHelpIcon(category.icon);

  return (
    <section className="rounded-[26px] border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 shrink-0 text-[color:var(--brand-link)]" aria-hidden="true" />
        <h3 className="text-base font-bold leading-snug tracking-tight text-foreground">
          {category.name}
        </h3>
      </div>
      <ul className="mt-3">
        {articles.map((article, index) => (
          <li key={article.slug} className={cn("py-3", index > 0 && "border-t border-border")}>
            <HelpArticleLink article={article} className="group block">
              <span className="text-sm font-semibold leading-6 text-foreground underline decoration-[color:var(--ink)]/20 underline-offset-4 transition-colors group-hover:text-[color:var(--brand-link)] group-hover:decoration-[color:var(--brand-link)]">
                {article.title}
              </span>
              <span className="mt-1 line-clamp-2 block text-sm leading-6 text-muted-foreground">
                {article.summary}
              </span>
            </HelpArticleLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SearchResults({ query, results }: { query: string; results: HelpArticle[] }) {
  const { t } = useTranslation();

  return (
    <section className="mx-auto w-full max-w-[1600px] px-5 py-12 sm:px-8 lg:px-12">
      <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {results.length > 0 ? t("help.results_title") : t("help.no_results_title", { query })}
      </h2>
      {results.length > 0 ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("help.results_summary", { total: results.length, query })}
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((article) => {
              const categoryName = getHelpCategory(article.category)?.name;
              return (
                <HelpArticleLink
                  key={article.slug}
                  article={article}
                  className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-[color:var(--foreground)]/25"
                >
                  <span className="text-sm font-bold leading-snug tracking-tight text-foreground underline decoration-[color:var(--ink)]/20 underline-offset-4 transition-colors group-hover:text-[color:var(--brand-link)] group-hover:decoration-[color:var(--brand-link)]">
                    {article.title}
                  </span>
                  <span className="mt-2 line-clamp-2 block text-sm leading-6 text-muted-foreground">
                    {article.summary}
                  </span>
                  {categoryName ? (
                    <span className="mt-3 inline-block text-[11px] font-medium text-muted-foreground/80">
                      {categoryName}
                    </span>
                  ) : null}
                </HelpArticleLink>
              );
            })}
          </div>
        </>
      ) : (
        <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
          {t("help.no_results_body")}
        </p>
      )}
    </section>
  );
}

function HelpCentrePage() {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const { audience, q } = Route.useSearch();
  const urlQuery = q ?? "";
  // The URL is the source of truth for the active query (article pages link
  // here with ?q=); the draft keeps typing snappy and the URL honest.
  const [query, setQueryDraft] = useState(urlQuery);
  const supportHref = useSupportWhatsAppHref();

  // Tutors land on the tutor tab; everyone else on the parents tab.
  const activeTab: AudienceTab = audience ?? (hasRole("tutor") ? "tutors" : "parents");
  const contentAudience = activeTab === "tutors" ? "tutor" : "parent";

  useEffect(() => {
    setQueryDraft(urlQuery);
  }, [urlQuery]);
  const setQuery = (value: string) => {
    setQueryDraft(value);
    void navigate({
      to: "/help",
      search: {
        audience,
        q: value.trim() ? value : undefined,
      },
      replace: true,
    });
  };

  const setTab = (tab: AudienceTab) => {
    // The parents tab is the default, so it clears the param for clean URLs.
    // An active search survives the switch (GLM review round 2: the results
    // view and the URL must not diverge) — results just re-filter.
    navigate({
      to: "/help",
      search: {
        audience: tab === "tutors" ? ("tutors" as const) : undefined,
        q: query.trim() ? query : undefined,
      },
      replace: true,
    });
  };

  const topics = useMemo(() => getHelpTopics(contentAudience), [contentAudience]);
  const results = useMemo(
    () => searchHelpArticles(query, contentAudience),
    [query, contentAudience],
  );
  const isSearching = query.trim().length > 0;

  return (
    <PublicPage>
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-3xl px-5 pt-14 pb-10 text-center sm:pt-20 sm:pb-12">
          <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {t("help.title")}
          </h1>

          <form
            role="search"
            onSubmit={(event) => event.preventDefault()}
            className="relative mx-auto mt-8 max-w-xl"
          >
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("help.search_placeholder")}
              aria-label={t("help.search_label")}
              className="h-14 w-full rounded-full border border-[color:var(--ink)]/15 bg-[color:var(--surface)] pl-6 pr-20 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-[color:var(--brand-link)]"
            />
            {isSearching ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("help.clear_search")}
                className="absolute right-[4.25rem] top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[color:var(--foreground)]/[0.06] hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="submit"
              aria-label={t("help.search_label")}
              className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[color:var(--brand-link)] text-white transition-colors hover:bg-[color:var(--brand-link)]/85"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </button>
          </form>

          <div
            role="tablist"
            aria-label={t("help.tabs_label")}
            className="mt-7 inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-border bg-[color:var(--surface-subtle)] p-1"
          >
            {(
              [
                ["tutors", t("help.tab_tutors")],
                ["parents", t("help.tab_parents")],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                role="tab"
                type="button"
                aria-selected={activeTab === tab}
                onClick={() => setTab(tab)}
                className={cn(
                  "relative isolate h-9 shrink-0 whitespace-nowrap rounded-full px-5 text-sm font-semibold transition-colors",
                  activeTab === tab
                    ? "text-[color:var(--background)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {activeTab === tab ? (
                  <motion.span
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 rounded-full bg-[color:var(--foreground)]"
                    initial={false}
                    layoutId="help-audience-pill"
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 420, damping: 32 }
                    }
                  />
                ) : null}
                {label}
              </button>
            ))}
          </div>
          <QuickChips activeTab={activeTab} />
        </div>
      </section>

      {isSearching ? (
        <SearchResults query={query.trim()} results={results} />
      ) : (
        <section className="mx-auto w-full max-w-[1600px] px-5 py-12 sm:px-8 lg:px-12">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("help.topics_title")}
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map(({ category, articles }) => (
              <TopicCategoryCard
                key={category.slug}
                categorySlug={category.slug}
                articles={articles}
              />
            ))}
          </div>
        </section>
      )}

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto w-full max-w-2xl px-5 py-16 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card">
            <LifeBuoy className="h-6 w-6 text-[color:var(--brand-link)]" aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("help.contact_title")}
          </h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">{t("help.contact_body")}</p>
          {supportHref ? (
            <a
              href={supportHref}
              target="_blank"
              rel="noreferrer"
              className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[color:var(--brand-whatsapp)] px-7 text-[15px] font-semibold text-white transition-colors hover:bg-[color:var(--brand-whatsapp-hover)]"
            >
              <WhatsAppIcon className="h-5 w-5" aria-hidden="true" />
              {t("help.contact_cta")}
            </a>
          ) : null}
          <p className="mt-5 text-sm text-muted-foreground">
            <a
              href="mailto:contact@matchmax.hk?subject=MatchMax%20platform%20feedback"
              className="font-semibold text-foreground underline decoration-[color:var(--ink)]/20 underline-offset-4 transition-colors hover:text-[color:var(--brand-link)] hover:decoration-[color:var(--brand-link)]"
            >
              {t("help.feedback_link")}
            </a>
          </p>
        </div>
      </section>
    </PublicPage>
  );
}
