import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { ChevronRight, Clock3, LifeBuoy } from "lucide-react";
import { useTranslation } from "react-i18next";

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

export const Route = createFileRoute("/help/$category/$slug")({
  beforeLoad: ({ params }) => {
    const article = getHelpArticle(params.category, params.slug);
    if (!article) throw notFound();
    // Published topics that already have a home elsewhere link straight there.
    if (article.external) throw redirect({ href: article.external });
  },
  head: ({ match }) => {
    const article = getHelpArticle(match.params.category, match.params.slug);
    if (!article) return { meta: [{ title: "Help Centre | MatchMax" }] };
    return {
      meta: [
        { title: `${article.title} | MatchMax Help Centre` },
        { name: "description", content: article.summary },
        { name: "robots", content: article.status === "draft" ? "noindex" : "index, follow" },
        { property: "og:title", content: `${article.title} | MatchMax Help Centre` },
        { property: "og:description", content: article.summary },
        {
          property: "og:url",
          content: `https://matchmax.hk/help/${article.category}/${article.slug}`,
        },
      ],
    };
  },
  component: HelpArticlePage,
});

function audienceLabel(audience: HelpArticle["audience"]): string {
  switch (audience) {
    case "tutor":
      return "help.audience_tutor";
    case "all":
      return "help.audience_all";
    default:
      return "help.audience_parent";
  }
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
    (entry) => entry.category === article.category && entry.slug !== article.slug,
  ).slice(0, 4);
  const readingMinutes = Math.max(1, Math.round(article.body.split(/\s+/).length / 200));
  const isDraft = article.status === "draft";

  return (
    <PublicPage>
      <div className="mx-auto w-full max-w-6xl px-4 pt-5 sm:px-6 lg:hidden">
        <PageBackButton fallbackTo="/help" />
      </div>

      <nav aria-label="Breadcrumb" className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
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

      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
        <nav aria-label={t("help.toc_title")} className="hidden lg:block">
          {toc.length > 0 ? (
            <div className="sticky top-24">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {t("help.toc_title")}
              </p>
              <ul className="mt-4 space-y-1">
                {toc.map((entry) => (
                  <li key={entry.id}>
                    <a
                      href={`#${entry.id}`}
                      className={cn(
                        "-ml-4 block border-l-2 py-2 text-sm leading-6 transition-colors",
                        entry.level === 3 && "pl-7",
                        entry.level === 2 && "pl-4",
                        "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {entry.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </nav>

        <article className="min-w-0">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              {category ? (
                <span className="rounded-full border border-border px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {category.name}
                </span>
              ) : null}
              <span className="rounded-full border border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/5 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[color:var(--brand-link)]">
                {t(audienceLabel(article.audience))}
              </span>
            </div>
            <h1 className="mt-4 text-balance text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl">
              {article.title}
            </h1>
            <p className="mt-3 text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
              {article.summary}
            </p>
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              {isDraft
                ? t("help.coming_soon_badge")
                : t("help.reading_time", {
                    minutes: readingMinutes,
                  })}
            </p>
          </header>

          {isDraft ? (
            <div className="mt-8 rounded-2xl border border-dashed border-[color:var(--ink)]/25 bg-muted/50 p-6 sm:p-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card">
                <LifeBuoy className="h-5 w-5 text-[color:var(--brand-link)]" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-xl font-extrabold tracking-tight text-foreground">
                {t("help.coming_soon_title")}
              </h2>
              <p className="mt-2 max-w-xl text-base leading-7 text-muted-foreground">
                {t("help.coming_soon_body")}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  to="/help"
                  className="inline-flex h-10 items-center rounded-full border border-[color:var(--foreground)]/15 bg-[color:var(--surface)] px-5 text-sm font-semibold text-foreground transition-colors hover:bg-[color:var(--foreground)]/[0.04]"
                >
                  {t("help.back_to_help")}
                </Link>
                {supportHref ? (
                  <a
                    href={supportHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-[color:var(--brand-whatsapp)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--brand-whatsapp-hover)]"
                  >
                    <WhatsAppIcon className="h-4 w-4" aria-hidden="true" />
                    {t("help.contact_cta")}
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-8 space-y-5">
              <HelpMarkdown>{article.body}</HelpMarkdown>
            </div>
          )}

          {related.length > 0 ? (
            <section className="mt-12 border-t border-border pt-8">
              <h2 className="text-lg font-extrabold tracking-tight text-foreground">
                {t("help.related_title")}
              </h2>
              <ul className="mt-4">
                {related.map((entry, index) => (
                  <li
                    key={entry.slug}
                    className={cn("py-3", index > 0 && "border-t border-border")}
                  >
                    <HelpArticleLink article={entry} className="group block">
                      <span className="text-sm font-semibold leading-6 text-foreground underline decoration-[color:var(--ink)]/20 underline-offset-4 transition-colors group-hover:text-[color:var(--brand-link)] group-hover:decoration-[color:var(--brand-link)]">
                        {entry.title}
                      </span>
                    </HelpArticleLink>
                    {entry.status === "draft" ? (
                      <span className="mt-1 inline-block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/80">
                        {t("help.coming_soon_badge")}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-12 rounded-2xl border border-border bg-muted/40 p-6 sm:p-8">
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">
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
      </div>
    </PublicPage>
  );
}
