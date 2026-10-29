import { createFileRoute, Link, notFound, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowUp, Check, ChevronRight, Clock3, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";

import { PageBackButton } from "@/components/layout/page-back-button";
import { PublicPage } from "@/components/layout/PublicPage";
import { WhatsAppIcon } from "@/components/layout/WhatsAppFloatButton";
import {
  HelpArticleLink,
  HelpMarkdown,
  extractHelpToc,
  useSupportWhatsAppHref,
} from "@/features/help/components";
import {
  getHelpArticle,
  getHelpCategory,
  HELP_ARTICLES,
  type HelpArticle,
} from "@/features/help/content";
import { cn } from "@/lib/utils";
import { canonicalUrl } from "@/features/i18n/seo";

// Issue #500: the old handbook hub page folds into the tutor Help tab.
// Old bookmarks to /help/tutor-guide/tutor-handbook land on the tutor index.
export const Route = createFileRoute("/help/$category/$slug")({
  beforeLoad: ({ params }) => {
    if (params.category === "tutor-guide" && params.slug === "tutor-handbook") {
      throw redirect({ to: "/help", search: { audience: "tutors" }, statusCode: 301 });
    }
    const article = getHelpArticle(params.category, params.slug);
    if (!article) throw notFound();
    // Published topics that already have a home elsewhere link straight there.
    if (article.external) throw redirect({ href: article.external, statusCode: 301 });
  },
  head: ({ match }) => {
    const article = getHelpArticle(match.params.category, match.params.slug);
    if (!article) return { meta: [{ title: "Help Centre | MatchMax" }] };
    const path = `/help/${article.category}/${article.slug}`;
    return {
      meta: [
        { title: `${article.title} | MatchMax Help Centre` },
        { name: "description", content: article.summary },
        { name: "robots", content: article.status === "draft" ? "noindex" : "index, follow" },
        { property: "og:title", content: `${article.title} | MatchMax Help Centre` },
        { property: "og:description", content: article.summary },
        { property: "og:url", content: canonicalUrl(path) },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "TechArticle",
            headline: article.title,
            description: article.summary,
            author: { "@type": "Organization", name: "MatchMax Team" },
            publisher: {
              "@type": "Organization",
              name: "MatchMax",
              url: "https://matchmax.hk",
            },
            url: canonicalUrl(path),
            dateModified: article.updated,
            inLanguage: "en",
          }),
        },
      ],
    };
  },
  component: HelpArticlePage,
});

/** "Updated Oct 2026" from a YYYY-MM-DD frontmatter date (deterministic format). */
function formatUpdated(date: string | undefined): string | undefined {
  if (!date) return undefined;
  const match = /^(\d{4})-(\d{2})/.exec(date);
  if (!match) return undefined;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthIndex = Number.parseInt(match[2], 10) - 1;
  if (monthIndex < 0 || monthIndex > 11) return undefined;
  return `${months[monthIndex]} ${match[1]}`;
}

/** "Did this help?" feedback row (issue #500). Local state only, no tracking. */
function DidThisHelp() {
  const { t } = useTranslation();
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);

  if (answer) {
    return (
      <div className="mt-12 flex items-center gap-2 rounded-[18px] border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
        <Check className="h-4 w-4 text-[color:var(--brand-link)]" aria-hidden="true" />
        {t("help.did_help_thanks")}
      </div>
    );
  }

  return (
    <div className="mt-12 rounded-[18px] border border-border bg-card px-5 py-4">
      <p className="text-sm font-semibold text-foreground">{t("help.did_help_title")}</p>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setAnswer("yes")}
          className="inline-flex h-9 items-center rounded-full border border-[color:var(--foreground)]/15 bg-[color:var(--surface)] px-4 text-sm font-semibold text-foreground transition-colors hover:bg-[color:var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:outline-none"
        >
          {t("help.did_help_yes")}
        </button>
        <button
          type="button"
          onClick={() => setAnswer("no")}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[color:var(--foreground)]/15 bg-[color:var(--surface)] px-4 text-sm font-semibold text-foreground transition-colors hover:bg-[color:var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:outline-none"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          {t("help.did_help_no")}
        </button>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("help.did_help_hint")}</p>
    </div>
  );
}

/**
 * Persistent Help sub-header search on article pages (issue #500 §B): a
 * compact pill matching the index hero anatomy. Submitting hands the query
 * to the Help index via ?q=, which renders the full results view there.
 */
function HelpSubHeaderSearch({ audience }: { audience?: "tutors" }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    navigate({
      to: "/help",
      search: trimmed
        ? { q: trimmed, ...(audience ? { audience } : {}) }
        : audience
          ? { audience }
          : {},
    });
  };

  return (
    <form role="search" onSubmit={submit} className="relative mt-5">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("help.search_placeholder")}
        aria-label={t("help.search_label")}
        className="h-11 w-full rounded-full border border-border bg-[color:var(--surface)] pl-5 pr-12 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-[color:var(--brand-link)]"
      />
      <button
        type="submit"
        aria-label={t("help.search_label")}
        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[color:var(--brand-link)] text-white transition-colors hover:bg-[color:var(--brand-link)]/85"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
      </button>
    </form>
  );
}

function HelpArticlePage() {
  const { t } = useTranslation();
  const params = Route.useParams();
  const supportHref = useSupportWhatsAppHref();
  const article = getHelpArticle(params.category, params.slug);
  if (!article) return null; // Guarded by beforeLoad; keeps narrowing for TS.

  const category = getHelpCategory(article.category);
  const toc = extractHelpToc(article.body);
  const related = HELP_ARTICLES.filter(
    (entry) =>
      entry.status === "published" &&
      entry.category === article.category &&
      entry.slug !== article.slug,
  ).slice(0, 4);
  const readingMinutes = Math.max(1, Math.round(article.body.split(/\s+/).length / 200));
  const updated = formatUpdated(article.updated);

  return (
    <PublicPage>
      <div className="mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6 lg:hidden">
        <PageBackButton fallbackTo="/help" />
      </div>

      <nav aria-label="Breadcrumb" className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6">
        <ol className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
          <li>
            <Link
              to="/help"
              className="font-medium transition-colors hover:text-[color:var(--brand-link)]"
            >
              {t("help.breadcrumb_home")}
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          {category ? (
            <>
              <li className="whitespace-nowrap">{category.name}</li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
            </>
          ) : null}
          <li aria-current="page" className="min-w-0 truncate font-semibold text-foreground">
            {article.title}
          </li>
        </ol>
      </nav>

      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        {/* Issue #500: tutor-audience articles search with the tutor tab preselected. */}
        <HelpSubHeaderSearch audience={article.audience === "tutor" ? "tutors" : undefined} />
      </div>

      <article id="top" className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <header>
          {category ? (
            <p className="text-sm font-medium text-[color:var(--brand-link)]">{category.name}</p>
          ) : null}
          <h1 className="mt-2 text-balance text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            {article.title}
          </h1>
          <p className="mt-3 text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            {article.summary}
          </p>
          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <Clock3 className="h-4 w-4" aria-hidden="true" />
            <span>
              {t("help.byline_author")} · {t("help.reading_time", { minutes: readingMinutes })}
            </span>
            {updated ? <span>· {t("help.byline_updated", { date: updated })}</span> : null}
          </p>
        </header>

        {toc.length > 0 ? (
          <nav
            aria-label={t("help.toc_inline_title")}
            className="mt-8 rounded-[18px] border border-border bg-card px-5 py-4"
          >
            <p className="text-[11px] font-medium text-muted-foreground">
              {t("help.toc_inline_title")}
            </p>
            <ul className="mt-2 space-y-1.5">
              {toc.map((entry) => (
                <li key={entry.id}>
                  <a
                    href={`#${entry.id}`}
                    className={cn(
                      "text-sm leading-6 text-[color:var(--brand-link)] underline decoration-transparent underline-offset-4 transition-colors hover:decoration-[color:var(--brand-link)]",
                      entry.level === 3 && "pl-4",
                    )}
                  >
                    {entry.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <div className="mt-8 space-y-5">
          <HelpMarkdown>{article.body}</HelpMarkdown>
        </div>

        <div className="mt-10 flex justify-end">
          <a
            href="#top"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-[color:var(--brand-link)]"
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
            {t("help.back_to_top")}
          </a>
        </div>

        <DidThisHelp />

        {related.length > 0 ? (
          <section className="mt-12 border-t border-border pt-8">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              {t("help.related_title")}
            </h2>
            <ul className="mt-4">
              {related.map((entry, index) => (
                <li key={entry.slug} className={cn("py-3", index > 0 && "border-t border-border")}>
                  <HelpArticleLink article={entry} className="group block">
                    <span className="text-sm font-semibold leading-6 text-foreground underline decoration-[color:var(--ink)]/20 underline-offset-4 transition-colors group-hover:text-[color:var(--brand-link)] group-hover:decoration-[color:var(--brand-link)]">
                      {entry.title}
                    </span>
                  </HelpArticleLink>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-12 rounded-[26px] border border-border bg-muted/40 p-6 sm:p-8">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {t("help.contact_title")}
          </h2>
          <p className="mt-2 max-w-xl text-base leading-7 text-muted-foreground">
            {t("help.contact_body")}
          </p>
          <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            {supportHref ? (
              <a
                href={supportHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 font-semibold text-foreground underline decoration-[color:var(--ink)]/20 underline-offset-4 transition-colors hover:text-[color:var(--brand-link)] hover:decoration-[color:var(--brand-link)]"
              >
                <WhatsAppIcon className="h-4 w-4" aria-hidden="true" />
                {t("help.contact_cta")}
              </a>
            ) : null}
            <a
              href="mailto:contact@matchmax.hk?subject=MatchMax%20platform%20feedback"
              className="font-semibold text-foreground underline decoration-[color:var(--ink)]/20 underline-offset-4 transition-colors hover:text-[color:var(--brand-link)] hover:decoration-[color:var(--brand-link)]"
            >
              {t("help.feedback_link")}
            </a>
          </p>
        </section>
      </article>
    </PublicPage>
  );
}
