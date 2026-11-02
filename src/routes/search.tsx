import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { GlobalSearchInput } from "@/features/search/global-search-input";
import {
  SEARCH_SCOPES,
  globalSearch,
  type SearchGroups,
  type SearchHit,
  type SearchScope,
} from "@/features/search/search.functions";

const searchSchema = z.object({
  q: z.string().max(120).optional().catch(undefined),
  tag: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]))
    .catch(undefined),
  scope: z.enum(SEARCH_SCOPES).optional().catch(undefined),
});

/**
 * #553: the dedicated results page (SoT). Grouped Tutors · Notes · Cases ·
 * Centres · Users (Posts hidden until #549 ships posts), type badges,
 * "Matched on" footnotes, removable #tag chips and All / Tutors / Notes
 * scope pills shared with the landing hero.
 */
export const Route = createFileRoute("/search")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [{ title: "Search | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: SearchPage,
});

const GROUP_ORDER: (keyof SearchGroups)[] = ["tutors", "notes", "cases", "centres", "users"];
const SKELETON_ROWS = [0, 1, 2];

function ResultRow({ hit, group }: { hit: SearchHit; group: keyof SearchGroups }) {
  const { t } = useTranslation();
  return (
    <li>
      <a
        href={hit.href}
        className="flex flex-col gap-1 rounded-2xl border border-border px-4 py-3 transition-colors hover:bg-[color:var(--foreground)]/[0.03]"
      >
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-[color:var(--foreground)]/[0.07] px-2 py-0.5 text-[11px] font-semibold">
            {t(`global_search.badge_${group}`)}
          </span>
          <span className="text-sm font-semibold text-[color:var(--ink)]">{hit.title}</span>
        </span>
        {hit.subtitle && <span className="text-xs text-muted-foreground">{hit.subtitle}</span>}
        {hit.matchedOn.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {t("global_search.matched_on", { fields: hit.matchedOn.join(", ") })}
          </span>
        )}
      </a>
    </li>
  );
}

function SearchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { q = "", tag = [], scope = "all" } = Route.useSearch();
  const hasQuery = q.trim().length > 0 || tag.length > 0;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["global-search", q, tag, scope],
    queryFn: () => globalSearch({ data: { q, tags: tag, scope } }),
    enabled: hasQuery,
  });

  const setSearch = (patch: { tag?: string[]; scope?: SearchScope }) => {
    const nextTags = patch.tag ?? tag;
    void navigate({
      to: "/search",
      search: {
        q: q || undefined,
        tag: nextTags.length ? nextTags : undefined,
        scope: patch.scope ?? scope,
      },
    });
  };

  const groups = data ? GROUP_ORDER.filter((g) => data.groups[g].length > 0) : [];
  const total = groups.reduce((n, g) => n + (data?.groups[g].length ?? 0), 0);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-8">
        <h1 className="text-2xl font-bold">{t("global_search.title")}</h1>
        <GlobalSearchInput initialQuery={q} tags={tag} scope={scope} />
        <div className="flex flex-wrap items-center gap-2">
          {SEARCH_SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={scope === s}
              onClick={() => setSearch({ scope: s })}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                scope === s
                  ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-background"
                  : "border-border",
              )}
            >
              {t(`global_search.scope_${s}`)}
            </button>
          ))}
          {tag.map((tg) => (
            <button
              key={tg}
              type="button"
              onClick={() => setSearch({ tag: tag.filter((x) => x !== tg) })}
              className="flex items-center gap-1 rounded-full border border-border bg-[color:var(--foreground)]/[0.05] px-3 py-1 text-sm"
              aria-label={t("global_search.remove_tag", { tag: tg })}
            >
              #{tg} <X className="h-3 w-3" aria-hidden />
            </button>
          ))}
        </div>

        {!hasQuery && <p className="text-sm text-muted-foreground">{t("global_search.hint")}</p>}
        {hasQuery && isLoading && (
          <div className="space-y-2">
            {SKELETON_ROWS.map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        )}
        {isError && <p className="text-sm text-destructive">{t("global_search.error")}</p>}
        {data && total === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("global_search.empty", { query: [q, ...tag.map((x) => `#${x}`)].join(" ").trim() })}
          </p>
        )}
        {groups.map((g) => (
          <section key={g} className="space-y-2">
            <h2 className="text-base font-semibold">{t(`global_search.group_${g}`)}</h2>
            <ul className="space-y-2">
              {data?.groups[g].map((h) => (
                <ResultRow key={h.id} hit={h} group={g} />
              ))}
            </ul>
          </section>
        ))}
        {data && total > 0 && (
          <p className="text-xs text-muted-foreground">
            <Link to="/tutors" className="underline">
              {t("global_search.refine_tutors")}
            </Link>
          </p>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
